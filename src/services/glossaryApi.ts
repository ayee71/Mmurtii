import { auth } from './firebase';
import type {
  GlossaryAuditRecord,
  GlossaryDomain,
  GlossaryEntryRecord,
  GlossaryEntryVersionRecord,
  GlossarySearchResponsePayload,
  GlossarySubmissionProposedEntry,
  GlossarySubmissionRecord,
  GlossarySubmissionStatus,
} from '../shared/legalGlossarySchema';

async function getGlossaryAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Public search continues unauthenticated; protected endpoints fail closed server-side
  }
  return headers;
}

async function parseGlossaryResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '');
    throw new Error(rawText || fallbackMessage);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || fallbackMessage);
  }
  return data as T;
}

export interface FetchGlossaryResponse extends GlossarySearchResponsePayload {
  ok: boolean;
  permissions?: {
    canSubmit: boolean;
    canReview: boolean;
  };
}

export async function fetchGlossaryEntries(params: {
  query?: string;
  domain?: GlossaryDomain | 'all';
  jurisdiction?: string;
  status?: 'approved' | 'archived' | 'all';
  page?: number;
  pageSize?: number;
}): Promise<FetchGlossaryResponse> {
  const search = new URLSearchParams();
  if (params.query) search.set('q', params.query);
  if (params.domain && params.domain !== 'all') search.set('domain', params.domain);
  if (params.jurisdiction && params.jurisdiction !== 'all') search.set('jurisdiction', params.jurisdiction);
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const res = await fetch(`/api/legal/glossary?${search.toString()}`, {
    method: 'GET',
    headers: await getGlossaryAuthHeaders(),
  });
  return parseGlossaryResponse<FetchGlossaryResponse>(res, 'Failed to load glossary entries.');
}

export async function fetchGlossaryEntryDetail(termId: string): Promise<{
  ok: boolean;
  entry: GlossaryEntryRecord;
  versions: GlossaryEntryVersionRecord[];
}> {
  const res = await fetch(`/api/legal/glossary/${encodeURIComponent(termId)}`, {
    method: 'GET',
    headers: await getGlossaryAuthHeaders(),
  });
  return parseGlossaryResponse(res, 'Failed to load glossary entry details.');
}

export async function submitGlossaryTermOrRevision(payload: {
  submissionType: 'new_term' | 'revision';
  targetTermId?: string;
  aiAssistedDraft?: boolean;
  proposedEntry: GlossarySubmissionProposedEntry;
}): Promise<{ ok: boolean; submission: GlossarySubmissionRecord }> {
  const res = await fetch('/api/legal/glossary/submissions', {
    method: 'POST',
    headers: await getGlossaryAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseGlossaryResponse(res, 'Failed to submit glossary proposal.');
}

export async function fetchGlossarySubmissions(params: {
  status?: GlossarySubmissionStatus | 'all';
  mineOnly?: boolean;
} = {}): Promise<{
  ok: boolean;
  count: number;
  isReviewer: boolean;
  submissions: GlossarySubmissionRecord[];
}> {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.mineOnly) search.set('mine', '1');

  const res = await fetch(`/api/legal/glossary/submissions?${search.toString()}`, {
    method: 'GET',
    headers: await getGlossaryAuthHeaders(),
  });
  return parseGlossaryResponse(res, 'Failed to load glossary submissions.');
}

export async function reviewGlossarySubmissionApi(payload: {
  submissionId: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  reviewerNote: string;
  editedProposedEntry?: Partial<GlossarySubmissionProposedEntry>;
}): Promise<{
  ok: boolean;
  submission: GlossarySubmissionRecord;
  approvedEntry?: GlossaryEntryRecord;
}> {
  const res = await fetch(
    `/api/legal/glossary/submissions/${encodeURIComponent(payload.submissionId)}/review`,
    {
      method: 'POST',
      headers: await getGlossaryAuthHeaders(),
      body: JSON.stringify({
        decision: payload.decision,
        reviewerNote: payload.reviewerNote,
        editedProposedEntry: payload.editedProposedEntry,
      }),
    }
  );
  return parseGlossaryResponse(res, 'Failed to submit glossary review decision.');
}

export async function archiveGlossaryEntryApi(
  termId: string,
  reason: string
): Promise<{ ok: boolean; entry: GlossaryEntryRecord }> {
  const res = await fetch(`/api/legal/glossary/${encodeURIComponent(termId)}/archive`, {
    method: 'POST',
    headers: await getGlossaryAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  return parseGlossaryResponse(res, 'Failed to archive glossary entry.');
}

export async function fetchGlossaryAuditLogs(termId?: string): Promise<{
  ok: boolean;
  count: number;
  logs: GlossaryAuditRecord[];
}> {
  const search = new URLSearchParams();
  if (termId) search.set('termId', termId);
  const res = await fetch(`/api/legal/glossary/audit?${search.toString()}`, {
    method: 'GET',
    headers: await getGlossaryAuthHeaders(),
  });
  return parseGlossaryResponse(res, 'Failed to load glossary audit logs.');
}
