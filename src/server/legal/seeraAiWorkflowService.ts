import OpenAI from 'openai';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { findRelevantTelegramPrecedents } from '../../data/telegramMasterArchive';
import { CASSATION_PRECEDENTS_DATA } from '../../data/cassationPrecedents';
import { OROMIA_AND_FEDERAL_LEGISLATION_DB } from '../../data/legislationDatabase';
import {
  AiOutputLanguage,
  DEFAULT_AI_OUTPUT_LANGUAGE,
  getAiOutputLanguageDisplayName,
  normalizeAiOutputLanguage,
  withResponseLanguagePolicy,
} from '../../shared/aiOutputLanguage';

export const SEERAAI_LEGAL_SYSTEM_PROMPT = `
You are SEERAAI (SAI Ethio), an advanced AI legal research and judicial assistant specialized in Ethiopian Federal laws and Oromia Regional laws.
Core Directives:
1. Languages: Fluency in Afaan Oromoo, Amharic, and English.
2. Domain Expertise: Analyze claims, statements of defence, documentary/testimonial evidence, disputed facts, procedural issues, and limitation periods under Ethiopian and Oromia jurisprudence.
3. Judgment Drafting: Assist in drafting structured legal judgments and court rulings.
4. Strict Honesty & Grounding: Never fabricate laws, statutory provisions, regulations, or court decisions. Always distinguish verified statutory law from legal interpretation and judicial uncertainty.
5. Record Integrity: Never overwrite original legal documents or court case records provided by the user.
6. Cassation Citations Mandate: When referencing Federal Supreme Court Cassation Bench precedents or Telegram archive posts (@seeraai_ethio, starting from https://t.me/seeraai_ethio/125), cite the exact Galmee Lakkoofsa (File No.), Volume, and Telegram post URL whenever available in grounded sources.
`;

export type AIProviderMode = 'openai' | 'gemini' | 'dual';

export interface SeeraAIRequest {
  prompt: string;
  context?: string;
  mode?: AIProviderMode;
  outputLanguage?: AiOutputLanguage;
  language?: AiOutputLanguage;
  telegramChatId?: string | number;
  saveToFirebase?: boolean;
  customGeminiKey?: string;
}

export interface SeeraAIWorkflowResult {
  mode: AIProviderMode;
  prompt: string;
  openaiResponse: string;
  geminiResponse: string;
  synthesis: string;
  telegramDispatched: boolean;
  telegramError?: string;
  providers: {
    geminiModel: string;
    openaiModel: string;
    openaiAvailable: boolean;
    geminiAvailable: boolean;
    telegramAvailable: boolean;
  };
  createdAt: string;
}

function getServerGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY server-side hin galmoofne.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getGroundedContextSnippet(query: string): string {
  const q = query.trim().toLowerCase();
  if (!q) return '';

  const snippets: string[] = [];
  try {
    const tgMatches = findRelevantTelegramPrecedents(query, 4);
    for (const item of tgMatches) {
      const postUrl =
        item.postUrl ||
        (item.postNumber
          ? `https://t.me/seeraai_ethio/${item.postNumber}`
          : 'https://t.me/seeraai_ethio');
      snippets.push(
        `[Telegram @seeraai_ethio | ${item.postNumber ? `Post #${item.postNumber} | ` : ''}File #${item.fileNumber} | ${postUrl}] ${item.title.om}: ${item.summary.om.slice(0, 400)} | Principle: ${item.principle.om.slice(0, 250)}`
      );
    }
  } catch {
    // Non-fatal fallback
  }

  try {
    const tokens = q.split(/\s+/).filter((t) => t.length >= 3).slice(0, 8);
    if (tokens.length > 0) {
      const cassationMatches = CASSATION_PRECEDENTS_DATA.filter((c) => {
        const hay = `${c.fileNumber} ${c.parties.om} ${c.legalIssue.om} ${c.legalIssue.en} ${c.bindingPrinciple.om}`.toLowerCase();
        return tokens.some((tok) => hay.includes(tok));
      }).slice(0, 3);

      for (const c of cassationMatches) {
        snippets.push(
          `[Cassation Galmee Lakk. ${c.fileNumber} | Vol. ${c.volume}] ${c.legalIssue.om} — ${c.bindingPrinciple.om}`
        );
      }

      const legMatches = OROMIA_AND_FEDERAL_LEGISLATION_DB.filter((l) => {
        const hay = `${l.number} ${l.title.om} ${l.title.en} ${l.summary.om}`.toLowerCase();
        return tokens.some((tok) => hay.includes(tok));
      }).slice(0, 3);

      for (const l of legMatches) {
        snippets.push(
          `[Legislation ${l.number} (${l.jurisdiction})] ${l.title.om} — ${l.summary.om}`
        );
      }
    }
  } catch {
    // Non-fatal fallback
  }

  if (snippets.length === 0) return '';
  return `\n\n[VERIFIED ETHIOPIAN & OROMIA LEGAL GROUNDING]:\n${snippets.join('\n')}`;
}

export function getWorkflowEngineStatus() {
  const rawOpenAi = (process.env.OPENAI_API_KEY || '').trim();
  const normalizedOpenAi = rawOpenAi.includes('sk-') ? rawOpenAi.substring(rawOpenAi.indexOf('sk-')) : rawOpenAi;
  const hasOpenAI = Boolean(normalizedOpenAi && normalizedOpenAi.startsWith('sk-'));
  const hasGemini = Boolean((process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim());
  const hasTelegram = Boolean((process.env.TELEGRAM_BOT_TOKEN || '').trim());

  return {
    geminiAvailable: hasGemini,
    openaiAvailable: hasOpenAI,
    telegramAvailable: hasTelegram,
    geminiModel: 'gemini-4-hydrogen',
    openaiModel: 'gpt-4o',
  };
}

export async function sendTelegramMessage(chatId: string | number, text: string) {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN server-side hin galmoofne.');
  }

  const normalizedChatId = String(chatId ?? '').trim();
  if (!normalizedChatId || !/^(-?\d{5,20}|@[a-zA-Z0-9_]{5,32})$/.test(normalizedChatId)) {
    throw new Error('Telegram Chat ID sirrii miti (fakkeenya: 123456789 ykn @channel).');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: normalizedChatId,
      text: text.slice(0, 4000),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram API dogoggora (${res.status}): ${errText}`);
  }

  return await res.json();
}

export async function executeSeeraAIWorkflow(payload: SeeraAIRequest): Promise<SeeraAIWorkflowResult> {
  const {
    prompt,
    context = '',
    mode = 'dual',
    telegramChatId,
  } = payload;

  const outputLang = normalizeAiOutputLanguage(
    payload.outputLanguage ?? payload.language,
    DEFAULT_AI_OUTPUT_LANGUAGE
  ).language;
  const governedSystemPrompt = withResponseLanguagePolicy(SEERAAI_LEGAL_SYSTEM_PROMPT, outputLang);

  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) {
    throw new Error('Gaaffii seeraa (prompt) galchuun dirqama.');
  }

  const grounding = getGroundedContextSnippet(cleanPrompt);
  const fullPrompt = [
    context ? `Context / Case Documents:\n${context.trim()}` : '',
    grounding ? grounding : '',
    `User Query:\n${cleanPrompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const status = getWorkflowEngineStatus();

  const callOpenAI = async (): Promise<string> => {
    const rawKey = (process.env.OPENAI_API_KEY || '').trim();
    const apiKey = rawKey.includes('sk-') ? rawKey.substring(rawKey.indexOf('sk-')) : rawKey;
    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('OPENAI_API_KEY server-side Secrets keessatti hin galmoofne.');
    }

    const openai = new OpenAI({ apiKey, timeout: 25000, maxRetries: 1 });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: governedSystemPrompt },
        { role: 'user', content: fullPrompt },
      ],
    });
    return completion.choices[0]?.message?.content || '';
  };

  const callGemini = async (): Promise<string> => {
    const ai = getServerGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: fullPrompt,
      config: {
        systemInstruction: governedSystemPrompt,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return response.text || '';
  };

  let openaiResponse = '';
  let geminiResponse = '';
  let synthesis = '';

  if (mode === 'openai') {
    openaiResponse = await callOpenAI();
  } else if (mode === 'gemini') {
    geminiResponse = await callGemini();
  } else {
    const [oaRes, gemRes] = await Promise.allSettled([callOpenAI(), callGemini()]);
    openaiResponse =
      oaRes.status === 'fulfilled'
        ? oaRes.value
        : `[OpenAI Notice]: ${oaRes.reason?.message || 'OpenAI error'}`;
    geminiResponse =
      gemRes.status === 'fulfilled'
        ? gemRes.value
        : `[Gemini Notice]: ${gemRes.reason?.message || 'Gemini error'}`;

    if (oaRes.status === 'fulfilled' && gemRes.status === 'fulfilled') {
      try {
        const targetLangName = getAiOutputLanguageDisplayName(outputLang);
        const synthesisPrompt = `
Compare Provider A (OpenAI GPT-4o) and Provider B (Google Gemini 4 Hydrogen) for this Ethiopian & Oromia legal query:
"${cleanPrompt}"

Provider A (OpenAI GPT-4o):
${openaiResponse}

Provider B (Google Gemini):
${geminiResponse}

Respond strictly in ${targetLangName} (${outputLang}) with 4 clear structured sections:
1. Similarities & Shared Legal Citations
2. Differences in Interpretation or Statutory Emphasis
3. Verification Needed & Grounded Caution
4. Unified Legal Synthesis & Disclaimer
`;
        const ai = getServerGeminiClient();
        const synRes = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: synthesisPrompt,
          config: {
            systemInstruction: withResponseLanguagePolicy(
              'You are SEERAAI Master Legal Supervisor. Reconcile two independent legal AI analyses objectively without fabricating laws or citations.',
              outputLang
            ),
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        synthesis = synRes.text || '';
      } catch (synErr: any) {
        console.warn('[SEERAAI Workflow] Synthesis warning:', synErr?.message || synErr);
      }
    } else if (gemRes.status === 'fulfilled' && oaRes.status === 'rejected') {
      synthesis =
        outputLang === 'am'
          ? 'የGemini 4 Hydrogen ትንተና በተሳካ ሁኔታ ተዘጋጅቷል። OpenAI GPT-4o ለጊዜው አልተገኘም።'
          : outputLang === 'en'
            ? 'Gemini 4 Hydrogen legal analysis completed. OpenAI GPT-4o was unavailable for this request.'
            : "Xiinxalli Gemini 4 Hydrogen milkaa'inaan qophaa'eera. OpenAI GPT-4o yeroof hin argamne.";
    }
  }

  let telegramDispatched = false;
  let telegramError: string | undefined;

  if (telegramChatId !== undefined && telegramChatId !== null && String(telegramChatId).trim() !== '') {
    try {
      const tgText = synthesis || geminiResponse || openaiResponse;
      await sendTelegramMessage(telegramChatId, `⚖️ SEERAAI:\n\n${tgText}`);
      telegramDispatched = true;
    } catch (tgErr: any) {
      telegramError = tgErr?.message || 'Telegram erguun hin milkoofne.';
    }
  }

  return {
    mode,
    prompt: cleanPrompt,
    openaiResponse,
    geminiResponse,
    synthesis,
    telegramDispatched,
    telegramError,
    providers: status,
    createdAt: new Date().toISOString(),
  };
}
