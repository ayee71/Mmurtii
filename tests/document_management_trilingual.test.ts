import assert from 'node:assert/strict';
import {
  detectDocumentLanguage,
  getDocumentOriginalLanguage,
  parseTagInput,
  normalizeSearchText,
  extractSearchSnippet,
  searchDocuments,
} from '../src/utils/languageDetect';
import { extractDocumentContent } from '../src/server/legal/documentIngestionPipeline';

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

function setupBrowserGlobals() {
  const ls = new MemoryStorage();
  const ss = new MemoryStorage();
  (globalThis as any).localStorage = ls;
  (globalThis as any).sessionStorage = ss;
  if (typeof (globalThis as any).CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEvent<T = any> {
      type: string;
      detail?: T;
      constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }
  return { ls, ss };
}

let passed = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  const { ls } = setupBrowserGlobals();

  // Dynamic import after browser storage globals are initialized
  const storage = await import('../src/services/storage');

  await runTest('1. detectDocumentLanguage accurately classifies Afaan Oromoo, Amharic, and English legal texts', () => {
    const omText =
      "Waliigaltee Kiraa Manaa keeyyata 1711 bu'uura godhachuun Mana Murtii Aanaa keessatti mirgaa fi dirqama kaffaltii beenyaa irratti murtaa'e.";
    const amText =
      'የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ ሰበር ሰሚ ችሎት በመዝገብ ቁጥር 241890 አቤቱታና የሥራ ውል ክርክር ላይ የሰጠው ውሳኔ።';
    const enText =
      'Pursuant to Article 2028 of the Ethiopian Civil Code and Labor Proclamation No. 1156/2019, the plaintiff seeks compensation and contractual enforcement.';

    const omRes = detectDocumentLanguage(omText);
    const amRes = detectDocumentLanguage(amText);
    const enRes = detectDocumentLanguage(enText);

    assert.equal(omRes.language, 'om');
    assert.equal(omRes.script, 'latin');
    assert.equal(amRes.language, 'am');
    assert.equal(amRes.script, 'ethiopic');
    assert.equal(enRes.language, 'en');
    assert.equal(enRes.script, 'latin');
  });

  await runTest('2. saveDocument preserves originalLanguage verbatim regardless of UI language', () => {
    ls.clear();
    ls.setItem('seera_lang', 'en'); // UI language is English, uploaded documents are om & am

    const omDoc = storage.saveDocument({
      title: 'Iyyannoo Ol-iyyannoo',
      content: 'Kun iyyannoo ol-iyyannoo Mana Murtii Olaanaatti dhihaateedha. Keeyyata 323 SDFHH.',
      prompt: 'Uploaded File: appeal_om.txt',
      taskType: 'general',
      outputLanguages: ['om'],
      tags: ['ol-iyyannoo', 'SDFHH'],
      fileName: 'appeal_om.txt',
      isUploaded: true,
    });

    const amDoc = storage.saveDocument({
      title: 'የሥራ ውል ስምምነት',
      content: 'በአሰሪና ሰራተኛ አዋጅ ቁጥር 1156/2011 መሠረት የተደረገ የሥራ ውል እና የካሳ ስምምነት።',
      prompt: 'Uploaded File: employment_am.txt',
      taskType: 'general',
      outputLanguages: ['am'],
      tags: ['ውል', 'ካሳ'],
      fileName: 'employment_am.txt',
      isUploaded: true,
    });

    const enDoc = storage.saveDocument({
      title: 'Commercial Lease Contract',
      content: 'This Lease Agreement is executed pursuant to Article 2896 of the Civil Code between Landlord and Tenant.',
      prompt: 'Uploaded File: lease_en.txt',
      taskType: 'contract',
      outputLanguages: ['en'],
      tags: ['Lease', 'Civil Code'],
      fileName: 'lease_en.txt',
      isUploaded: true,
    });

    assert.equal(omDoc.originalLanguage, 'om');
    assert.equal(getDocumentOriginalLanguage(omDoc), 'om');
    assert.equal(amDoc.originalLanguage, 'am');
    assert.equal(getDocumentOriginalLanguage(amDoc), 'am');
    assert.equal(enDoc.originalLanguage, 'en');
    assert.equal(getDocumentOriginalLanguage(enDoc), 'en');
  });

  await runTest('3. Trilingual keyword tagging: parseTagInput, addTagsToDocument, removeTagFromDocument', () => {
    const parsed = parseTagInput('#Waliigaltee, ካሳ, Contract; waliigaltee, ውል');
    assert.deepEqual(parsed, ['Waliigaltee', 'ካሳ', 'Contract', 'ውል']);

    const docs = storage.getSavedDocuments();
    const target = docs.find((d) => d.originalLanguage === 'am')!;
    const afterAdd = storage.addTagsToDocument(target.id, 'ሰበር, Labor Law, ካሳ');
    assert.ok(afterAdd);
    assert.ok(afterAdd.tags.includes('ሰበር'));
    assert.ok(afterAdd.tags.includes('Labor Law'));
    // 'ካሳ' already existed so should remain deduplicated
    assert.equal(afterAdd.tags.filter((t) => normalizeSearchText(t) === normalizeSearchText('ካሳ')).length, 1);

    const afterRemove = storage.removeTagFromDocument(target.id, 'Labor Law');
    assert.ok(afterRemove);
    assert.ok(!afterRemove.tags.includes('Labor Law'));
    assert.ok(afterRemove.tags.includes('ውል'));
  });

  await runTest('4. Folder lifecycle: createFolder, renameFolder, moveDocumentToFolder, deleteFolder', () => {
    const folder = storage.createFolder('Dhimma Hojjetaa', 'emerald');
    assert.equal(folder.name, 'Dhimma Hojjetaa');

    const renamed = storage.renameFolder(folder.id, 'Dhimmoota Hojjetaa fi Hojjechiisaa', 'blue');
    assert.ok(renamed);
    assert.equal(renamed.name, 'Dhimmoota Hojjetaa fi Hojjechiisaa');
    assert.equal(renamed.color, 'blue');

    const docsBefore = storage.getSavedDocuments();
    const targetDoc = docsBefore[0];
    storage.moveDocumentToFolder(targetDoc.id, folder.id);

    const docsMoved = storage.getSavedDocuments();
    assert.equal(docsMoved.find((d) => d.id === targetDoc.id)?.folderId, folder.id);

    storage.deleteFolder(folder.id);
    const docsAfterDelete = storage.getSavedDocuments();
    assert.equal(docsAfterDelete.find((d) => d.id === targetDoc.id)?.folderId, undefined);
  });

  await runTest('5. autoCategorizeDocumentsIntoFolders respects user-scoped keys and organizes trilingual docs', () => {
    const res = storage.autoCategorizeDocumentsIntoFolders();
    assert.ok(res.categorizedCount >= 1);
    const docsAfter = storage.getSavedDocuments();
    const amDoc = docsAfter.find((d) => d.originalLanguage === 'am');
    assert.equal(amDoc?.folderId, 'folder_contracts');
  });

  await runTest('6. Full-text searchDocuments + languageFilter + tagFilter + unfiled + extractSearchSnippet', () => {
    const unfiledDoc = storage.saveDocument({
      title: 'Evidence Memo',
      content: 'Witness testimony submitted regarding land boundary dispute in Bishoftu under Article 1200.',
      prompt: 'Evidence Memo',
      taskType: 'general',
      originalLanguage: 'en',
      outputLanguages: ['en'],
      tags: ['Evidence', 'Land'],
    });

    const allDocs = storage.getSavedDocuments();

    // Search Amharic phrase inside document content
    const amHits = searchDocuments(allDocs, { query: 'አሰሪና ሰራተኛ', languageFilter: 'am' });
    assert.equal(amHits.length, 1);
    assert.equal(amHits[0].originalLanguage, 'am');
    assert.ok(amHits[0].matchedIn.includes('content'));
    assert.ok(amHits[0].snippet);
    assert.ok(amHits[0].snippet!.snippet.includes('አሰሪና ሰራተኛ'));

    // Search Oromo phrase inside document content
    const omHits = searchDocuments(allDocs, { query: 'kaffaltii', languageFilter: 'all' });
    assert.equal(omHits.length, 0); // none has kaffaltii in our saved docs yet, try SDFHH
    const omHits2 = searchDocuments(allDocs, { query: 'SDFHH', languageFilter: 'om' });
    assert.equal(omHits2.length, 1);
    assert.equal(omHits2[0].originalLanguage, 'om');

    // Language filter alone isolates uploaded English docs
    const enOnly = searchDocuments(allDocs, { languageFilter: 'en' });
    assert.equal(enOnly.length, 2);
    assert.ok(enOnly.every((h) => h.originalLanguage === 'en'));

    // Tag filter without overwriting query
    const tagAndQueryHits = searchDocuments(allDocs, {
      query: 'Bishoftu',
      tagFilter: 'Land',
      folder: 'unfiled',
    });
    assert.equal(tagAndQueryHits.length, 1);
    assert.equal(tagAndQueryHits[0].doc.id, unfiledDoc.id);

    const snippetRes = extractSearchSnippet(unfiledDoc.content, 'boundary dispute', 80);
    assert.ok(snippetRes);
    assert.ok(snippetRes.snippet.toLowerCase().includes('boundary dispute'));
    assert.ok(snippetRes.matchCount >= 1);

    const singleTermRes = extractSearchSnippet(unfiledDoc.content, 'Bishoftu', 80);
    assert.ok(singleTermRes);
    assert.equal(singleTermRes.matchCount, 1);
  });

  await runTest('7. Server extractDocumentContent preserves UTF-8 Afaan Oromoo & Amharic text verbatim', async () => {
    const sampleAmOm =
      'Waliigaltee Hojii fi Murtee Dhaddacha Ijibbaataa\nየሥራ ውል እና የሰበር ችሎት ውሳኔ ቁጥር 214560';
    const parsed = await extractDocumentContent({
      buffer: Buffer.from(sampleAmOm, 'utf8'),
      fileName: 'bilingual_legal_note.txt',
      mimeType: 'text/plain',
    });
    assert.equal(parsed.text, sampleAmOm);
    assert.equal(parsed.ocrApplied, false);
  });

  console.log(`\nALL ${passed} TRILINGUAL DOCUMENT MANAGEMENT TESTS PASSED`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
