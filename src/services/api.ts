import { Language } from '../i18n/translations';
import { getStoredAiOutputLanguage, getUserSettings } from './storage';
import { AiOutputLanguage, normalizeAiOutputLanguage } from '../shared/aiOutputLanguage';
import { auth } from './firebase';

export interface GenerateRequest {
  prompt: string;
  context?: string;
  taskType?: 'contract' | 'explain_law' | 'social_facebook' | 'social_telegram' | 'summarize' | 'general';
  outputLanguage?: AiOutputLanguage;
  outputLanguages?: Language[] | 'all';
  modelTier?: string; // More flexible model tier
}

export interface GenerateResponse {
  content: string;
  separatedVersions: {
    om?: string;
    am?: string;
    en?: string;
  };
  detectedInputLang: Language;
  outputLanguages: Language[];
}

export interface TranslateRequest {
  sourceText: string;
  sourceLang: Language | 'auto';
  targetLang: Language;
  mode?: 'translate' | 'proofread_rewrite';
  module?: 'translate_view' | 'document_analysis' | 'voice_ocr_converter' | 'api_translate';
}

export interface TranslateResponse {
  translatedText: string;
  sourceLang: Language;
  targetLang: Language;
  isRewrite: boolean;
  translationId?: string;
  createdAt?: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  glossaryVersion?: string;
  appVersion?: string;
}

export interface DictionaryResponse {
  term: string;
  om?: {
    term: string;
    definition: string;
    usage: string;
  };
  am?: {
    term: string;
    definition: string;
    usage: string;
  };
  en?: {
    term: string;
    definition: string;
    usage: string;
  };
  primaryProclamationOrCode?: string;
  raw?: string;
  aiDraft?: boolean;
  verificationStatus?: string;
  disclaimer?: string;
}

export async function getApiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID token for API headers:', err);
  }
  return headers;
}

async function safeParseResponse(res: Response, fallbackMessage: string): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (res.status === 413) {
    throw new Error('Sagaleen Waraabame Baay\'ee Dheeraadha (413 Request Entity Too Large). Maaloo saagalee gabaabaa waraabaa. / Audio payload too large. Please record a shorter clip or compress the file.');
  }
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.includes('413') || text.includes('Too Large')) {
      throw new Error('Sagaleen Waraabame Baay\'ee Dheeraadha (413 Request Entity Too Large). Maaloo saagalee gabaabaa waraabaa. / Audio payload too large.');
    }
    throw new Error(
      text.includes('<!doctype')
        ? 'Tajaajilli yeroof hin deebisne. Maaloo irra deebi\'aa yaalaa. / Please try again.'
        : text || fallbackMessage
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Quota exceeded. Please try again later or check your billing plan. / Quota darbeera jira. Maaloo yeroo biraa yaalaa ykn plan keessan ilaalaa.');
    }
    throw new Error(data?.error || fallbackMessage);
  }
  return data;
}

export async function detectLanguage(text: string): Promise<Language> {
  try {
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify({ text }),
    });
    const data = await safeParseResponse(res, 'Detection failed');
    return data.detectedLanguage || 'om';
  } catch (e) {
    // Fallback simple detection
    if (/[\u1200-\u137F]/.test(text)) return 'am';
    if (/\b(keeyyata|labsii|seera|waan|mootummaa|waliigalte|akka|dhaddacha)\b/i.test(text)) return 'om';
    return 'en';
  }
}
import { cleanLegalArtifacts } from '../utils/legalProseFormatter';

export function cleanTextFormatting(text: string): string {
  if (!text) return '';
  return cleanLegalArtifacts(text);
}

export async function generateLegalContent(req: GenerateRequest, retries = 2): Promise<GenerateResponse> {
  const settings = getUserSettings();
  const storedLang = getStoredAiOutputLanguage();
  const explicitFromArray = Array.isArray(req.outputLanguages) ? req.outputLanguages[0] : req.outputLanguages;
  const resolvedLang = normalizeAiOutputLanguage(
    req.outputLanguage ?? (explicitFromArray === 'all' ? undefined : explicitFromArray),
    storedLang
  ).language;
  const payload = {
    ...req,
    outputLanguage: resolvedLang,
    outputLanguages: req.outputLanguages === 'all' ? 'all' : [resolvedLang],
    modelTier: req.modelTier || settings.aiModelTier || 'deep_thinking',
  };
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify(payload),
    });

    const data: GenerateResponse = await safeParseResponse(res, 'Generation failed');
    if (data) {
      if (data.content) data.content = cleanTextFormatting(data.content);
      if (data.separatedVersions) {
        if (data.separatedVersions.om) data.separatedVersions.om = cleanTextFormatting(data.separatedVersions.om);
        if (data.separatedVersions.am) data.separatedVersions.am = cleanTextFormatting(data.separatedVersions.am);
        if (data.separatedVersions.en) data.separatedVersions.en = cleanTextFormatting(data.separatedVersions.en);
      }
    }
    return data;
  } catch (err: any) {
    if (retries > 0 && (err?.message?.includes('Tajaajilli yeroof hin deebisne') || err?.name === 'TypeError' || err?.message?.includes('Failed to fetch'))) {
      console.warn(`Retrying generateLegalContent, ${retries} attempts left...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateLegalContent(req, retries - 1);
    }
    console.error('API Error in generateLegalContent:', err);
    if (err?.name === 'TypeError' || err?.message?.includes('Failed to fetch')) {
      throw new Error('Walqunnamtiin network addaan cite. Maaloo irra deebi\'aa yaalaa. / Network connection issue, please retry.');
    }
    throw err;
  }
}

export async function translateLegalText(req: TranslateRequest): Promise<TranslateResponse> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify(req),
  });

  const data: TranslateResponse = await safeParseResponse(res, 'Translation failed');
  if (data && data.translatedText) {
    data.translatedText = data.translatedText
      .replace(/^```(?:[a-zA-Z0-9_-]+)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }
  return data;
}

export interface AnalyzeDocumentRequest {
  fileData?: string | null;
  mimeType?: string;
  fileText?: string;
  fileName?: string;
  files?: { fileData: string; mimeType: string; fileName?: string }[];
  analysisType?: 'risk_analysis' | 'compliance' | 'plain_explanation' | 'translate_document' | 'summarize' | 'extract_text' | 'court_case_analysis_v2';
  outputLanguage?: AiOutputLanguage;
  outputLanguages?: Language[] | 'all';
  customInstructions?: string;
  modelTier?: string; // Flexible model tier
}

export interface AnalyzeDocumentResponse {
  analysis: string;
  separatedVersions?: {
    om?: string;
    am?: string;
    en?: string;
  };
  structuredAnalysis?: any;
  outputLanguages: Language[];
  fileName: string;
  analysisType: string;
  modelUsed?: string;
  detectedInputLang?: Language;
}

export async function analyzeLegalDocument(req: AnalyzeDocumentRequest): Promise<AnalyzeDocumentResponse> {
  const settings = getUserSettings();
  const storedLang = getStoredAiOutputLanguage();
  const explicitFromArray = Array.isArray(req.outputLanguages) ? req.outputLanguages[0] : req.outputLanguages;
  const resolvedLang = normalizeAiOutputLanguage(
    req.outputLanguage ?? (explicitFromArray === 'all' ? undefined : explicitFromArray),
    storedLang
  ).language;
  const payload = {
    ...req,
    outputLanguage: resolvedLang,
    outputLanguages: req.outputLanguages === 'all' ? 'all' : [resolvedLang],
    modelTier: req.modelTier || settings.aiModelTier || 'gemini-4-hydrogen',
  };

  const res = await fetch('/api/analyze-document', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify(payload),
  });

  const data: AnalyzeDocumentResponse = await safeParseResponse(res, 'Document analysis failed');
  if (data) {
    const preserveRaw = req.analysisType === 'extract_text' || req.analysisType === 'translate_document';
    if (data.analysis) {
      data.analysis = preserveRaw
        ? data.analysis.replace(/^```(?:[a-zA-Z0-9_-]+)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
        : cleanTextFormatting(data.analysis);
    }
    if (data.separatedVersions) {
      if (data.separatedVersions.om) {
        data.separatedVersions.om = preserveRaw ? data.separatedVersions.om.trim() : cleanTextFormatting(data.separatedVersions.om);
      }
      if (data.separatedVersions.am) {
        data.separatedVersions.am = preserveRaw ? data.separatedVersions.am.trim() : cleanTextFormatting(data.separatedVersions.am);
      }
      if (data.separatedVersions.en) {
        data.separatedVersions.en = preserveRaw ? data.separatedVersions.en.trim() : cleanTextFormatting(data.separatedVersions.en);
      }
    }
  }
  return data;
}

export interface DocumentQuestionRequest {
  documentText?: string;
  templateContext?: {
    title?: string;
    lawBasis?: string;
    category?: string;
    formData?: Record<string, string>;
  };
  question: string;
  language?: Language;
  outputLanguage?: AiOutputLanguage;
  modelTier?: string; // Flexible model tier
}

export interface DocumentQuestionResponse {
  answer: string;
  modelUsed?: string;
  question: string;
  language: string;
}

export async function askDocumentQuestion(req: DocumentQuestionRequest): Promise<DocumentQuestionResponse> {
  const settings = getUserSettings();
  const resolvedLang = normalizeAiOutputLanguage(
    req.outputLanguage ?? req.language,
    getStoredAiOutputLanguage()
  ).language;
  const payload = {
    ...req,
    language: resolvedLang,
    outputLanguage: resolvedLang,
    modelTier: req.modelTier || settings.aiModelTier || 'gemini-4-hydrogen',
  };

  const res = await fetch('/api/qa-document', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify(payload),
  });

  return await safeParseResponse(res, 'Document Q&A failed');
}

export async function lookupLegalTerm(term: string): Promise<DictionaryResponse> {
  const res = await fetch('/api/legal-dictionary', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify({ term }),
  });

  return await safeParseResponse(res, 'Dictionary lookup failed');
}

export interface LegalLogicSuggestion {
  proclamationTitle: string;
  proclamationNumber?: string;
  articleOrSection: string;
  legalConcept: string;
  reasoning: string;
  cassationQuery: string;
}

export interface LegalLogicSearchResponse {
  concepts: string[];
  suggestions: LegalLogicSuggestion[];
  rawAnalysis: string;
}

export async function performLegalLogicSearch(
  text: string,
  lang?: Language
): Promise<LegalLogicSearchResponse> {
  const resolvedLang = normalizeAiOutputLanguage(lang, getStoredAiOutputLanguage()).language;
  const prompt = `You are an expert Ethiopian AI Legal Logic Agent. Analyze the following legal text or dictated case details and identify the underlying legal concepts, relevant FDRE Proclamations, specific Civil/Labor/Criminal/Commercial Code articles, and Cassation decision precedents that apply to this scenario.

Text to Analyze:
"""
${text}
"""

Format your response in three clearly structured sections in ${resolvedLang === 'om' ? 'Afaan Oromoo' : resolvedLang === 'am' ? 'Amharic (አማርኛ)' : 'English'}:
1. Core Identified Legal Concepts
2. Applicable Proclamations & Articles
3. Key Cassation Precedent Angle

Provide concrete proclamation numbers and practical legal analysis grounded strictly in verified Ethiopian law.`;

  const settings = getUserSettings();
  const payload = {
    prompt,
    taskType: 'explain_law',
    outputLanguage: resolvedLang,
    outputLanguages: [resolvedLang],
    modelTier: settings.aiModelTier || 'gemini-4-hydrogen',
  };

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await safeParseResponse(res, 'Legal logic search failed');
  return {
    concepts: [text.substring(0, 60)],
    suggestions: [],
    rawAnalysis: data.content || data.separatedVersions?.[resolvedLang] || 'Result generated.',
  };
}

export async function auditDocumentLegalLogic(
  text: string,
  lang?: Language,
  modelTier?: string
): Promise<any> {
  const settings = getUserSettings();
  const resolvedLang = normalizeAiOutputLanguage(lang, getStoredAiOutputLanguage()).language;
  const res = await fetch('/api/audit-legal-logic', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify({
      text,
      language: resolvedLang,
      outputLanguage: resolvedLang,
      modelTier: modelTier || settings.aiModelTier || 'gemini-4-hydrogen',
    }),
  });

  return await safeParseResponse(res, 'Procedural legal logic audit failed');
}

export interface TranscribeAudioRequest {
  audioData: string; // base64
  mimeType?: string;
  language?: Language | 'auto';
  legalMode?: boolean;
  verbatimMode?: boolean;
}

export interface TranscribeAudioResponse {
  transcription: string;
  detectedLanguage: Language;
  modelUsed?: string;
}

export async function transcribeSpeechAudio(req: TranscribeAudioRequest): Promise<TranscribeAudioResponse> {
  try {
    // If base64 payload is larger than ~10MB, cap payload to prevent 413 HTTP errors
    const sanitizedReq = { ...req };
    if (sanitizedReq.audioData && sanitizedReq.audioData.length > 10 * 1024 * 1024) {
      sanitizedReq.audioData = sanitizedReq.audioData.substring(0, 10 * 1024 * 1024);
    }

    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify(sanitizedReq),
    });

    return await safeParseResponse(res, 'Transcription failed');
  } catch (err: any) {
    if (err?.name === 'TypeError' || err?.message?.includes('Failed to fetch') || err?.message?.includes('413') || err?.message?.includes('Too Large')) {
      throw new Error('Sagaleen Waraabame Baay\'ee Dheeraadha (Payload Large). Maaloo saagalee gabaabaa waraabaa. / Audio file too large, please record shorter clips.');
    }
    throw err;
  }
}

export interface OcrConvertRequest {
  fileData: string; // base64
  mimeType: string;
  fileName?: string;
  language?: Language | 'auto';
  extractMode?: 'full' | 'legal' | 'table';
}

export interface OcrConvertResponse {
  extractedText: string;
  detectedLanguage: Language;
  fileName: string;
  modelUsed?: string;
  wordCount: number;
}

export async function convertMediaFileToText(req: OcrConvertRequest): Promise<OcrConvertResponse> {
  try {
    const res = await fetch('/api/ocr-convert', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify(req),
    });

    return await safeParseResponse(res, 'OCR text extraction failed');
  } catch (err: any) {
    console.error('API Error in convertMediaFileToText:', err);
    if (err?.name === 'TypeError' || err?.message?.includes('Failed to fetch')) {
      throw new Error('Walqunnamtiin network addaan cite. Maaloo irra deebi\'aa yaalaa. / Network connection issue, please retry.');
    }
    throw err;
  }
}

export interface ExtractedMetadata {
  caseName: string;
  date: string;
  docType: string;
}

export async function extractDocumentMetadata(text: string, modelTier?: string): Promise<ExtractedMetadata> {
  const settings = getUserSettings();
  try {
    const res = await fetch('/api/extract-metadata', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify({
        text,
        modelTier: modelTier || settings.aiModelTier || 'gemini-4-hydrogen',
      }),
    });
    const data = await safeParseResponse(res, 'Metadata extraction failed');
    return {
      caseName: data.caseName || '',
      date: data.date || '',
      docType: data.docType || '',
    };
  } catch (err) {
    console.warn('extractDocumentMetadata error:', err);
    return { caseName: '', date: '', docType: '' };
  }
}

export interface LegalCitationSuggestion {
  id: string;
  lawTitle: string;
  proclamationNumber: string;
  articleNumber: string;
  category: string;
  jurisdiction: 'federal' | 'oromia';
  badgeEmoji?: string;
  title: string;
  summary: string;
  insertText: string;
  cassationRef?: string;
  matchedKeyword?: string;
  relevanceScore?: number;
}

export async function findLegalCitations(
  text: string,
  language?: Language,
  maxResults: number = 8
): Promise<LegalCitationSuggestion[]> {
  if (!text || text.trim().length === 0) return [];
  const resolvedLang = normalizeAiOutputLanguage(language, getStoredAiOutputLanguage()).language;
  try {
    const res = await fetch('/api/citations/finder', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify({ text, language: resolvedLang, outputLanguage: resolvedLang, maxResults }),
    });
    const data = await safeParseResponse(res, 'Citation scanning failed');
    return data.suggestions || [];
  } catch (err) {
    console.warn('findLegalCitations error:', err);
    return [];
  }
}

export async function dualAiAnalyze(
  prompt: string,
  modelProvider: 'gemini' | 'openai' = 'gemini',
  outputLanguage?: AiOutputLanguage
): Promise<{ response: string; provider: string }> {
  const resolvedLang = normalizeAiOutputLanguage(outputLanguage, getStoredAiOutputLanguage()).language;
  try {
    const res = await fetch('/api/ai/dual-analyze', {
      method: 'POST',
      headers: await getApiHeaders(),
      body: JSON.stringify({ prompt, modelProvider, outputLanguage: resolvedLang, language: resolvedLang }),
    });
    const data = await safeParseResponse(res, 'Dual AI analysis failed');
    return {
      response: data?.data?.response || data?.response || '',
      provider: data?.data?.provider || data?.provider || modelProvider,
    };
  } catch (err: any) {
    console.error('dualAiAnalyze error:', err);
    throw err;
  }
}
