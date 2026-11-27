import assert from 'node:assert/strict';
import {
  categorizeLegalQuery,
  getAllUserLegalInquiries,
  recordUserLegalInquiry,
  getInquiryFrequencyTimeline,
  getCategoryDistribution,
  getJurisdictionDistribution,
  getHourlyInquiryActivity,
  getInquiryKpiSummary,
  LegalInquiryCategory,
} from '../src/services/userInquiryAnalyticsService';

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
  console.log('--- STARTING USER LEGAL INQUIRY ANALYTICS SUITE ---');

  // Test 1: Legal Query Categorization across Oromo, Amharic, and English
  await runTest('1. Categorization: Trilingual legal keywords map to correct domains', () => {
    // Labor
    assert.equal(
      categorizeLegalQuery('Labsii hojjataa fi hojjechiisaa lakk 1156/2011 kaffaltii hojiirraa gaggeeffamaa'),
      'labor'
    );
    assert.equal(categorizeLegalQuery('የአሰሪና ሰራተኛ አዋጅ 1156/2011 ስንብት'), 'labor');
    assert.equal(categorizeLegalQuery('Unlawful dismissal and severance pay calculation under proclamation 1156'), 'labor');

    // Land
    assert.equal(categorizeLegalQuery('Labsii Lafa Baadiyyaa Oromiyaa Lakk. 248/2015 qabiyyee'), 'land_property');
    assert.equal(categorizeLegalQuery('የገጠር መሬት ይዞታ ማረጋገጫ ደብተር'), 'land_property');

    // Contracts
    assert.equal(categorizeLegalQuery('Koodii Siiviilii Kwt. 1723 waliigaltee kireessaa manaa'), 'contracts_commercial');
    assert.equal(categorizeLegalQuery('የቤት ኪራይ ውል እና የንግድ ውል ማፍረስ'), 'contracts_commercial');

    // Criminal
    assert.equal(categorizeLegalQuery('Mirga wabiin bahuu seera deemsa falmii yakkaa keessatti'), 'criminal_procedure');
    assert.equal(categorizeLegalQuery('የዋስትና መብት እና የወንጀል ምርመራ'), 'criminal_procedure');

    // Cassation
    assert.equal(categorizeLegalQuery('Dhaddacha Ijibbaataa Galmee Lakk. 198742 Jildii 22'), 'cassation_civil');
    assert.equal(categorizeLegalQuery('የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር መዝገብ'), 'cassation_civil');

    // Family
    assert.equal(categorizeLegalQuery('Seera maatii fi dhaala qabeenyaa'), 'family_inheritance');

    // Constitutional
    assert.equal(categorizeLegalQuery('Heera Mootummaa RDFI Keeyyata 40 mirga namoomaa'), 'constitutional_admin');
  });

  // Test 2: Inquiries Retrieval & Baseline Seeding
  await runTest('2. Inquiries Ledger: Returns chronologically ordered legal inquiry records', () => {
    const inquiries = getAllUserLegalInquiries();
    assert.ok(Array.isArray(inquiries));
    assert.ok(inquiries.length >= 5, 'Baseline seeds provide at least 5 records');

    for (const inq of inquiries) {
      assert.ok(inq.id);
      assert.ok(inq.query);
      assert.ok(inq.category);
      assert.ok(inq.timestamp > 0);
      assert.ok(inq.categoryLabel.om);
      assert.ok(inq.categoryLabel.am);
      assert.ok(inq.categoryLabel.en);
    }
  });

  // Test 3: Record New User Legal Inquiry
  await runTest('3. Real-time Recording: Logs new inquiry and assigns proper metadata', () => {
    const testQuery = 'Labsii 1156/2011 keeyyata 27 hojjataa heeyyama malee hafe';
    const recorded = recordUserLegalInquiry(testQuery, {
      jurisdiction: 'both',
      sourcesCount: 3,
      durationMs: 1100,
    });

    assert.ok(recorded.id.startsWith('inq_'));
    assert.equal(recorded.query, testQuery);
    assert.equal(recorded.category, 'labor');
    assert.equal(recorded.groundedSourcesCount, 3);
  });

  // Test 4: Recharts Timeline Aggregation
  await runTest('4. Recharts Frequency Timeline: Generates multi-series daily data points', () => {
    const timeline = getInquiryFrequencyTimeline(7);
    assert.equal(timeline.length, 7);

    for (const point of timeline) {
      assert.ok(point.date);
      assert.ok(point.dayLabel);
      assert.ok(typeof point.totalInquiries === 'number');
      assert.ok(typeof point.labor === 'number');
      assert.ok(typeof point.land_property === 'number');
      assert.ok(typeof point.contracts_commercial === 'number');
      assert.ok(typeof point.criminal_procedure === 'number');
      assert.ok(typeof point.cassation_civil === 'number');
    }
  });

  // Test 5: Recharts Category Distribution Aggregation
  await runTest('5. Recharts Category Distribution: Computes percentage, color, and localized names', () => {
    const dist = getCategoryDistribution('om');
    assert.ok(dist.length >= 7);

    let totalPct = 0;
    for (const item of dist) {
      assert.ok(item.key);
      assert.ok(item.name);
      assert.ok(item.color.startsWith('#'));
      assert.ok(typeof item.count === 'number');
      assert.ok(typeof item.percentage === 'number');
      totalPct += item.percentage;
    }
    assert.ok(totalPct > 0);
  });

  // Test 6: Jurisdiction Distribution Aggregation
  await runTest('6. Jurisdiction Distribution: Breaks down federal vs regional coverage', () => {
    const jur = getJurisdictionDistribution();
    assert.equal(jur.length, 3);
    const oromia = jur.find((j) => j.jurisdiction === 'oromia');
    const federal = jur.find((j) => j.jurisdiction === 'federal');
    const both = jur.find((j) => j.jurisdiction === 'both');

    assert.ok(oromia);
    assert.ok(federal);
    assert.ok(both);
  });

  // Test 7: Hourly Activity & KPI Summary Aggregations
  await runTest('7. Hourly Activity & KPI Summary: Computes 24h distribution and accuracy KPIs', () => {
    const hourly = getHourlyInquiryActivity();
    assert.equal(hourly.length, 24);

    const kpis = getInquiryKpiSummary();
    assert.ok(kpis.totalInquiries >= 5);
    assert.ok(kpis.topCategoryKey);
    assert.ok(kpis.groundedRate >= 50 && kpis.groundedRate <= 100);
    assert.ok(kpis.avgDailyCount > 0);
    assert.ok(kpis.activeDaysCount > 0);
  });

  console.log(`\nALL EXECUTED USER INQUIRY ANALYTICS TESTS PASSED: ${passed}/7`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
