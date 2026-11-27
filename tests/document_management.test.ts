import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Minimal Browser Environment Harness for Storage Service Testing
// ---------------------------------------------------------------------------
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const localStore = new MemoryStorage();
const sessionStore = new MemoryStorage();

(globalThis as any).localStorage = localStore;
(globalThis as any).sessionStorage = sessionStore;
(globalThis as any).CustomEvent = class CustomEvent<T = any> {
  type: string;
  detail: T;
  constructor(type: string, init?: { detail?: T }) {
    this.type = type;
    this.detail = init?.detail as T;
  }
};
(globalThis as any).window = {
  location: { origin: 'http://localhost:3000' },
  dispatchEvent: () => true,
  localStorage: localStore,
  sessionStorage: sessionStore,
};

import {
  detectDocumentLanguage,
  getDocumentOriginalLanguage,
  getLanguageDisplayName,
  parseTagInput,
  normalizeSearchText,
  extractSearchSnippet,
  searchDocuments,
} from '../src/utils/languageDetect';
import {
  saveDocument,
  getSavedDocuments,
  updateDocument,
  toggleBookmarkDocument,
  moveDocumentToFolder,
  addTagsToDocument,
  removeTagFromDocument,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  autoCategorizeDocumentsIntoFolders,
  saveUserSettings,
  getUserScopedKey,
} from '../src/services/storage';

let passed = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('--- STARTING TRILINGUAL DOCUMENT MANAGEMENT TEST SUITE ---');

  localStore.setItem('seera_current_user_id', 'jurist_user_001');
  localStore.setItem('seera_current_user_email', 'jurist001@seeraai.et');

  // 1. Language detection accuracy across Afaan Oromoo, Amharic, and English
  await runTest('1. detectDocumentLanguage accurately identifies Afaan Oromoo, Amharic, and English legal texts', () => {
    const omSample =
      'Bu’uura Heera Mootummaa Federaalaa keeyyata 37 fi Labsii Lakk. 1156/2011 tiin hojjataan mirga beenyaa gaafachuu qaba. Mana Murtii Waliigalaa Dhaddacha Ijibbaataa galmee kana ilaalee murtii kenneera.';
    const amSample =
      'በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ ሕገ መንግሥት አንቀጽ 37 እና በአዋጅ ቁጥር 1156/2011 መሠረት ሠራተኛው የካሳ ክፍያ የመጠየቅ መብት አለው። የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት ውሳኔ ሰጥቷል።';
    const enSample =
      'Pursuant to Article 37 of the FDRE Constitution and Labour Proclamation No. 1156/2019, the plaintiff is entitled to severance compensation and damages from the respondent as ruled by the Federal Supreme Court Cassation Division.';

    const omRes = detectDocumentLanguage(omSample);
    const amRes = detectDocumentLanguage(amSample);
    const enRes = detectDocumentLanguage(enSample);

    assert.equal(omRes.language, 'om');
    assert.equal(omRes.script, 'latin');
    assert.equal(omRes.confidence, 'high');

    assert.equal(amRes.language, 'am');
    assert.equal(amRes.script, 'ethiopic');
    assert.equal(amRes.confidence, 'high');

    assert.equal(enRes.language, 'en');
    assert.equal(enRes.script, 'latin');
    assert.equal(enRes.confidence, 'high');

    assert.equal(getLanguageDisplayName('om', 'bilingual'), 'Afaan Oromoo (OM)');
    assert.equal(getLanguageDisplayName('am', 'bilingual'), 'አማርኛ / Amharic (AM)');
    assert.equal(getLanguageDisplayName('en', 'bilingual'), 'English (EN)');
  });

  // 2. Original language preservation regardless of UI language
  await runTest('2. Original language & verbatim text are preserved even when app UI language differs', () => {
    // Set app UI language to English while saving Afaan Oromoo & Amharic documents
    saveUserSettings({ appLanguage: 'en', defaultOutputLanguage: 'en' });

    const omContent = "Waliigaltee Kireessuu Lafa Qonnaa: Bu'uura Seera Hariiroo Hawaasaa keeyyata 2896 tiin qophaa'e.";
    const amContent = 'የመኖሪያ ቤት ኪራይ ውል፤ በፍትሐ ብሔር ሕግ አንቀጽ 2896 መሠረት በሁለቱ ወገኖች መካከል ተፈርሟል።';
    const enContent = 'Commercial Lease Agreement drafted pursuant to Civil Code Article 2896 and Commercial Code provisions.';

    const savedOm = saveDocument({
      title: 'Waliigaltee Kireessuu',
      taskType: 'contract',
      prompt: 'Uploaded document',
      outputLanguages: ['om'],
      originalLanguage: 'om',
      languageLocked: true,
      content: omContent,
      tags: ['Waliigaltee', 'Kireessuu'],
      isUploaded: true,
      fileName: 'waliigaltee.docx',
      fileSizeBytes: 12040,
    });

    const savedAm = saveDocument({
      title: 'የቤት ኪራይ ውል',
      taskType: 'contract',
      prompt: 'Uploaded document',
      outputLanguages: ['am'],
      originalLanguage: 'am',
      languageLocked: true,
      content: amContent,
      tags: ['ውል', 'ኪራይ'],
      isUploaded: true,
      fileName: 'kiray_wul.pdf',
      fileSizeBytes: 24000,
    });

    const savedEn = saveDocument({
      title: 'Commercial Lease Agreement',
      taskType: 'contract',
      prompt: 'Uploaded document',
      outputLanguages: ['en'],
      content: enContent, // omit originalLanguage to verify auto-detection preserves 'en'
      tags: ['Lease', 'Civil Code'],
      isUploaded: true,
      fileName: 'commercial_lease.txt',
      fileSizeBytes: 4200,
    });

    assert.equal(savedOm.originalLanguage, 'om');
    assert.equal(savedOm.content, omContent);
    assert.deepEqual(savedOm.outputLanguages, ['om']);

    assert.equal(savedAm.originalLanguage, 'am');
    assert.equal(savedAm.content, amContent);
    assert.deepEqual(savedAm.outputLanguages, ['am']);

    assert.equal(savedEn.originalLanguage, 'en');
    assert.equal(savedEn.content, enContent);

    assert.equal(getDocumentOriginalLanguage(savedOm), 'om');
    assert.equal(getDocumentOriginalLanguage(savedAm), 'am');
    assert.equal(getDocumentOriginalLanguage(savedEn), 'en');

    // Switch app UI back to Afaan Oromoo and verify English/Amharic docs retain their original language
    saveUserSettings({ appLanguage: 'om', defaultOutputLanguage: 'om' });
    const reloaded = getSavedDocuments();
    const amLoaded = reloaded.find((d) => d.id === savedAm.id)!;
    const enLoaded = reloaded.find((d) => d.id === savedEn.id)!;
    assert.equal(amLoaded.originalLanguage, 'am');
    assert.equal(amLoaded.content, amContent);
    assert.equal(enLoaded.originalLanguage, 'en');
    assert.equal(enLoaded.content, enContent);
  });

  // 3. Folder lifecycle: create, rename, move, delete (preserves documents as unfiled), auto-categorize
  await runTest('3. Folder lifecycle creates, renames, moves, preserves docs on folder delete, and auto-categorizes', () => {
    const customFolder = createFolder('Dhimma Hojii (Labor Cases)', 'emerald');
    assert.ok(customFolder.id.startsWith('folder_'));
    assert.ok(getFolders().some((f) => f.id === customFolder.id && f.name === 'Dhimma Hojii (Labor Cases)'));

    const renamed = renameFolder(customFolder.id, 'Dhimma Hojii fi Beenyaa', 'blue');
    assert.ok(renamed);
    assert.equal(renamed?.name, 'Dhimma Hojii fi Beenyaa');
    assert.equal(renamed?.color, 'blue');

    const docsBefore = getSavedDocuments();
    const targetDoc = docsBefore[0];
    moveDocumentToFolder(targetDoc.id, customFolder.id);
    assert.equal(getSavedDocuments().find((d) => d.id === targetDoc.id)?.folderId, customFolder.id);

    // Deleting the folder must clear folderId without deleting the document itself
    deleteFolder(customFolder.id);
    assert.equal(getFolders().some((f) => f.id === customFolder.id), false);
    const docAfterFolderDelete = getSavedDocuments().find((d) => d.id === targetDoc.id);
    assert.ok(docAfterFolderDelete, 'Document must not be deleted when its folder is deleted');
    assert.equal(docAfterFolderDelete?.folderId, undefined);

    // Auto-categorize unfiled documents into folders using user-scoped storage keys
    const autoResult = autoCategorizeDocumentsIntoFolders();
    assert.ok(autoResult.categorizedCount >= 1);
    const scopedFoldersRaw = localStore.getItem(getUserScopedKey('seera_ai_legal_folders'));
    assert.ok(scopedFoldersRaw, 'Folders must be stored under user-scoped key');
    const allDocsNowFiled = getSavedDocuments().every((d) => Boolean(d.folderId));
    assert.equal(allDocsNowFiled, true);
  });

  // 4. Tagging: parseTagInput, NFKC/case deduplication across om/am/en, and removal
  await runTest('4. Tagging parses delimiters cleanly, deduplicates across Unicode/case, and removes tags', () => {
    const parsed = parseTagInput('#Heera, beenyaa; የሠራተኛ መብት\nBeenyaa, #Cassation');
    assert.deepEqual(parsed, ['Heera', 'beenyaa', 'የሠራተኛ መብት', 'Cassation']);

    const doc = saveDocument({
      title: 'Iyyannoo Ol-iyyannoo',
      taskType: 'explain_law',
      prompt: 'Legal brief',
      outputLanguages: ['om'],
      originalLanguage: 'om',
      content: 'Qabiyyee iyyannoo ol-iyyannoo bu’uura Labsii Lakk. 1156/2011.',
      tags: ['Ol-iyyannoo'],
    });

    const afterAdd = addTagsToDocument(doc.id, 'ol-iyyannoo, Dhaddacha Ijibbaataa; የሰበር ውሳኔ, Cassation');
    assert.ok(afterAdd);
    assert.deepEqual(afterAdd?.tags, ['Ol-iyyannoo', 'Dhaddacha Ijibbaataa', 'የሰበር ውሳኔ', 'Cassation']);

    const afterRemove = removeTagFromDocument(doc.id, 'dhaddacha ijibbaataa');
    assert.ok(afterRemove);
    assert.deepEqual(afterRemove?.tags, ['Ol-iyyannoo', 'የሰበር ውሳኔ', 'Cassation']);
  });

  // 5. Full-text search across trilingual docs, apostrophe/NFKC normalization, folder & tag & language filters, snippets
  await runTest('5. searchDocuments searches title/body/tags/metadata with language/folder/tag filters and snippets', () => {
    const folderA = createFolder('Dhimma Dhaalaa', 'purple');
    const docs = getSavedDocuments();
    const omDoc = docs.find((d) => d.originalLanguage === 'om' && d.title === 'Waliigaltee Kireessuu')!;
    const amDoc = docs.find((d) => d.originalLanguage === 'am')!;
    const enDoc = docs.find((d) => d.originalLanguage === 'en')!;

    moveDocumentToFolder(omDoc.id, folderA.id);
    toggleBookmarkDocument(amDoc.id);
    updateDocument(enDoc.id, { caseName: 'Abebe vs. Nile Transport PLC', docType: 'Contract' });

    const refreshed = getSavedDocuments();

    // Apostrophe & NFKC normalization search in Afaan Oromoo body
    const omHits = searchDocuments(refreshed, { query: "bu'uura kireessuu" });
    assert.ok(omHits.some((h) => h.doc.id === omDoc.id));
    const omHit = omHits.find((h) => h.doc.id === omDoc.id)!;
    assert.equal(omHit.originalLanguage, 'om');
    assert.ok(omHit.matchedIn.includes('content'));
    assert.ok(omHit.snippet && omHit.snippet.matchCount >= 1);

    // Amharic full-text search
    const amHits = searchDocuments(refreshed, { query: 'ፍትሐ ብሔር 2896', languageFilter: 'am' });
    assert.equal(amHits.length, 1);
    assert.equal(amHits[0].doc.id, amDoc.id);
    assert.equal(amHits[0].originalLanguage, 'am');
    assert.ok(amHits[0].snippet?.snippet.includes('2896'));

    // English metadata + body search
    const enHits = searchDocuments(refreshed, { query: 'Nile Transport', languageFilter: 'en' });
    assert.equal(enHits.length, 1);
    assert.equal(enHits[0].doc.id, enDoc.id);
    assert.ok(enHits[0].matchedIn.includes('metadata'));

    // Folder filter + tag filter
    const folderHits = searchDocuments(refreshed, { folder: folderA.id, tagFilter: 'Waliigaltee' });
    assert.equal(folderHits.length, 1);
    assert.equal(folderHits[0].doc.id, omDoc.id);

    // Bookmarked filter
    const bookmarkHits = searchDocuments(refreshed, { folder: 'bookmarked' });
    assert.equal(bookmarkHits.length, 1);
    assert.equal(bookmarkHits[0].doc.id, amDoc.id);

    // Standalone snippet extractor check
    const snip = extractSearchSnippet(
      'Section 1. Preliminary Jurisdiction. The Federal Supreme Court Cassation Bench hereby affirms jurisdiction over maritime insurance disputes under Article 642.',
      'Cassation Bench jurisdiction',
      110
    );
    assert.ok(snip);
    assert.ok(snip!.matchCount >= 1);
    assert.ok(normalizeSearchText(snip!.snippet).includes('cassation'));
  });

  // 6. User-scoped data isolation check
  await runTest('6. Switching active user isolates saved documents and folders cleanly', () => {
    const user1Docs = getSavedDocuments();
    assert.ok(user1Docs.length >= 4);

    localStore.setItem('seera_current_user_id', 'jurist_user_002');
    localStore.setItem('seera_current_user_email', 'jurist002@seeraai.et');

    const user2Docs = getSavedDocuments();
    assert.equal(user2Docs.length, 0);

    const user2Folder = createFolder('Private Chamber Files', 'amber');
    const user2Saved = saveDocument({
      title: 'Private Defense Brief',
      taskType: 'general',
      prompt: 'Uploaded',
      outputLanguages: ['en'],
      originalLanguage: 'en',
      content: 'Confidential defense submission prepared in English.',
      folderId: user2Folder.id,
      tags: ['Defense'],
    });

    assert.equal(getSavedDocuments().length, 1);
    assert.equal(getSavedDocuments()[0].id, user2Saved.id);

    // Switch back to user 1 and verify user 2's doc is not visible
    localStore.setItem('seera_current_user_id', 'jurist_user_001');
    localStore.setItem('seera_current_user_email', 'jurist001@seeraai.et');
    const user1DocsAfter = getSavedDocuments();
    assert.equal(user1DocsAfter.some((d) => d.id === user2Saved.id), false);
    assert.equal(user1DocsAfter.length, user1Docs.length);
  });

  console.log(`\nPASSED TESTS: ${passed}/6`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
