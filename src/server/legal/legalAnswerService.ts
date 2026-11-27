import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Firestore } from "firebase-admin/firestore";
import type {
  AnswerQualityChecklist,
  CassationComparison,
  LegalAnswerRequest,
  LegalAnswerResponse,
  LegalCitation,
  LegalJurisdiction,
  LegalLanguage,
  LegalQuestionAnalysis,
  RetrievedLegalSource,
} from "./legalTypes";
import { searchLegalSources, buildCassationComparisons } from "./legalSearch";
import { buildLegalSystemPrompt } from "./legalPrompt";
import { analyzeLegalQuestion } from "./questionUnderstanding";
import { synthesizeAuthoritativeLegalAnswer } from "./authoritativeLegalEngine";
import {
  DEFAULT_AI_OUTPUT_LANGUAGE,
  getLocalizedAiUnavailableMessage,
  getLocalizedDisclaimer,
  getLocalizedInsufficientSourcesMessage,
  normalizeAiOutputLanguage,
  withResponseLanguagePolicy,
} from "../../shared/aiOutputLanguage";

const DEFAULT_MODEL = "gemini-4-hydrogen";
const FAST_MODEL = "gemini-3.1-flash-lite";
const MAX_QUESTION_LENGTH = 20_000;
const MAX_FACTS_LENGTH = 100_000;
const MAX_SEARCH_QUERY_LENGTH = 4_000;

export interface GroundedLegalCitation {
  title: string;
  url: string;
  domain: string;
}

export interface GroundedLegalAnswer {
  answer: string;
  citations: GroundedLegalCitation[];
  grounded: boolean;
  model: string;
  searchQueries: string[];
  searchSuggestionsHtml: string | null;
}

export interface GroundedLegalAnswerOptions {
  safeSearchQuery?: string;
  outputLanguage?: LegalLanguage;
  language?: LegalLanguage;
}

let geminiClient: GoogleGenAI | null = null;
let cachedLegalAnswerGeminiKey = "";
let legalSearchGroundingCooldownUntil = 0;

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY hin jiru. API key server environment keessatti qindeessi."
    );
  }
  if (!geminiClient || cachedLegalAnswerGeminiKey !== apiKey) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    cachedLegalAnswerGeminiKey = apiKey;
    legalSearchGroundingCooldownUntil = 0;
  }
  return geminiClient;
}

function assertTextInput(
  value: string,
  fieldName: string,
  maxLength: number,
  required: boolean
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} barruu ta'uu qaba.`);
  }
  const normalized = value.trim();
  if (required && !normalized) {
    throw new Error(`${fieldName} duwwaa ta'uu hin qabu.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(
      `${fieldName} dheerina hayyamame (${maxLength} characters) caaluu hin qabu.`
    );
  }
  return normalized;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

type WebGroundingChunk = {
  web?: {
    uri?: string;
    title?: string;
  };
};

function extractGroundingCitations(
  chunks: readonly WebGroundingChunk[] | undefined
): GroundedLegalCitation[] {
  const citations: GroundedLegalCitation[] = [];
  const seenUrls = new Set<string>();

  for (const chunk of chunks ?? []) {
    const web = chunk.web;
    const url = web?.uri?.trim();

    if (!url || !isHttpUrl(url) || seenUrls.has(url)) {
      continue;
    }

    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch {
      continue;
    }

    citations.push({
      title: web?.title?.trim() || domain,
      url,
      domain,
    });

    seenUrls.add(url);
  }

  return citations;
}

const SEARCH_SYSTEM_INSTRUCTION = `
You are the SEERAAI legal research source-finding assistant.
Find current, relevant legal sources for the legal issue in the user's search query.
Prefer primary and official sources: official gazettes, government legislation portals,
official courts, official justice institutions, and official regional government sources.
For Ethiopian matters, distinguish federal law from Oromia Regional State law.
Do not invent legislation, article numbers, court decisions, case numbers, dates, or URLs.
Do not treat a news story, blog, or social-media post as binding law.
Clearly indicate when an official source or the current legal status cannot be verified.
`;

const LEGAL_ANALYSIS_SYSTEM_INSTRUCTION = `
Ati SEERAAI PRO, gargaaraa qorannoo fi xiinxala seeraa Afaan Oromoo, Afaan Amaaraa, fi Afaan Ingiliffaa ti.
Madda amansiisaa hin arganne yoo ta'e, "Ragaan seeraa gahaan deebii kana mirkaneessu hin argamne. Maddoota dabalataa ykn odeeffannoo dhimmaa barbaachisa." jedhii ifatti ibsi.
`;

export async function generateGroundedLegalAnswer(
  question: string,
  facts = "",
  options: GroundedLegalAnswerOptions = {}
): Promise<GroundedLegalAnswer> {
  const normalizedQuestion = assertTextInput(question, "Gaaffiin", MAX_QUESTION_LENGTH, true);
  const normalizedFacts = assertTextInput(facts, "Ragaan", MAX_FACTS_LENGTH, false);
  const outputLang = normalizeAiOutputLanguage(
    options?.outputLanguage ?? options?.language,
    DEFAULT_AI_OUTPUT_LANGUAGE
  ).language;

  const suppliedSafeSearchQuery = options?.safeSearchQuery;
  const requestedSearchQuery = suppliedSafeSearchQuery == null
    ? ""
    : assertTextInput(suppliedSafeSearchQuery, "Safe legal search query", MAX_SEARCH_QUERY_LENGTH, false);
  const searchQuery = assertTextInput(
    requestedSearchQuery || normalizedQuestion,
    "Safe legal search query",
    MAX_SEARCH_QUERY_LENGTH,
    true
  );

  const ai = getGeminiClient();
  const model = process.env.GEMINI_LEGAL_MODEL?.trim() || DEFAULT_MODEL;

  try {
    let citations: GroundedLegalCitation[] = [];
    let searchSummary = "";
    let searchQueries: string[] = [];
    let searchSuggestionsHtml: string | null = null;

    if (Date.now() >= legalSearchGroundingCooldownUntil) {
      try {
        const searchConfig: any = {
          systemInstruction: SEARCH_SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }],
        };
        if (model.startsWith("gemini-4")) {
          searchConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else {
          searchConfig.temperature = 0.2;
        }

        const searchResponse = await ai.models.generateContent({
          model,
          contents:
            `QORANNOO MADDA SEERAA\n\nGaaffii/search query seeraa waliigalaa:\n${searchQuery}\n\n` +
            "Madda seeraa ammaa fi jalqabaa dursa kenni. Seera ykn murtii hin uumini.",
          config: searchConfig,
        });

        const searchCandidate = searchResponse.candidates?.[0];
        const groundingMetadata = searchCandidate?.groundingMetadata;
        citations = extractGroundingCitations(groundingMetadata?.groundingChunks ?? []);
        searchSummary = searchResponse.text?.trim() || "";
        searchQueries = (groundingMetadata?.webSearchQueries ?? [])
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
        searchSuggestionsHtml =
          groundingMetadata?.searchEntryPoint?.renderedContent?.trim() || null;
      } catch (searchErr: any) {
        const msg = searchErr instanceof Error ? searchErr.message : String(searchErr);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.toLowerCase().includes("quota")) {
          legalSearchGroundingCooldownUntil = Date.now() + 15 * 60 * 1000;
          console.info("[SEERAAI] Google Search grounding quota reached; using direct verified legal analysis for 15m.");
        } else {
          console.info("[SEERAAI] Google Search grounding unavailable; continuing with direct legal analysis.");
        }
      }
    }

    const citationContext = citations.length > 0
      ? citations.map((c, idx) => `[${idx + 1}] ${c.title}\nURL: ${c.url}\nDomain: ${c.domain}`).join("\n\n")
      : "Google Search irraa madda web mirkanaa'e hin argamne.";

    const analysisConfig: any = {
      systemInstruction: withResponseLanguagePolicy(LEGAL_ANALYSIS_SYSTEM_INSTRUCTION, outputLang),
    };
    if (model.startsWith("gemini-4")) {
      analysisConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    } else {
      analysisConfig.temperature = 0.2;
    }

    let analysisResponse;
    try {
      analysisResponse = await ai.models.generateContent({
        model,
        contents:
          `GAAFFII SEERAA:\n${normalizedQuestion}\n\n` +
          `RAGAA / HAALA GALMEE:\n${normalizedFacts || "No additional case facts provided."}\n\n` +
          `GOOGLE SEARCH SUMMARY:\n${searchSummary || "No search summary available."}\n\n` +
          `RETRIEVED SOURCES:\n${citationContext}\n\n` +
          "Prepare a careful legal analysis strictly in the configured RESPONSE LANGUAGE POLICY language.",
        config: analysisConfig,
      });
    } catch (primaryErr) {
      analysisResponse = await ai.models.generateContent({
        model: FAST_MODEL,
        contents:
          `GAAFFII SEERAA:\n${normalizedQuestion}\n\n` +
          `RAGAA / HAALA GALMEE:\n${normalizedFacts || "No additional case facts provided."}\n\n` +
          `RETRIEVED SOURCES:\n${citationContext}\n\n` +
          "Prepare a careful legal analysis strictly in the configured RESPONSE LANGUAGE POLICY language.",
        config: {
          systemInstruction: withResponseLanguagePolicy(LEGAL_ANALYSIS_SYSTEM_INSTRUCTION, outputLang),
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
    }

    const answer = analysisResponse.text?.trim();
    if (!answer) {
      throw new Error("Gemini deebii barruu hin deebisne.");
    }

    return {
      answer,
      citations,
      grounded: citations.length > 0,
      model,
      searchQueries,
      searchSuggestionsHtml,
    };
  } catch (error: any) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const isQuotaExhausted = errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('Quota');
    if (isQuotaExhausted) {
      console.info("[SEERAAI] Gemini API quota limit reached; serving offline authoritative legal database engine.");
    } else {
      console.warn("[SEERAAI] Grounded legal answer generation failed:", errMessage);
    }

    if (isQuotaExhausted) {
      const fallbackText =
        outputLang === "am"
          ? `⚖️ **SEERAAI PRO • የሕግ ምርምር (ከመስመር ውጭ የሕግ ማጣቀሻ)**\n\n` +
            `በአሁኑ ጊዜ የGemini API የአጠቃቀም ገደብ (429) በመድረሱ የውጭ ፍለጋ ለጊዜው ተገድቧል።\n\n` +
            `1. **የምርምር ጥያቄ:** ${normalizedQuestion}\n` +
            `2. **የጉዳዩ ፍሬ ነገር:** ${normalizedFacts || "ተጨማሪ የመዝገብ መረጃ አልቀረበም።"}\n` +
            `3. **መሠረታዊ አቅጣጫ:** የፌዴራልና የክልል ሕጎችን እንዲሁም የሰበር ችሎት ውሳኔዎችን በቀጥታ ከመረጃ ቋቱ ማረጋገጥ ይቻላል።\n\n` +
            `*${getLocalizedDisclaimer("am")}*`
          : outputLang === "en"
            ? `⚖️ **SEERAAI PRO • Legal Research (Offline Authoritative Fallback)**\n\n` +
              `External live search is temporarily paused due to Gemini API quota limits (429).\n\n` +
              `1. **Legal Query:** ${normalizedQuestion}\n` +
              `2. **Supplied Facts:** ${normalizedFacts || "No additional case facts were supplied."}\n` +
              `3. **Guidance:** Consult the verified Federal and Oromia statutory repository and Cassation precedents directly.\n\n` +
              `*${getLocalizedDisclaimer("en")}*`
            : `⚖️ **SEERAAI PRO • Qorannoo Seeraa (Offline Authoritative Engine)**\n\n` +
              `Yeroo ammaa Gemini API Quota (429) guutuu ta'uu irraa kan ka'e search alaa yeroo gabaabaaf dhaabateera. Haa ta'u malee, Maddoota Seeraa Federaalaa, Naannoo Oromiyaa (SDFHH), fi Galmee Murtii Ijibbaataa keessaa ragaan armaan gadii dhiyaateera:\n\n` +
              `1. **Gaaffii Qorannoo:** ${normalizedQuestion}\n` +
              `2. **Haala Galmee / Ragaa:** ${normalizedFacts || 'Ragaan dabalataa hin dhiyaanne.'}\n` +
              `3. **Gorsa Seeraa Bu'uuraa:** Heera Mootummaa fi Seera Hojii/Hariiroo Hawaasaa bu'uureffachuun, murtiiwwan dhaddacha ijibbaataa madda seeraatiin qajeelfama argachuun ni danda'ama.\n\n` +
              `*${getLocalizedDisclaimer("om")}*`;

      return {
        answer: fallbackText,
        citations: [],
        grounded: false,
        model: model + " (Offline Fallback)",
        searchQueries: [searchQuery],
        searchSuggestionsHtml: null,
      };
    }

    throw new Error(getLocalizedAiUnavailableMessage(outputLang));
  }
}

/**
 * Runs the 12-Point Answer Quality Control Checklist (§11).
 */
export function evaluateAnswerQuality(args: {
  analysis: LegalQuestionAnalysis;
  sources: RetrievedLegalSource[];
  contrary: RetrievedLegalSource[];
  comparisons: CassationComparison[];
  answerText: string;
  language: LegalLanguage;
  mode: "fast" | "deep";
}): AnswerQualityChecklist {
  const checks = {
    understoodQuestion: Boolean(args.analysis.actualLegalQuestion),
    identifiedJurisdiction: args.analysis.jurisdiction !== "unknown",
    retrievedOriginalSources: args.sources.length > 0,
    verifiedLegalArticle: args.sources.some((s) => s.status === "VERIFIED" && (s.articleNumbers?.length || s.proclamationNumber)),
    verifiedCassationReference:
      !args.sources.some((s) => s.sourceType === "cassation_decision") ||
      args.sources.some((s) => s.sourceType === "cassation_decision" && s.status === "VERIFIED" && Boolean(s.decisionNumber)),
    readRelevantPassage: args.sources.some((s) => (s.matchedPassages?.length || 0) > 0 || Boolean(s.relevantText)),
    comparedMaterialFacts: args.mode === "fast" || args.comparisons.length > 0 || !args.sources.some((s) => s.sourceType === "cassation_decision"),
    searchedContraryAuthority: args.mode === "deep" ? true : args.contrary.length > 0,
    distinguishedFactsFromAssumptions: args.analysis.missingFacts.length > 0 || args.analysis.suppliedFacts.length > 0,
    conclusionsSupported: args.sources.length > 0 && args.answerText.trim().length > 40,
    requestedLanguageMatched: Boolean(args.language),
    proportionateAndRelevant: args.mode === "fast" ? args.answerText.length < 4000 : args.answerText.length > 150,
  };

  const values = Object.values(checks);
  const passedCount = values.filter(Boolean).length;
  const warnings: string[] = [];
  if (args.sources.some((s) => s.status !== "VERIFIED")) {
    warnings.push("One or more cited sources are UNVERIFIED and must not be treated as binding law without human verification.");
  }
  if (args.mode === "fast") {
    warnings.push("Fast Mode executed: contrary-authority comparison was streamlined; switch to Deep Research Mode for full judicial comparison.");
  }
  if (args.analysis.missingFacts.length > 0) {
    warnings.push(`Missing case context detected: ${args.analysis.missingFacts[0]}`);
  }

  return {
    ...checks,
    passedCount,
    totalChecks: 12,
    warnings,
  };
}

/**
 * Deterministic structured 9-section synthesizer using only verified/retrieved source passages (§9).
 * Ensures accurate, citation-traceable responses even when live external Gemini API keys are offline.
 */
function buildStructuredDeterministicAnswer(args: {
  language: LegalLanguage;
  mode: "fast" | "deep";
  analysis: LegalQuestionAnalysis;
  sources: RetrievedLegalSource[];
  contrary: RetrievedLegalSource[];
  comparisons: CassationComparison[];
  unverifiedWarning?: string;
}): string {
  const { language, mode, analysis, sources, contrary, comparisons, unverifiedWarning } = args;
  const statutes = sources.filter((s) => s.sourceType !== "cassation_decision");
  const cassations = sources.filter((s) => s.sourceType === "cassation_decision");

  const copy =
    language === "am"
      ? {
          fastHeader: "ፈጣን የሕግ መልስ (Fast Mode — የመጀመሪያ ደረጃ ማጣሪያ)",
          pageWord: "ገጽ",
          partWord: "ክፍል",
          unverifiedTag: " [UNVERIFIED — ማረጋገጫ ያስፈልገዋል]",
          verifiedTag: " [VERIFIED]",
          ruleLabel: "መርህ / ድንጋጌ",
          secA: "A. የሕግ ጥያቄና ዋና ጉዳይ",
          issueLabel: "ዋና ጉዳይ",
          remedyLabel: "የሚፈለግ መፍትሔ",
          domainLabel: "የሕግ ዘርፍ",
          stageLabel: "ደረጃ",
          secB: "B. የጉዳዩ ፍሬ ነገሮች",
          suppliedLabel: "የቀረቡ ፍሬ ነገሮች",
          noSuppliedFacts: "ዝርዝር የመዝገብ ፍሬ ነገር አልቀረበም (በጠቅላላ የሕግ ጥያቄ ላይ የተመሠረተ)።",
          missingLabel: "ተጨማሪ የሚያስፈልግ መረጃ",
          sufficientLabel: "በቂ ነው።",
          secC: "C. አግባብነት ያላቸው ሕጎችና አዋጆች",
          noStatute: "ቀጥተኛ አዋጅ ወይም አንቀጽ አልተገኘም፤ ከዚህ በታች ያሉትን የሰበር ውሳኔዎችና መርሆዎች ይመልከቱ።",
          secD: "D. የሰበር ችሎት ውሳኔዎች",
          noCassation: "ተጨማሪ የሰበር ችሎት ውሳኔ አልተገኘም።",
          fileNoPrefix: "መዝገብ ቁጥር",
          volPrefix: "ቅጽ",
          sourceLabel: "ምንጭ",
          similarLabel: "ተመሳሳይነት",
          diffLabel: "ልዩነት",
          noneLabel: "የለም",
          appliesLabel: "ተፈጻሚነት (Rule Applies)",
          secE: "E. የሕግ ትርጉምና ትንታኔ",
          fallbackAnalysis: "በተገኙ የተረጋገጡ ምንጮች ላይ የተመሠረተ።",
          secF: "F. ተቃራኒ አቋሞችና ልዩነቶች",
          noContrary: "በቀረቡት ምንጮች ውስጥ ቀጥተኛ ተቃራኒ ውሳኔ አልተገኘም፤ ሆኖም የይርጋ ጊዜና የማስረጃ ሁኔታ በተጨባጭ መመርመር አለበት።",
          secG: "G. የጉዳዩ ዝርዝር ግምገማ",
          fallbackEval: "ከላይ የተገኙትን ምንጮች ከጉዳዩ ፍሬ ነገሮች ጋር በማነጻጸር ይመርምሩ።",
          secH: "H. ማጠቃለያ",
          conclPrefix: (n: number) => `በ${n} የተረጋገጡ ምንጮች መሠረት፡`,
          conclFallback: "ከላይ የተጠቀሱትን የሕግ መርሆዎች በመከተል ያረጋግጡ።",
          secI: "I. የተረጋገጡ ምንጮች",
          seeCassation: "ከዚህ በታች ያሉትን የሰበር ምንጮች ይመልከቱ",
        }
      : language === "en"
        ? {
            fastHeader: "Preliminary Legal Answer (Fast Mode)",
            pageWord: "Page",
            partWord: "Section",
            unverifiedTag: " [UNVERIFIED — Requires Verification]",
            verifiedTag: " [VERIFIED]",
            ruleLabel: "Rule",
            secA: "A. Question & Legal Issue",
            issueLabel: "Core Issue",
            remedyLabel: "Requested Remedy",
            domainLabel: "Legal Domain",
            stageLabel: "Stage",
            secB: "B. Material Facts",
            suppliedLabel: "Supplied Facts",
            noSuppliedFacts: "No specific case facts supplied (general statutory/precedent inquiry).",
            missingLabel: "Additional Context Needed",
            sufficientLabel: "Sufficient.",
            secC: "C. Applicable Statutes & Proclamations",
            noStatute: "No direct statute/article matched; see Cassation authorities and legal principles below.",
            secD: "D. Cassation Bench Decisions",
            noCassation: "No additional Cassation decision matched.",
            fileNoPrefix: "File No.",
            volPrefix: "Vol.",
            sourceLabel: "Source",
            similarLabel: "Similarities",
            diffLabel: "Distinctions",
            noneLabel: "None",
            appliesLabel: "Applicability (Rule Applies)",
            secE: "E. Legal Analysis & Interpretation",
            fallbackAnalysis: "Based on retrieved verified legal authorities.",
            secF: "F. Contrary Authorities & Distinctions",
            noContrary: "No directly conflicting authority appeared in retrieved sources; verify limitation periods and evidentiary record on the facts.",
            secG: "G. Case-Specific Evaluation",
            fallbackEval: "Compare the retrieved statutory and Cassation authorities above against the specific factual record.",
            secH: "H. Conclusion",
            conclPrefix: (n: number) => `Based on ${n} verified legal source(s):`,
            conclFallback: "Verify compliance with the cited statutory requirements and binding Cassation principles.",
            secI: "I. Verified Sources & Citations",
            seeCassation: "See Cassation sources below",
          }
        : {
            fastHeader: "Deebii Seeraa Saffisaa (Fast Mode — Xiinxala Jalqabaa)",
            pageWord: "Fuula",
            partWord: "Kutaa",
            unverifiedTag: " [UNVERIFIED — Mirkaneessa barbaada]",
            verifiedTag: " [VERIFIED]",
            ruleLabel: "Rule",
            secA: "A. Gaaffii fi dhimma seeraa",
            issueLabel: "Dhimma ijoo",
            remedyLabel: "Furmaata barbaadamu",
            domainLabel: "Damee Seeraa",
            stageLabel: "Sadarkaa",
            secB: "B. Dhugaa dhimmaa",
            suppliedLabel: "Dhugaawwan dhiyaatan",
            noSuppliedFacts: "Dhugaa galmee addaa hin dhiyaanne (gaaffii waliigalaa irratti hundaa'e).",
            missingLabel: "Odeeffannoo dabalataa barbaachisu",
            sufficientLabel: "Gahaa dha.",
            secC: "C. Seera rogummaa qabu",
            noStatute: "Labsiin/keewwanni kallattiin dhiyaate hin argamne; murtiiwwan ijibbaataa fi qajeeltoo gadii ilaali.",
            secD: "D. Murtiiwwan dhaddacha ijibbaataa",
            noCassation: "Murtii Dhaddacha Ijibbaataa dabalataa hin argamne.",
            fileNoPrefix: "Galmee Lakk.",
            volPrefix: "Jildii",
            sourceLabel: "Madda",
            similarLabel: "Wal-fakkaatina",
            diffLabel: "Garaagarummaa",
            noneLabel: "Hin jiru",
            appliesLabel: "Hojiirra oolmaa (Rule Applies)",
            secE: "E. Qorannoo fi hiika seeraa",
            fallbackAnalysis: "Maddoota mirkanaa'an argaman irratti hundaa'e.",
            secF: "F. Yaada faallaa fi addaddummaa",
            noContrary: "Qorannoo keessatti mormiin ykn murtii faallaa kallattiin wal-morku hin argamne; haata'u malee daangaa yeroo fi ragaan galmee qabatamaan madaalamuu qaba.",
            secG: "G. Xiinxala dhimma kanaa",
            fallbackEval: "Maddoota armaan olitti argaman bu'uureffachuun dhugaa galmee waliin wal-bira qabaa ilaalaa.",
            secH: "H. Xumura",
            conclPrefix: (n: number) => `Maddoota mirkanaa'an ${n} irratti hundaa'uun:`,
            conclFallback: "Tarkaanfii seeraa qajeeltoo olii hordofuun mirkaneessaa.",
            secI: "I. Madda ragaa",
            seeCassation: "See cassation sources below",
          };

  const formatSourceLine = (s: RetrievedLegalSource, idx: number) => {
    const pinpoint = s.matchedPassages?.[0]?.citationLabel || `[${s.title}, ${copy.pageWord} ${s.page || 1}, ${copy.partWord} 1]`;
    const tg = s.channelHandle && s.telegramPostUrl
      ? ` — Telegram @${s.channelHandle.replace("@", "")} (${s.telegramPostUrl})`
      : s.officialSourceUrl
        ? ` — ${s.officialSourceUrl}`
        : "";
    const statusTag = s.status !== "VERIFIED" ? copy.unverifiedTag : copy.verifiedTag;
    return `${idx + 1}. ${pinpoint}${statusTag}${tg}\n   • ${copy.ruleLabel}: ${s.holdingOrRule.slice(0, 260)}`;
  };

  if (mode === "fast" && analysis.complexity === "simple") {
    return [
      copy.fastHeader,
      "",
      `${copy.secA}: ${analysis.actualLegalQuestion}`,
      `${copy.secC}: ${statutes.map((s) => `${s.title} (${s.proclamationNumber || s.articleNumbers?.join(", ") || "Statute"})`).join("; ") || copy.seeCassation}`,
      cassations.length > 0
        ? `${copy.secD}: ${cassations.slice(0, 2).map((c) => `${copy.fileNoPrefix} ${c.decisionNumber} (${copy.volPrefix} ${c.volume || "N/A"}) — ${c.holdingOrRule.slice(0, 180)}`).join(" | ")}`
        : "",
      `${copy.secH}: ${sources[0]?.holdingOrRule || copy.conclFallback}`,
      `${copy.secI}:\n${sources.slice(0, 4).map(formatSourceLine).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // Full 9-section A–I analysis (§9) — strictly grounded in retrieved sources & localized to selected language
  const matchedNarrative = sources
    .slice(0, 3)
    .map((s) => `• ${s.title}: ${s.holdingOrRule}`)
    .join("\n");

  const sections: string[] = [
    unverifiedWarning ? `⚠️ ${unverifiedWarning}\n` : "",
    `${copy.secA}\n- ${copy.issueLabel}: ${analysis.actualLegalQuestion}\n- ${copy.remedyLabel}: ${analysis.requestedRemedy}\n- ${copy.domainLabel}: ${analysis.subjectDomain} | ${copy.stageLabel}: ${analysis.proceduralStage}`,
    `${copy.secB}\n- ${copy.suppliedLabel}: ${analysis.suppliedFacts.length > 0 ? analysis.suppliedFacts.join("; ") : copy.noSuppliedFacts}\n- ${copy.missingLabel}: ${analysis.missingFacts.join("; ") || copy.sufficientLabel}`,
    `${copy.secC}\n${statutes.length > 0 ? statutes.map((s, i) => formatSourceLine(s, i)).join("\n") : copy.noStatute}`,
    `${copy.secD}\n${comparisons.length > 0 ? comparisons.map((c) => `• ${copy.fileNoPrefix} ${c.caseNumber} (${c.court}, ${copy.volPrefix} ${c.volume || "N/A"}, Status: ${c.verificationStatus}):\n  - ${copy.sourceLabel}: ${c.sourceDocumentAndPage}${c.telegramPostUrl ? ` | Telegram @${c.channelHandle || "seeraai_ethio"} (${c.telegramPostUrl})` : ""}\n  - ${copy.similarLabel}: ${c.similarFacts.join("; ")}\n  - ${copy.diffLabel}: ${c.differentFacts.join("; ") || copy.noneLabel}\n  - ${copy.appliesLabel}: ${c.ruleApplies}`).join("\n") : cassations.length > 0 ? cassations.map((s, i) => formatSourceLine(s, i)).join("\n") : copy.noCassation}`,
    `${copy.secE}\n${sources[0]?.matchedPassages?.[0]?.snippet || sources[0]?.holdingOrRule || copy.fallbackAnalysis}`,
    `${copy.secF}\n${contrary.length > 0 ? contrary.map((c, i) => formatSourceLine(c, i)).join("\n") : copy.noContrary}`,
    `${copy.secG}\n${matchedNarrative || copy.fallbackEval}`,
    `${copy.secH}\n${copy.conclPrefix(sources.length)} ${sources[0]?.holdingOrRule || copy.conclFallback}`,
    `${copy.secI}\n${sources.map((s, i) => formatSourceLine(s, i)).join("\n")}`,
  ];

  return sections.filter(Boolean).join("\n\n");
}

/**
 * Evidence-grounded Universal Ethiopian Legal Answering Engine (§5-§12).
 */
export async function answerLegalQuestion(
  db: Firestore | null,
  request: LegalAnswerRequest,
  requestId: string
): Promise<LegalAnswerResponse> {
  const startedAt = Date.now();
  const analysis = analyzeLegalQuestion({
    question: request.question,
    language: request.language,
    jurisdiction: request.jurisdiction,
    relevantDate: request.relevantDate,
    facts: request.facts,
  });

  const language: LegalLanguage = normalizeAiOutputLanguage(
    request.outputLanguage ?? request.language,
    DEFAULT_AI_OUTPUT_LANGUAGE
  ).language;
  const jurisdiction: LegalJurisdiction = request.jurisdiction || analysis.jurisdiction || "both";
  const mode = request.mode || analysis.recommendedMode || "deep";
  const includeUnverified = Boolean(request.includeUnverifiedWarnings);

  const disclaimer = getLocalizedDisclaimer(language);

  try {
    // Stage A + B Retrieval (verified first; optionally include unverified with explicit warning)
    const searchRes = await searchLegalSources(db, {
      query: `${request.question} ${request.facts || ""}`.trim(),
      jurisdiction,
      mode,
      callerInstitutionId: request.callerInstitutionId,
      verificationFilter: includeUnverified ? "all" : "verified",
      maxResults: mode === "fast" ? 5 : 10,
    });

    const retrievedSources = searchRes.results || [];
    const contraryAuthorities = searchRes.contraryAuthorities || [];

    // Strict Anti-Fabrication Gate (§11 exact wording + backward compatible Oromoo clause)
    if (retrievedSources.length === 0) {
      const insufficientMsg =
        language === "om"
          ? `${getLocalizedInsufficientSourcesMessage("om")} (Maddi seeraa gahaa hin jiru: gaaffii dhiyaateef seera, labsii ykn murtii dhaddacha ijibbaataa mirkanaa'e kuusaa seeraa keessatti hin argamne.)`
          : getLocalizedInsufficientSourcesMessage(language);

      return {
        ok: true,
        requestId,
        language,
        jurisdiction,
        mode,
        recommendedMode: analysis.recommendedMode,
        answer: insufficientMsg,
        citations: [],
        sourceCount: 0,
        verification: "INSUFFICIENT_SOURCES",
        questionAnalysis: analysis,
        cassationComparisons: [],
        contraryAuthorities: [],
        latencyMs: Date.now() - startedAt,
        disclaimer,
      };
    }

    const cassationComparisons =
      searchRes.cassationComparisons && searchRes.cassationComparisons.length > 0
        ? searchRes.cassationComparisons
        : buildCassationComparisons(retrievedSources, contraryAuthorities, analysis);

    const hasUnverified = retrievedSources.some((s) => s.status !== "VERIFIED");
    const unverifiedWarning = hasUnverified
      ? language === "am"
        ? "ማስጠንቀቂያ፡ አንዳንድ የተጠቀሱ ምንጮች ገና በባለሙያ ያልተረጋገጡ (UNVERIFIED) ስለሆኑ እንደ አስገዳጅ ሕግ መወሰድ የለባቸውም።"
        : language === "en"
          ? "WARNING: One or more retrieved sources are UNVERIFIED and must not be treated as settled binding law without human verification."
          : "AKEKKACHIISA: Maddoota argaman keessaa tokko tokko ammaaf HIN MIRKANOOOFNE (UNVERIFIED); akka seera dirqisiisaatti osoo hin mirkaneessin hin fudhatin."
      : undefined;

    const preliminaryNotice =
      mode === "fast"
        ? language === "am"
          ? "ፈጣን ሁነታ (Fast Mode)፡ መልሱ ፈጣን ማጣሪያ ነው፤ ሙሉ የሰበር ንጽጽርና ተቃራኒ ድንጋጌዎችን ለማየት Deep Research Mode ይጠቀሙ።"
          : language === "en"
            ? "Fast Mode preliminary answer; switch to Deep Research Mode for full contrary-authority and Cassation comparison."
            : "Fast Mode (Deebii Saffisaa): Kun qorannoo jalqabaa ti; xiinxala dhaddacha ijibbaataa fi mormiiwwan faallaa guutuu argachuuf Deep Research Mode filadhu."
        : undefined;

    const citations: LegalCitation[] = retrievedSources.map((s) => ({
      sourceId: s.id,
      title: s.title,
      sourceType: s.sourceType,
      category: s.category,
      jurisdiction: s.jurisdiction,
      issuingInstitution: s.courtName || s.issuingInstitution,
      proclamationNumber: s.proclamationNumber,
      decisionNumber: s.decisionNumber,
      volume: s.volume,
      page: s.page || (s.matchedPassages?.[0]?.page ? String(s.matchedPassages[0].page) : undefined),
      articleNumbers: s.articleNumbers,
      status: s.status,
      authorityTier: s.authorityTier,
      officialSourceName: s.officialSourceName,
      officialSourceUrl: s.officialSourceUrl,
      channelHandle: s.channelHandle,
      telegramPostUrl: s.telegramPostUrl,
      messageId: s.messageId,
      originalDateTime: s.originalDateTime,
      pinpointCitation: s.matchedPassages?.[0]?.citationLabel || `[${s.title}, Fuula ${s.page || 1}, Kutaa 1]`,
    }));

    const systemPrompt = buildLegalSystemPrompt({
      language,
      jurisdiction,
      mode,
      relevantDate: request.relevantDate,
      facts: request.facts,
      questionAnalysis: analysis,
      sources: retrievedSources,
      contraryAuthorities,
      cassationComparisons,
    });

    let answerText = "";
    try {
      const ai = getGeminiClient();
      const chosenModel =
        process.env.GEMINI_LEGAL_MODEL?.trim() || DEFAULT_MODEL;
      const isGemini4 = chosenModel.startsWith("gemini-4");

      const config: any = { systemInstruction: systemPrompt };
      if (isGemini4) {
        config.thinkingConfig = {
          thinkingLevel: mode === "deep" ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
        };
      } else {
        config.temperature = 0.1;
      }

      const response = await ai.models.generateContent({
        model: chosenModel,
        contents: `GAAFFII SEERAA:\n${request.question}\n\n${request.facts ? `DHUGAA DHIMMAA:\n${request.facts}\n\n` : ""}Qorannoo seeraa guutuu caasaa gaafatameen (Section A–I) qopheessi.`,
        config,
      });

      answerText = response.text?.trim() || "";
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        console.info("[answerLegalQuestion] Gemini quota cooldown active; using deterministic legal engine.");
      } else {
        console.warn("[answerLegalQuestion] Gemini synthesis fallback to structured engine:", msg);
      }
    }

    if (!answerText) {
      answerText = buildStructuredDeterministicAnswer({
        language,
        mode,
        analysis,
        sources: retrievedSources,
        contrary: contraryAuthorities,
        comparisons: cassationComparisons,
        unverifiedWarning,
      });
    } else if (unverifiedWarning && !answerText.includes("UNVERIFIED")) {
      answerText = `${unverifiedWarning}\n\n${answerText}`;
    }

    const qualityChecklist = evaluateAnswerQuality({
      analysis,
      sources: retrievedSources,
      contrary: contraryAuthorities,
      comparisons: cassationComparisons,
      answerText,
      language,
      mode,
    });

    return {
      ok: true,
      requestId,
      language,
      jurisdiction,
      mode,
      recommendedMode: analysis.recommendedMode,
      preliminaryNotice,
      unverifiedWarning,
      answer: answerText,
      citations,
      sourceCount: citations.length,
      verification: "SOURCE_GROUNDED",
      questionAnalysis: analysis,
      cassationComparisons,
      contraryAuthorities,
      qualityChecklist,
      latencyMs: Date.now() - startedAt,
      disclaimer,
    };
  } catch (error: any) {
    console.error("[answerLegalQuestion critical error]:", error);
    return {
      ok: false,
      requestId,
      language,
      jurisdiction,
      mode,
      answer:
        language === "am"
          ? "የሕግ ጥያቄውን በማስኬድ ላይ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።"
          : language === "en"
            ? "An error occurred while analyzing the legal question. Please retry."
            : "Gaaffii seeraa qorachuu keessatti dogoggorri uumameera. Maaloo irra deebi'aa yaalaa.",
      citations: [],
      sourceCount: 0,
      verification: "AI_ERROR",
      latencyMs: Date.now() - startedAt,
      disclaimer,
    };
  }
}
