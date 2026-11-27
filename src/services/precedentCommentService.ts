import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export type PrecedentCommentType = 'private_note' | 'legal_question';
export type PrecedentCommentVisibility = 'institution_private' | 'personal_private';
export type PrecedentCommentStatus = 'open' | 'resolved';

export interface PrecedentComment {
  commentId: string;
  precedentId: string;
  fileNumber: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  institutionId: string;
  institutionName: string;
  commentType: PrecedentCommentType;
  visibility: PrecedentCommentVisibility;
  content: string;
  status: PrecedentCommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrecedentCommentInput {
  precedentId: string;
  fileNumber: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  institutionId: string;
  institutionName: string;
  commentType: PrecedentCommentType;
  visibility: PrecedentCommentVisibility;
  content: string;
}

const COLLECTION_NAME = 'precedent_comments';
const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

export function validatePrecedentCommentInput(input: {
  precedentId: string;
  fileNumber: string;
  institutionId: string;
  content: string;
}): { valid: boolean; error?: string } {
  const cleanContent = (input.content || '').trim();
  if (cleanContent.length < 2) {
    return { valid: false, error: 'Note or question must be at least 2 characters long.' };
  }
  if (cleanContent.length > 4000) {
    return { valid: false, error: 'Note or question cannot exceed 4,000 characters.' };
  }
  if (!input.precedentId || input.precedentId.length > 128) {
    return { valid: false, error: 'Invalid precedent identifier.' };
  }
  if (!input.fileNumber || input.fileNumber.length > 64) {
    return { valid: false, error: 'Invalid precedent file number.' };
  }
  if (!input.institutionId || input.institutionId.length > 128 || !ID_PATTERN.test(input.institutionId)) {
    return { valid: false, error: 'Verified institutional membership (valid institutionId) is required.' };
  }
  return { valid: true };
}

function normalizeTimestampToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof (val as any)?.toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapDocToComment(id: string, data: Record<string, any>): PrecedentComment {
  return {
    commentId: String(data.commentId || id),
    precedentId: String(data.precedentId || ''),
    fileNumber: String(data.fileNumber || ''),
    authorUid: String(data.authorUid || ''),
    authorName: String(data.authorName || 'Institutional Officer'),
    authorRole: String(data.authorRole || 'staff'),
    institutionId: String(data.institutionId || ''),
    institutionName: String(data.institutionName || ''),
    commentType: data.commentType === 'legal_question' ? 'legal_question' : 'private_note',
    visibility: data.visibility === 'personal_private' ? 'personal_private' : 'institution_private',
    content: String(data.content || ''),
    status: data.status === 'resolved' ? 'resolved' : 'open',
    createdAt: normalizeTimestampToIso(data.createdAt),
    updatedAt: normalizeTimestampToIso(data.updatedAt),
  };
}

function createCommentId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `pc_${Date.now()}_${rand}`;
}

function buildPermissionErrorIfNeeded(error: unknown, op: OperationType, path: string): Error {
  handleFirestoreError(error, op, path);
  const message = error instanceof Error ? error.message : String(error);
  const infoPayload = {
    error: message,
    operationType: op,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
    },
  };
  return new Error(JSON.stringify(infoPayload));
}

/**
 * Fetches private notes & questions visible to the verified institutional user
 * for a specific precedent:
 * 1) Institutional private notes/questions scoped strictly to their institutionId
 * 2) Author's own personal private notes/questions scoped strictly to their authorUid
 */
export async function listPrecedentComments(params: {
  precedentId: string;
  authorUid: string;
  institutionId: string;
}): Promise<PrecedentComment[]> {
  const { precedentId, authorUid, institutionId } = params;
  if (!precedentId || !authorUid || !institutionId) {
    return [];
  }

  const results = new Map<string, PrecedentComment>();

  try {
    const instQuery = query(
      collection(db, COLLECTION_NAME),
      where('precedentId', '==', precedentId),
      where('institutionId', '==', institutionId),
      where('visibility', '==', 'institution_private')
    );
    const instSnap = await getDocs(instQuery);
    instSnap.forEach((snap) => {
      const mapped = mapDocToComment(snap.id, snap.data());
      results.set(mapped.commentId, mapped);
    });
  } catch (error) {
    throw buildPermissionErrorIfNeeded(error, OperationType.LIST, COLLECTION_NAME);
  }

  try {
    const personalQuery = query(
      collection(db, COLLECTION_NAME),
      where('precedentId', '==', precedentId),
      where('authorUid', '==', authorUid),
      where('institutionId', '==', institutionId),
      where('visibility', '==', 'personal_private')
    );
    const personalSnap = await getDocs(personalQuery);
    personalSnap.forEach((snap) => {
      const mapped = mapDocToComment(snap.id, snap.data());
      results.set(mapped.commentId, mapped);
    });
  } catch (error) {
    throw buildPermissionErrorIfNeeded(error, OperationType.LIST, COLLECTION_NAME);
  }

  return Array.from(results.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Real-time Firestore listener for comments on a single precedent (both
 * institution-private notes and the user's own personal-private notes).
 */
export function subscribeToPrecedentComments(
  params: {
    precedentId: string;
    authorUid: string;
    institutionId: string;
  },
  onUpdate: (comments: PrecedentComment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { precedentId, authorUid, institutionId } = params;
  if (!precedentId || !authorUid || !institutionId) {
    onUpdate([]);
    return () => {};
  }

  const instMap = new Map<string, PrecedentComment>();
  const personalMap = new Map<string, PrecedentComment>();

  const emitMerged = () => {
    const merged = new Map<string, PrecedentComment>();
    instMap.forEach((v, k) => merged.set(k, v));
    personalMap.forEach((v, k) => merged.set(k, v));
    onUpdate(
      Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  };

  const instQuery = query(
    collection(db, COLLECTION_NAME),
    where('precedentId', '==', precedentId),
    where('institutionId', '==', institutionId),
    where('visibility', '==', 'institution_private')
  );

  const personalQuery = query(
    collection(db, COLLECTION_NAME),
    where('precedentId', '==', precedentId),
    where('authorUid', '==', authorUid),
    where('institutionId', '==', institutionId),
    where('visibility', '==', 'personal_private')
  );

  const unsubInst = onSnapshot(
    instQuery,
    (snapshot) => {
      instMap.clear();
      snapshot.forEach((snap) => {
        const mapped = mapDocToComment(snap.id, snap.data());
        instMap.set(mapped.commentId, mapped);
      });
      emitMerged();
    },
    (error) => {
      const wrapped = buildPermissionErrorIfNeeded(error, OperationType.LIST, COLLECTION_NAME);
      if (onError) onError(wrapped);
    }
  );

  const unsubPersonal = onSnapshot(
    personalQuery,
    (snapshot) => {
      personalMap.clear();
      snapshot.forEach((snap) => {
        const mapped = mapDocToComment(snap.id, snap.data());
        personalMap.set(mapped.commentId, mapped);
      });
      emitMerged();
    },
    (error) => {
      const wrapped = buildPermissionErrorIfNeeded(error, OperationType.LIST, COLLECTION_NAME);
      if (onError) onError(wrapped);
    }
  );

  return () => {
    unsubInst();
    unsubPersonal();
  };
}

/**
 * Real-time institutional feed listener across all precedents inside the user's
 * verified institution, plus discovery of all precedents the user previously
 * commented on (including personal_private entries).
 */
export function subscribeToInstitutionPrecedentComments(
  params: {
    institutionId: string;
    authorUid: string;
  },
  onUpdate: (payload: {
    institutionComments: PrecedentComment[];
    newlyAddedComments: PrecedentComment[];
    userCommentedPrecedentIds: string[];
  }) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { institutionId, authorUid } = params;
  if (!institutionId || !authorUid) {
    onUpdate({
      institutionComments: [],
      newlyAddedComments: [],
      userCommentedPrecedentIds: [],
    });
    return () => {};
  }

  let initialInstSynced = false;
  const seenCommentIds = new Set<string>();
  let latestInstitutionComments: PrecedentComment[] = [];
  const instAuthoredPrecedentIds = new Set<string>();
  const personalAuthoredPrecedentIds = new Set<string>();

  const emit = (newlyAddedComments: PrecedentComment[]) => {
    const combinedIds = new Set<string>();
    instAuthoredPrecedentIds.forEach((id) => combinedIds.add(id));
    personalAuthoredPrecedentIds.forEach((id) => combinedIds.add(id));
    onUpdate({
      institutionComments: latestInstitutionComments,
      newlyAddedComments,
      userCommentedPrecedentIds: Array.from(combinedIds),
    });
  };

  const instFeedQuery = query(
    collection(db, COLLECTION_NAME),
    where('institutionId', '==', institutionId),
    where('visibility', '==', 'institution_private')
  );

  const myPersonalQuery = query(
    collection(db, COLLECTION_NAME),
    where('authorUid', '==', authorUid),
    where('institutionId', '==', institutionId),
    where('visibility', '==', 'personal_private')
  );

  const unsubInst = onSnapshot(
    instFeedQuery,
    (snapshot) => {
      const all: PrecedentComment[] = [];
      instAuthoredPrecedentIds.clear();
      snapshot.forEach((snap) => {
        const mapped = mapDocToComment(snap.id, snap.data());
        all.push(mapped);
        if (mapped.authorUid === authorUid && mapped.precedentId) {
          instAuthoredPrecedentIds.add(mapped.precedentId);
        }
      });

      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      latestInstitutionComments = all;

      const addedNow: PrecedentComment[] = [];
      if (!initialInstSynced) {
        all.forEach((c) => seenCommentIds.add(c.commentId));
        initialInstSynced = true;
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !seenCommentIds.has(change.doc.id)) {
            const mapped = mapDocToComment(change.doc.id, change.doc.data());
            seenCommentIds.add(mapped.commentId);
            addedNow.push(mapped);
          }
        });
      }

      emit(addedNow);
    },
    (error) => {
      const wrapped = buildPermissionErrorIfNeeded(error, OperationType.LIST, COLLECTION_NAME);
      if (onError) onError(wrapped);
    }
  );

  const unsubPersonal = onSnapshot(
    myPersonalQuery,
    (snapshot) => {
      personalAuthoredPrecedentIds.clear();
      snapshot.forEach((snap) => {
        const data = snap.data();
        if (typeof data?.precedentId === 'string' && data.precedentId) {
          personalAuthoredPrecedentIds.add(data.precedentId);
        }
      });
      emit([]);
    },
    (error) => {
      const wrapped = buildPermissionErrorIfNeeded(error, OperationType.LIST, COLLECTION_NAME);
      if (onError) onError(wrapped);
    }
  );

  return () => {
    unsubInst();
    unsubPersonal();
  };
}

/**
 * Creates a verified institutional private note or legal question on a specific precedent.
 */
export async function createPrecedentComment(input: CreatePrecedentCommentInput): Promise<PrecedentComment> {
  const validation = validatePrecedentCommentInput({
    precedentId: input.precedentId,
    fileNumber: input.fileNumber,
    institutionId: input.institutionId,
    content: input.content,
  });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid precedent comment input.');
  }

  if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== input.authorUid) {
    throw new Error('Verified non-anonymous Firebase authentication is required.');
  }

  const commentId = createCommentId();
  const docPath = `${COLLECTION_NAME}/${commentId}`;
  const cleanContent = input.content.trim();
  const cleanAuthorName = (input.authorName || 'Institutional Officer').trim().slice(0, 120);
  const cleanAuthorRole = (input.authorRole || 'legal_expert').trim().slice(0, 64);
  const cleanInstName = (input.institutionName || input.institutionId).trim().slice(0, 200);

  const payload = {
    commentId,
    precedentId: input.precedentId.slice(0, 128),
    fileNumber: input.fileNumber.slice(0, 64),
    authorUid: input.authorUid,
    authorName: cleanAuthorName,
    authorRole: cleanAuthorRole,
    institutionId: input.institutionId,
    institutionName: cleanInstName,
    commentType: input.commentType,
    visibility: input.visibility,
    content: cleanContent,
    status: 'open' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, commentId), payload);
  } catch (error) {
    throw buildPermissionErrorIfNeeded(error, OperationType.CREATE, docPath);
  }

  const nowIso = new Date().toISOString();
  return {
    commentId,
    precedentId: payload.precedentId,
    fileNumber: payload.fileNumber,
    authorUid: payload.authorUid,
    authorName: payload.authorName,
    authorRole: payload.authorRole,
    institutionId: payload.institutionId,
    institutionName: payload.institutionName,
    commentType: payload.commentType,
    visibility: payload.visibility,
    content: payload.content,
    status: 'open',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Updates content, commentType, or visibility of an author's own precedent comment.
 */
export async function updatePrecedentCommentContent(
  commentId: string,
  updates: {
    content: string;
    commentType: PrecedentCommentType;
    visibility: PrecedentCommentVisibility;
  }
): Promise<void> {
  const cleanContent = (updates.content || '').trim();
  if (cleanContent.length < 2 || cleanContent.length > 4000) {
    throw new Error('Note or question must be between 2 and 4,000 characters.');
  }

  const docPath = `${COLLECTION_NAME}/${commentId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, commentId), {
      content: cleanContent,
      commentType: updates.commentType,
      visibility: updates.visibility,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw buildPermissionErrorIfNeeded(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Toggles resolution status ('open' | 'resolved') on an author's precedent question/note.
 */
export async function updatePrecedentCommentStatus(
  commentId: string,
  nextStatus: PrecedentCommentStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${commentId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, commentId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw buildPermissionErrorIfNeeded(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Deletes an institutional precedent note/question (author or institution admin).
 */
export async function deletePrecedentComment(commentId: string): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${commentId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, commentId));
  } catch (error) {
    throw buildPermissionErrorIfNeeded(error, OperationType.DELETE, docPath);
  }
}
