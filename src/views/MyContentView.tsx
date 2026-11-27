import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Search,
  Trash2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Filter,
  Calendar,
  FileDown,
  Database,
  WifiOff,
  Wifi,
  Folder,
  FolderPlus,
  Star,
  Tag,
  Plus,
  X,
  FolderOpen,
  Edit3,
  RefreshCw,
  Clock,
  ShieldCheck,
  History,
  Mic,
  Sparkles,
  Eye,
  Scale,
  UploadCloud,
  Loader2,
  FileText,
  MessageCircle,
  Gavel,
  Globe,
  Bell,
  CalendarPlus,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { DiscussionPanel } from '../components/DiscussionPanel';
import { Language, translations } from '../i18n/translations';
import {
  getSavedDocumentsAsync,
  deleteDocument,
  updateDocument,
  getUserSettings,
  SavedLegalDocument,
  LegalFolder,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveDocumentToFolder,
  toggleBookmarkDocument,
  autoCategorizeDocumentsIntoFolders,
  shareFolder,
  saveDocument,
  addTagsToDocument,
  removeTagFromDocument,
  uploadFileToFirebaseStorage,
} from '../services/storage';
import { extractDocumentPreservingLanguage } from '../services/documentExtractionService';
import { extractDocumentMetadata } from '../services/api';
import { auth } from '../services/firebase';
import {
  getDocumentOriginalLanguage,
  getLanguageDisplayName,
  parseTagInput,
  searchDocuments,
  normalizeSearchText,
} from '../utils/languageDetect';
import {
  isBiometricSessionUnlocked,
  setBiometricSessionUnlocked,
  verifyHighSecurityBiometrics,
} from '../utils/biometric';
import { getOfflineTranslationsFromDB, clearOfflineTranslationsFromDB, CachedTranslation, QueuedDocumentEdit } from '../services/indexedDb';
import { backgroundSyncManager } from '../services/backgroundSync';
import { PdfExportModal } from '../components/PdfExportModal';
import { LegalCitationHighlighter } from '../components/LegalCitationHighlighter';
import { EditDocumentModal } from '../components/EditDocumentModal';
import { DocumentVersionHistoryModal } from '../components/DocumentVersionHistoryModal';
import { DocumentVoiceNoteModal } from '../components/DocumentVoiceNoteModal';
import { DecisionIntegrityModal } from '../components/DecisionIntegrityModal';
import { LegalArgumentComparatorModal } from '../components/LegalArgumentComparatorModal';
import { DocumentSmartSummaryModal } from '../components/DocumentSmartSummaryModal';
import { DocumentQuickPreviewModal } from '../components/DocumentQuickPreviewModal';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { TelegramImportModal } from '../components/TelegramImportModal';
import { directExportSavedDocument } from '../services/legalDocumentExport';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { SavedCitationsModal } from '../components/SavedCitationsModal';
import { DownloadBookmarksButton } from '../components/DownloadBookmarksButton';
import { getLocalSavedCitations } from '../services/citationLibraryService';

function renderHighlightedSnippet(text: string, query: string): React.ReactNode {
  const cleanQuery = query.trim();
  if (!cleanQuery) return text;
  const terms = Array.from(new Set(cleanQuery.split(/\s+/).filter(Boolean)));
  if (terms.length === 0) return text;
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = text.split(pattern);
  const normTerms = new Set(terms.map((t) => normalizeSearchText(t)));
  return parts.map((part, idx) =>
    normTerms.has(normalizeSearchText(part)) ? (
      <mark key={idx} className="bg-amber-400/25 text-amber-200 px-0.5 rounded font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  );
}


const LITIGATION_STAGES = [
  { id: 'filing', om: 'Iyyannoo', am: 'አቤቱታ', en: 'Filing', color: 'bg-slate-500' },
  { id: 'summons', om: 'Waamicha', am: 'መጥሪያ', en: 'Summons', color: 'bg-blue-500' },
  { id: 'pleading', om: 'Deebii', am: 'መልስ', en: 'Pleading', color: 'bg-indigo-500' },
  { id: 'evidence', om: 'Ragaa', am: 'ማስረጃ', en: 'Evidence', color: 'bg-purple-500' },
  { id: 'deliberation', om: 'Madaallii', am: 'ምርመራ', en: 'Deliberation', color: 'bg-amber-500' },
  { id: 'verdict', om: 'Murtii', am: 'ውሳኔ', en: 'Verdict', color: 'bg-emerald-500' },
];

interface MyContentViewProps {
  currentLang: Language;
  onOpenDoc?: (doc: SavedLegalDocument) => void;
}

export const MyContentView: React.FC<MyContentViewProps> = ({ currentLang, onOpenDoc }) => {
  const t = translations[currentLang];
  const [docs, setDocs] = useState<SavedLegalDocument[]>([]);
  const [folders, setFolders] = useState<LegalFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all'); // 'all' | 'bookmarked' | folderId
  const [offlineTranslations, setOfflineTranslations] = useState<CachedTranslation[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'documents' | 'translations' | 'citations' | 'discussion'>('documents');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<string>('all');
  const [selectedLegalCategory, setSelectedLegalCategory] = useState<'all' | 'Civil' | 'Criminal' | 'Cassation'>('all');
  const [selectedDoc, setSelectedDoc] = useState<SavedLegalDocument | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<CachedTranslation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pdfModalDoc, setPdfModalDoc] = useState<SavedLegalDocument | null>(null);
  const [exportModalMode, setExportModalMode] = useState<'pdf' | 'word'>('pdf');
  const [editingDoc, setEditingDoc] = useState<SavedLegalDocument | null>(null);
  const [versionModalDoc, setVersionModalDoc] = useState<SavedLegalDocument | null>(null);
  const [voiceNoteModalDoc, setVoiceNoteModalDoc] = useState<SavedLegalDocument | null>(null);
  const [integrityModalDoc, setIntegrityModalDoc] = useState<SavedLegalDocument | null>(null);
  const [smartSummaryDoc, setSmartSummaryDoc] = useState<SavedLegalDocument | null>(null);
  const [exportingDocId, setExportingDocId] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // High-Security Biometric Protection State
  const [pendingProtectedDoc, setPendingProtectedDoc] = useState<SavedLegalDocument | null>(null);
  const [pendingProtectedAction, setPendingProtectedAction] = useState<'view' | 'edit' | 'pdf' | 'word' | 'version' | 'preview' | null>(null);
  const [isBiometricVerifying, setIsBiometricVerifying] = useState(false);
  const [biometricPromptError, setBiometricPromptError] = useState<string | null>(null);

  // Offline edit queue and synchronization state
  const [queuedEdits, setQueuedEdits] = useState<QueuedDocumentEdit[]>([]);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // New folder, language/tag filters, upload & Batch operations state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedLangFilter, setSelectedLangFilter] = useState<Language | 'all'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('amber');
  const [renamingFolder, setRenamingFolder] = useState<LegalFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameFolderColor, setRenameFolderColor] = useState('amber');
  const [activeInlineTagDocId, setActiveInlineTagDocId] = useState<string | null>(null);
  const [inlineTagDraft, setInlineTagDraft] = useState('');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<SavedLegalDocument | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [sharingFolder, setSharingFolder] = useState<LegalFolder | null>(null);
  const [sharedWithInput, setSharedWithInput] = useState('');
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);

  const handleQuickShare = async (doc: SavedLegalDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const token = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const shareUrl = `${window.location.origin}/#share?docId=${doc.id}&token=${token}&secure=true`;
    await navigator.clipboard.writeText(shareUrl);
    setSyncToast(
      currentLang === 'om'
        ? `Hidda qoodinsaa (Quick Share Link) qabiyyee "${doc.title}" koppii ta'eera!`
        : currentLang === 'am'
        ? `የሰነዱ ማጋራሪያ ሊንክ ተኮርጅቷል!`
        : `Secure read-only share link copied to clipboard!`
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  // Litigation Tracker & Reminder State
  const [reminders, setReminders] = useState<{ docId: string; title: string; date: string }[]>([]);
  const [showReminderToast, setShowReminderToast] = useState<{ title: string; time: string } | null>(null);

  // Batch Upload State
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, statusOm: '', statusEn: '' });
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isBatchRenaming, setIsBatchRenaming] = useState(false);
  const [batchRenameProgress, setBatchRenameProgress] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isInlineDropDragging, setIsInlineDropDragging] = useState(false);
  const fileDragCounterRef = useRef(0);
  const inlineDropInputRef = useRef<HTMLInputElement | null>(null);
  const [isMigratingStorage, setIsMigratingStorage] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);

  const handleBatchAiRename = async () => {
    if (selectedDocIds.length === 0) return;
    setIsBatchRenaming(true);
    let renamedCount = 0;

    for (const id of selectedDocIds) {
      const doc = docs.find(d => d.id === id);
      if (!doc) continue;
      setBatchRenameProgress(`Renaming "${doc.title.substring(0, 15)}..."`);
      try {
        const metadata = await extractDocumentMetadata(doc.content.substring(0, 4000));
        const cName = metadata.caseName || doc.caseName || 'Case';
        const dStr = metadata.date || doc.extractedDate || new Date().toISOString().split('T')[0];
        const dType = metadata.docType || doc.docType || 'LegalDoc';
        
        const standardizedTitle = `${cName.replace(/\s+/g, '_')}_${dStr}_${dType.replace(/\s+/g, '_')}`;

        updateDocument(doc.id, {
          title: standardizedTitle,
          caseName: cName,
          extractedDate: dStr,
          docType: dType
        });
        renamedCount++;
      } catch (err) {
        console.error('Batch rename failed for doc:', doc.id, err);
      }
    }

    setIsBatchRenaming(false);
    setBatchRenameProgress('');
    setSelectedDocIds([]);
    loadData();
    setSyncToast(
      currentLang === 'om'
        ? `Sanadoonni ${renamedCount} maqaa dhangii seeraatiin (AI) milkaa'inaan jijjiiramaniiru!`
        : `Successfully standardized filenames for ${renamedCount} documents using AI!`
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  const loadData = async () => {
    const loadedDocs = await getSavedDocumentsAsync();
    setDocs(loadedDocs);
    const loadedFolders = getFolders();
    setFolders(loadedFolders);
    const loadedTrans = await getOfflineTranslationsFromDB();
    setOfflineTranslations(loadedTrans);
  };

  useEffect(() => {
    loadData();

    // Subscribe to background sync utility: updates local state silently without page refresh
    const unsubscribeDocs = backgroundSyncManager.subscribe((syncedDocs) => {
      setDocs(syncedDocs);
    });

    // Subscribe to offline edit queue changes
    const unsubscribeQueue = backgroundSyncManager.subscribeQueue((queue) => {
      setQueuedEdits(queue);
    });

    const handleSyncComplete = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>;
      const count = customEvent.detail?.count || 1;
      setSyncToast(`Hojiin fooyya'iinsaa (${count}) milkaa'inaan kuusaa keessaniin wal simateera!`);
      setTimeout(() => setSyncToast(null), 4000);
      loadData();
    };

    const handleOnline = () => {
      setIsOnline(true);
      backgroundSyncManager.syncQueuedEdits();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('seera_queued_edits_synced', handleSyncComplete);

    // Initial Reminder Check
    checkUpcomingHearings();

    return () => {
      unsubscribeDocs();
      unsubscribeQueue();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('seera_queued_edits_synced', handleSyncComplete);
    };
  }, []);

  useEffect(() => {
    // Check reminders when docs change
    checkUpcomingHearings();
  }, [docs]);

  const checkUpcomingHearings = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const upcoming = docs.filter(d => {
      if (!d.hearingDate) return false;
      const hDate = new Date(d.hearingDate);
      return hDate > now && hDate <= tomorrow;
    });

    if (upcoming.length > 0) {
      const first = upcoming[0];
      setShowReminderToast({
        title: first.title,
        time: new Date(first.hearingDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  };

  const handleUpdateLitigation = (docId: string, stage: string) => {
    updateDocument(docId, { litigationStage: stage as any });
    loadData();
  };

  const handleUpdateHearingDate = (docId: string, date: string) => {
    updateDocument(docId, { hearingDate: date });
    loadData();
  };

  const handleCalculateDeadline = (docId: string, serviceDate: string, type: 'appeal' | 'defense' | 'set_aside' | 'other') => {
    if (!serviceDate) return;
    const date = new Date(serviceDate);
    let days = 30;
    let label = { 
      om: 'Darbiinsa Yeroo Ol-iyyannoo', 
      am: 'የይግባኝ ጊዜ ገደብ', 
      en: 'Appeal Filing Deadline' 
    };
    
    if (type === 'defense') {
      days = 15;
      label = { 
        om: 'Darbiinsa Yeroo Deebii', 
        am: 'የመከላከያ መልስ ጊዜ ገደብ', 
        en: 'Defense Filing Deadline' 
      };
    } else if (type === 'set_aside') {
      days = 30;
      label = { 
        om: 'Darbiinsa Yeroo Murtii Diiguu', 
        am: 'ውሳኔን የመሻሪያ ጊዜ ገደብ', 
        en: 'Set-Aside Deadline' 
      };
    }

    const deadline = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    updateDocument(docId, { 
      serviceDate, 
      filingDeadline: { 
        date: deadline.toISOString(), 
        label, 
        type 
      } 
    });
    loadData();
  };

  const exportToCalendar = (doc: SavedLegalDocument) => {
    if (!doc.hearingDate) return;
    
    const title = encodeURIComponent(`Court Hearing: ${doc.title}`);
    const date = new Date(doc.hearingDate);
    const dateStr = date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(date.getTime() + 3600000); // +1 hour
    const endStr = end.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${endStr}&details=SEERAAI Legal Reminder for Case ID: ${doc.id}&sf=true&output=xml`;
    
    // For iCal
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${dateStr}
DTEND:${endStr}
SUMMARY:Court Hearing: ${doc.title}
DESCRIPTION:SEERAAI Legal Reminder for Case ID: ${doc.id}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hearing_${doc.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    void googleUrl;
    window.dispatchEvent(new CustomEvent('seera:show_toast', {
      detail: {
        message: currentLang === 'om' ? 'Beellamni kalandarii (.ics) buufameera!' : 'Calendar reminder (.ics) downloaded!',
        emoji: '📅'
      }
    }));
  };

  const handleForceSync = async () => {
    setIsSyncingNow(true);
    try {
      const res = await backgroundSyncManager.syncQueuedEdits();
      if (res.syncedCount > 0) {
        setSyncToast(`Sanadoonni ${res.syncedCount} ofumaan kuusaa keessaniin wal simataniiru!`);
        setTimeout(() => setSyncToast(null), 4000);
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleToggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmarkDocument(id);
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isBookmarked: !d.isBookmarked } : d))
    );
  };

  const handleMoveFolder = (docId: string, folderId: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const targetFolder = folderId === 'none' ? undefined : folderId;
    moveDocumentToFolder(docId, targetFolder);
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, folderId: targetFolder } : d))
    );
  };

  const handleCreateNewFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder = createFolder(newFolderName.trim(), newFolderColor);
    setFolders(getFolders());
    setSelectedFolder(folder.id);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleAutoCategorize = () => {
    const res = autoCategorizeDocumentsIntoFolders();
    loadData();
    setSyncToast(
      currentLang === 'om'
        ? `Sanadoonni ${res.categorizedCount} foldaroota saayinsii seeraatiin offiin qindaa'aniiru!`
        : `Auto-categorized ${res.categorizedCount} saved documents into legal folders!`
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleGroupByCaseFiles = () => {
    let currentFolders = getFolders();
    const currentDocs = docs;
    let count = 0;
    let created = 0;

    currentDocs.forEach((doc: SavedLegalDocument) => {
      if (doc.caseName && doc.caseName.trim()) {
        const caseNameClean = doc.caseName.trim();
        let folder = currentFolders.find(f => f.name.toLowerCase() === caseNameClean.toLowerCase());
        if (!folder) {
          folder = createFolder(caseNameClean, 'blue');
          currentFolders = getFolders();
          created++;
        }
        if (folder && doc.folderId !== folder.id) {
          moveDocumentToFolder(doc.id, folder.id);
          count++;
        }
      }
    });

    loadData();
    setSyncToast(
      currentLang === 'om'
        ? `Galmeewwan man-murtii ${count} fi foldaroota case ${created} milkaa'inaan qindaa'aniiru!`
        : `Grouped ${count} court documents into ${created} case file folders!`
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleDeleteFolderConfirm = (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Foldara "${folderName}" haquu barbaadduu? Sanadoonni keessa jiran hin haqqaman.`)) {
      deleteFolder(folderId);
      setFolders(getFolders());
      if (selectedFolder === folderId) setSelectedFolder('all');
      loadData();
    }
  };

  const handleRenameFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder || !renameFolderName.trim()) return;
    const updated = renameFolder(renamingFolder.id, renameFolderName, renameFolderColor);
    if (updated) {
      setFolders(getFolders());
      setSyncToast(
        currentLang === 'om'
          ? `Maqaan foldaraa gara "${updated.name}" tti jijjiirameera!`
          : currentLang === 'am'
          ? `የማህደሩ ስም ወደ "${updated.name}" ተቀይሯል!`
          : `Folder renamed to "${updated.name}".`
      );
      setTimeout(() => setSyncToast(null), 3500);
    }
    setRenamingFolder(null);
    setRenameFolderName('');
  };

  const handleInlineAddTags = (docId: string, rawInput: string) => {
    const parsed = parseTagInput(rawInput);
    if (parsed.length === 0) return;
    const updated = addTagsToDocument(docId, parsed);
    if (updated) {
      setDocs((prev) => prev.map((d) => (d.id === docId ? updated : d)));
      if (selectedDoc?.id === docId) setSelectedDoc(updated);
      if (auth?.currentUser?.uid) {
        void backgroundSyncManager.queueDocumentEdit(docId, { tags: updated.tags }, updated.title);
      }
    }
    setInlineTagDraft('');
  };

  const handleInlineRemoveTag = (docId: string, tagToRemove: string) => {
    const updated = removeTagFromDocument(docId, tagToRemove);
    if (updated) {
      const nextDocs = docs.map((d) => (d.id === docId ? updated : d));
      setDocs(nextDocs);
      if (selectedDoc?.id === docId) setSelectedDoc(updated);
      if (
        selectedTagFilter &&
        normalizeSearchText(selectedTagFilter) === normalizeSearchText(tagToRemove) &&
        !nextDocs.some((d) => (d.tags || []).some((t) => normalizeSearchText(t) === normalizeSearchText(tagToRemove)))
      ) {
        setSelectedTagFilter(null);
      }
      if (auth?.currentUser?.uid) {
        void backgroundSyncManager.queueDocumentEdit(docId, { tags: updated.tags }, updated.title);
      }
    }
  };

  const handleBatchMoveToFolder = (targetValue: string) => {
    if (!targetValue || selectedDocIds.length === 0) return;
    const targetFolderId = targetValue === 'none' ? undefined : targetValue;
    selectedDocIds.forEach((docId) => {
      moveDocumentToFolder(docId, targetFolderId);
      const targetDoc = docs.find((d) => d.id === docId);
      if (targetDoc && auth?.currentUser?.uid) {
        void backgroundSyncManager.queueDocumentEdit(docId, { folderId: targetFolderId }, targetDoc.title);
      }
    });
    const folderLabel = targetFolderId
      ? folders.find((f) => f.id === targetFolderId)?.name || 'folder'
      : 'Root Library';
    setDocs((prev) =>
      prev.map((d) => (selectedDocIds.includes(d.id) ? { ...d, folderId: targetFolderId } : d))
    );
    setSyncToast(
      currentLang === 'om'
        ? `Sanadoonni ${selectedDocIds.length} gara "${folderLabel}" tti dabarfamaniiru.`
        : `Moved ${selectedDocIds.length} document(s) to "${folderLabel}".`
    );
    setTimeout(() => setSyncToast(null), 3500);
    setSelectedDocIds([]);
  };

  const handleShareFolder = async () => {
    if (!sharingFolder) return;
    const userIds = sharedWithInput.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const token = await shareFolder(sharingFolder, userIds);
      setSyncToast(`Folder "${sharingFolder.name}" shared! Access Token: ${token}`);
      setTimeout(() => setSyncToast(null), 5000);
      setSharingFolder(null);
      setSharedWithInput('');
    } catch (e) {
      console.error(e);
      setSyncToast(currentLang === 'om' ? 'Foldara qooduun hin milkoofne.' : 'Failed to share folder.');
      setTimeout(() => setSyncToast(null), 4000);
    }
  };

  const processUploadedFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsBatchUploading(true);
    setBatchProgress({ current: 0, total: files.length, statusOm: 'Sanadoota qindeessaa jira...', statusEn: 'Preparing batch upload...' });

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress(prev => ({
        ...prev,
        current: i + 1,
        statusOm: `Sanada "${file.name}" afaan jalqabaa eeguun baasaa jira...`,
        statusEn: `Extracting "${file.name}" preserving original language...`
      }));

      try {
        // 1. Extract text preserving original language (om, am, en)
        const extracted = await extractDocumentPreservingLanguage(file, 'auto');
        const text = extracted.text || '';
        const origLang = extracted.originalLanguage;

        // 2. Extract optional metadata when online
        let caseName = '';
        let extractedDate = '';
        let docType = '';
        let folderId: string | undefined =
          selectedFolder !== 'all' && selectedFolder !== 'bookmarked' && selectedFolder !== 'unfiled'
            ? selectedFolder
            : undefined;

        if (text && text.length >= 25 && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const metadata = await extractDocumentMetadata(text.substring(0, 5000));
            caseName = metadata.caseName || '';
            extractedDate = metadata.date || '';
            docType = metadata.docType || '';

            if (!folderId && docType) {
              const lowerDocType = docType.toLowerCase();
              if (lowerDocType.includes('contract') || lowerDocType.includes('waliigaltee') || docType.includes('ውል')) folderId = 'folder_contracts';
              else if (lowerDocType.includes('judgment') || lowerDocType.includes('murtii') || docType.includes('ውሳኔ')) folderId = 'folder_explanations';
              else if (lowerDocType.includes('petition') || lowerDocType.includes('iyyannoo')) folderId = 'folder_petitions';
              else if (lowerDocType.includes('claim') || lowerDocType.includes('himata')) folderId = 'folder_petitions';
            }
          } catch (err) {
            console.error('Metadata extraction failed for', file.name, err);
          }
        }

        // 3. Upload to Cloud Storage only for verified signed-in accounts
        let storageUrl: string | undefined;
        if (auth?.currentUser?.emailVerified) {
          try {
            const uploadRes = await uploadFileToFirebaseStorage(file, file.name);
            storageUrl = uploadRes.url;
          } catch (err) {
            console.error('Cloud upload failed in batch', err);
          }
        }

        // 4. Save document preserving exact originalLanguage
        const saved = saveDocument({
          title: caseName || file.name.replace(/\.[^.]+$/, ''),
          content: text || `[Uploaded file: ${file.name}]`,
          prompt: `Uploaded File: ${file.name}`,
          taskType: 'general',
          originalLanguage: origLang,
          languageLocked: false,
          outputLanguages: [origLang],
          tags: docType ? parseTagInput(docType) : [],
          caseName: caseName || undefined,
          extractedDate: extractedDate || undefined,
          docType: docType || undefined,
          folderId,
          storageUrl,
          fileDataUrl: (extracted.base64 && !storageUrl && file.size <= 3_000_000) ? `data:${extracted.mimeType};base64,${extracted.base64}` : undefined,
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
        successCount++;
      } catch (err) {
        console.error('Error processing file:', file.name, err);
      }
    }

    setIsBatchUploading(false);
    loadData();
    setSyncToast(
      currentLang === 'om'
        ? `Sanadoonni ${successCount} afaan jalqabaatiin milkaa'inaan fe'amaniiru!`
        : currentLang === 'am'
        ? `${successCount} ሰነዶች በዋናው ቋንቋቸው በተሳካ ሁኔታ ተሰቅለዋል!`
        : `Successfully uploaded ${successCount} document(s) preserving original language!`
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processUploadedFiles(files);
    e.target.value = ''; // Reset input
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    fileDragCounterRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFiles) {
      setIsDraggingFiles(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    fileDragCounterRef.current = Math.max(0, fileDragCounterRef.current - 1);
    if (fileDragCounterRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    fileDragCounterRef.current = 0;
    setIsDraggingFiles(false);
    setIsInlineDropDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await processUploadedFiles(files);
    }
  };

  const toggleSelectDoc = (id: string) => {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    setSelectedDocIds(prev => prev.length === filteredDocs.length ? [] : filteredDocs.map(d => d.id));
  };

  const handleBatchDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedDocIds.length} documents?`)) {
      selectedDocIds.forEach(deleteDocument);
      setSelectedDocIds([]);
      loadData();
    }
  };

  const handleMigrateToCloud = async () => {
    const docsToMigrate = docs.filter(d => d.fileDataUrl && !d.storageUrl);
    if (docsToMigrate.length === 0) {
      setSyncToast(currentLang === 'om' ? 'Sanadni gara cloudtti jijjiiramu hin jiru.' : 'No local attachments pending cloud migration.');
      setTimeout(() => setSyncToast(null), 3500);
      return;
    }

    if (!confirm(currentLang === 'om' ? `Sanadoonni ${docsToMigrate.length} gara cloudtti akka dabarfaman ni barbaadduu? Kun bakka kuusaa localStorage ni qusata.` : `Migrate ${docsToMigrate.length} documents to Cloud Storage? This will free up browser local storage.`)) {
      return;
    }

    setIsMigratingStorage(true);
    setMigrationProgress(0);
    let successCount = 0;

    for (let i = 0; i < docsToMigrate.length; i++) {
      const doc = docsToMigrate[i];
      try {
        const base64Data = doc.fileDataUrl!.split(',')[1];
        const contentType = doc.mimeType || doc.fileDataUrl!.split(';')[0].split(':')[1];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let j = 0; j < slice.length; j++) {
            byteNumbers[j] = slice.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        const blob = new Blob(byteArrays, { type: contentType });

        const { url } = await uploadFileToFirebaseStorage(blob, doc.title);

        updateDocument(doc.id, {
          storageUrl: url,
          fileDataUrl: undefined
        });
        successCount++;
      } catch (err) {
        console.error('Migration failed for doc:', doc.id, err);
      }
      setMigrationProgress(Math.round(((i + 1) / docsToMigrate.length) * 100));
    }

    setIsMigratingStorage(false);
    loadData();
    setSyncToast(
      currentLang === 'om'
        ? `Sanadoonni ${successCount} milkaa'inaan gara cloudtti dabarfamaniiru!`
        : `Successfully migrated ${successCount} documents to Cloud Storage!`
    );
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleBatchTag = () => {
    const parsedTags = parseTagInput(currentTagInput);
    if (parsedTags.length === 0) return;
    selectedDocIds.forEach((id) => {
      const updated = addTagsToDocument(id, parsedTags);
      if (updated && auth?.currentUser?.uid) {
        void backgroundSyncManager.queueDocumentEdit(id, { tags: updated.tags }, updated.title);
      }
    });
    setSyncToast(
      currentLang === 'om'
        ? `Jechoonni ijoo ${parsedTags.length} sanadoota ${selectedDocIds.length} irratti dabalamaniiru.`
        : `Added ${parsedTags.length} tag(s) to ${selectedDocIds.length} document(s).`
    );
    setTimeout(() => setSyncToast(null), 3500);
    setSelectedDocIds([]);
    setCurrentTagInput('');
    setIsTagModalOpen(false);
    loadData();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Sanada kana haquu barbaadduu? / ይህንን ሰነድ መሰረዝ ይፈልጋሉ? / Delete this document?')) {
      deleteDocument(id);
      loadData();
      if (selectedDoc?.id === id) setSelectedDoc(null);
    }
  };

  const handleClearTranslations = async () => {
    if (confirm('Hiikkaawwan kuufaman hunda haquu barbaadduu? / Clear cached translations?')) {
      await clearOfflineTranslationsFromDB();
      setOfflineTranslations([]);
      setSelectedTranslation(null);
    }
  };

  const handleCopy = async (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportTxt = (title: string, content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDirectExport = async (
    doc: SavedLegalDocument,
    format: 'pdf' | 'word',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    if (requiresBiometricProtection(doc) && !isBiometricSessionUnlocked()) {
      setPendingProtectedDoc(doc);
      setPendingProtectedAction(format);
      setBiometricPromptError(null);
      return;
    }

    const exportKey = `${doc.id}_${format}`;
    setExportingDocId(exportKey);
    setExportToast(
      format === 'pdf'
        ? (currentLang === 'om' ? 'PDF qopheessaa jira...' : 'PDF በማዘጋጀት ላይ...')
        : (currentLang === 'om' ? 'Word (.docx) qopheessaa jira...' : 'የዎርድ ሰነድ በማዘጋጀት ላይ...')
    );

    try {
      const settings = getUserSettings();
      await directExportSavedDocument(doc, format, settings.lawFirmBranding, (msg) => {
        setExportToast(msg);
      });
      setExportToast(
        format === 'pdf'
          ? (currentLang === 'om' ? `Sanadni PDF "${doc.title}" milkaa'inaan buufameera!` : `PDF ሰነድ "${doc.title}" በተሳካ ሁኔታ ወርዷል!`)
          : (currentLang === 'om' ? `Sanadni Word (.docx) "${doc.title}" milkaa'inaan baafameera!` : `የዎርድ (.docx) ሰነድ "${doc.title}" በተሳካ ሁኔታ ወርዷል!`)
      );
      setTimeout(() => setExportToast(null), 4000);
    } catch (err: any) {
      console.error('Direct export failed:', err);
      setExportToast(
        currentLang === 'om'
          ? `Dogoggora baasii sanadaa: ${err.message || 'Homaa hin raawwatamne'}`
          : `የሰነድ ማውረድ ስህተት፡ ${err.message || 'አልተሳካም'}`
      );
      setTimeout(() => setExportToast(null), 5000);
    } finally {
      setExportingDocId(null);
    }
  };

  const requiresBiometricProtection = (doc: SavedLegalDocument): boolean => {
    const settings = getUserSettings();
    if (doc.isHighSecurity) return true;
    if (settings.biometricDocumentProtection && (doc.taskType === 'contract' || doc.tags?.includes('confidential'))) {
      return true;
    }
    return false;
  };

  const executeWithBiometricCheck = async (
    doc: SavedLegalDocument,
    action: 'view' | 'edit' | 'pdf' | 'word' | 'version' | 'preview'
  ) => {
    if (requiresBiometricProtection(doc) && !isBiometricSessionUnlocked()) {
      setPendingProtectedDoc(doc);
      setPendingProtectedAction(action);
      setBiometricPromptError(null);
      return;
    }

    if (action === 'view') {
      setDocSearchQuery(search.trim());
      setSelectedDoc(doc);
      if (onOpenDoc) onOpenDoc(doc);
    } else if (action === 'edit') {
      setEditingDoc(doc);
    } else if (action === 'pdf') {
      setExportModalMode('pdf');
      setPdfModalDoc(doc);
    } else if (action === 'word') {
      setExportModalMode('word');
      setPdfModalDoc(doc);
    } else if (action === 'version') {
      setVersionModalDoc(doc);
    } else if (action === 'preview') {
      setPreviewDoc(doc);
    }
  };

  const handleVerifyBiometricsAndProceed = async () => {
    if (!pendingProtectedDoc) return;
    setIsBiometricVerifying(true);
    setBiometricPromptError(null);

    try {
      const res = await verifyHighSecurityBiometrics(pendingProtectedDoc.title);
      if (res.success) {
        setBiometricSessionUnlocked(true);
        const targetDoc = pendingProtectedDoc;
        const targetAction = pendingProtectedAction;
        setPendingProtectedDoc(null);
        setPendingProtectedAction(null);

        if (targetAction === 'view') {
          setSelectedDoc(targetDoc);
          if (onOpenDoc) onOpenDoc(targetDoc);
        } else if (targetAction === 'edit') {
          setEditingDoc(targetDoc);
        } else if (targetAction === 'pdf') {
          setExportModalMode('pdf');
          setPdfModalDoc(targetDoc);
        } else if (targetAction === 'word') {
          setExportModalMode('word');
          setPdfModalDoc(targetDoc);
        } else if (targetAction === 'version') {
          setVersionModalDoc(targetDoc);
        } else if (targetAction === 'preview') {
          setPreviewDoc(targetDoc);
        }
      } else {
        setBiometricPromptError(
          res.error || (
            currentLang === 'om'
              ? 'Mirkaneessi asxaa qubaa hin milkoofne. Irra deebi\'aa yaalaa.'
              : currentLang === 'am'
              ? 'የባዮሜትሪክ ማረጋገጫ አልተሳካም። እባክዎ እንደገና ይሞክሩ።'
              : 'Biometric verification failed. Please try again.'
          )
        );
      }
    } catch (err: any) {
      setBiometricPromptError(err?.message || 'Biometric verification error');
    } finally {
      setIsBiometricVerifying(false);
    }
  };

  const handleToggleHighSecurity = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    const newStatus = !doc.isHighSecurity;
    const updated = updateDocument(id, { isHighSecurity: newStatus });
    if (updated) {
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      if (selectedDoc?.id === id) {
        setSelectedDoc(updated);
      }
    }
  };

  const searchHits = searchDocuments(docs, {
    query: search,
    folder: selectedFolder,
    taskType: selectedTask,
    languageFilter: selectedLangFilter,
    tagFilter: selectedTagFilter,
  }).filter((hit) => {
    if (selectedLegalCategory === 'all') return true;
    const text = `${hit.doc.title} ${hit.doc.caseName || ''} ${hit.doc.docType || ''} ${hit.doc.tags?.join(' ') || ''} ${hit.doc.content}`.toLowerCase();
    const cat = selectedLegalCategory.toLowerCase();
    if (cat === 'civil') {
      return text.includes('civil') || text.includes('hariiroo') || text.includes('siwil') || text.includes('ሲቪል') || text.includes('contract') || text.includes('waliigaltee') || text.includes('ውል');
    }
    if (cat === 'criminal') {
      return text.includes('criminal') || text.includes('yakka') || text.includes('ወንጀል') || text.includes('penal') || text.includes('crime');
    }
    if (cat === 'cassation') {
      return text.includes('cassation') || text.includes('ijibbaataa') || text.includes('ሰበር') || text.includes('precedent') || text.includes('murtii');
    }
    return true;
  });

  const filteredDocs = searchHits.map((hit) => hit.doc);

  const languageCounts = docs.reduce(
    (acc, doc) => {
      const orig = getDocumentOriginalLanguage(doc);
      acc[orig] += 1;
      return acc;
    },
    { om: 0, am: 0, en: 0 }
  );

  const allUniqueTags = Array.from(new Set(docs.flatMap((d) => d.tags || [])));

  const filteredTranslations = offlineTranslations.filter((tr) => {
    if (!search.trim()) return true;
    const q = normalizeSearchText(search);
    return (
      normalizeSearchText(tr.sourceText).includes(q) ||
      normalizeSearchText(tr.translatedText).includes(q) ||
      normalizeSearchText(tr.sourceLang).includes(q)
    );
  });

  return (
    <div 
      className="relative min-h-screen"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      {/* Visual File Drop Overlay */}
      {isDraggingFiles && (
        <div className="fixed inset-0 z-[100] bg-indigo-600/30 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-indigo-400 m-4 rounded-3xl pointer-events-none animate-in zoom-in duration-150">
          <div className="bg-slate-900/90 p-8 rounded-2xl border border-indigo-400 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center animate-bounce">
              <UploadCloud className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">Drop files to Upload</h3>
              <p className="text-slate-400 text-sm mt-1">
                Sanadoota Afaan Oromoo, አማርኛ, or English asitti gadi dhiisaa (PDF, Word, Images, TXT)
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8 pb-16">
      {/* Title & Primary Upload Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif-legal font-bold text-slate-100 flex items-center gap-3">
            <Bookmark className="w-7 h-7 text-amber-400 shrink-0" />
            <span>{t.nav.myContent} & Document Manager</span>
          </h1>
          <p className="mt-1 text-slate-400 text-sm">
            {currentLang === 'om'
              ? 'Sanadoota seeraa Afaan Oromoo, Amaariffaa fi Ingiliffaan fe’aa, foldaraa fi jechoota ijootiin qindeessaa, keessattis barbaadaa.'
              : currentLang === 'am'
              ? 'የሕግ ሰነዶችን በአፋን ኦሮሞ፣ በአማርኛ ወይም በእንግሊዝኛ ይስቀሉ፣ በማህደርና በመለያዎች ያደራጁ፣ በውስጣቸውም ይፈልጉ።'
              : 'Upload legal documents in Afaan Oromoo, Amharic, or English, organize into folders, tag with keywords, and search full text with original language preserved.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span>
            {currentLang === 'om'
              ? 'Sanada Ol-fe’i'
              : currentLang === 'am'
              ? 'ሰነድ ስቀል'
              : 'Upload Legal Document'}
          </span>
        </button>
      </div>

      {/* Hearing Reminder Toast */}
      {showReminderToast && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-200 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300 shadow-2xl ring-2 ring-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center animate-bounce shadow-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-rose-300">BEELLAMA DHADDACHAA (Court Hearing)</div>
              <div className="text-sm">"{showReminderToast.title}" sa'aatii <span className="font-mono font-bold text-white bg-rose-500/40 px-1.5 rounded">{showReminderToast.time}</span> irratti qabameera.</div>
            </div>
          </div>
          <button
            onClick={() => setShowReminderToast(null)}
            className="p-2 hover:bg-rose-500/20 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Toast Notice when sync completes */}
      {syncToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{syncToast}</span>
          </div>
          <button
            onClick={() => setSyncToast(null)}
            className="text-slate-400 hover:text-slate-200 cursor-pointer text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Offline Edits Queue Status Bar (when pending edits exist) */}
      {queuedEdits.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <span>Hojiiwwan Fooyya'iinsaa Offline ({queuedEdits.length}) Eegaa Jiru</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  Background Queue Active
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Gulaalliin intarneeta malee hojjattan {queuedEdits.length} kuufameera; akkuma intarneettiin deebi'een ofumaan kuusaa keessaniin wal simata.
              </div>
            </div>
          </div>

          <button
            onClick={handleForceSync}
            disabled={isSyncingNow}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
            <span>{isSyncingNow ? 'Sync Ta\'aa Jira...' : 'Amma Sync Godhi'}</span>
          </button>
        </div>
      )}

      {/* Enhanced Offline Mode Sync Status Indicator & Manual Re-sync */}
      <SyncStatusIndicator
        currentLang={currentLang}
        variant="card"
        onSyncComplete={() => loadData()}
      />

      {/* Sub-Tabs: Documents vs Translations */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveSubTab('documents')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'documents'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          Saved Legal Documents ({docs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('translations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'translations'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          Recent Offline Translations ({offlineTranslations.length})
        </button>
        <button
          onClick={() => setActiveSubTab('citations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeSubTab === 'citations'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Gavel className="w-3.5 h-3.5 text-amber-400" />
          <span>{currentLang === 'om' ? 'Wabiilee & Murtiiwwan Koo' : 'Saved Citations & Precedents'} ({getLocalSavedCitations().length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('discussion')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeSubTab === 'discussion'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-amber-400 hover:bg-slate-800 border border-amber-500/30'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Collaboration Discussion</span>
        </button>
      </div>

      {activeSubTab === 'citations' && (
        <SavedCitationsModal
          isOpen={true}
          onClose={() => setActiveSubTab('documents')}
          currentLang={currentLang}
        />
      )}


      {activeSubTab === 'discussion' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>💬</span>
                <span>Document Manager Collaborative Discussion Panel</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time comment threads, colleague tagging (@handle), and live review sessions.
              </p>
            </div>
          </div>
          <div className="min-h-[500px]">
            <DiscussionPanel targetId="document-manager-main-hub" title="Document Manager Library Hub" />
          </div>
        </div>
      )}

      {/* Folder Structure & Upload Bar */}
      {activeSubTab === 'documents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Foldaroota fi Sanadoota Filataman (Folders & Document Library)
              </h3>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>
                  {currentLang === 'om'
                    ? '+ Sanada Ol-fe’i'
                    : currentLang === 'am'
                    ? '+ ሰነድ ስቀል'
                    : '+ Upload Document'}
                </span>
              </button>

              <div className="relative group">
                <input
                  type="file"
                  multiple
                  onChange={handleBatchUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  accept=".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png,.webp"
                />
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Quick Batch Upload</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Foldara Haaraa</span>
              </button>

              <button
                type="button"
                onClick={handleAutoCategorize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
                title="Automatically organize saved & annotated documents into matching folders"
              >
                <span>🤖</span>
                <span>Auto-Categorize</span>
              </button>

              <button
                type="button"
                onClick={handleGroupByCaseFiles}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
                title="Group related court documents and case files together by Case Name / ID"
              >
                <span>⚖️</span>
                <span>Group Case Files</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTelegramModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
                title="Sync documents from Telegram channel archives (@wakolegalstudio)"
              >
                <span>✈️</span>
                <span>Sync Archive</span>
              </button>

              <button
                type="button"
                onClick={handleMigrateToCloud}
                disabled={isMigratingStorage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
                title="Optimize Storage: Move local base64 documents to Firebase Cloud Storage"
              >
                <Database className={`w-3.5 h-3.5 ${isMigratingStorage ? 'animate-spin' : ''}`} />
                <span>{isMigratingStorage ? 'Optimizing...' : 'Optimize Storage'}</span>
              </button>

              <DownloadBookmarksButton currentLang={currentLang} variant="primary" />
            </div>
          </div>

          {/* Dedicated Inline Multi-File Drag-and-Drop Dropzone */}
          <div
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              e.stopPropagation();
              setIsInlineDropDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsInlineDropDragging(false);
            }}
            onDrop={handleFileDrop}
            onClick={() => inlineDropInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-all ${
              isInlineDropDragging
                ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/30'
                : 'border-slate-700/90 bg-slate-950/60 hover:border-amber-500/60 hover:bg-slate-950'
            }`}
          >
            <input
              ref={inlineDropInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                void handleBatchUpload(e);
              }}
              className="hidden"
            />
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className={`p-2 rounded-xl border shrink-0 ${isInlineDropDragging ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-900 border-slate-800 text-amber-400'}`}>
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {isInlineDropDragging
                    ? currentLang === 'om'
                      ? 'Sanadoota hedduu asitti gadi dhiisaa!'
                      : currentLang === 'am'
                      ? 'ብዙ ሰነዶችን እዚህ ይልቀቁ!'
                      : 'Drop multiple legal files now to upload!'
                    : currentLang === 'om'
                    ? 'Sanadoota seeraa hedduu harkisii asitti gadi dhiisi (ykn cuqaasii filadhu)'
                    : currentLang === 'am'
                    ? 'ብዙ የሕግ ሰነዶችን እዚህ ይጎትቱ ወይም ይጫኑ'
                    : 'Drag & drop multiple legal documents here, or click to browse'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {currentLang === 'om'
                    ? 'PDF, Word (.docx/.doc), TXT, Suuraa — Afaan Oromoo, አማርኛ, English osoo hin jijjiiramin eegama.'
                    : currentLang === 'am'
                    ? 'PDF, Word (.docx/.doc), TXT, ምስል — ዋናው ቋንቋ ሳይቀየር ይቀመጣል።'
                    : 'PDF, Word (.docx/.doc), TXT, Images — original language preserved & auto-filed into current folder.'}
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
              {currentLang === 'om' ? '+ Faayila Filadhu' : currentLang === 'am' ? '+ ፋይል ምረጥ' : '+ Browse Files'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedFolder('all')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-all cursor-pointer ${
                selectedFolder === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Hunda ({docs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFolder('bookmarked')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-all cursor-pointer ${
                selectedFolder === 'bookmarked'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-950 text-amber-400 hover:bg-slate-800 border border-amber-500/30'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Bookmarked ({docs.filter((d) => d.isBookmarked).length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFolder('unfiled')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-all cursor-pointer ${
                selectedFolder === 'unfiled'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Foldara Malee / Unfiled ({docs.filter((d) => !d.folderId).length})</span>
            </button>

            {folders.map((folder) => {
              const count = docs.filter((d) => d.folderId === folder.id).length;
              const isHovered = hoveredFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => { e.preventDefault(); setHoveredFolderId(folder.id); }}
                  onDragLeave={() => setHoveredFolderId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const docId = e.dataTransfer.getData('text/plain');
                    if (docId) {
                      moveDocumentToFolder(docId, folder.id);
                      setDocs(prev => prev.map(d => d.id === docId ? { ...d, folderId: folder.id } : d));
                      setSyncToast(
                        currentLang === 'om'
                          ? `Sanadni foldara "${folder.name}" tti jijjiirameera!`
                          : `Moved document to folder "${folder.name}"!`
                      );
                      setTimeout(() => setSyncToast(null), 3000);
                    }
                    setHoveredFolderId(null);
                  }}
                  className={`relative group inline-flex items-center shrink-0 rounded-xl transition-all ${
                    isHovered ? 'bg-amber-500/25 ring-2 ring-amber-400 scale-105 shadow-xl' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-all cursor-pointer ${
                      selectedFolder === folder.id
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>{folder.name} ({count})</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingFolder(folder);
                      setRenameFolderName(folder.name);
                      setRenameFolderColor(folder.color || 'amber');
                    }}
                    className="ml-1 p-1 text-slate-500 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Maqaa foldaraa jijjiiri (Rename Folder)"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharingFolder(folder);
                    }}
                    className="p-1 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Foldara kana qoodi (Share)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFolderConfirm(folder.id, folder.name, e)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Foldara kana haqi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legal Record Category Filter Tabs */}
      {activeSubTab === 'documents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {currentLang === 'om' ? 'Gosa Galmee Seeraa (Record Categories):' : currentLang === 'am' ? 'የሕግ መዝገብ ምድቦች:' : 'Legal Record Categories:'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {[
              { id: 'all', label: { om: 'Hunda (All)', am: 'ሁሉም (All)', en: 'All Categories' }, icon: FileText },
              { id: 'Civil', label: { om: 'Civil (Hariiroo Hawaasaa)', am: 'ሲቪል (Civil)', en: 'Civil Law' }, icon: Scale },
              { id: 'Criminal', label: { om: 'Criminal (Yakkaa)', am: 'ወንጀል (Criminal)', en: 'Criminal Law' }, icon: Gavel },
              { id: 'Cassation', label: { om: 'Cassation (Ijibbaataa)', am: 'ሰበር (Cassation)', en: 'Cassation Precedents' }, icon: ShieldCheck },
            ].map((cat) => {
              const IconComp = cat.icon;
              const isActive = selectedLegalCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedLegalCategory(cat.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{cat.label[currentLang] || cat.label.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                currentLang === 'om'
                  ? 'Qabiyyee sanadaa, mata-duree, jechoota ijoo (Afaan Oromoo / አማርኛ / English) barbaadi...'
                  : currentLang === 'am'
                  ? 'በሰነዶች ውስጥ ይፈልጉ (አፋን ኦሮሞ / አማርኛ / እንግሊዝኛ)...'
                  : 'Search inside uploaded documents, titles, and tags (Oromoo / Amharic / English)...'
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/70"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {activeSubTab === 'documents' && (
            <div className="text-xs text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
              <span>
                Showing <strong className="text-slate-200">{filteredDocs.length}</strong> of {docs.length}
              </span>
              {search.trim() && (
                <span className="text-amber-300">
                  {' · '}
                  {searchHits.filter((h) => h.snippet !== null).length} content matches
                </span>
              )}
            </div>
          )}
        </div>

        {activeSubTab === 'documents' && (
          <>
            {/* Original Language Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <Globe className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap shrink-0">
                Original Language:
              </span>
              {(
                [
                  { id: 'all', label: `All Languages (${docs.length})` },
                  { id: 'om', label: `Afaan Oromoo (${languageCounts.om})` },
                  { id: 'am', label: `አማርኛ (${languageCounts.am})` },
                  { id: 'en', label: `English (${languageCounts.en})` },
                ] as const
              ).map((langOpt) => (
                <button
                  key={langOpt.id}
                  type="button"
                  onClick={() => setSelectedLangFilter(langOpt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 tabular-nums transition-all cursor-pointer ${
                    selectedLangFilter === langOpt.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {langOpt.label}
                </button>
              ))}
            </div>

            {/* Keyword Tag Filter */}
            {allUniqueTags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-400 whitespace-nowrap shrink-0">Tags:</span>
                {selectedTagFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter(null)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Clear: {selectedTagFilter} ×
                  </button>
                )}
                {allUniqueTags.map((tag) => {
                  const isActive =
                    selectedTagFilter !== null &&
                    normalizeSearchText(selectedTagFilter) === normalizeSearchText(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTagFilter(isActive ? null : tag)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Task Type Filter */}
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              {['all', 'contract', 'explain_law', 'translate', 'social_facebook', 'social_telegram'].map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    selectedTask === task
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {task === 'all'
                    ? 'Hunda / All'
                    : task === 'contract'
                    ? 'Waliigaltee / Contract'
                    : task === 'explain_law'
                    ? 'Seera Ibsi / Explain'
                    : task === 'translate'
                    ? 'Hiikkaa / Translate'
                    : 'Social'}
                </button>
              ))}
            </div>
          </>
        )}

        {activeSubTab === 'translations' && offlineTranslations.length > 0 && (
          <button
            type="button"
            onClick={handleClearTranslations}
            className="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear Cached Translations
          </button>
        )}
      </div>

      {/* Batch Tag Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Add Keyword Tags</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Separate multiple keywords with commas (Afaan Oromoo, አማርኛ, or English).
              </p>
            </div>
            <input
              value={currentTagInput}
              onChange={(e) => setCurrentTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBatchTag();
                }
              }}
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              placeholder="e.g., Waliigaltee, ካሳ, Contract"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchTag}
                className="flex-1 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold text-xs cursor-pointer"
              >
                Add Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Folder Modal */}
      {sharingFolder && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Share Folder: {sharingFolder.name}</h2>
            <input 
              value={sharedWithInput} 
              onChange={(e) => setSharedWithInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 mb-4"
              placeholder="Enter comma separated user IDs..."
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setSharingFolder(null)} className="flex-1 py-2 bg-slate-800 text-slate-200 rounded-xl font-bold cursor-pointer">Cancel</button>
              <button type="button" onClick={handleShareFolder} className="flex-1 py-2 bg-amber-500 text-slate-950 rounded-xl font-bold cursor-pointer">Share</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Upload Progress Modal */}
      {isBatchUploading && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-white">Batch Processing Documents</h2>
              <p className="text-slate-400 text-sm">
                {currentLang === 'om' ? batchProgress.statusOm : batchProgress.statusEn}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-indigo-300">
                <span>Progress</span>
                <span>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">AI Entity Extraction Active</p>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Migration Progress Modal */}
      {isMigratingStorage && (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Database className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-white">Optimizing Storage</h2>
              <p className="text-slate-400 text-sm">
                {currentLang === 'om' 
                  ? 'Sanadoota keessan gara clouditti dabarsaa jirra. Kun yeroo muraasa fudhachuu danda\'a.' 
                  : 'Moving your documents to secure cloud storage. This will free up local browser space.'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-amber-300">
                <span>Migration Progress</span>
                <span>{migrationProgress}%</span>
              </div>
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  style={{ width: `${migrationProgress}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cloud Transition Active</p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Toolbar */}
      {selectedDocIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl mb-4 text-xs shadow-lg animate-in fade-in">
          <span className="font-bold text-amber-300 tabular-nums">{selectedDocIds.length} selected</span>
          <button type="button" onClick={handleBatchDelete} className="px-3 py-1.5 rounded-xl bg-red-900/30 text-red-300 hover:bg-red-900/50 font-bold transition-all cursor-pointer whitespace-nowrap shrink-0">Delete</button>
          <button type="button" onClick={() => setIsTagModalOpen(true)} className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold transition-all cursor-pointer whitespace-nowrap shrink-0">Add Tags</button>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleBatchMoveToFolder(e.target.value);
            }}
            aria-label="Move selected documents to folder"
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-amber-500"
          >
            <option value="">Move to Folder...</option>
            <option value="none">No Folder (Root Library)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBatchAiRename}
            disabled={isBatchRenaming}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow disabled:opacity-50 whitespace-nowrap shrink-0"
            title="AI Entity Extraction Batch Filename Standardization (CaseName_Date_DocType)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isBatchRenaming ? (batchRenameProgress || 'Renaming...') : 'AI Batch Rename (Standardize)'}</span>
          </button>
        </div>
      )}

      {/* Grid of Documents or Translations */}
      {activeSubTab === 'documents' ? (
        searchHits.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-sm space-y-3">
            <p>
              {search || selectedLangFilter !== 'all' || selectedTagFilter || selectedFolder !== 'all'
                ? currentLang === 'om'
                  ? 'Sanadni ulaagaa barbaachaa kanaan walsimu hin argamne.'
                  : currentLang === 'am'
                  ? 'ከፍለጋ መስፈርቱ ጋር የሚስማማ ሰነድ አልተገኘም።'
                  : 'No documents match your active folder, language, tag, or search filters.'
                : t.common.emptyContent}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {currentLang === 'om'
                    ? 'Sanada Ol-fe’i'
                    : currentLang === 'am'
                    ? 'ሰነድ ስቀል'
                    : 'Upload Legal Document'}
                </span>
              </button>
              {(search || selectedLangFilter !== 'all' || selectedTagFilter || selectedFolder !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedLangFilter('all');
                    setSelectedTagFilter(null);
                    setSelectedFolder('all');
                    setSelectedTask('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedFolder + (search || '')}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {searchHits.map((hit) => {
                const doc = hit.doc;
                const origLang = hit.originalLanguage;
                const isInlineTagOpen = activeInlineTagDocId === doc.id;
                return (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', doc.id);
                    }}
                    onClick={() => {
                      setDocSearchQuery(search.trim());
                      void executeWithBiometricCheck(doc, 'view');
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative h-full ${
                      selectedDoc?.id === doc.id
                        ? 'bg-slate-900 border-amber-500 shadow-xl'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(doc.id)}
                    onChange={() => toggleSelectDoc(doc.id)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2 pr-6">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                        <Globe className="w-3 h-3" />
                        <span>{getLanguageDisplayName(origLang, 'bilingual')}</span>
                      </span>
                      <span>·</span>
                      <span className="uppercase font-mono text-slate-300">{doc.taskType}</span>
                      {doc.isHighSecurity && (
                        <>
                          <span>·</span>
                          <span className="text-rose-300 font-semibold">🔒 High-Security</span>
                        </>
                      )}
                      {queuedEdits.some((q) => q.docId === doc.id) && (
                        <>
                          <span>·</span>
                          <span className="text-amber-300 font-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Queue Offline</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleHighSecurity(doc.id, e)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          doc.isHighSecurity ? 'text-rose-400 bg-rose-500/10 border border-rose-500/30' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={doc.isHighSecurity ? 'High-Security Biometric Protected' : 'Set as High-Security Document'}
                      >
                        <span className="text-xs">{doc.isHighSecurity ? '🔒' : '🔓'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleBookmark(doc.id, e)}
                        className="p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={doc.isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                      >
                        <Star className={`w-4 h-4 ${doc.isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-slate-500 hover:text-amber-300'}`} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-100 text-sm sm:text-base line-clamp-1">
                    {doc.caseName || doc.title}
                  </h3>
                  {(doc.fileName || (doc.caseName && doc.caseName !== doc.title) || doc.docType) && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {[
                        doc.docType,
                        doc.fileName,
                        doc.caseName && doc.caseName !== doc.title ? `Original: ${doc.title}` : null,
                        doc.extractedDate ? new Date(doc.extractedDate).toLocaleDateString() : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}

                  {/* Interactive Document Custom Tags & Click-to-Add Keywords */}
                  <div className="mt-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleInlineRemoveTag(doc.id, tag)}
                            className="text-amber-400 hover:text-red-400 font-bold ml-0.5 cursor-pointer"
                            title="Remove tag"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveInlineTagDocId(isInlineTagOpen ? null : doc.id);
                          setInlineTagDraft('');
                        }}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer border border-slate-700"
                        title="Add keyword tags"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Tag</span>
                      </button>
                    </div>

                    {isInlineTagOpen && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={inlineTagDraft}
                            onChange={(e) => setInlineTagDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                handleInlineAddTags(doc.id, inlineTagDraft);
                              } else if (e.key === 'Escape') {
                                setActiveInlineTagDocId(null);
                              }
                            }}
                            autoFocus
                            placeholder="Keywords (comma separated)..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleInlineAddTags(doc.id, inlineTagDraft)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Add
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {['Waliigaltee', 'ውል', 'Contract', 'Appeal', 'Evidence', 'Cassation', 'ካሳ', 'Urgent']
                            .filter((p) => !doc.tags.some((t) => normalizeSearchText(t) === normalizeSearchText(p)))
                            .map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleInlineAddTags(doc.id, preset)}
                                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-amber-300 cursor-pointer"
                              >
                                + {preset}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Case Progress Tracker */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider">
                      <span className="text-slate-400">Case Progress Tracker</span>
                      <span className="text-amber-400 tabular-nums">
                        {Math.round(((LITIGATION_STAGES.findIndex(s => s.id === (doc.litigationStage || 'filing')) + 1) / LITIGATION_STAGES.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                      {LITIGATION_STAGES.map((stage, idx) => {
                        const currentIndex = LITIGATION_STAGES.findIndex(s => s.id === (doc.litigationStage || 'filing'));
                        const isActive = idx <= currentIndex;
                        return (
                          <div 
                            key={stage.id}
                            className={`h-full flex-1 transition-all duration-500 ${isActive ? stage.color : 'bg-slate-900/50'}`}
                            title={stage[currentLang]}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {LITIGATION_STAGES.map((stage) => (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateLitigation(doc.id, stage.id);
                          }}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap transition-all border ${
                            doc.litigationStage === stage.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          {stage[currentLang]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {hit.snippet ? (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/25 space-y-1">
                      <div className="text-[10px] font-semibold text-amber-300 tabular-nums">
                        {hit.snippet.matchCount} match{hit.snippet.matchCount > 1 ? 'es' : ''} in document
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {renderHighlightedSnippet(hit.snippet.snippet, search)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {doc.content}
                    </p>
                  )}

                  {/* Hearing Date & Auto-Reminder UI */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase">
                        <CalendarPlus className="w-3.5 h-3.5 text-amber-500" />
                        <span>Beellama Dhaddachaa</span>
                      </div>
                      {doc.hearingDate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToCalendar(doc);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[9px] font-bold hover:bg-blue-500/20 transition-all cursor-pointer"
                        >
                          <Share2 className="w-2.5 h-2.5" />
                          <span>Calendar</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="datetime-local"
                        value={doc.hearingDate ? doc.hearingDate.slice(0, 16) : ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateHearingDate(doc.id, e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:border-amber-500 outline-none w-full font-mono"
                      />
                    </div>
                    {doc.hearingDate && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-center">
                        <Bell className="w-2.5 h-2.5" />
                        <span>Notified 24h before hearing</span>
                      </div>
                    )}
                  </div>

                  {/* Legal Filing Deadline Calculator (Request 6) */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                      <Scale className="w-3.5 h-3.5" />
                      <span>Deadline Calculator (SDFHH)</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Service / Order Date</label>
                        <input 
                          type="date"
                          value={doc.serviceDate || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleCalculateDeadline(doc.id, e.target.value, doc.filingDeadline?.type || 'appeal')}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:border-amber-500 outline-none w-full font-mono"
                        />
                      </div>
                      
                      <div className="flex gap-1">
                        {(['appeal', 'defense', 'set_aside'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (doc.serviceDate) handleCalculateDeadline(doc.id, doc.serviceDate, type);
                            }}
                            className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase transition-all border ${
                              doc.filingDeadline?.type === type 
                                ? 'bg-amber-500 text-slate-950 border-amber-500' 
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                          >
                            {type.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {doc.filingDeadline && (
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-rose-400 uppercase">{doc.filingDeadline.label[currentLang]}</span>
                          <span className="text-[10px] font-mono font-bold text-white bg-rose-500 px-1.5 rounded">
                            {new Date(doc.filingDeadline.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-500 italic">
                          {Math.ceil((new Date(doc.filingDeadline.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleQuickShare(doc, e)}
                      className="p-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900 border border-sky-800 text-sky-300 transition-colors cursor-pointer"
                      title="Quick Share (Secure Read-Only Link)"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSmartSummaryDoc(doc);
                      }}
                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                      title="Cuunfaa Seeraa (Smart Executive Summary)"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeWithBiometricCheck(doc, 'preview');
                      }}
                      className="px-2 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      title={currentLang === 'om' ? 'Dur-argii & Expand (Quick Preview & Annotate)' : currentLang === 'am' ? 'ፈጣን ቅድመ-ዕይታ እና ማስታወሻ' : 'Expand / Quick Preview & Annotate'}
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-extrabold uppercase tracking-tighter">Expand</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIntegrityModalDoc(doc);
                      }}
                      className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 transition-colors cursor-pointer"
                      title="Decision Integrity Checker (Cross-reference citations)"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeWithBiometricCheck(doc, 'edit');
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                      title="Fooyyessi / Edit Document (Offline Queue Support)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeWithBiometricCheck(doc, 'version');
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors relative cursor-pointer"
                      title="Tarree Seenaa Fooyya'iinsaa (Version History & Compare)"
                    >
                      <History className="w-3.5 h-3.5" />
                      {doc.versions && doc.versions.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400"></span>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeWithBiometricCheck(doc, 'word');
                      }}
                      className="p-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-800 text-blue-300 transition-colors cursor-pointer"
                      title="Export to Word (.docx)"
                    >
                      <span>📄</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeWithBiometricCheck(doc, 'pdf');
                      }}
                      className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 transition-colors cursor-pointer"
                      title="Download as PDF"
                    >
                      <span>📥</span>
                    </button>

                    <button
                      onClick={(e) => handleCopy(doc.content, doc.id, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title={t.actions.copy}
                    >
                      {copiedId === doc.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={(e) => handleExportTxt(doc.title, doc.content, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title={t.actions.exportTxt}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-red-400"
                      title={t.actions.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Folder Mover & Assignment */}
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-3 h-3 text-amber-400" />
                    <select
                      value={doc.folderId || 'none'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleMoveFolder(doc.id, e.target.value, e)}
                      className="bg-slate-950 text-[10px] text-slate-300 border border-slate-800 rounded px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="none">📁 Foldara Hin Qabu</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {doc.isBookmarked && (
                    <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>Bookmarked</span>
                    </span>
                  )}
                </div>
                  </div>
              </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
        )
      ) : (
        filteredTranslations.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-sm">
            <p>Hiikkaawwan offline kuufaman hin jiran. / No cached offline translations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTranslations.map((tr) => (
              <div
                key={tr.id}
                onClick={() => setSelectedTranslation(tr)}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {tr.sourceLang.toUpperCase()} → {tr.targetLangs[0]?.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(tr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-100 text-sm line-clamp-1">
                    {tr.title || 'Hiikkaa Seeraa (Legal Translation)'}
                  </h3>

                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    <p className="line-clamp-2"><strong className="text-slate-300">Source:</strong> {tr.sourceText}</p>
                    <p className="line-clamp-2"><strong className="text-emerald-400">Result:</strong> {tr.translatedText}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px] text-slate-500">
                    {new Date(tr.timestamp).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleCopy(tr.translatedText, tr.id, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title={t.actions.copy}
                    >
                      {copiedId === tr.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => handleExportTxt('Hiikkaa_Seeraa', tr.translatedText, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title={t.actions.exportTxt}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Expanded Document Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 space-y-3 bg-slate-950/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-100 text-base">{selectedDoc.title}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      <Globe className="w-3 h-3" />
                      <span>{getLanguageDisplayName(getDocumentOriginalLanguage(selectedDoc), 'bilingual')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        handleToggleBookmark(selectedDoc.id, e);
                        setSelectedDoc((prev) =>
                          prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null
                        );
                      }}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        selectedDoc.isBookmarked
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-amber-400'
                      }`}
                      title={selectedDoc.isBookmarked ? 'Bookmarked!' : 'Bookmark Document'}
                    >
                      <Star className={`w-3.5 h-3.5 ${selectedDoc.isBookmarked ? 'fill-slate-950 text-slate-950' : 'text-slate-400'}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleToggleHighSecurity(selectedDoc.id, e)}
                      className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                        selectedDoc.isHighSecurity
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-rose-400'
                      }`}
                      title={selectedDoc.isHighSecurity ? 'High-Security Biometric Protected' : 'Set as High-Security Document'}
                    >
                      <span>{selectedDoc.isHighSecurity ? '🔒' : '🔓'}</span>
                      <span className="text-[11px] font-mono">
                        {selectedDoc.isHighSecurity ? 'High-Security' : 'Standard'}
                      </span>
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{new Date(selectedDoc.createdAt).toLocaleString()}</span>
                    {selectedDoc.fileName && <span>· {selectedDoc.fileName}</span>}
                    <span>·</span>
                    <select
                      value={selectedDoc.folderId || 'none'}
                      onChange={(e) => {
                        const targetFolder = e.target.value === 'none' ? undefined : e.target.value;
                        moveDocumentToFolder(selectedDoc.id, targetFolder);
                        setSelectedDoc((prev) => (prev ? { ...prev, folderId: targetFolder } : null));
                        setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? { ...d, folderId: targetFolder } : d)));
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value="none">No Folder (Root)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cufi / ዝጋ / Close
                </button>
              </div>

              {/* In-Document Search + Inline Tag Management */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    placeholder="Find text inside this document..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {docSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDocSearchQuery('')}
                      aria-label="Clear in-document search"
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {docSearchQuery.trim() && (
                  <span className="text-xs text-amber-300 font-semibold whitespace-nowrap shrink-0 tabular-nums">
                    {(() => {
                      const escaped = docSearchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const m = selectedDoc.content.match(new RegExp(escaped, 'gi'));
                      const count = m ? m.length : 0;
                      return `${count} match${count === 1 ? '' : 'es'} found`;
                    })()}
                  </span>
                )}
              </div>

              {/* Tags inside expanded modal */}
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedDoc.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleInlineRemoveTag(selectedDoc.id, tag)}
                      className="text-amber-400 hover:text-rose-400 font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={inlineTagDraft}
                  onChange={(e) => setInlineTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleInlineAddTags(selectedDoc.id, inlineTagDraft);
                    }
                  }}
                  placeholder="+ Add tag & press Enter..."
                  className="bg-slate-900 border border-slate-800 rounded-md px-2 py-0.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-40"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[58vh] text-sm text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-amber-500/20">
              <LegalCitationHighlighter
                text={selectedDoc.content}
                currentLang={currentLang}
                searchTerm={docSearchQuery.trim()}
              />
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    handleToggleBookmark(selectedDoc.id, e);
                    setSelectedDoc((prev) =>
                      prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null
                    );
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all ${
                    selectedDoc.isBookmarked
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-500/40'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${selectedDoc.isBookmarked ? 'fill-slate-950 text-slate-950' : 'text-amber-400'}`} />
                  <span>{selectedDoc.isBookmarked ? '★ Bookmarked' : 'Add Bookmark'}</span>
                </button>

                <button
                  onClick={() => {
                    setEditingDoc(selectedDoc);
                    setSelectedDoc(null);
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Fooyyessi / Edit</span>
                </button>

                <button
                  onClick={() => {
                    setSmartSummaryDoc(selectedDoc);
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Generate concise multi-language executive summary"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Smart Summary</span>
                </button>

                <button
                  onClick={() => {
                    setPreviewDoc(selectedDoc);
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Interactive PDF-style canvas drawing and text highlighting annotations"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{currentLang === 'om' ? 'Dur-argii & Mallattoo' : currentLang === 'am' ? 'ቅድመ-ዕይታ & ማስታወሻ' : 'Preview & Annotate'}</span>
                </button>

                <button
                  onClick={() => {
                    setVersionModalDoc(selectedDoc);
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="View revision history and restore previous versions"
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>Seenaa (Versions)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleQuickShare(selectedDoc, e)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
                  title="Generate secure read-only share link"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Quick Share</span>
                </button>
                <button
                  onClick={() => {
                    setExportModalMode('word');
                    setPdfModalDoc(selectedDoc);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>📄</span>
                  <span>Word (.docx) Baasi</span>
                </button>
                <button
                  onClick={() => {
                    setExportModalMode('pdf');
                    setPdfModalDoc(selectedDoc);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>📥</span>
                  <span>PDF (.pdf) Buusi</span>
                </button>
                <button
                  onClick={() => handleDirectExport(selectedDoc, 'pdf')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md cursor-pointer font-extrabold"
                  title="Download structured case summary PDF including case notes, timelines, and legal content"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-950" />
                  <span>Download Case Summary</span>
                </button>
                <button
                  onClick={(e) => handleCopy(selectedDoc.content, selectedDoc.id, e)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === selectedDoc.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === selectedDoc.id ? t.actions.copied : t.actions.copy}</span>
                </button>
                <button
                  onClick={(e) => handleExportTxt(selectedDoc.title, selectedDoc.content, e)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.actions.exportTxt}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Translation Modal */}
      {selectedTranslation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div>
                <h3 className="font-bold text-slate-100 text-base">{selectedTranslation.title || 'Offline Cached Translation'}</h3>
                <span className="text-xs text-slate-400">{new Date(selectedTranslation.timestamp).toLocaleString()}</span>
              </div>
              <button
                onClick={() => setSelectedTranslation(null)}
                className="px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cufi / ዝጋ / Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              <div>
                <strong className="text-xs uppercase font-mono text-slate-400 block mb-1">Source Text ({selectedTranslation.sourceLang.toUpperCase()}):</strong>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300">{selectedTranslation.sourceText}</div>
              </div>
              <div>
                <strong className="text-xs uppercase font-mono text-emerald-400 block mb-1">Translated Text ({selectedTranslation.targetLangs[0]?.toUpperCase()}):</strong>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-100">{selectedTranslation.translatedText}</div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                onClick={(e) => handleCopy(selectedTranslation.translatedText, selectedTranslation.id, e)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === selectedTranslation.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Translation</span>
              </button>
              <button
                onClick={(e) => handleExportTxt('Hiikkaa_Seeraa', selectedTranslation.translatedText, e)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export TXT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      {pdfModalDoc && (
        <PdfExportModal
          isOpen={!!pdfModalDoc}
          onClose={() => setPdfModalDoc(null)}
          currentLang={currentLang}
          title={pdfModalDoc.title}
          taskType={pdfModalDoc.taskType}
          content={pdfModalDoc.content}
          separatedVersions={pdfModalDoc.separatedVersions}
          outputLanguages={pdfModalDoc.outputLanguages}
          initialMode={exportModalMode}
        />
      )}

      {/* Create New Folder Modal */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm">Foldara Haaraa Uumi / Create Folder</h3>
              </div>
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Maqaa Foldaraa / Folder Name:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="fkn: Waliigaltee Manaa, Dhaddacha Ijoo, Iyyannoo..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Halluu / Color Tag:
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'amber', label: 'Bilaachaa / Amber', class: 'bg-amber-500' },
                    { id: 'blue', label: 'Cuquliisa / Blue', class: 'bg-blue-500' },
                    { id: 'emerald', label: 'Magariisa / Green', class: 'bg-emerald-500' },
                    { id: 'purple', label: 'Waangoo / Purple', class: 'bg-purple-500' },
                    { id: 'rose', label: 'Diimaa / Rose', class: 'bg-rose-500' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewFolderColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.class} flex items-center justify-center transition-all cursor-pointer ${
                        newFolderColor === c.id ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {newFolderColor === c.id && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Dhiisi / Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer"
                >
                  Foldara Uumi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Rename Folder Modal */}
      {renamingFolder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm">Maqaa Foldaraa Jijjiiri / Rename Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setRenamingFolder(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Maqaa Haaraa / New Folder Name:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Halluu / Color Tag:
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'amber', class: 'bg-amber-500' },
                    { id: 'blue', class: 'bg-blue-500' },
                    { id: 'emerald', class: 'bg-emerald-500' },
                    { id: 'purple', class: 'bg-purple-500' },
                    { id: 'rose', class: 'bg-rose-500' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRenameFolderColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.class} flex items-center justify-center transition-all cursor-pointer ${
                        renameFolderColor === c.id ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {renameFolderColor === c.id && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingFolder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Dhiisi / Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer"
                >
                  Save Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Upload Modal (Trilingual + Original Language Preservation) */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        currentLang={currentLang}
        folders={folders}
        defaultFolderId={selectedFolder}
        onFoldersChanged={(updatedFolders) => setFolders(updatedFolders)}
        onUploaded={(createdDocs) => {
          loadData();
          setSyncToast(
            currentLang === 'om'
              ? `Sanadoonni ${createdDocs.length} afaan jalqabaa isaanii eeguun ol-fe'amaniiru!`
              : currentLang === 'am'
              ? `${createdDocs.length} ሰነድ በዋናው ቋንቋው ተቀምጧል!`
              : `Uploaded ${createdDocs.length} document(s) with original language preserved.`
          );
          setTimeout(() => setSyncToast(null), 4000);
        }}
      />

      {/* Edit Document Modal with Offline Background Sync Support */}
      {editingDoc && (
        <EditDocumentModal
          doc={editingDoc}
          currentLang={currentLang}
          onClose={() => setEditingDoc(null)}
          onSaved={(updated) => {
            setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          }}
        />
      )}

      {/* Version History & Side-by-Side Comparison Modal */}
      {versionModalDoc && (
        <DocumentVersionHistoryModal
          doc={versionModalDoc}
          currentLang={currentLang}
          onClose={() => setVersionModalDoc(null)}
          onRestored={(updated) => {
            setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setVersionModalDoc(null);
          }}
        />
      )}

      {/* High-Security Biometric Verification Modal */}
      {pendingProtectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mx-auto shadow-inner">
              🔐
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold px-2.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                🔒 High-Security Legal Document
              </span>
              <h3 className="font-bold text-lg text-slate-100">
                {currentLang === 'om'
                  ? 'Mirkaneessa Asxaa Qubaa / FaceID'
                  : currentLang === 'am'
                  ? 'የጣት አሻራ / FaceID ማረጋገጫ'
                  : 'Biometric WebAuthn Unlock Required'}
              </h3>
              <p className="text-xs text-amber-300 font-semibold line-clamp-1">
                "{pendingProtectedDoc.title}"
              </p>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">
                {currentLang === 'om'
                  ? 'Sanadni kun qabiyyee seeraa iccitii ol\'aanaa qaba. Banuu fi dubbisuuf sensorii asxaa qubaa (Touch ID) yookiin Face ID fayyadamaa.'
                  : currentLang === 'am'
                  ? 'ይህ ሰነድ ከፍተኛ ሚስጥራዊ የሕግ መረጃ የያዘ ነው። ሰነዱን ለመክፈት እባክዎ የጣት አሻራዎን ወይም Face ID ይጠቀሙ።'
                  : 'This legal document contains confidential contents. Please authenticate using your device Touch ID, Face ID, or Windows Hello sensor.'}
              </p>
            </div>

            {biometricPromptError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                ⚠️ {biometricPromptError}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isBiometricVerifying}
                onClick={handleVerifyBiometricsAndProceed}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow disabled:opacity-60"
              >
                <span>{isBiometricVerifying ? '⏳' : '👆'}</span>
                <span>
                  {isBiometricVerifying
                    ? (currentLang === 'om' ? 'Mirkaneessaa jira...' : currentLang === 'am' ? 'በማረጋገጥ ላይ...' : 'Authenticating WebAuthn...')
                    : (currentLang === 'om' ? 'Asxaa Qubaa / FaceID\'n Bani' : currentLang === 'am' ? 'በጣት አሻራ / FaceID ክፈት' : 'Unlock via Biometrics (FaceID/Fingerprint)')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingProtectedDoc(null);
                  setPendingProtectedAction(null);
                  setBiometricPromptError(null);
                }}
                className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {currentLang === 'om' ? 'Dhiisi / Cufi' : currentLang === 'am' ? 'ሰርዝ' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {integrityModalDoc && (
        <DecisionIntegrityModal
          documentTitle={integrityModalDoc.title}
          documentContent={integrityModalDoc.content}
          currentLang={currentLang}
          onClose={() => setIntegrityModalDoc(null)}
        />
      )}

      {smartSummaryDoc && (
        <DocumentSmartSummaryModal
          doc={smartSummaryDoc}
          currentLang={currentLang}
          onClose={() => setSmartSummaryDoc(null)}
        />
      )}

      {previewDoc && (
        <DocumentQuickPreviewModal
          doc={previewDoc}
          currentLang={currentLang}
          onClose={() => setPreviewDoc(null)}
          onSavedAsNew={(newDoc) => {
            loadData();
            setSyncToast(
              currentLang === 'om'
                ? `Sanadni bifa haarawaan qophaa'e "${newDoc.title}" kuusameera!`
                : currentLang === 'am'
                ? `አዲሱ ማስታወሻ የተያዘበት ሰነድ "${newDoc.title}" ተቀምጧል!`
                : `Annotated document "${newDoc.title}" saved successfully!`
            );
            setTimeout(() => setSyncToast(null), 4000);
          }}
        />
      )}

      {isTelegramModalOpen && (
        <TelegramImportModal
          language={currentLang}
          onClose={() => setIsTelegramModalOpen(false)}
          onImportComplete={(count) => {
            setIsTelegramModalOpen(false);
            loadData();
            setSyncToast(
              currentLang === 'om'
                ? `Galmeewwan Telegram ${count}+ milkaa'inaan fe'amaniiru!`
                : `Successfully imported ${count}+ Telegram archive documents!`
            );
            setTimeout(() => setSyncToast(null), 4000);
          }}
        />
      )}
      {/* Floating Discussion Button */}
      <button
        type="button"
        onClick={() => setIsDiscussionOpen(true)}
        className="fixed right-6 bottom-24 p-3 bg-amber-500 text-slate-950 rounded-full shadow-2xl hover:scale-105 transition-all z-40"
        title="Marii (Discussion)"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Discussion Overlay */}
      {isDiscussionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-end">
                <button onClick={() => setIsDiscussionOpen(false)} className="text-slate-400 hover:text-slate-200 text-xl font-bold p-2">✕</button>
            </div>
            <DiscussionPanel targetId="my-content-general" />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

