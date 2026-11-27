import assert from 'node:assert/strict';
import {
  COURT_NAME_MAPPINGS,
  LEGAL_DOCUMENT_TYPE_MAPPINGS,
  COMMON_LEGAL_PHRASES_MAPPINGS,
  lookupLegalTerm,
  normalizeCourtName,
  normalizeDocumentType,
  getAiTerminologyConsistencyPrompt,
} from '../src/services/legalTerminologyService';
import {
  findRelevantTelegramPrecedents,
} from '../src/data/telegramMasterArchive';

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
  console.log('--- STARTING LEGAL TERMINOLOGY & RETRIEVAL DEDUPLICATION SUITE ---');

  // Test 1: Trilingual Court Name Mappings
  await runTest('1. Court Name Mappings: Authoritative Federal & Oromia courts are mapped trilingually', () => {
    assert.ok(COURT_NAME_MAPPINGS.length >= 10);
    const federalCassation = COURT_NAME_MAPPINGS.find((c) => c.id === 'court_fsc_cassation');
    assert.ok(federalCassation);
    assert.equal(federalCassation.terms.om, 'Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa');
    assert.equal(federalCassation.terms.am, 'የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት');
    assert.equal(federalCassation.terms.en, 'Federal Supreme Court Cassation Division');

    const oromiaCassation = COURT_NAME_MAPPINGS.find((c) => c.id === 'court_osc_cassation');
    assert.ok(oromiaCassation);
    assert.equal(oromiaCassation.terms.om, 'Mana Murtii Waliigalaa Oromiyaa Dhaddacha Ijibbaataa');
  });

  // Test 2: Legal Document Types
  await runTest('2. Legal Document Types: Key pleading and procedural documents mapped trilingually', () => {
    assert.ok(LEGAL_DOCUMENT_TYPE_MAPPINGS.length >= 12);
    const claim = LEGAL_DOCUMENT_TYPE_MAPPINGS.find((d) => d.id === 'doc_statement_of_claim');
    assert.ok(claim);
    assert.equal(claim.terms.om, 'Iyyannoo Himannaa (Kadhannaa)');
    assert.equal(claim.terms.am, 'የክስ ማመልከቻ');
    assert.equal(claim.terms.en, 'Statement of Claim / Plaint');

    const cassationPetition = LEGAL_DOCUMENT_TYPE_MAPPINGS.find((d) => d.id === 'doc_cassation_petition');
    assert.ok(cassationPetition);
    assert.equal(cassationPetition.terms.om, 'Iyyannoo Dhaddacha Ijibbaataa');
  });

  // Test 3: Common Legal Phrases & Principles
  await runTest('3. Common Legal Phrases: Fundamental legal maxims and terms are strictly mapped', () => {
    assert.ok(COMMON_LEGAL_PHRASES_MAPPINGS.length >= 20);
    const ratio = COMMON_LEGAL_PHRASES_MAPPINGS.find((p) => p.id === 'phrase_ratio_decidendi');
    assert.ok(ratio);
    assert.equal(ratio.terms.om, 'Qajeeltoo Seeraa Dirqisiisaa (Hiika Seeraa Dirqisiisaa)');

    const resJudicata = COMMON_LEGAL_PHRASES_MAPPINGS.find((p) => p.id === 'phrase_res_judicata');
    assert.ok(resJudicata);
    assert.equal(resJudicata.terms.om, 'Dhimma Murtii Argatee Xumurame (Rees Judikaataa)');
  });

  // Test 4: Terminology Lookups and Normalization
  await runTest('4. Lookup & Normalization: Identifies cross-language terms and maps accurately', () => {
    const termMatch = lookupLegalTerm('የሰበር አቤቱታ');
    assert.ok(termMatch.matchedEntry);
    assert.equal(termMatch.matchedEntry.id, 'doc_cassation_petition');
    assert.equal(termMatch.matchedEntry.terms.om, 'Iyyannoo Dhaddacha Ijibbaataa');

    const normCourt = normalizeCourtName('Federal High Court', 'om');
    assert.equal(normCourt, 'Mana Murtii Olaanaa Federaalaa');

    const normDoc = normalizeDocumentType('Iyyannoo Himannaa', 'am');
    assert.equal(normDoc, 'የክስ ማመልከቻ');
  });

  // Test 5: AI System Directive
  await runTest('5. AI System Directive: Generates comprehensive terminology constraints', () => {
    const promptOm = getAiTerminologyConsistencyPrompt('om');
    assert.ok(promptOm.includes('AUTHORITATIVE TRILINGUAL LEGAL TERMINOLOGY MANDATE'));
    assert.ok(promptOm.includes('Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa'));
    assert.ok(promptOm.includes('Iyyannoo Himannaa'));

    const promptAm = getAiTerminologyConsistencyPrompt('am');
    assert.ok(promptAm.includes('የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት'));
  });

  // Test 6: Deduplication and Synthetic Template Exclusion in Telegram Retrieval
  await runTest('6. Retrieval Deduplication: Generic query does NOT return repeated synthetic templates', () => {
    const results = findRelevantTelegramPrecedents('murtii dhimma seeraa', 4);
    // Should never return synthetic template records
    for (const r of results) {
      assert.notEqual(r.isSyntheticTemplate, true);
    }

    // Check unique file numbers and titles
    const fileNumbers = results.map((r) => r.fileNumber).filter(Boolean);
    const uniqueFileNumbers = new Set(fileNumbers);
    assert.equal(fileNumbers.length, uniqueFileNumbers.size, 'No duplicate file numbers');
  });

  // Test 7: Specific Query Matching
  await runTest('7. Specific Legal Inquiry: Labor dispute query retrieves genuine labor precedents, not random templates', () => {
    const results = findRelevantTelegramPrecedents('kaffaltii hojiirraa gaggeeffamaa seera hojjataa fi hojjechiisaa', 3);
    for (const r of results) {
      assert.notEqual(r.isSyntheticTemplate, true);
    }
  });

  console.log(`\nALL EXECUTED TERMINOLOGY & DEDUPLICATION TESTS PASSED: ${passed}/7`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
