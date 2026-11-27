import { Language } from '../i18n/translations';
import { analyzeLegalDocument, AnalyzeDocumentResponse, convertMediaFileToText } from './api';
import mammoth from 'mammoth';
import { detectDocumentLanguage, LanguageDetectionResult } from '../utils/languageDetect';

export interface ProcessFileOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  enhanceContrast?: boolean;
}

export interface ProcessFileResult {
  success: boolean;
  base64?: string;
  text?: string;
  mimeType: string;
  name: string;
  width?: number;
  height?: number;
  originalSizeBytes?: number;
  optimizedSizeBytes?: number;
  compressionRatio?: number;
  processingTimeMs?: number;
  error?: string;
}

export type ExtractProgressCallback = (percent: number, stage: string) => void;

/**
 * Offloads heavy document image downscaling, contrast optimization,
 * and base64 encoding to a dedicated Web Worker off the main thread.
 */
export function processDocumentOffThread(
  file: File,
  options?: ProcessFileOptions,
  onProgress?: ExtractProgressCallback
): Promise<ProcessFileResult> {
  return new Promise((resolve) => {
    try {
      const worker = new Worker(
        new URL('../workers/imageProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      const timeout = setTimeout(() => {
        worker.terminate();
        resolve({
          success: false,
          mimeType: file.type,
          name: file.name,
          error: 'Document extraction timed out.',
        });
      }, 30000);

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;

        if (data.type === 'PROGRESS') {
          if (onProgress) {
            onProgress(data.percent || 0, data.stage || 'processing');
          }
          return;
        }

        clearTimeout(timeout);
        worker.terminate();

        if (data.error) {
          resolve({
            success: false,
            mimeType: file.type,
            name: file.name,
            error: data.error,
          });
        } else {
          resolve({
            success: true,
            base64: data.base64,
            text: data.text,
            mimeType: data.mimeType || file.type,
            name: data.name || file.name,
            width: data.width,
            height: data.height,
            originalSizeBytes: data.originalSizeBytes || file.size,
            optimizedSizeBytes: data.optimizedSizeBytes,
            compressionRatio: data.compressionRatio,
            processingTimeMs: data.processingTimeMs,
          });
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        console.warn('Document extraction worker encountered an error, falling back to FileReader:', err);
        fallbackFileReader(file).then(resolve);
      };

      worker.postMessage({
        type: 'PROCESS_FILE',
        file,
        options,
      });
    } catch (e: any) {
      console.warn('Could not initialize Web Worker, falling back to direct FileReader:', e);
      fallbackFileReader(file).then(resolve);
    }
  });
}

/**
 * Fallback in case Web Worker is disabled in restrictive iframe environments
 */
function fallbackFileReader(file: File): Promise<ProcessFileResult> {
  return new Promise((resolve) => {
    if (file.type === 'text/plain' || /\.(txt|md|csv)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          success: true,
          text: (e.target?.result as string) || '',
          mimeType: file.type || 'text/plain',
          name: file.name,
          originalSizeBytes: file.size,
        });
      };
      reader.onerror = () => resolve({ success: false, mimeType: file.type, name: file.name, error: 'Read error' });
      reader.readAsText(file, 'UTF-8');
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string) || '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({
          success: true,
          base64,
          mimeType: file.type || 'application/octet-stream',
          name: file.name,
          originalSizeBytes: file.size,
        });
      };
      reader.onerror = () => resolve({ success: false, mimeType: file.type, name: file.name, error: 'Read error' });
      reader.readAsDataURL(file);
    }
  });
}

export interface ExtractedUploadedDocument {
  text: string;
  originalLanguage: Language;
  detection: LanguageDetectionResult;
  mimeType: string;
  base64?: string;
  fileName: string;
  fileSizeBytes: number;
  extractionMethod: 'utf8-text' | 'docx-mammoth' | 'server-ocr' | 'fallback';
}

/**
 * Extracts text from uploaded legal files (.txt, .docx, .doc, .pdf, images) while strictly
 * preserving the document's original language ('om' | 'am' | 'en') without auto-translating.
 */
export async function extractDocumentPreservingLanguage(
  file: File,
  preferredLang: Language | 'auto' = 'auto'
): Promise<ExtractedUploadedDocument> {
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  // 1. Plain UTF-8 text (.txt, .md, .csv)
  if (mime === 'text/plain' || /\.(txt|md|csv)$/i.test(lowerName)) {
    const text = (await file.text()).trim();
    const detection = detectDocumentLanguage(text);
    return {
      text,
      originalLanguage: preferredLang !== 'auto' ? preferredLang : detection.language,
      detection,
      mimeType: file.type || 'text/plain',
      fileName: file.name,
      fileSizeBytes: file.size,
      extractionMethod: 'utf8-text',
    };
  }

  // 2. Word (.docx) direct client-side extraction via mammoth
  if (
    lowerName.endsWith('.docx') ||
    mime.includes('wordprocessingml')
  ) {
    try {
      const buffer = await file.arrayBuffer();
      const extracted = await mammoth.extractRawText({ arrayBuffer: buffer });
      const text = (extracted?.value || '').trim();
      if (text.length > 0) {
        const detection = detectDocumentLanguage(text);
        return {
          text,
          originalLanguage: preferredLang !== 'auto' ? preferredLang : detection.language,
          detection,
          mimeType:
            file.type ||
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileName: file.name,
          fileSizeBytes: file.size,
          extractionMethod: 'docx-mammoth',
        };
      }
    } catch (docxErr) {
      console.warn('[DocumentExtraction] Client mammoth .docx extraction failed, trying server fallback:', docxErr);
    }
  }

  // 3. PDF / .doc / Scanned Image extraction via off-thread worker + server OCR/parser
  const processed = await processDocumentOffThread(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.85,
    enhanceContrast: true,
  });

  let text = (processed.text || '').trim();
  let resolvedMime = processed.mimeType || file.type || 'application/octet-stream';
  if (lowerName.endsWith('.pdf') && !resolvedMime.includes('pdf')) {
    resolvedMime = 'application/pdf';
  } else if (lowerName.endsWith('.doc') && resolvedMime === 'application/octet-stream') {
    resolvedMime = 'application/msword';
  }

  let extractionMethod: ExtractedUploadedDocument['extractionMethod'] = 'server-ocr';
  let serverDetectedLang: Language | undefined;

  if (!text && processed.base64) {
    try {
      const ocrRes = await convertMediaFileToText({
        fileData: processed.base64,
        mimeType: resolvedMime,
        fileName: file.name,
        language: preferredLang,
        extractMode: 'full',
      });
      text = (ocrRes.extractedText || '').trim();
      serverDetectedLang = ocrRes.detectedLanguage;
    } catch (ocrErr) {
      console.warn('[DocumentExtraction] Server OCR extraction failed:', ocrErr);
      extractionMethod = 'fallback';
    }
  }

  const detection = detectDocumentLanguage(text || file.name);
  const resolvedLang: Language =
    preferredLang !== 'auto'
      ? preferredLang
      : text
      ? (detection.confidence === 'low' && serverDetectedLang ? serverDetectedLang : detection.language)
      : serverDetectedLang || detection.language;

  return {
    text,
    originalLanguage: resolvedLang,
    detection,
    mimeType: resolvedMime,
    base64: processed.base64,
    fileName: file.name,
    fileSizeBytes: file.size,
    extractionMethod,
  };
}

/**
 * High-speed end-to-end OCR and document analysis:
 * 1. Offloads image resizing and contrast optimization to Web Worker
 * 2. Transmits lightweight, optimized payload to backend AI OCR
 */
export async function extractAndAnalyzeDocument(
  file: File,
  analysisType: 'risk_analysis' | 'compliance' | 'plain_explanation' | 'translate_document' | 'summarize',
  outputLanguages: Language[],
  customInstructions?: string,
  onStatusUpdate?: (msgOm: string, msgEn: string) => void
): Promise<AnalyzeDocumentResponse> {
  if (onStatusUpdate) {
    onStatusUpdate(
      'Suuraa qulqulleessaa fi saffisaan qopheessaa jira (Web Worker Off-Thread Processing)...',
      'Optimizing and resizing document image off-main-thread via Web Worker...'
    );
  }

  const processed = await processDocumentOffThread(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    enhanceContrast: true,
  });

  if (!processed.success) {
    throw new Error(processed.error || 'Failed to process document file.');
  }

  if (onStatusUpdate) {
    const ratioInfo = processed.compressionRatio ? ` [${processed.compressionRatio}% saffisaan qindeeffame]` : '';
    onStatusUpdate(
      `Xiinxala seeraa fi OCR jalqabaa jira${ratioInfo}...`,
      `Performing legal OCR extraction & precedent analysis...`
    );
  }

  return await analyzeLegalDocument({
    fileData: processed.base64 || null,
    mimeType: processed.mimeType,
    fileText: processed.text || '',
    fileName: processed.name,
    analysisType,
    outputLanguages,
    customInstructions,
  });
}
