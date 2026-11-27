import { addAnnotation, deleteAnnotation } from './annotationService';
import { isWriteLocked } from './signOutSafetyService';

export interface PrecedentPersonalNote {
  id: string;
  precedentId: string;
  fileNumber: string;
  title: string;
  content: string;
  audioDataUrl?: string;
  durationSeconds?: number;
  language: 'om' | 'am' | 'en';
  tag?: 'general' | 'issue' | 'ratio' | 'strategy' | 'citation';
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
  annotationId?: string;
}

const STORAGE_PREFIX = 'seera_precedent_personal_notes_';

function getStorageKey(precedentId: string): string {
  const sanitized = String(precedentId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${STORAGE_PREFIX}${sanitized}`;
}

export function getPrecedentPersonalNotes(precedentId: string): PrecedentPersonalNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(precedentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[PrecedentNoteService] Failed to parse personal notes:', err);
    return [];
  }
}

export function savePrecedentPersonalNote(
  noteInput: Omit<PrecedentPersonalNote, 'id' | 'createdAt'> & { id?: string }
): PrecedentPersonalNote {
  if (isWriteLocked()) {
    throw new Error('SIGN_OUT_WRITE_LOCKED:savePrecedentPersonalNote');
  }

  const existingNotes = getPrecedentPersonalNotes(noteInput.precedentId);
  const now = new Date().toISOString();
  const noteId = noteInput.id || `pnote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const finalNote: PrecedentPersonalNote = {
    ...noteInput,
    id: noteId,
    createdAt: noteInput.id ? existingNotes.find((n) => n.id === noteInput.id)?.createdAt || now : now,
    updatedAt: now,
  };

  const filtered = existingNotes.filter((n) => n.id !== noteId);
  const updatedList = [finalNote, ...filtered];

  try {
    localStorage.setItem(getStorageKey(noteInput.precedentId), JSON.stringify(updatedList));
  } catch (storageErr) {
    console.error('[PrecedentNoteService] LocalStorage save failed:', storageErr);
  }

  // Also bridge into AnnotationTool so the personal note is visible across both tools
  if (!finalNote.annotationId) {
    addAnnotation({
      documentId: noteInput.precedentId,
      selectedText: `[Voice Note: ${finalNote.title || `Galmee ${finalNote.fileNumber}`}]`,
      content: finalNote.content,
      tag: 'important',
      color: 'amber',
      authorName: finalNote.authorName || 'Abbaa Seeraa / Ogeessa',
      authorRole: 'personal_note',
      status: 'open',
    }).then((annId) => {
      finalNote.annotationId = annId;
      try {
        const latest = getPrecedentPersonalNotes(noteInput.precedentId);
        const idx = latest.findIndex((n) => n.id === noteId);
        if (idx >= 0) {
          latest[idx].annotationId = annId;
          localStorage.setItem(getStorageKey(noteInput.precedentId), JSON.stringify(latest));
        }
      } catch {}
    }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('seera_precedent_notes_changed', {
        detail: { precedentId: noteInput.precedentId, count: updatedList.length },
      })
    );
  }

  return finalNote;
}

export function deletePrecedentPersonalNote(precedentId: string, noteId: string): boolean {
  if (isWriteLocked()) return false;
  const existingNotes = getPrecedentPersonalNotes(precedentId);
  const target = existingNotes.find((n) => n.id === noteId);
  if (!target) return false;
  const updatedList = existingNotes.filter((n) => n.id !== noteId);

  try {
    localStorage.setItem(getStorageKey(precedentId), JSON.stringify(updatedList));
  } catch (storageErr) {
    console.warn('[PrecedentNoteService] Delete failed:', storageErr);
    return false;
  }

  if (target?.annotationId) {
    deleteAnnotation(target.annotationId).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('seera_precedent_notes_changed', {
        detail: { precedentId, count: updatedList.length },
      })
    );
  }
  return true;
}

export function getPrecedentNotesCount(precedentId: string): number {
  return getPrecedentPersonalNotes(precedentId).length;
}
