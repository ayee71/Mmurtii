import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { getApiHeaders } from './api';
import { getStoredAiOutputLanguage } from './storage';
import { AiOutputLanguage, normalizeAiOutputLanguage } from '../shared/aiOutputLanguage';

export type AIProviderMode = 'openai' | 'gemini' | 'dual';

export interface SeeraAIWorkflowClientRequest {
  prompt: string;
  context?: string;
  mode?: AIProviderMode;
  outputLanguage?: AiOutputLanguage;
  telegramChatId?: string | number;
  saveToFirebase?: boolean;
}

export interface SeeraAIWorkflowEngineStatus {
  geminiAvailable: boolean;
  openaiAvailable: boolean;
  telegramAvailable: boolean;
  geminiModel: string;
  openaiModel: string;
}

export interface SeeraAIWorkflowClientResult {
  analysisId?: string;
  savedToFirebase: boolean;
  firebaseNotice?: string;
  mode: AIProviderMode;
  prompt: string;
  openaiResponse: string;
  geminiResponse: string;
  synthesis: string;
  telegramDispatched: boolean;
  telegramError?: string;
  providers: SeeraAIWorkflowEngineStatus;
  createdAt: string;
}

export interface SavedSeeraAIAnalysisRecord {
  analysisId: string;
  userId: string;
  mode: AIProviderMode;
  prompt: string;
  context?: string;
  openaiResponse?: string;
  geminiResponse?: string;
  synthesis?: string;
  telegramChatId?: string;
  telegramDispatched?: boolean;
  createdAt: string;
}

function generateValidAnalysisId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `seera_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export async function getSeeraAIWorkflowStatus(): Promise<SeeraAIWorkflowEngineStatus> {
  const res = await fetch('/api/seeraai/workflow/status', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    return {
      geminiAvailable: true,
      openaiAvailable: false,
      telegramAvailable: false,
      geminiModel: 'gemini-4-hydrogen',
      openaiModel: 'gpt-4o',
    };
  }
  return json.status;
}

export async function saveSeeraAIAnalysisToFirestore(
  result: Pick<
    SeeraAIWorkflowClientResult,
    'mode' | 'prompt' | 'openaiResponse' | 'geminiResponse' | 'synthesis' | 'telegramDispatched' | 'createdAt'
  >,
  options?: { context?: string; telegramChatId?: string | number }
): Promise<{ saved: boolean; analysisId?: string; notice?: string }> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !user.emailVerified) {
    return {
      saved: false,
      notice: 'Firestore irratti olkaa\'uuf eenyummaa email mirkanaa\'een seenuun barbaachisaadha.',
    };
  }

  const analysisId = generateValidAnalysisId();
  const docPath = `seeraai_analyses/${analysisId}`;

  const payload: Record<string, any> = {
    analysisId,
    userId: user.uid,
    mode: result.mode,
    prompt: (result.prompt || '').slice(0, 20000),
    createdAt: (result.createdAt || new Date().toISOString()).slice(0, 64),
    timestamp: serverTimestamp(),
  };

  if (options?.context && options.context.trim()) {
    payload.context = options.context.trim().slice(0, 40000);
  }
  if (result.openaiResponse) {
    payload.openaiResponse = result.openaiResponse.slice(0, 50000);
  }
  if (result.geminiResponse) {
    payload.geminiResponse = result.geminiResponse.slice(0, 50000);
  }
  if (result.synthesis) {
    payload.synthesis = result.synthesis.slice(0, 50000);
  }
  if (options?.telegramChatId !== undefined && String(options.telegramChatId).trim()) {
    payload.telegramChatId = String(options.telegramChatId).trim().slice(0, 64);
  }
  if (typeof result.telegramDispatched === 'boolean') {
    payload.telegramDispatched = result.telegramDispatched;
  }

  try {
    await setDoc(doc(db, 'seeraai_analyses', analysisId), payload);
    return { saved: true, analysisId };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, docPath);
    return {
      saved: false,
      notice: err instanceof Error ? err.message : 'Firestore olkaa\'uun hin milkoofne.',
    };
  }
}

export async function listSavedSeeraAIAnalyses(maxItems = 10): Promise<SavedSeeraAIAnalysisRecord[]> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !user.emailVerified) {
    return [];
  }

  const colPath = 'seeraai_analyses';
  try {
    const q = query(
      collection(db, colPath),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SavedSeeraAIAnalysisRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colPath);
    return [];
  }
}

export async function sendWorkflowSummaryToTelegram(
  telegramChatId: string | number,
  text: string
): Promise<{ success: boolean; messageId?: number | null; error?: string }> {
  const res = await fetch('/api/seeraai/telegram-send', {
    method: 'POST',
    headers: await getApiHeaders(),
    body: JSON.stringify({ telegramChatId: String(telegramChatId).trim(), text }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Telegram erguun hin milkoofne.');
  }
  return json;
}

export async function runSeeraAIWorkflow(
  payload: SeeraAIWorkflowClientRequest
): Promise<SeeraAIWorkflowClientResult> {
  const headers = await getApiHeaders();
  const resolvedLang = normalizeAiOutputLanguage(
    payload.outputLanguage,
    getStoredAiOutputLanguage()
  ).language;
  const res = await fetch('/api/seeraai/workflow', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: payload.prompt,
      context: payload.context,
      mode: payload.mode || 'dual',
      outputLanguage: resolvedLang,
      language: resolvedLang,
      telegramChatId: payload.telegramChatId,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json?.data) {
    throw new Error(json?.error || 'SEERAAI Dual AI workflow failed.');
  }

  const data = json.data;
  let savedToFirebase = false;
  let analysisId: string | undefined;
  let firebaseNotice: string | undefined;

  if (payload.saveToFirebase) {
    const saveOutcome = await saveSeeraAIAnalysisToFirestore(data, {
      context: payload.context,
      telegramChatId: payload.telegramChatId,
    });
    savedToFirebase = saveOutcome.saved;
    analysisId = saveOutcome.analysisId;
    firebaseNotice = saveOutcome.notice;
  }

  return {
    ...data,
    analysisId,
    savedToFirebase,
    firebaseNotice,
  };
}
