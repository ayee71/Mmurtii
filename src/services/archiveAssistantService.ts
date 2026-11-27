import { MASTER_FILES, findRelevantTelegramPrecedents } from '../data/telegramMasterArchive';
import { CASSATION_PRECEDENTS_DATA } from '../data/cassationPrecedents';
import { getStoredAiOutputLanguage } from './storage';
import { AiOutputLanguage, normalizeAiOutputLanguage } from '../shared/aiOutputLanguage';

export interface ArchiveAssistantResult {
  answer: string;
  source: 'remote-assistant' | 'local-gemini';
  endpoint: string;
  structuredSections?: {
    deebiiSeeraa?: string;
    ragummaa?: string;
    qajeeltoo?: string;
    gorsa?: string;
  };
}

export function parseArchiveAssistantResponse(text: string): {
  deebiiSeeraa?: string;
  ragummaa?: string;
  qajeeltoo?: string;
  gorsa?: string;
} {
  const sections: {
    deebiiSeeraa?: string;
    ragummaa?: string;
    qajeeltoo?: string;
    gorsa?: string;
  } = {};

  // Match 1. DEEBII SEERAA
  const m1 = text.match(/1\.\s*DEEBII SEERAA[^\n]*\n([\s\S]*?)(?=2\.\s*RAGUMMAA|$)/i);
  if (m1 && m1[1]) sections.deebiiSeeraa = m1[1].trim();

  // Match 2. RAGUMMAA SEERAA FI MURTIIWWAN IJIBBAATAA
  const m2 = text.match(/2\.\s*RAGUMMAA[^\n]*\n([\s\S]*?)(?=3\.\s*QAJEELTOO|$)/i);
  if (m2 && m2[1]) sections.ragummaa = m2[1].trim();

  // Match 3. QAJEELTOO BU'UURAA
  const m3 = text.match(/3\.\s*QAJEELTOO[^\n]*\n([\s\S]*?)(?=4\.\s*GORSA|$)/i);
  if (m3 && m3[1]) sections.qajeeltoo = m3[1].trim();

  // Match 4. GORSA QABATAMAA
  const m4 = text.match(/4\.\s*GORSA[^\n]*\n([\s\S]*?)$/i);
  if (m4 && m4[1]) sections.gorsa = m4[1].trim();

  return sections;
}

export async function askArchiveAssistant(
  question: string,
  language?: AiOutputLanguage,
  providedContextCases?: any[]
): Promise<ArchiveAssistantResult> {
  const resolvedLang = normalizeAiOutputLanguage(language, getStoredAiOutputLanguage()).language;

  if (!question || !question.trim()) {
    throw new Error(
      resolvedLang === 'am'
        ? 'የሕግ ጥያቄው ባዶ መሆን አይችልም'
        : resolvedLang === 'en'
          ? 'Legal question cannot be empty'
          : 'Gaaffiin seeraa hin ibsamne'
    );
  }

  // 1. Gather context from Telegram Master files
  const matchedTelegram = providedContextCases && providedContextCases.length > 0
    ? providedContextCases
    : findRelevantTelegramPrecedents(question, 8);

  const telegramSummary = matchedTelegram
    .map(
      (f: any) =>
        `• Telegram Galmee #${f.fileNumber} (${f.volume}): ${f.title?.[resolvedLang] || f.title?.om || f.title?.en || ''} - Principle: ${f.principle?.[resolvedLang] || f.principle?.om || f.principle?.en || ''} (Articles: ${f.keyArticles?.[resolvedLang] || f.keyArticles?.om || f.keyArticles?.en || ''})`
    )
    .join('\n');

  // 2. Gather context from Cassation Precedents data
  const qLower = question.toLowerCase();
  const matchedCassation = CASSATION_PRECEDENTS_DATA.filter((c) => {
    return (
      c.fileNumber.includes(qLower) ||
      c.legalIssue.om.toLowerCase().includes(qLower) ||
      c.bindingPrinciple.om.toLowerCase().includes(qLower) ||
      c.statutoryProvisions.some((p) => p.toLowerCase().includes(qLower))
    );
  }).slice(0, 3);

  const cassationSummary = matchedCassation
    .map(
      (c) =>
        `• Cassation File #${c.fileNumber} (Vol. ${c.volume}, Year ${c.yearEC}): Issue: ${c.legalIssue?.[resolvedLang] || c.legalIssue.om} - Holding: ${c.bindingPrinciple?.[resolvedLang] || c.bindingPrinciple.om} (Provisions: ${c.statutoryProvisions.join(', ')})`
    )
    .join('\n');

  const contextPrecedents = [telegramSummary, cassationSummary].filter(Boolean).join('\n\n');

  // Call the server proxy endpoint which executes the local Gemini archive assistant
  const response = await fetch('/api/gemini/archive-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      language: resolvedLang,
      outputLanguage: resolvedLang,
      contextCases: matchedTelegram,
      contextPrecedents,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawAnswer = data.answer || '';
  const structuredSections = parseArchiveAssistantResponse(rawAnswer);

  return {
    answer: rawAnswer,
    source: data.source || 'local-gemini',
    endpoint: data.endpoint || 'local-gemini-archive-assistant',
    structuredSections,
  };
}

/**
 * Universal helper matching Wako Legal Studio client API pattern:
 * askWakoLegalAI("Darbiinsi yeroo falmii lafa baadiyaa Oromiyaa keessatti waggaa meeqa?")
 */
export async function askWakoLegalAI(
  question: string,
  language?: AiOutputLanguage,
  contextCases?: any[]
): Promise<string> {
  const res = await askArchiveAssistant(question, language, contextCases);
  return res.answer;
}
