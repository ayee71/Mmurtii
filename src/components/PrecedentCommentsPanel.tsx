import React, { useState, useEffect } from 'react';
import {
  Building2,
  Lock,
  MessageSquarePlus,
  HelpCircle,
  FileText,
  Send,
  Trash2,
  CheckCircle2,
  CircleDot,
  Edit3,
  AlertCircle,
  Loader2,
  ShieldCheck,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import { getLocalInstitutions } from '../services/courtInstitutionService';
import {
  PrecedentComment,
  PrecedentCommentType,
  PrecedentCommentVisibility,
  subscribeToPrecedentComments,
  createPrecedentComment,
  updatePrecedentCommentContent,
  updatePrecedentCommentStatus,
  deletePrecedentComment,
  validatePrecedentCommentInput,
} from '../services/precedentCommentService';
import type { PrecedentInteractionType } from '../services/precedentAlertService';

interface PrecedentCommentsPanelProps {
  precedentId: string;
  fileNumber: string;
  precedentTitle?: string;
  currentLang: Language;
  autoOpen?: boolean;
  onPrecedentInteract?: (precedentId: string, interactionType: PrecedentInteractionType) => void;
}

export const PrecedentCommentsPanel: React.FC<PrecedentCommentsPanelProps> = ({
  precedentId,
  fileNumber,
  currentLang,
  autoOpen = false,
  onPrecedentInteract,
}) => {
  const { user, profile, authClaims } = useAuth();

  // Only verified institutional staff (verified email + server-issued institutionId & staff role) or superadmin with institution context
  const resolvedInstitutionId = authClaims.institutionId || (authClaims.isTrustedAdmin ? profile?.courtId || 'inst_oromia_supreme' : null);
  const isVerifiedInstitutionalUser = Boolean(
    user &&
      !user.isAnonymous &&
      authClaims.isEmailVerified &&
      (authClaims.isCourtStaff || authClaims.isTrustedAdmin) &&
      resolvedInstitutionId
  );

  const institutions = getLocalInstitutions();
  const matchedInst = institutions.find((i) => i.id === resolvedInstitutionId);
  const resolvedInstitutionName = matchedInst?.name || resolvedInstitutionId || 'Verified Judicial Institution';
  const resolvedAuthorName =
    profile?.visitorName || user?.displayName || user?.email?.split('@')[0] || 'Institutional Officer';
  const resolvedAuthorRole = authClaims.courtRole || (authClaims.isTrustedAdmin ? 'superadmin' : 'staff');

  const [isOpen, setIsOpen] = useState(Boolean(autoOpen));
  const [comments, setComments] = useState<PrecedentComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [commentType, setCommentType] = useState<PrecedentCommentType>('private_note');
  const [visibility, setVisibility] = useState<PrecedentCommentVisibility>('institution_private');
  const [content, setContent] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingType, setEditingType] = useState<PrecedentCommentType>('private_note');
  const [editingVisibility, setEditingVisibility] = useState<PrecedentCommentVisibility>('institution_private');

  const labels = {
    om: {
      toggle: 'Yaada & Gaaffii Dhuunfaa Dhaabbataa (Institutional Notes)',
      verifiedBadge: 'Dhaabbata Mirkanaa\'e',
      lockedTitle: 'Miseensota Dhaabbilee Mirkanaa\'aniif Qofa (Verified Institutional Access Only)',
      lockedDesc:
        'Yaada dhuunfaa ykn gaaffii seeraa murtii kana irratti barreessuuf, akkaawuntii email mirkanaa\'ee fi mirga dhaabbata mana murtii (verified institutional claims) qabaachuun dirqama.',
      noteTab: 'Yaadannoo Dhuunfaa (Private Note)',
      questionTab: 'Gaaffii Seeraa (Legal Question)',
      instScope: 'Dhaabbata Koo Qofaaf (Institution-Private)',
      personalScope: 'Ana Qofaaf (Personal-Private)',
      placeholder:
        'Yaadannoo dhuunfaa ykn gaaffii seeraa murtii kana irratti barreessi (Dhaabbata biroo biratti hin mul\'atu)...',
      submit: 'Olkaa\'i (Save Private Note)',
      saving: 'Olkaa\'amaa jira...',
      empty: 'Yaadannoon ykn gaaffiin dhaabbata keessanii murtii kanaaf hin galmoofne.',
      openStatus: 'Banaa (Open)',
      resolvedStatus: 'Furame (Resolved)',
      edit: 'Gulaali',
      saveEdit: 'Jijjiirama Olkaa\'i',
      cancel: 'Dhiisi',
      delete: 'Haqi',
    },
    am: {
      toggle: 'የተቋም የግል ማስታወሻ እና ጥያቄዎች (Institutional Notes)',
      verifiedBadge: 'የተረጋገጠ ተቋም',
      lockedTitle: 'ለተረጋገጡ የተቋም ተጠቃሚዎች ብቻ (Verified Institutional Users Only)',
      lockedDesc:
        'በዚህ ውሳኔ ላይ የግል ማስታወሻ ወይም የሕግ ጥያቄ ለመመዝገብ የተረጋገጠ ኢሜይል እና የተቋም ፈቃድ (institutional role) ያስፈልጋል።',
      noteTab: 'የግል ማስታወሻ (Private Note)',
      questionTab: 'የሕግ ጥያቄ (Legal Question)',
      instScope: 'ለተቋሜ ብቻ (Institution-Private)',
      personalScope: 'ለእኔ ብቻ (Personal-Private)',
      placeholder: 'በዚህ የሰበር ውሳኔ ላይ የግል ማስታወሻ ወይም የሕግ ጥያቄ ይጻፉ (ለሌሎች ተቋማት አይታይም)...',
      submit: 'አስቀምጥ (Save Private Note)',
      saving: 'በማስቀመጥ ላይ...',
      empty: 'ለዚህ ውሳኔ የተመዘገበ የተቋም ማስታወሻ ወይም ጥያቄ የለም።',
      openStatus: 'ክፍት (Open)',
      resolvedStatus: 'ተፈቷል (Resolved)',
      edit: 'አርም',
      saveEdit: 'ለውጡን አስቀምጥ',
      cancel: 'ሰርዝ',
      delete: 'ሰርዝ',
    },
    en: {
      toggle: 'Verified Institutional Notes & Questions',
      verifiedBadge: 'Verified Institution',
      lockedTitle: 'Verified Institutional Users Only',
      lockedDesc:
        'Posting or reading private institutional notes and legal questions on this precedent requires a verified email account with institutional staff claims.',
      noteTab: 'Private Note',
      questionTab: 'Legal Question',
      instScope: 'My Institution Only',
      personalScope: 'Personal Only (Just Me)',
      placeholder:
        'Write a private institutional note or legal question on this precedent (strictly isolated from other institutions and the public)...',
      submit: 'Save Private Entry',
      saving: 'Saving...',
      empty: 'No institutional private notes or questions recorded for this precedent yet.',
      openStatus: 'Open',
      resolvedStatus: 'Resolved',
      edit: 'Edit',
      saveEdit: 'Save Changes',
      cancel: 'Cancel',
      delete: 'Delete',
    },
  }[currentLang];

  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (!isOpen || !isVerifiedInstitutionalUser || !user?.uid || !resolvedInstitutionId) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const unsubscribe = subscribeToPrecedentComments(
      {
        precedentId,
        authorUid: user.uid,
        institutionId: resolvedInstitutionId,
      },
      (list) => {
        setComments(list);
        setLoading(false);
      },
      (err) => {
        let friendly = 'Unable to load institutional notes right now.';
        try {
          const parsed = JSON.parse(err?.message || '{}');
          if (parsed?.error) friendly = `Firestore access notice: ${parsed.error}`;
        } catch {
          if (err?.message) friendly = err.message;
        }
        setErrorMsg(friendly);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, isVerifiedInstitutionalUser, user?.uid, resolvedInstitutionId, precedentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerifiedInstitutionalUser || !user?.uid || !resolvedInstitutionId) return;

    const validation = validatePrecedentCommentInput({
      precedentId,
      fileNumber,
      institutionId: resolvedInstitutionId,
      content,
    });
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid note input.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await createPrecedentComment({
        precedentId,
        fileNumber,
        authorUid: user.uid,
        authorName: resolvedAuthorName,
        authorRole: resolvedAuthorRole,
        institutionId: resolvedInstitutionId,
        institutionName: resolvedInstitutionName,
        commentType,
        visibility,
        content,
      });
      setComments((prev) =>
        prev.some((item) => item.commentId === created.commentId) ? prev : [created, ...prev]
      );
      setContent('');
      if (onPrecedentInteract) {
        onPrecedentInteract(precedentId, 'comment');
      }
    } catch (err: any) {
      let friendly = 'Failed to save institutional note.';
      try {
        const parsed = JSON.parse(err?.message || '{}');
        if (parsed?.error) friendly = `Save blocked: ${parsed.error}`;
      } catch {
        if (err?.message) friendly = err.message;
      }
      setErrorMsg(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    setErrorMsg(null);
    try {
      await updatePrecedentCommentContent(commentId, {
        content: editingText,
        commentType: editingType,
        visibility: editingVisibility,
      });
      setComments((prev) =>
        prev.map((item) =>
          item.commentId === commentId
            ? {
                ...item,
                content: editingText.trim(),
                commentType: editingType,
                visibility: editingVisibility,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      setEditingId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update note.');
    }
  };

  const handleToggleStatus = async (item: PrecedentComment) => {
    const nextStatus = item.status === 'resolved' ? 'open' : 'resolved';
    setErrorMsg(null);
    try {
      await updatePrecedentCommentStatus(item.commentId, nextStatus);
      setComments((prev) =>
        prev.map((c) => (c.commentId === item.commentId ? { ...c, status: nextStatus } : c))
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (commentId: string) => {
    setErrorMsg(null);
    try {
      await deletePrecedentComment(commentId);
      setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete note.');
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-slate-950/90 border border-slate-800 overflow-hidden">
      {/* Collapsible Bar */}
      <button
        type="button"
        onClick={() =>
          setIsOpen((prev) => {
            const next = !prev;
            if (next && onPrecedentInteract) {
              onPrecedentInteract(precedentId, 'view_comments');
            }
            return next;
          })
        }
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-900/70 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {isVerifiedInstitutionalUser ? <Building2 className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
          </span>
          <span className="text-xs font-bold text-slate-200">{labels.toggle}</span>
          {isVerifiedInstitutionalUser ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3" />
              {labels.verifiedBadge}: {resolvedInstitutionName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
              <Lock className="w-3 h-3" /> Institutional Lock
            </span>
          )}
          {comments.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 text-[10px] font-mono font-bold">
              {comments.length}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-800 space-y-4">
          {!isVerifiedInstitutionalUser ? (
            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-start gap-3 text-xs">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">{labels.lockedTitle}</p>
                <p className="text-slate-400 leading-relaxed">{labels.lockedDesc}</p>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="break-words">{errorMsg}</span>
                </div>
              )}

              {/* New Note / Question Form */}
              <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Type Toggle */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCommentType('private_note')}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                        commentType === 'private_note'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{labels.noteTab}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentType('legal_question')}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                        commentType === 'legal_question'
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{labels.questionTab}</span>
                    </button>
                  </div>

                  {/* Privacy Visibility Selector */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVisibility('institution_private')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer ${
                        visibility === 'institution_private'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      <Building2 className="w-3 h-3" />
                      <span>{labels.instScope}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('personal_private')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer ${
                        visibility === 'personal_private'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>{labels.personalScope}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={labels.placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>
                    {resolvedAuthorName} ({resolvedAuthorRole}) • {resolvedInstitutionName}
                  </span>
                  <button
                    type="submit"
                    disabled={submitting || content.trim().length < 2}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{submitting ? labels.saving : labels.submit}</span>
                  </button>
                </div>
              </form>

              {/* Existing Notes & Questions */}
              {loading ? (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Loading institutional notes...</span>
                </div>
              ) : comments.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                  <MessageSquarePlus className="w-5 h-5 text-slate-500" />
                  <span>{labels.empty}</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((item) => {
                    const isAuthor = item.authorUid === user?.uid;
                    const isEditing = editingId === item.commentId;

                    return (
                      <div
                        key={item.commentId}
                        className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                item.commentType === 'legal_question'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {item.commentType === 'legal_question' ? '❓ Legal Question' : '📝 Private Note'}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                item.visibility === 'personal_private'
                                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {item.visibility === 'personal_private' ? '🔒 Personal Only' : `🏛️ ${item.institutionName}`}
                            </span>

                            <span className="font-bold text-slate-200">{item.authorName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{item.authorRole}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isAuthor && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer ${
                                  item.status === 'resolved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-950 text-amber-300 border-slate-700'
                                }`}
                              >
                                {item.status === 'resolved' ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <CircleDot className="w-3 h-3" />
                                )}
                                <span>{item.status === 'resolved' ? labels.resolvedStatus : labels.openStatus}</span>
                              </button>
                            )}

                            {isAuthor && !isEditing && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(item.commentId);
                                  setEditingText(item.content);
                                  setEditingType(item.commentType);
                                  setEditingVisibility(item.visibility);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 cursor-pointer"
                                title={labels.edit}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(isAuthor || authClaims.courtRole === 'court_admin' || authClaims.isTrustedAdmin) && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item.commentId)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                                title={labels.delete}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={editingType}
                                onChange={(e) => setEditingType(e.target.value as PrecedentCommentType)}
                                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-200"
                              >
                                <option value="private_note">{labels.noteTab}</option>
                                <option value="legal_question">{labels.questionTab}</option>
                              </select>
                              <select
                                value={editingVisibility}
                                onChange={(e) => setEditingVisibility(e.target.value as PrecedentCommentVisibility)}
                                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-200"
                              >
                                <option value="institution_private">{labels.instScope}</option>
                                <option value="personal_private">{labels.personalScope}</option>
                              </select>
                            </div>
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-slate-100"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
                              >
                                {labels.cancel}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.commentId)}
                                className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                              >
                                {labels.saveEdit}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        )}

                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PrecedentCommentsPanel;
