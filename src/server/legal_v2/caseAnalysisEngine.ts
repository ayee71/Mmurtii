import { buildCaseAnalysisSystemPrompt } from './caseAnalysisPrompt';
import { AiOutputLanguage, DEFAULT_AI_OUTPUT_LANGUAGE, normalizeAiOutputLanguage } from '../../shared/aiOutputLanguage';

export interface CaseAnalysisRequest {
  fileText: string;
  files?: Array<{ data: string; mimeType: string; name: string }>;
  caseContext?: string;
  outputLanguage?: AiOutputLanguage | string;
}

export interface CaseAnalysisResult {
  fullReport: string;
  structuredData: any;
}

/**
 * SEERAAI - Refined Court Case Analysis Engine
 * Implements the 11-phase analysis protocol.
 */
export async function runRefinedCaseAnalysis(
  params: CaseAnalysisRequest,
  generateText: (input: { systemPrompt: string; userPrompt: string; responseMimeType?: string }) => Promise<string>
): Promise<CaseAnalysisResult> {
  const { fileText, caseContext = '', outputLanguage } = params;
  const resolvedLang = normalizeAiOutputLanguage(outputLanguage, DEFAULT_AI_OUTPUT_LANGUAGE).language;
  const systemPrompt = buildCaseAnalysisSystemPrompt(resolvedLang);

  if (!fileText.trim()) {
    throw new Error('Barreeffama galmee hin argamne. Maaloo galmee fe\'aa ykn OCR dubbisaa.');
  }

  const userPrompt = `
CASE CONTEXT / INQUIRY:
${caseContext || 'Comprehensive Ethiopian court case analysis.'}

EXTRACTED DOCUMENT TEXT:
--------------------------------------------------
${fileText.slice(0, 50000)}
--------------------------------------------------

Follow the 11-phase protocol carefully and write all prose strictly in the configured RESPONSE LANGUAGE POLICY language (${resolvedLang}).
`;

  // First pass: Generate the full prose report in the selected AI output language
  const fullReport = await generateText({
    systemPrompt,
    userPrompt,
  });

  // Second pass: Extract structured data (JSON)
  const jsonPrompt = `${userPrompt}\n\nProvide ONLY the valid JSON schema representation in ${resolvedLang}.`;
  const jsonResponse = await generateText({
    systemPrompt,
    userPrompt: jsonPrompt,
    responseMimeType: 'application/json',
  });

  let structuredData = {};
  try {
    structuredData = JSON.parse(jsonResponse);
  } catch (e) {
    console.error('Failed to parse structured case analysis data:', e);
    structuredData = { error: 'Failed to generate structured data' };
  }

  return {
    fullReport,
    structuredData,
  };
}
