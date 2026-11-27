import assert from 'node:assert/strict';
import {
  formatTelegramFaqAutoReply,
  matchTelegramFaqProclamations,
  resolvePublicAppBaseUrl,
} from '../src/server/legal/telegramFaqAutoResponder';

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
  console.log('--- STARTING TELEGRAM FAQ AUTO-RESPONDER TEST SUITE ---');

  await runTest('1. Direct proclamation number & keyword lookup returns Labor Proclamation 1156/2019 with deep links', () => {
    const byNumber = matchTelegramFaqProclamations('1156/2019', { lang: 'en' });
    assert.equal(byNumber.isDirectFaqLookup, true);
    assert.equal(byNumber.isFaqOverviewRequest, false);
    assert.ok(byNumber.matches.length > 0);
    assert.equal(byNumber.matches[0].id, 'fed_proc_1156_2019');
    assert.ok(byNumber.matches[0].appUrl.includes('tab=legislation'));
    assert.ok(byNumber.matches[0].appUrl.includes('q=Labsii+1156%2F2011'));
    assert.equal(byNumber.matches[0].telegramUrl, 'https://t.me/wakolegalstudio/1480');

    const byKeyword = matchTelegramFaqProclamations('labor proclamation link', { lang: 'om' });
    assert.equal(byKeyword.isDirectFaqLookup, true);
    assert.equal(byKeyword.matches[0].id, 'fed_proc_1156_2019');
  });

  await runTest('2. FAQ overview command returns featured active proclamations without repealed laws', () => {
    const overview = matchTelegramFaqProclamations('/faq', { lang: 'om', limit: 6 });
    assert.equal(overview.isFaqOverviewRequest, true);
    assert.equal(overview.isDirectFaqLookup, true);
    assert.ok(overview.matches.length >= 4);
    assert.ok(overview.matches.some((m) => m.id === 'fed_proc_1156_2019'));
    assert.ok(overview.matches.some((m) => m.id === 'fed_proc_1332_2016'));
    assert.ok(overview.matches.every((m) => m.status !== 'repealed'));
  });

  await runTest('3. Active rural land proclamation 248/2015 ranks first; repealed 130/1999 surfaces only when explicitly requested', () => {
    const generalRural = matchTelegramFaqProclamations('rural land', { lang: 'en' });
    assert.ok(generalRural.matches.length > 0);
    assert.equal(generalRural.matches[0].id, 'oro_proc_248_2015');
    assert.equal(generalRural.matches[0].status, 'active');

    const explicitRepealed = matchTelegramFaqProclamations('130/1999', { lang: 'om' });
    assert.ok(explicitRepealed.matches.some((m) => m.id === 'oro_proc_130_1999' && m.status === 'repealed'));
    const formatted = formatTelegramFaqAutoReply(explicitRepealed, 'om');
    assert.ok(formatted.includes('Haqameera'));
  });

  await runTest('4. Substantive legal question matches relevant proclamation without hijacking AI legal analysis', () => {
    const deepQuestion = matchTelegramFaqProclamations(
      'What does Labor Proclamation 1156/2019 Art. 39 say about severance?',
      { lang: 'en' }
    );
    assert.equal(deepQuestion.isDirectFaqLookup, false);
    assert.equal(deepQuestion.isFaqOverviewRequest, false);
    assert.ok(deepQuestion.matches.length > 0);
    assert.equal(deepQuestion.matches[0].id, 'fed_proc_1156_2019');
  });

  await runTest('5. Trilingual auto-reply formatting and URL normalization work across om, am, and en', () => {
    const resOm = matchTelegramFaqProclamations('1332/2016', { lang: 'om' });
    const textOm = formatTelegramFaqAutoReply(resOm, 'om');
    assert.ok(textOm.includes('Linkii Saffisaa Labsiilee Seeraa'));
    assert.ok(textOm.includes('https://t.me/seeraai_ethio/245'));

    const resAm = matchTelegramFaqProclamations('1156/2019', { lang: 'am' });
    const textAm = formatTelegramFaqAutoReply(resAm, 'am');
    assert.ok(textAm.includes('ተዛማጅ አዋጆች እና ፈጣን ሊንኮች'));
    assert.ok(textAm.includes('ዋና አንቀጾች'));

    const resEn1156 = matchTelegramFaqProclamations('1156/2019', { lang: 'en' });
    const textEn1156 = formatTelegramFaqAutoReply(resEn1156, 'en');
    assert.ok(textEn1156.includes('Instant Proclamation Links'));
    assert.ok(textEn1156.includes('Key Articles'));

    const resEn1321 = matchTelegramFaqProclamations('1321/2024', { lang: 'en' });
    const textEn1321 = formatTelegramFaqAutoReply(resEn1321, 'en');
    assert.ok(textEn1321.includes('Personal Data Protection Proclamation No. 1321/2024'));

    assert.equal(
      resolvePublicAppBaseUrl('https://ais-dev-example.europe-west3.run.app/'),
      'https://ais-pre-example.europe-west3.run.app'
    );
  });

  console.log(`\nPASSED TESTS: ${passed}/5`);
}

void main();
