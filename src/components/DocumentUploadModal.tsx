import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Folder,
  FolderPlus,
  Tag,
  Globe,
  Check,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import {
  LegalFolder,
  SavedLegalDocument,
  createFolder,
  saveDocument,
  uploadFileToFirebaseStorage,
} from '../services/storage';
import { extractDocumentPreservingLanguage } from '../services/documentExtractionService';
import { extractDocumentMetadata } from '../services/api';
import {
  detectDocumentLanguage,
  getLanguageDisplayName,
  parseTagInput,
} from '../utils/languageDetect';
import { auth } from '../services/firebase';
import { backgroundSyncManager } from '../services/backgroundSync';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  folders: LegalFolder[];
  defaultFolderId?: string;
  onFoldersChanged: (updatedFolders: LegalFolder[]) => void;
  onUploaded: (createdDocs: SavedLegalDocument[]) => void;
}

const KEYWORD_PRESETS = [
  'Contract',
  'Waliigaltee',
  'ውል',
  'Appeal',
  'Labor Law',
  'Property',
  'Evidence',
  'Cassation',
  'ካሳ',
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  folders,
  defaultFolderId,
  onFoldersChanged,
  onUploaded,
}) => {
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [languageChoice, setLanguageChoice] = useState<Language | 'auto'>('auto');
  const [detectedPreviewLang, setDetectedPreviewLang] = useState<Language | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>(
    defaultFolderId && defaultFolderId !== 'all' && defaultFolderId !== 'bookmarked' && defaultFolderId !== 'unfiled'
      ? defaultFolderId
      : 'none'
  );
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [isCreatingInlineFolder, setIsCreatingInlineFolder] = useState(false);
  const [inlineFolderName, setInlineFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const uiText = {
    title:
      currentLang === 'om'
        ? 'Sanada Seeraa Ol-fe’i'
        : currentLang === 'am'
        ? 'የሕግ ሰነድ ስቀል'
        : 'Upload Legal Document',
    subtitle:
      currentLang === 'om'
        ? 'Afaan Oromoo, Amaariffa ykn Ingiliffaan fe’i — afaan jalqabaa osoo hin jijjiiramin eegama.'
        : currentLang === 'am'
        ? 'በአፋን ኦሮሞ፣ በአማርኛ ወይም በእንግሊዝኛ ይስቀሉ — ዋናው ቋንቋ ሳይቀየር ይቀመጣል።'
        : 'Upload in Afaan Oromoo, Amharic, or English — original text & language preserved verbatim.',
    fileTab:
      currentLang === 'om'
        ? 'Faayila Ol-fe’i (PDF / Word / TXT / Suuraa)'
        : currentLang === 'am'
        ? 'ፋይል ስቀል (PDF / Word / TXT / ምስል)'
        : 'Upload File(s)',
    textTab:
      currentLang === 'om'
        ? 'Barruu Galchi (Paste / Type)'
        : currentLang === 'am'
        ? 'ጽሑፍ አስገባ (Paste / Type)'
        : 'Paste / Write Text',
    langLabel:
      currentLang === 'om'
        ? 'Afaan Jalqabaa Sanadaa (Original Language)'
        : currentLang === 'am'
        ? 'የሰነዱ ዋና ቋንቋ (Original Language)'
        : 'Document Original Language',
    folderLabel:
      currentLang === 'om'
        ? 'Foldara Keessa Kaa’i (Folder)'
        : currentLang === 'am'
        ? 'ማህደር ምረጥ (Folder)'
        : 'Organize Into Folder',
    tagsLabel:
      currentLang === 'om'
        ? 'Jechoota Ijoo / Tags (Keywords)'
        : currentLang === 'am'
        ? 'ቁልፍ ቃላት / መለያዎች (Tags)'
        : 'Keyword Tags',
    saveBtn:
      currentLang === 'om'
        ? 'Sanada Ol-kaayi'
        : currentLang === 'am'
        ? 'ሰነዱን አስቀምጥ'
        : 'Upload & Save Document',
  };

  const inspectFileLanguagePreview = async (file: File) => {
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.txt') || lower.endsWith('.md') || file.type === 'text/plain') {
        const previewText = (await file.text()).slice(0, 4000);
        if (previewText.trim()) {
          setDetectedPreviewLang(detectDocumentLanguage(previewText).language);
        }
      } else if (lower.endsWith('.docx')) {
        const extracted = await extractDocumentPreservingLanguage(file, 'auto');
        if (extracted.text.trim()) {
          setDetectedPreviewLang(extracted.originalLanguage);
        }
      }
    } catch {
      // Optional preview only
    }
  };

  const handleFilesSelected = (incoming: File[], append: boolean = true) => {
    if (incoming.length === 0) return;
    setErrorMsg(null);
    setSelectedFiles((prev) => {
      const base = append ? prev : [];
      const seen = new Set(base.map((f) => `${f.name}::${f.size}::${f.lastModified}`));
      const merged = [...base];
      for (const file of incoming) {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      }
      if (!titleInput.trim() && merged.length === 1) {
        setTitleInput(merged[0].name.replace(/\.[^.]+$/, ''));
      }
      if (merged.length > 0 && base.length === 0) {
        void inspectFileLanguagePreview(merged[0]);
      }
      return merged;
    });
  };

  const handleRemoveSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const commitPendingTags = (raw: string) => {
    const parsed = parseTagInput(raw);
    if (parsed.length === 0) return;
    setTags((prev) => parseTagInput([...prev, ...parsed].join(',')));
    setTagDraft('');
  };

  const handleCreateInlineFolder = () => {
    const trimmed = inlineFolderName.trim();
    if (!trimmed) return;
    const created = createFolder(trimmed, 'amber');
    onFoldersChanged([...folders, created]);
    setTargetFolderId(created.id);
    setInlineFolderName('');
    setIsCreatingInlineFolder(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const extraTags = parseTagInput(tagDraft);
    const finalTags = parseTagInput([...tags, ...extraTags].join(','));
    const chosenFolder = targetFolderId === 'none' ? undefined : targetFolderId;

    if (inputMode === 'text') {
      const cleanText = pastedText.trim();
      if (!cleanText) {
        setErrorMsg(
          currentLang === 'om'
            ? 'Maaloo barreeffama sanadaa galchaa.'
            : currentLang === 'am'
            ? 'እባክዎ የሰነዱን ጽሑፍ ያስገቡ።'
            : 'Please enter or paste document text.'
        );
        return;
      }

      setIsSubmitting(true);
      setProgressText(currentLang === 'om' ? 'Sanada kuusaa jira...' : 'Saving document...');
      try {
        const detection = detectDocumentLanguage(cleanText);
        const origLang: Language = languageChoice === 'auto' ? detection.language : languageChoice;
        const resolvedTitle =
          titleInput.trim() ||
          cleanText.split('\n')[0].trim().slice(0, 65) ||
          'Uploaded Legal Document';

        const saved = saveDocument({
          title: resolvedTitle,
          content: cleanText,
          prompt: `Uploaded Text Document (${getLanguageDisplayName(origLang, 'short')})`,
          taskType: 'general',
          originalLanguage: origLang,
          languageLocked: languageChoice !== 'auto',
          outputLanguages: [origLang],
          tags: finalTags,
          folderId: chosenFolder,
          isUploaded: true,
        });

        if (auth?.currentUser?.uid) {
          void backgroundSyncManager.queueDocumentEdit(
            saved.id,
            {
              title: saved.title,
              content: saved.content,
              folderId: saved.folderId,
              tags: saved.tags,
              originalLanguage: saved.originalLanguage,
            },
            saved.title
          );
        }

        onUploaded([saved]);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to save document.');
      } finally {
        setIsSubmitting(false);
        setProgressText('');
      }
      return;
    }

    if (selectedFiles.length === 0) {
      setErrorMsg(
        currentLang === 'om'
          ? 'Maaloo faayila tokko yoo xiqqaate filadhaa.'
          : currentLang === 'am'
          ? 'እባክዎ ቢያንስ አንድ ፋይል ይምረጡ።'
          : 'Please choose at least one legal document file.'
      );
      return;
    }

    setIsSubmitting(true);
    const createdDocs: SavedLegalDocument[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgressText(
          `${i + 1}/${selectedFiles.length}: "${file.name}" (${
            currentLang === 'om'
              ? 'qabiyyee baasaa jira...'
              : currentLang === 'am'
              ? 'ጽሑፍ በማውጣት ላይ...'
              : 'extracting text...'
          })`
        );

        const extracted = await extractDocumentPreservingLanguage(file, languageChoice);
        const contentText = extracted.text || `[Uploaded file: ${file.name}]`;
        const origLang = extracted.originalLanguage;

        let caseName = '';
        let extractedDate = '';
        let docType = '';

        if (extracted.text && extracted.text.length >= 30 && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const meta = await extractDocumentMetadata(extracted.text.slice(0, 5000));
            caseName = meta.caseName || '';
            extractedDate = meta.date || '';
            docType = meta.docType || '';
          } catch {
            // Non-blocking AI metadata enrichment
          }
        }

        let storageUrl: string | undefined;
        try {
          if (auth?.currentUser?.emailVerified) {
            const res = await uploadFileToFirebaseStorage(file, file.name);
            storageUrl = res.url;
          }
        } catch {
          // Storage fallback: full extracted text + optional dataUrl stays local/IndexedDB + Firestore
        }

        const mergedTags = parseTagInput(
          [...finalTags, docType].filter(Boolean).join(',')
        );

        const docTitle =
          selectedFiles.length === 1 && titleInput.trim()
            ? titleInput.trim()
            : caseName || file.name.replace(/\.[^.]+$/, '');

        const saved = saveDocument({
          title: docTitle,
          content: contentText,
          prompt: `Uploaded File: ${file.name}`,
          taskType: 'general',
          originalLanguage: origLang,
          languageLocked: languageChoice !== 'auto',
          outputLanguages: [origLang],
          tags: mergedTags,
          caseName: caseName || undefined,
          extractedDate: extractedDate || undefined,
          docType: docType || undefined,
          folderId: chosenFolder,
          storageUrl,
          fileDataUrl:
            extracted.base64 && !storageUrl && file.size <= 3_000_000
              ? `data:${extracted.mimeType};base64,${extracted.base64}`
              : undefined,
          mimeType: extracted.mimeType,
          fileName: file.name,
          fileSizeBytes: file.size,
          isUploaded: true,
        });

        if (auth?.currentUser?.uid) {
          void backgroundSyncManager.queueDocumentEdit(
            saved.id,
            {
              title: saved.title,
              content: saved.content,
              folderId: saved.folderId,
              tags: saved.tags,
              originalLanguage: saved.originalLanguage,
              fileName: saved.fileName,
            },
            saved.title
          );
        }

        createdDocs.push(saved);
      }

      onUploaded(createdDocs);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Document upload failed.');
    } finally {
      setIsSubmitting(false);
      setProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/70">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">{uiText.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{uiText.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close upload modal"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Input Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'file'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{uiText.fileTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inputMode === 'text'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{uiText.textTab}</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {inputMode === 'file' ? (
            <div className="space-y-3">
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragCounterRef.current += 1;
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isDragging) setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
                  if (dragCounterRef.current === 0) {
                    setIsDragging(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragCounterRef.current = 0;
                  setIsDragging(false);
                  const dropped = Array.from(e.dataTransfer.files || []);
                  handleFilesSelected(dropped, true);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/30 scale-[1.01]'
                    : 'border-slate-700 bg-slate-950/60 hover:border-amber-500/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    handleFilesSelected(Array.from(e.target.files || []), true);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <UploadCloud className={`w-8 h-8 mx-auto mb-2 transition-transform ${isDragging ? 'text-amber-300 scale-110' : 'text-amber-400'}`} />
                <p className="text-sm font-semibold text-slate-200">
                  {isDragging
                    ? currentLang === 'om'
                      ? 'Faayiloota asitti gadi dhiisaa!'
                      : currentLang === 'am'
                      ? 'ፋይሎቹን እዚህ ይልቀቁ!'
                      : 'Drop legal files here to add to queue!'
                    : selectedFiles.length === 0
                    ? currentLang === 'om'
                      ? 'Faayiloota hedduu filadhu ykn asitti harkisi'
                      : currentLang === 'am'
                      ? 'ብዙ ፋይሎችን ይምረጡ ወይም እዚህ ይጎትቱ'
                      : 'Drag & drop multiple legal files here, or click to browse'
                    : currentLang === 'om'
                    ? 'Faayiloota dabalataa harkisi ykn cuqaasi (Multiple files)'
                    : currentLang === 'am'
                    ? 'ተጨማሪ ፋይሎችን ይጎትቱ ወይም ይጫኑ'
                    : 'Drop more legal documents here or click to add'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF · Word (.docx / .doc) · Text (.txt) · Scanned Images (JPG, PNG)
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-300">
                      {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} queued (
                      {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      disabled={isSubmitting}
                      className="text-slate-400 hover:text-rose-400 font-medium cursor-pointer"
                    >
                      {currentLang === 'om' ? 'Hunda Haqi' : currentLang === 'am' ? 'ሁሉንም አጽዳ' : 'Clear all'}
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-slate-200 truncate">{file.name}</span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedFile(idx)}
                          disabled={isSubmitting}
                          aria-label={`Remove ${file.name}`}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                {currentLang === 'om'
                  ? 'Qabiyyee Sanadaa (Afaan Oromoo / አማርኛ / English)'
                  : currentLang === 'am'
                  ? 'የሰነዱ ጽሑፍ (አፋን ኦሮሞ / አማርኛ / እንግሊዝኛ)'
                  : 'Legal Document Content (Afaan Oromoo / Amharic / English)'}
              </label>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => {
                  const val = e.target.value;
                  setPastedText(val);
                  if (val.trim().length >= 8) {
                    setDetectedPreviewLang(detectDocumentLanguage(val).language);
                  } else {
                    setDetectedPreviewLang(null);
                  }
                }}
                placeholder="Waliigaltee, iyyannoo, labsii ykn barreeffama seeraa asitti maxxansaa... / የሕግ ሰነዱን እዚህ ይለጥፉ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {currentLang === 'om'
                ? 'Mata-duree Sanadaa (Dirqama miti)'
                : currentLang === 'am'
                ? 'የሰነዱ ርዕስ (አማራጭ)'
                : 'Document Title (Optional — auto-filled from file if empty)'}
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g., Waliigaltee Kiraa Manaa · የሥራ ውል · Employment Contract"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Original Language Preservation Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>{uiText.langLabel}</span>
              </label>
              {detectedPreviewLang && (
                <span className="text-xs text-emerald-400 font-medium">
                  Detected: {getLanguageDisplayName(detectedPreviewLang, 'bilingual')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'auto', label: 'Auto-Detect' },
                  { id: 'om', label: 'Afaan Oromoo' },
                  { id: 'am', label: 'አማርኛ' },
                  { id: 'en', label: 'English' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLanguageChoice(opt.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    languageChoice === opt.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Folder Assignment + Inline New Folder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>{uiText.folderLabel}</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingInlineFolder((v) => !v)}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{currentLang === 'om' ? '+ Foldara Haaraa' : '+ New Folder'}</span>
              </button>
            </div>

            {isCreatingInlineFolder && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inlineFolderName}
                  onChange={(e) => setInlineFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateInlineFolder();
                    }
                  }}
                  placeholder="Maqaa foldara haaraa / Folder name..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleCreateInlineFolder}
                  className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Create
                </button>
              </div>
            )}

            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="none">
                {currentLang === 'om'
                  ? 'Foldara Malee (Root Library)'
                  : currentLang === 'am'
                  ? 'ያለ ማህደር (Root Library)'
                  : 'No Folder (Root Library)'}
              </option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>{uiText.tagsLabel}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitPendingTags(tagDraft);
                  }
                }}
                placeholder="Type keywords separated by commas (e.g., waliigaltee, ካሳ, labor law)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => commitPendingTags(tagDraft)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-medium"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      aria-label={`Remove tag ${tag}`}
                      className="text-amber-300 hover:text-rose-400 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {KEYWORD_PRESETS.filter(
                (p) => !tags.some((t) => t.toLowerCase() === p.toLowerCase())
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => commitPendingTags(preset)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {isSubmitting && progressText && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{progressText}</span>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {currentLang === 'om' ? 'Dhiisi' : currentLang === 'am' ? 'ሰርዝ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{uiText.saveBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
