/**
 * SEERAAI PRO — Centralized Trilingual Legal Terminology Database
 * Strict mappings across Afaan Oromoo, Amharic, and English for:
 * 1. Court Names (Federal & Oromia Regional Court Hierarchy)
 * 2. Legal Document Types (Pleadings, Motions, Judgments, Affidavits)
 * 3. Common Legal Phrases & Core Jurisprudential Terminology
 *
 * Designed to ensure strict consistency across AI model outputs,
 * legal search retrieval, and user interface translation.
 */

export type TerminologyLanguage = 'om' | 'am' | 'en';

export type LegalDomain =
  | 'civil'
  | 'criminal'
  | 'procedure'
  | 'civil_procedure'
  | 'constitutional'
  | 'labor'
  | 'land'
  | 'commercial'
  | 'family'
  | 'administrative'
  | 'evidence';

export interface TrilingualTermEntry {
  id: string;
  category: 'court_name' | 'document_type' | 'legal_phrase';
  domain?: LegalDomain;
  terms: {
    om: string;
    am: string;
    en: string;
  };
  abbreviations?: {
    om?: string;
    am?: string;
    en?: string;
  };
  definition?: {
    om: string;
    am: string;
    en: string;
  };
  statutoryBasis?: string;
}

// ==========================================
// 1. COURT NAMES (ETHIOPIAN FEDERAL & OROMIA REGIONAL)
// ==========================================
export const COURT_NAME_MAPPINGS: TrilingualTermEntry[] = [
  {
    id: 'court_fsc_cassation',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa',
      am: 'የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት',
      en: 'Federal Supreme Court Cassation Division',
    },
    abbreviations: {
      om: 'MMWF Dhaddacha Ijibbaataa',
      am: 'የፌ/ጠ/ፍ/ቤት ሰበር',
      en: 'FSCCD',
    },
    definition: {
      om: 'Dhaddacha ol-aanaa murtii dhumaa dogoggora bu\'uura seeraa qabu qajeelchuuf aangoo qabu.',
      am: 'መሰረታዊ የሕግ ስህተት ያለባቸውን የመጨረሻ ውሳኔዎች የማረም ስልጣን ያለው ከፍተኛ ችሎት።',
      en: 'Apex division with jurisdictional authority to review and correct fundamental errors of law.',
    },
    statutoryBasis: 'Heera RDFI Kwt 80(3)(a); Labsii 1234/2013 Kwt 10',
  },
  {
    id: 'court_fsc',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Waliigalaa Federaalaa',
      am: 'የፌዴራል ጠቅላይ ፍርድ ቤት',
      en: 'Federal Supreme Court',
    },
    abbreviations: {
      om: 'MMWF',
      am: 'የፌ/ጠ/ፍ/ቤት',
      en: 'FSC',
    },
    definition: {
      om: 'Mana murtii olaanaa federaalaa kan aangoo sadarkaa federaalaatti dhaddacha ijibbaataa fi oliyyannoo qabu.',
      am: 'በፌዴራል ደረጃ ከፍተኛ የዳኝነት ስልጣን ያለው የበላይ ፍርድ ቤት።',
      en: 'Supreme judicial organ of the Federal Democratic Republic of Ethiopia.',
    },
    statutoryBasis: 'Heera RDFI Kwt 79(1); Labsii 1234/2013',
  },
  {
    id: 'court_fhc',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Olaanaa Federaalaa',
      am: 'የፌዴራል ከፍተኛ ፍርድ ቤት',
      en: 'Federal High Court',
    },
    abbreviations: {
      om: 'MMOF',
      am: 'የፌ/ከ/ፍ/ቤት',
      en: 'FHC',
    },
    definition: {
      om: 'Mana murtii federaalaa aangoo jalqabaa fi oliyyannoo dhimmoota federaalaa qabu.',
      am: 'በፌዴራል ጉዳዮች ላይ የመጀመሪያ ደረጃ እና የይግባኝ ስልጣን ያለው ፍርድ ቤት።',
      en: 'Federal appellate and intermediate court exercising first-instance and appellate jurisdiction.',
    },
    statutoryBasis: 'Labsii 1234/2013 Kwt 11-13',
  },
  {
    id: 'court_ffic',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Jalqabaa Federaalaa',
      am: 'የፌዴራል የመጀመሪያ ደረጃ ፍርድ ቤት',
      en: 'Federal First Instance Court',
    },
    abbreviations: {
      om: 'MMJF',
      am: 'የፌ/መ/ደ/ፍ/ቤት',
      en: 'FFIC',
    },
    definition: {
      om: 'Mana murtii federaalaa dhimmoota seera federaalaatiin ilaallaman sadarkaa jalqabaatti dhagahu.',
      am: 'በፌዴራል ሕግ ስልጣን ስር ያሉ ጉዳዮችን በመጀመሪያ ደረጃ የሚያይ ፍርድ ቤት።',
      en: 'Trial court of first instance for federal civil and criminal jurisdiction.',
    },
    statutoryBasis: 'Labsii 1234/2013 Kwt 14-16',
  },
  {
    id: 'court_osc_cassation',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Waliigalaa Oromiyaa Dhaddacha Ijibbaataa',
      am: 'የኦሮሚያ ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት',
      en: 'Oromia Supreme Court Cassation Bench',
    },
    abbreviations: {
      om: 'MMWO Dhaddacha Ijibbaataa',
      am: 'የኦሮሚያ ጠ/ፍ/ቤት ሰበር',
      en: 'OSCCB',
    },
    definition: {
      om: 'Dhaddacha Naannoo Oromiyaa keessatti murtii dhumaa dogoggora bu\'uura seera naannichaa qabu sakatta\'u.',
      am: 'በኦሮሚያ ክልል ሕጎች ላይ የተፈጸሙ መሰረታዊ የሕግ ስህተቶችን የሚያርም የክልሉ ሰበር ችሎት።',
      en: 'Regional cassation division reviewing final judgments on basic errors of Oromia regional law.',
    },
    statutoryBasis: 'Heera Mootummaa Naannoo Oromiyaa Kwt 62; Labsii 216/2011 Kwt 8',
  },
  {
    id: 'court_osc',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Waliigalaa Oromiyaa',
      am: 'የኦሮሚያ ጠቅላይ ፍርድ ቤት',
      en: 'Oromia Supreme Court',
    },
    abbreviations: {
      om: 'MMWO',
      am: 'የኦሮሚያ ጠ/ፍ/ቤት',
      en: 'OSC',
    },
    definition: {
      om: 'Qaama abbaa seerummaa ol-aanaa Naannoo Oromiyaati.',
      am: 'የኦሮሚያ ብሔራዊ ክልላዊ መንግሥት የበላይ የዳኝነት አካል።',
      en: 'Apex regional court of the Oromia National Regional State.',
    },
    statutoryBasis: 'Heera Mootummaa Naannoo Oromiyaa Kwt 62; Labsii 216/2011',
  },
  {
    id: 'court_ohc',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Olaanaa Oromiyaa',
      am: 'የኦሮሚያ ከፍተኛ ፍርድ ቤት',
      en: 'Oromia High Court',
    },
    abbreviations: {
      om: 'MMOO',
      am: 'የኦሮሚያ ከ/ፍ/ቤት',
      en: 'OHC',
    },
    definition: {
      om: 'Mana murtii godinaalee Oromiyaa keessatti aangoo jalqabaa fi oliyyannoo qabu.',
      am: 'በኦሮሚያ ዞኖች ውስጥ የመጀመሪያ ደረጃ እና የይግባኝ ስልጣን ያለው ፍርድ ቤት።',
      en: 'Zonal-level high court in Oromia exercising both appellate and original jurisdiction.',
    },
    statutoryBasis: 'Labsii 216/2011 Kwt 14',
  },
  {
    id: 'court_odc',
    category: 'court_name',
    domain: 'procedure',
    terms: {
      om: 'Mana Murtii Aanaa Oromiyaa',
      am: 'የኦሮሚያ የወረዳ ፍርድ ቤት',
      en: 'Oromia Woreda (District) Court',
    },
    abbreviations: {
      om: 'MMAO',
      am: 'የኦሮሚያ ወ/ፍ/ቤት',
      en: 'OWC',
    },
    definition: {
      om: 'Mana murtii sadarkaa aanaatti falmii hariiroo hawaasaa fi yakkaa sadarkaa jalqabaatti ilaalu.',
      am: 'በወረዳ ደረጃ የፍትሐብሔር እና የወንጀል ክርክሮችን በመጀመሪያ ደረጃ የሚያይ ፍርድ ቤት።',
      en: 'Primary trial court at the district/woreda level in Oromia Regional State.',
    },
    statutoryBasis: 'Labsii 216/2011 Kwt 20',
  },
  {
    id: 'court_social',
    category: 'court_name',
    domain: 'civil',
    terms: {
      om: 'Mana Murtii Hawaasummaa',
      am: 'የማህበራዊ ፍርድ ቤት',
      en: 'Social Court (Kebele Level Tribunal)',
    },
    definition: {
      om: 'Mana murtii sadarkaa gandaatti wal-dhabdee xixiqqaa fi hariiroo hawaasummaa furuuf hundeeffame.',
      am: 'በቀበሌ ደረጃ አነስተኛ የፍትሐብሔር ክርክሮችንና የዕርቅ ጉዳዮችን ለማየት የተቋቋመ ፍርድ ቤት።',
      en: 'Neighborhood community court established at the kebele level for minor disputes and conciliation.',
    },
    statutoryBasis: 'Labsii 128/1999 (Oromia); Labsii 361/2003 (Addis Ababa)',
  },
  {
    id: 'court_labour_board',
    category: 'court_name',
    domain: 'labor',
    terms: {
      om: 'Boordii Murtee Falmii Hojjetaa fi Hojjechiisaa',
      am: 'የአሠሪና ሠራተኛ አከራካሪ ጉዳይ ወሳኝ ቦርድ',
      en: 'Labour Relations Board',
    },
    abbreviations: {
      om: 'BMFHH',
      am: 'አሠሪና ሠራተኛ ቦርድ',
      en: 'LRB',
    },
    definition: {
      om: 'Qaama bulchiinsaa wal-falmii gamtaa fi dhimmoota bu\'uuraa hojjetaa fi hojjechiisaa ilaaluuf aangoo seeraa qabu.',
      am: 'የህብረት ክርክሮችንና የአሠሪና ሠራተኛ አለመግባባቶችን ለመዳኘት በሕግ ስልጣን የተሰጠው ከፊል-ዳኝነት አካል።',
      en: 'Quasi-judicial administrative tribunal adjudicating collective and substantive labour disputes.',
    },
    statutoryBasis: 'Labsii 1156/2011 Kwt 144-156',
  },
  {
    id: 'court_tax_appeal',
    category: 'court_name',
    domain: 'administrative',
    terms: {
      om: 'Koomishinii Boordii Ol-iyyannoo Gibiraa',
      am: 'የታክስ ይግባኝ ሰሚ ኮሚሽን',
      en: 'Tax Appeal Commission',
    },
    definition: {
      om: 'Qaama oliyyannoo murtii kaffaltii taaksii fi gibiraa ilaaluuf hundeeffame.',
      am: 'የግብር ውሳኔዎችን ይግባኝ ለመስማትና ለመወሰን የተቋቋመ ከፊል-ዳኝነት ኮሚሽን።',
      en: 'Specialized administrative tribunal hearing appeals against tax authority assessments.',
    },
    statutoryBasis: 'Labsii 983/2008 Kwt 55-65',
  },
  {
    id: 'court_sharia',
    category: 'court_name',
    domain: 'family',
    terms: {
      om: 'Mana Murtii Shari\'aa (Federaalaa fi Naannoo)',
      am: 'የሸሪዓ ፍርድ ቤት (የፌዴራልና የክልል)',
      en: 'Sharia Court (Federal and Regional)',
    },
    definition: {
      om: 'Mana murtii dhimmoota maatii fi dhaala amantii Islaamaa bu\'uura heeraatiin gareewwan eeyyamaniin ilaalu.',
      am: 'በሙስሊሞች የጋብቻ፣ ፍቺ፣ የቤተሰብና ውርስ ጉዳዮች ላይ በተዋዋዮች ፈቃድ የሚዳኝ ፍርድ ቤት።',
      en: 'Religious personal status court with jurisdiction over marriage, divorce, and inheritance by consent of parties.',
    },
    statutoryBasis: 'Heera RDFI Kwt 34(5) & 78(5); Labsii 188/1992',
  },
];

// ==========================================
// 2. LEGAL DOCUMENT TYPES (PLEADINGS, WRITS, NOTICES)
// ==========================================
export const LEGAL_DOCUMENT_TYPE_MAPPINGS: TrilingualTermEntry[] = [
  {
    id: 'doc_statement_of_claim',
    category: 'document_type',
    domain: 'civil_procedure',
    terms: {
      om: 'Iyyannoo Himannaa (Kadhannaa)',
      am: 'የክስ ማመልከቻ',
      en: 'Statement of Claim / Plaint',
    },
    definition: {
      om: 'Sanada himataan mirga seeraa isaa eegsisuuf himatamaa irratti mana murtiitti dhiyeeffatu.',
      am: 'ከሳሽ መብቱን ለማስከበር በተከሳሽ ላይ ፍርድ ቤት የሚያቀርበው የመጀመሪያ ክስ ሰነድ።',
      en: 'Primary formal pleading filed by the plaintiff initiating civil court proceedings.',
    },
    statutoryBasis: 'SDFHH Kwt 222-224',
  },
  {
    id: 'doc_statement_of_defence',
    category: 'document_type',
    domain: 'civil_procedure',
    terms: {
      om: 'Deebii Himannaa (Deebii Ittisaa)',
      am: 'የመከላከያ መልስ',
      en: 'Statement of Defence / Written Statement',
    },
    definition: {
      om: 'Sanada himatamaan himannaa irratti dhiyaateef qabxiiwwan mormii fi seeraa dhiyeeffatu.',
      am: 'ተከሳሽ የቀረበበትን ክስ ለመከላከል በጽሑፍ የሚያቀርበው ዝርዝር የመከላከያ ነጥቦች ሰነድ።',
      en: 'Responsive pleading filed by the defendant admitting, denying, or raising preliminary objections.',
    },
    statutoryBasis: 'SDFHH Kwt 234-237',
  },
  {
    id: 'doc_counterclaim',
    category: 'document_type',
    domain: 'civil_procedure',
    terms: {
      om: 'Himannaa Deebii (Mormii Faallaa)',
      am: 'የመከሰሻ መልስ (የመልስ መልስ/ተቃራኒ ክስ)',
      en: 'Counterclaim / Cross-Action',
    },
    definition: {
      om: 'Himannaa himatamaan galmee sanuma keessatti himataa irratti deebisee dhiyeeffatu.',
      am: 'ተከሳሽ በቀረበበት ክስ መዝገብ ውስጥ በከሳሽ ላይ የሚያቀርበው ተዛማጅ ራሱን የቻለ ክስ።',
      en: 'Independent cause of action asserted by the defendant against the plaintiff within the same proceeding.',
    },
    statutoryBasis: 'SDFHH Kwt 235',
  },
  {
    id: 'doc_memo_of_appeal',
    category: 'document_type',
    domain: 'procedure',
    terms: {
      om: 'Iyyannoo Ol-iyyannoo',
      am: 'የይግባኝ ማመልከቻ (የይግባኝ አቤቱታ)',
      en: 'Memorandum of Appeal',
    },
    definition: {
      om: 'Sanada murtii mana murtii jalaatiin qabxiin seeraa ykn dhugaa dogoggore jedhamee mana murtii ol-aanaatti dhiyaatu.',
      am: 'በስር ፍርድ ቤት ውሳኔ ላይ የተፈጸመን የሕግ ወይም የፍሬ ነገር ስህተት በመጥቀስ ለበላይ ፍርድ ቤት የሚቀርብ አቤቱታ።',
      en: 'Formal appellate pleading specifying legal and factual grounds of objection to a lower court judgment.',
    },
    statutoryBasis: 'SDFHH Kwt 323-328; SDFY Kwt 181-184',
  },
  {
    id: 'doc_cassation_petition',
    category: 'document_type',
    domain: 'procedure',
    terms: {
      om: 'Iyyannoo Dhaddacha Ijibbaataa',
      am: 'የሰበር አቤቱታ ማመልከቻ',
      en: 'Cassation Petition (Petition for Cassation Review)',
    },
    definition: {
      om: 'Sanada murtii dhumaa irratti dogoggora bu\'uura seeraa qofa qajeelchuuf Dhaddacha Ijibbaataatti dhiyaatu.',
      am: 'የመጨረሻ ውሳኔ ባገኘ ጉዳይ ላይ መሰረታዊ የሕግ ስህተት እንዲታረም ለሰበር ሰሚ ችሎት የሚቀርብ ማመልከቻ።',
      en: 'Pleading submitted to the Cassation Division alleging a fundamental error of substantive or procedural law.',
    },
    statutoryBasis: 'Labsii 1234/2013 Kwt 10; SDFHH Kwt 341',
  },
  {
    id: 'doc_final_judgment',
    category: 'document_type',
    domain: 'procedure',
    terms: {
      om: 'Murtii Dhumaa (Murtii Barreeffamaa)',
      am: 'የመጨረሻ ፍርድ / ውሳኔ',
      en: 'Final Judgment and Decree',
    },
    definition: {
      om: 'Murtii manni murtii falmii gareewwanii qoratee mirgaa fi dirqama isaanii bu\'uura seeraatiin murteessee cufu.',
      am: 'ፍርድ ቤቱ ክርክሩን መርምሮ የግራ ቀኙን መብትና ግዴታ በሕግ ድንጋጌዎች ላይ ተመስርቶ የሚሰጠው የመጨረሻ ውሳኔ።',
      en: 'Final formal adjudication and operative decree determining the rights and liabilities of all parties.',
    },
    statutoryBasis: 'SDFHH Kwt 180-184',
  },
  {
    id: 'doc_court_order',
    category: 'document_type',
    domain: 'procedure',
    terms: {
      om: 'Ajaja Mana Murtii (Murtee Gidduu)',
      am: 'የትዕዛዝ ውሳኔ (የመሃል ትዕዛዝ)',
      en: 'Court Order / Interlocutory Order',
    },
    definition: {
      om: 'Qajeelfama ykn murtee manni murtii adeemsa falmii keessatti qaamoleef dabarsu.',
      am: 'በክርክሩ ሂደት ፍርድ ቤቱ ለተከራካሪዎች ወይም ለሶስተኛ ወገኖች የሚሰጠው የሥነ-ሥርዓት ትዕዛዝ።',
      en: 'Direction or interlocutory command made by a court prior to or in enforcement of a final judgment.',
    },
    statutoryBasis: 'SDFHH Kwt 185-189',
  },
  {
    id: 'doc_affidavit',
    category: 'document_type',
    domain: 'evidence',
    terms: {
      om: 'Kakuu Barreeffamaa (Ragaa Kakuu)',
      am: 'የቃለ-መሐላ ማስረጃ (አፊዳቪት)',
      en: 'Affidavit / Sworn Written Statement',
    },
    definition: {
      om: 'Ibsa barreeffamaa dhugaa ta\'uu isaa kakuudhaan qaama aangoo qabu duratti mirkanaa\'e.',
      am: 'በሕግ ስልጣን በተሰጠው አካል ፊት ቃለ-መሐላ ተፈጽሞበት በጽሑፍ የተረጋገጠ የእምነት ቃል ማስረጃ።',
      en: 'Voluntary written declaration of facts confirmed by oath or affirmation before an authorized officer.',
    },
    statutoryBasis: 'SDFHH Kwt 203-205; Labsii 1332/2016',
  },
  {
    id: 'doc_power_of_attorney',
    category: 'document_type',
    domain: 'civil',
    terms: {
      om: 'Waraqaa Bakka Bu\'iinsaa (Aangoo Bakka Bu\'iinsaa)',
      am: 'የውክልና ስልጣን ማስረጃ ሰነድ',
      en: 'Power of Attorney / Letter of Procuration',
    },
    definition: {
      om: 'Sanada nama tokkoof bakka ofii bu\'ee dhimma seeraa ykn qabeenya akka raawwatu aangoo kennu.',
      am: 'አንድ ሰው በሌላው ስም ሕጋዊ ድርጊቶችን እንዲፈጽም ሥልጣን የሚሰጥ የተረጋገጠ የውክልና ሰነድ።',
      en: 'Legal instrument authorizing a designated agent or attorney-at-fact to act on the principal\'s behalf.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 2199-2265',
  },
  {
    id: 'doc_written_contract',
    category: 'document_type',
    domain: 'civil',
    terms: {
      om: 'Waliigaltee Barreeffamaa',
      am: 'የጽሑፍ ውል / ስምምነት',
      en: 'Written Contract / Bilateral Agreement',
    },
    definition: {
      om: 'Waliigaltee mirgaa fi dirqama seeraa uumuuf gareewwan lama ykn isaa ol gidduutti barreeffamee mallatteeffamu.',
      am: 'በሁለት ወይም ከዚያ በላይ በሆኑ ሰዎች መካከል የሕግ ውጤት ያለው መብትና ግዴታ ለመፍጠር የተደረገ የጽሑፍ ስምምነት።',
      en: 'Enforceable mutual agreement in writing binding parties to specific legal obligations.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 1675-1731',
  },
  {
    id: 'doc_land_holding_cert',
    category: 'document_type',
    domain: 'land',
    terms: {
      om: 'Waraqaa Ragaa Qabiyyee Lafaa (Buukileettii Qabiyyee)',
      am: 'የመሬት ይዞታ ማረጋገጫ ምስክር ወረቀት (ደብተር)',
      en: 'Rural / Urban Land Holding Certificate (Tenure Certificate)',
    },
    definition: {
      om: 'Sanada seera qabeessa mirga itti fayyadama qabiyyee lafaa nama tokkoof ykn maatiif mirkaneessu.',
      am: 'የመሬት ይዞታ መብትን የሚያረጋግጥ በመንግሥት የተሰጠ ሕጋዊ የምስክር ወረቀት።',
      en: 'Statutory certificate issued by government cadastral authorities establishing lawful usufruct land tenure.',
    },
    statutoryBasis: 'Labsii 248/2015 Kwt 12 (Oromia); Labsii 130/1999 Kwt 6; Dambii 151/2005 Kwt 14',
  },
  {
    id: 'doc_summons_notice',
    category: 'document_type',
    domain: 'procedure',
    terms: {
      om: 'Waamicha Mana Murtii (Waraqaa Waamichaa)',
      am: 'የፍርድ ቤት መጥሪያ',
      en: 'Court Summons / Notice of Appearance',
    },
    definition: {
      om: 'Ajaja barreeffamaa manni murtii himatamaa ykn ragaan guyyaa murtaa\'etti dhaddacha akka dhiyaatu ittiin ajaju.',
      am: 'ተከሳሽ ወይም ምስክር በተወሰነ ቀንና ሰዓት ፍርድ ቤት እንዲቀርብ የሚታዘዝበት ይፋዊ መጥሪያ።',
      en: 'Official court writ served on a party or witness commanding personal appearance on a specified date.',
    },
    statutoryBasis: 'SDFHH Kwt 94-110',
  },
  {
    id: 'doc_witness_statement',
    category: 'document_type',
    domain: 'evidence',
    terms: {
      om: 'Ragaa Jecha Namaa (Waraabbata Jecha Ragaa)',
      am: 'የሰው ምስክር ቃል ጽሑፍ',
      en: 'Witness Testimony / Deposition Record',
    },
    definition: {
      om: 'Jecha ragaan dhaddacha duratti dhiyeessee fi barreeffamaan galmaa\'ee mirkanaa\'e.',
      am: 'ምስክር ፍርድ ቤት ቀርቦ የሰጠውና በመዝገብ የሰፈረ የቃለ-ምስክርነት ማስረጃ።',
      en: 'Oral statement given under oath before a court and transcribed into the official judicial record.',
    },
    statutoryBasis: 'SDFHH Kwt 261-273; Labsii 1332/2016',
  },
  {
    id: 'doc_writ_execution',
    category: 'document_type',
    domain: 'procedure',
    terms: {
      om: 'Ajaja Raawwii Murtii (Waraqaa Raawwachiisaa)',
      am: 'የፍርድ አፈጻጸም ትዕዛዝ / ወረቀት',
      en: 'Writ of Execution / Enforcement Decree',
    },
    definition: {
      om: 'Ajaja manni murtii qabeenya himatamaa qabsiisuun ykn dirqama raawwachiisuun murtii hojiirra oolchuuf baasu.',
      am: 'ፍርድ ቤቱ የወሰነውን ፍርድ በተግባር ለማስፈጸም የሚሰጠው የአስገዳጅ አፈጻጸም ትዕዛዝ።',
      en: 'Judicial writ ordering court registrars or bailiffs to enforce a final judgment or monetary decree.',
    },
    statutoryBasis: 'SDFHH Kwt 371-420',
  },
  {
    id: 'doc_bail_application',
    category: 'document_type',
    domain: 'criminal',
    terms: {
      om: 'Iyyannoo Wabiin Bahuu (Iyyannoo Mirga Wabii)',
      am: 'የዋስትና ማመልከቻ',
      en: 'Bail Application / Petition for Release on Bail',
    },
    definition: {
      om: 'Iyyannoo shakkamaan ykn abukaatoon isaa dhimmi isaa harka mirgaatti akka ilaallamuuf mana murtiitti dhiyeeffatu.',
      am: 'ተጠርጣሪ ወይም ተከሳሽ ክሱን በውጪ ሆኖ ለመከታተል ዋስ ጠርቶ ለመፈታት የሚያቀርበው ማመልከቻ።',
      en: 'Formal petition requesting provisional release of an accused person on bond or personal recognizance.',
    },
    statutoryBasis: 'Heera RDFI Kwt 19(6); SDFY Kwt 63-74',
  },
];

// ==========================================
// 3. COMMON LEGAL PHRASES & CORE JURISPRUDENTIAL CONCEPTS
// ==========================================
export const COMMON_LEGAL_PHRASES_MAPPINGS: TrilingualTermEntry[] = [
  {
    id: 'phrase_ratio_decidendi',
    category: 'legal_phrase',
    domain: 'procedure',
    terms: {
      om: 'Qajeeltoo Seeraa Dirqisiisaa (Hiika Seeraa Dirqisiisaa)',
      am: 'አስገዳጅ የሕግ መርህ / ትርጉም (ሬሾ ዲሲዴንዲ)',
      en: 'Binding Legal Principle / Ratio Decidendi',
    },
    definition: {
      om: 'Bu\'uura seeraa fi sababa qabatamaa abbaan seerummaa murtii murteessuuf itti fayyadamee fi manneen murtii jalaatiif dirqisiisaa ta\'e.',
      am: 'ፍርድ ቤቱ ውሳኔ ለመስጠት የተጠቀመበት መሰረታዊ የሕግ ምክንያት ሲሆን ለስር ፍርድ ቤቶች አስገዳጅነት ያለው መርህ።',
      en: 'The essential legal reasoning and principle upon which the court decided, holding binding precedent value.',
    },
    statutoryBasis: 'Labsii 1234/2013 Kwt 2(1) & Kwt 10; Heera RDFI Kwt 80(3)',
  },
  {
    id: 'phrase_obiter_dictum',
    category: 'legal_phrase',
    domain: 'procedure',
    terms: {
      om: 'Yaada Dabarsaa (Qajeeltoo Dabalataa Dirqisiisaa Hin Taane)',
      am: 'ተጨማሪ አስተያየት (አስገዳጅ ያልሆነ የችሎት ማብራሪያ)',
      en: 'Obiter Dictum / Incidental Remark',
    },
    definition: {
      om: 'Yaada ykn ibsa dabalataa abbootiin seeraa murtii keessatti dabarsan garuu kan dirqisiisummaa seeraa hin qabne.',
      am: 'ፍርድ ቤቱ በውሳኔው ውስጥ የገለጸው ተጨማሪ ማብራሪያ ሲሆን በቀጥታ አስገዳጅነት የሌለው አስተያየት።',
      en: 'A passing statement or observation made by a judge which does not form part of the binding ratio decidendi.',
    },
  },
  {
    id: 'phrase_statute_of_limitations',
    category: 'legal_phrase',
    domain: 'procedure',
    terms: {
      om: 'Darbiinsa Yeroo (Yeroo Seeraan Murtaa\'e)',
      am: 'የይርጋ ጊዜ',
      en: 'Statute of Limitations / Period of Limitation / Time Bar',
    },
    definition: {
      om: 'Daangaa yeroo seeraan murtaa\'e kan sana booda himannaan dhiyaatu mana murtiitti fudhatama dhabu.',
      am: 'መብትን በፍርድ ቤት ለማስከበር በሕግ የተወሰነ የጊዜ ገደብ ሲሆን ከዚህ ጊዜ በኋላ ክስ ማቅረብ አይቻልም።',
      en: 'Statutory deadline precluding legal proceedings from being brought after a specified time frame expires.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 1845-1856; Dambii 151/2005 Kwt 32; SDFHH Kwt 244(2)(f)',
  },
  {
    id: 'phrase_burden_of_proof',
    category: 'legal_phrase',
    domain: 'evidence',
    terms: {
      om: 'Dirqama Mirkaneessuu (Ba\'aa Ragaa)',
      am: 'የማስረዳት ሸክም',
      en: 'Burden of Proof (Onus Probandi)',
    },
    definition: {
      om: 'Dirqama seeraa qaamni dhimma tokko mirkaneeffate ragaa dhiyeessee amansiisuuf qabu.',
      am: 'አንድን የክስ ወይም የመከላከያ ፍሬ ነገር በፍርድ ቤት የማስረዳትና የማሳመን ሕጋዊ ኃላፊነት።',
      en: 'The statutory obligation of a party to prove the allegations and facts asserted in their pleadings.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 2001; SDFHH Kwt 258; Labsii 1332/2016 Kwt 35',
  },
  {
    id: 'phrase_standard_of_proof',
    category: 'legal_phrase',
    domain: 'evidence',
    terms: {
      om: 'Ulaagaa Mirkaneessaa (Sadarkaa Ragaa)',
      am: 'የማስረጃ ሚዛን መመዘኛ (የማስረጃ ደረጃ)',
      en: 'Standard of Proof',
    },
    definition: {
      om: 'Sadarkaa gahaatummaa ragaan tokko amansiisuuf qabaachuu qabu (hariiroo hawaasaatti madaallii ragaa; yakkaatti shakkiin ala).',
      am: 'ማስረጃው ሊያሟላ የሚገባው የማሳመን ደረጃ (በፍትሐብሔር የማስረጃ ሚዛን ብልጫ፣ በወንጀል ያለአንዳች ምክንያታዊ ጥርጣሬ)።',
      en: 'The degree of certainty required for evidence to establish a fact (balance of probabilities vs beyond reasonable doubt).',
    },
    statutoryBasis: 'Labsii 1332/2016 Kwt 40',
  },
  {
    id: 'phrase_prima_facie',
    category: 'legal_phrase',
    domain: 'evidence',
    terms: {
      om: 'Ragaa Jalqabaa Amansiisaa (Ragaa Fuula Jalqabaa)',
      am: 'በቂ የመጀመሪያ ማስረጃ (ፕሪማ ፋሲ)',
      en: 'Prima Facie Evidence',
    },
    definition: {
      om: 'Ragaa hanga faallaan isaa hin mirkanoofnetti akka dhugaatti fudhatamu.',
      am: 'ተቃራኒ ማስረጃ እስካልቀረበበት ድረስ እንደ በቂና ትክክለኛ ሆኖ የሚወሰድ የመጀመሪያ ደረጃ ማስረጃ።',
      en: 'Evidence that is sufficient to establish a fact or raise a presumption of fact unless rebutted or disproved.',
    },
    statutoryBasis: 'Labsii 1332/2016 Kwt 42',
  },
  {
    id: 'phrase_ultra_vires',
    category: 'legal_phrase',
    domain: 'administrative',
    terms: {
      om: 'Aangoon Ala (Aangoo Seeraan Alaa)',
      am: 'ከስልጣን ውጪ የሆነ (ከሕግ አግባብ ውጪ)',
      en: 'Ultra Vires (Beyond Legal Authority)',
    },
    definition: {
      om: 'Gocha ykn murtii qaamni tokko aangoo seeraan kennameefiin alatti raawwate.',
      am: 'አንድ የመንግሥት አካል ወይም ተቋም በሕግ ከተሰጠው የስልጣን ወሰን ውጪ የፈጸመው ሕገ-ወጥ ድርጊት።',
      en: 'An act or decision performed beyond the scope of legal powers and competencies conferred by law.',
    },
    statutoryBasis: 'Heera RDFI Kwt 9(2) & 79(1); Labsii 1234/2013',
  },
  {
    id: 'phrase_temporary_injunction',
    category: 'legal_phrase',
    domain: 'civil_procedure',
    terms: {
      om: 'Ajaja Dhorkaa Yeroo (Ajaja Hakuksaa)',
      am: 'የእግድ ትዕዛዝ (ጊዜያዊ እግድ)',
      en: 'Temporary Injunction / Interlocutory Restraining Order',
    },
    definition: {
      om: 'Ajaja manni murtii hanga murtii dhumaatti qabeenyi akka hin jijjiiramne ykn hin gurguramne ittisuuf baasu.',
      am: 'ፍርድ ቤቱ የመጨረሻ ውሳኔ እስኪሰጥ ድረስ ንብረት እንዳይሸጥ ወይም እንዳይለወጥ የሚያግድበት ጊዜያዊ ትዕዛዝ።',
      en: 'Provisional court order restraining a party from disposing of, transferring, or damaging property pendente lite.',
    },
    statutoryBasis: 'SDFHH Kwt 154-159',
  },
  {
    id: 'phrase_res_judicata',
    category: 'legal_phrase',
    domain: 'civil_procedure',
    terms: {
      om: 'Dhimma Murtii Argatee Xumurame (Rees Judikaataa)',
      am: 'በፍርድ ያለቀ ጉዳይ (ተወስኖ ያለቀ ክስ)',
      en: 'Res Judicata / Claim Preclusion',
    },
    definition: {
      om: 'Dhimma duraan mana murtii aangoo qabuun murtii dhumaa argate irra deebi\'anii himachuun kan hin danda\'amne ta\'uu qajeeltoo seeraati.',
      am: 'አንድ ጉዳይ ስልጣን ባለው ፍርድ ቤት የመጨረሻ ውሳኔ ካገኘ በኋላ በድጋሚ ክስ ሊቀርብበት እንደማይችል የሚከለክል የሕግ መርህ።',
      en: 'A matter that has been conclusively adjudicated on the merits by a competent court and cannot be re-litigated by the same parties.',
    },
    statutoryBasis: 'SDFHH Kwt 5; Seera Hariiroo Hawaasaa Kwt 1677',
  },
  {
    id: 'phrase_good_faith',
    category: 'legal_phrase',
    domain: 'civil',
    terms: {
      om: 'Qulqullummaa Sammuu (Amanamummaa Seeraa)',
      am: 'ቅን ልቦና (በቅንነት ማመን)',
      en: 'Good Faith / Bona Fide',
    },
    definition: {
      om: 'Haqaa fi seera irratti hundaa\'uun dogoggora ykn malaan-maltummaa malee amanamummaadhaan socho\'uu.',
      am: 'ያለምንም ተንኮል፣ ማታለል ወይም የማጭበርበር ሀሳብ በእውነተኛ እምነት የተፈጸመ ተግባር።',
      en: 'An honest, sincere intention to fulfill one\'s legal duty without any malice, fraud, or unfair advantage.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 1161, 1162, 1713',
  },
  {
    id: 'phrase_force_majeure',
    category: 'legal_phrase',
    domain: 'civil',
    terms: {
      om: 'Humnaa Oli (Sababa Humnaa Oliitiin)',
      am: 'ከአቅም በላይ የሆነ ምክንያት (ፎርስ ማዠር)',
      en: 'Force Majeure / Superior Force',
    },
    definition: {
      om: 'Taatee tilmaamuu fi ittisuun hin danda\'amne kan dirqama waliigaltee raawwachuu dhowwu.',
      am: 'ሊገመትና ሊከላከል የማይቻል፣ የውል ግዴታን ለመወጣት የሚያግድ ከአቅም በላይ የሆነ የተፈጥሮ ወይም ማህበራዊ ክስተት።',
      en: 'An unforeseeable, unavoidable external event rendering the performance of a contractual obligation impossible.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 1792-1794',
  },
  {
    id: 'phrase_specific_performance',
    category: 'legal_phrase',
    domain: 'civil',
    terms: {
      om: 'Dirqama Waliigaltee Raawwachiisuu (Akka Waliigalteetti Raawwachiisuu)',
      am: 'ውልን እንዳለ ማስፈጸም',
      en: 'Specific Performance of Contract',
    },
    definition: {
      om: 'Qaamni waliigaltee seene dirqama isaa beenyaa kaffaluu qofa osoo hin taane akkauma seeneetti akka raawwatu ajajamuu.',
      am: 'ተዋዋይ ወገን የገባውን ውል በገንዘብ ካሳ ሳይሆን በተገባው ስምምነት መሰረት በተጨባጭ እንዲፈጽም የሚሰጥ ፍርድ።',
      en: 'Equitable and statutory remedy compelling a defaulting party to execute the precise terms of a contract.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 1776',
  },
  {
    id: 'phrase_severance_pay',
    category: 'legal_phrase',
    domain: 'labor',
    terms: {
      om: 'Kaffaltii Hojiirraa Gaggeeffamaa (Durgoo Gaggeessaa)',
      am: 'የስንብት ክፍያ',
      en: 'Severance Pay / Redundancy Compensation',
    },
    definition: {
      om: 'Kaffaltii maallaqaa hojjechiisaan hojjataa seeraan ala gaggeeffameef ykn daldala cufameef tajaajila waggaa irratti shallagee kaffalu.',
      am: 'አሠሪው የሥራ ውል ሲቋረጥ ለሠራተኛው እንደ አገልግሎት ዘመኑ የሚያሰላውና የሚከፍለው ሕጋዊ የገንዘብ ክፍያ።',
      en: 'Statutory monetary payment calculated on length of service paid to an employee upon lawful or operational termination.',
    },
    statutoryBasis: 'Labsii 1156/2011 Kwt 39 & 40',
  },
  {
    id: 'phrase_presumption_of_innocence',
    category: 'legal_phrase',
    domain: 'constitutional',
    terms: {
      om: 'Balleessaa Malee Yaadamuu (Mirga Balleessaa Malee Yaadamuu)',
      am: 'የንጹህነት ግምት መብት',
      en: 'Presumption of Innocence',
    },
    definition: {
      om: 'Namni yakkaan shakkame hundi hanga manni murtii seeraan balleessaa itti murteessutti akka nama qulqulluutti yaadamuuf mirga qabu.',
      am: 'በወንጀል የተከሰሰ ማንኛውም ሰው በፍርድ ቤት ጥፋተኛነቱ በሕግ እስካልተረጋገጠ ድረስ እንደ ንጹህ የመቆጠር ሕገ-መንግሥታዊ መብቱ።',
      en: 'Universal constitutional principle that every person accused of a crime is presumed innocent until proven guilty according to law.',
    },
    statutoryBasis: 'Heera RDFI Kwt 20(3); SDFY Kwt 136',
  },
  {
    id: 'phrase_admissibility_of_evidence',
    category: 'legal_phrase',
    domain: 'evidence',
    terms: {
      om: 'Fudhatamummaa Ragaa (Ulaagaa Ragaan Fudhatamu)',
      am: 'የማስረጃ ተቀባይነት',
      en: 'Admissibility of Evidence',
    },
    definition: {
      om: 'Ragaan tokko ulaagaa seeraa guutee mana murtii keessatti dhaggeettii fi madaallii argachuuf mirkanaa\'uu.',
      am: 'አንድ ማስረጃ በሕግ የተደነገገውን የአቀራረብና የተዓማኒነት መስፈርት አሟልቶ በፍርድ ቤት ተቀባይነት የማግኘት ሁኔታ።',
      en: 'The legal qualification of evidence permitting its formal submission and consideration by a court of law.',
    },
    statutoryBasis: 'Labsii 1332/2016 Kwt 8, 12, 88; SDFHH Kwt 244(2)',
  },
  {
    id: 'phrase_right_to_bail',
    category: 'legal_phrase',
    domain: 'criminal',
    terms: {
      om: 'Mirga Wabiin Bahuu',
      am: 'የዋስትና መብት',
      en: 'Right to Bail / Entitlement to Release on Bond',
    },
    definition: {
      om: 'Namni qabame kamiyyuu akka seeraan murtaa\'etti wabiin gadhiifamuuf mirga bu\'uuraa heeraan eeggame qabaachuu.',
      am: 'የተያዘ ማንኛውም ሰው በሕግ በተደነገገው አግባብ በዋስ የመፈታት መብት እንዳለው የሚያረጋግጥ ሕገ-መንግሥታዊ ድንጋጌ።',
      en: 'Constitutional right of an arrested or accused person to be released from custody on sufficient bail.',
    },
    statutoryBasis: 'Heera RDFI Kwt 19(6); SDFY Kwt 63-70',
  },
  {
    id: 'phrase_cause_of_action',
    category: 'legal_phrase',
    domain: 'civil_procedure',
    terms: {
      om: 'Bu\'uura Himannaa (Sababa Falmii)',
      am: 'የክስ ምክንያት',
      en: 'Cause of Action',
    },
    definition: {
      om: 'Dhugaa fi sababa seeraa himataan himatamaa irratti mirga himannaa banachuu akka qabu isaaf eeyyamu.',
      am: 'ከሳሽ በተከሳሽ ላይ ፍርድ ቤት ቀርቦ ዳኝነት ለመጠየቅ የሚያስችለው የሕግና የፍሬ ነገር መሰረት።',
      en: 'The factual and legal basis entitling a plaintiff to seek judicial relief against a defendant.',
    },
    statutoryBasis: 'SDFHH Kwt 222(1)(d), 231(1)(a)',
  },
  {
    id: 'phrase_material_jurisdiction',
    category: 'legal_phrase',
    domain: 'civil_procedure',
    terms: {
      om: 'Aangoo Madaallii Dhimmaa (Aangoo Qabiyyee)',
      am: 'የጉዳዩ የዳኝነት ስልጣን (የቁስ ስልጣን)',
      en: 'Material / Subject-Matter Jurisdiction',
    },
    definition: {
      om: 'Aangoo manni murtii gosa dhimmaa fi hamma maallaqaatiin falmii tokko dhagahuuf seeraan qabu.',
      am: 'ፍርድ ቤቱ በጉዳዩ አይነትና በገንዘብ መጠን ክርክሮችን ለመስማት በሕግ የተሰጠው የዳኝነት ስልጣን ወሰን።',
      en: 'The competence of a court to hear cases of a specific category, subject matter, or monetary pecuniary limit.',
    },
    statutoryBasis: 'SDFHH Kwt 6-18; Labsii 1234/2013; Labsii 216/2011',
  },
  {
    id: 'phrase_territorial_jurisdiction',
    category: 'legal_phrase',
    domain: 'civil_procedure',
    terms: {
      om: 'Aangoo Daangaa Naannawaa (Aangoo Bakkaa)',
      am: 'የአካባቢ (የቦታ) የዳኝነት ስልጣን',
      en: 'Territorial / Local Jurisdiction',
    },
    definition: {
      om: 'Aangoo manni murtii teessoo himatamaa ykn bakka qabeenyi argamu irratti hundaa\'uun dhimma ilaaluuf qabu.',
      am: 'ተከሳሹ በሚኖርበት ወይም ንብረቱ በሚገኝበት የአካባቢ ወሰን መሰረት ክሱን ለማየት ያለው የፍርድ ቤት ስልጣን።',
      en: 'Geographical jurisdiction of a court determined by the residence of the parties or the location of immovable property.',
    },
    statutoryBasis: 'SDFHH Kwt 19-31',
  },
  {
    id: 'phrase_cross_examination',
    category: 'legal_phrase',
    domain: 'evidence',
    terms: {
      om: 'Gaaffii Qaxxaamuraa',
      am: 'የመስቀለኛ ጥያቄ',
      en: 'Cross-Examination',
    },
    definition: {
      om: 'Gareen faallaa ragaa dhiyaate tokko dhugaa ta\'uu isaa sakatta\'uuf gaaffii gaafatu.',
      am: 'ተቃራኒ ተከራካሪ ወገን የቀረበበትን ምስክር እውነተኝነትና ተዓማኒነት ለመፈተሽ የሚያቀርበው ጥያቄ።',
      en: 'The questioning of a witness called by the opposing party to test credibility and extract admissions.',
    },
    statutoryBasis: 'SDFHH Kwt 263(2); Labsii 1332/2016 Kwt 55',
  },
  {
    id: 'phrase_examination_in_chief',
    category: 'legal_phrase',
    domain: 'evidence',
    terms: {
      om: 'Gaaffii Kallattii',
      am: 'የቀጥታ ጥያቄ',
      en: 'Examination-in-Chief / Direct Examination',
    },
    definition: {
      om: 'Gareen ragaa waammate tokko dhimma isaa mirkaneessuuf ragaa sanaaf gaaffii jalqabaa gaafatu.',
      am: 'ምስክሩን የጠራው ተከራካሪ ወገን የክስ ወይም የመከላከያ ነጥቦቹን ለማስረዳት የሚያቀርበው የመጀመሪያ ጥያቄ።',
      en: 'The initial questioning of a witness by the party who called that witness.',
    },
    statutoryBasis: 'SDFHH Kwt 263(1); Labsii 1332/2016 Kwt 54',
  },
  {
    id: 'phrase_ex_parte',
    category: 'legal_phrase',
    domain: 'civil_procedure',
    terms: {
      om: 'Dhaddacha Garee Tokkoon Qofa Geggeeffamu (Ilaalcha Tokkoo)',
      am: 'በአንድ ወገን ብቻ የሚሰማ ክርክር (ኤክስ ፓርቴ)',
      en: 'Ex-Parte Proceeding / Hearing in Absence of Party',
    },
    definition: {
      om: 'Himatamaan waamichi ga\'ee osoo sababa hin dhiyeessin yoo hafe himataan qofaan dhiyaatee falmiin geggeeffamuu.',
      am: 'ተከሳሹ መጥሪያ ደርሶት ያለበቂ ምክንያት ሳይቀርብ ሲቀር በከሳሽ ወገን ብቻ ክርክሩን የመስማት ስነ-ስርዓት።',
      en: 'A judicial proceeding conducted for the benefit of or in the presence of one party only without contestation by the defaulted party.',
    },
    statutoryBasis: 'SDFHH Kwt 70(a), 72',
  },
  {
    id: 'phrase_stay_of_execution',
    category: 'legal_phrase',
    domain: 'procedure',
    terms: {
      om: 'Raawwii Murtii Dhaabuu (Hakuksuu Raawwii)',
      am: 'የፍርድ አፈጻጸም እግድ',
      en: 'Stay of Execution / Suspension of Enforcement',
    },
    definition: {
      om: 'Manni murtii ol-iyyannoon yeroo ilaallamutti miidhaan guddaan akka hin qaqqabneef raawwii murtii yeroof dhaabu.',
      am: 'ይግባኝ እየታየ ባለበት ወቅት ሊደርስ የሚችለውን ከባድ ጉዳት ለመከላከል ሲባል የፍርድ አፈጻጸሙ ለጊዜው እንዲቆም የሚሰጥ ትዕዛዝ።',
      en: 'A court order halting or suspending the enforcement of a judgment pending appellate review or collateral challenge.',
    },
    statutoryBasis: 'SDFHH Kwt 332-340',
  },
  {
    id: 'phrase_unjust_enrichment',
    category: 'legal_phrase',
    domain: 'civil',
    terms: {
      om: 'Sababa Malee Sooromu (Badhaadhummaa Seeraan Alaa)',
      am: 'ያላግባብ መበልጸግ',
      en: 'Unjust Enrichment / Restitution',
    },
    definition: {
      om: 'Namni tokko sababa seeraa malee miidhaa nama birootiin qabeenya ykn bu\'aa argate deebisuuf dirqama qabaachuu.',
      am: 'አንድ ሰው በሕግ ያለበቂ ምክንያት በሌላ ሰው ኪሳራ ያገኘውን ሀብት ወይም ጥቅም የመመለስ የሕግ ግዴታ።',
      en: 'The legal doctrine obligating a person who has retained a benefit at another\'s expense without lawful justification to make restitution.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 2162-2178',
  },
  {
    id: 'phrase_strict_liability',
    category: 'legal_phrase',
    domain: 'civil',
    terms: {
      om: 'Itti Gaafatamummaa Balleessaa Malee (Dirqama Itti Gaafatamummaa Qulqulluu)',
      am: 'ያለጥፋት የሚመጣ የፍትሐብሔር ኃላፊነት (ጥብቅ ኃላፊነት)',
      en: 'Strict / Absolute Liability (Liability Without Fault)',
    },
    definition: {
      om: 'Balleessaan nama sanaa osoo hin mirkanaa\'in balaa meeshaa ykn hojii balaa qabu irraa ka\'eef itti gaafatamummaa seeraa qabaachuu.',
      am: 'የባለቤቱ ቀጥተኛ ጥፋት ባይኖርም አደገኛ ከሆነ ተግባር ወይም ንብረት ለሚደርስ ጉዳት በሕግ የሚጣል የካሳ ኃላፊነት።',
      en: 'Legal responsibility for damages or injury regardless of fault, negligence, or intention.',
    },
    statutoryBasis: 'Seera Hariiroo Hawaasaa Kwt 2066-2089',
  },
];

// Combine all terminology categories into a single searchable array
export const ALL_TRILINGUAL_LEGAL_TERMS: TrilingualTermEntry[] = [
  ...COURT_NAME_MAPPINGS,
  ...LEGAL_DOCUMENT_TYPE_MAPPINGS,
  ...COMMON_LEGAL_PHRASES_MAPPINGS,
];

// Helper: Normalize lookup text for fuzzy matching
function normalizeTerminologyKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches the terminology database by term across all three languages.
 */
export function lookupLegalTerm(
  query: string,
  targetLanguage: TerminologyLanguage = 'om'
): { matchedEntry: TrilingualTermEntry | null; translatedTerm: string | null } {
  const norm = normalizeTerminologyKey(query);
  if (!norm) return { matchedEntry: null, translatedTerm: null };

  const entry = ALL_TRILINGUAL_LEGAL_TERMS.find((item) => {
    const omNorm = normalizeTerminologyKey(item.terms.om);
    const amNorm = normalizeTerminologyKey(item.terms.am);
    const enNorm = normalizeTerminologyKey(item.terms.en);
    return (
      omNorm === norm ||
      amNorm === norm ||
      enNorm === norm ||
      omNorm.includes(norm) ||
      amNorm.includes(norm) ||
      enNorm.includes(norm)
    );
  });

  if (!entry) return { matchedEntry: null, translatedTerm: null };
  return {
    matchedEntry: entry,
    translatedTerm: entry.terms[targetLanguage] || entry.terms.om,
  };
}

/**
 * Strictly normalizes court names into the target language.
 */
export function normalizeCourtName(
  input: string,
  targetLanguage: TerminologyLanguage = 'om'
): string {
  const norm = normalizeTerminologyKey(input);
  if (!norm) return input;

  for (const court of COURT_NAME_MAPPINGS) {
    const om = normalizeTerminologyKey(court.terms.om);
    const am = normalizeTerminologyKey(court.terms.am);
    const en = normalizeTerminologyKey(court.terms.en);

    if (
      om.includes(norm) ||
      am.includes(norm) ||
      en.includes(norm) ||
      norm.includes(om) ||
      norm.includes(am) ||
      norm.includes(en)
    ) {
      return court.terms[targetLanguage];
    }
  }

  return input;
}

/**
 * Strictly normalizes legal document types into the target language.
 */
export function normalizeDocumentType(
  input: string,
  targetLanguage: TerminologyLanguage = 'om'
): string {
  const norm = normalizeTerminologyKey(input);
  if (!norm) return input;

  for (const doc of LEGAL_DOCUMENT_TYPE_MAPPINGS) {
    const om = normalizeTerminologyKey(doc.terms.om);
    const am = normalizeTerminologyKey(doc.terms.am);
    const en = normalizeTerminologyKey(doc.terms.en);

    if (
      om.includes(norm) ||
      am.includes(norm) ||
      en.includes(norm) ||
      norm.includes(om) ||
      norm.includes(am) ||
      norm.includes(en)
    ) {
      return doc.terms[targetLanguage];
    }
  }

  return input;
}

/**
 * Generates an authoritative system prompt directive to enforce strict
 * legal terminology mappings for AI language models (Gemini / OpenAI).
 */
export function getAiTerminologyConsistencyPrompt(targetLanguage: TerminologyLanguage): string {
  const langLabel =
    targetLanguage === 'om'
      ? 'Afaan Oromoo'
      : targetLanguage === 'am'
        ? 'አማርኛ'
        : 'English';

  const courtExamples = COURT_NAME_MAPPINGS.slice(0, 8)
    .map((c) => `• ${c.terms.en} => "${c.terms[targetLanguage]}"`)
    .join('\n');

  const docExamples = LEGAL_DOCUMENT_TYPE_MAPPINGS.slice(0, 8)
    .map((d) => `• ${d.terms.en} => "${d.terms[targetLanguage]}"`)
    .join('\n');

  const phraseExamples = COMMON_LEGAL_PHRASES_MAPPINGS.slice(0, 10)
    .map((p) => `• ${p.terms.en} => "${p.terms[targetLanguage]}"`)
    .join('\n');

  return `
AUTHORITATIVE TRILINGUAL LEGAL TERMINOLOGY MANDATE (${langLabel}):
When producing legal analyses, citations, and court rulings in ${langLabel}, strictly use the authoritative Ethiopian Federal and Oromia Regional statutory terms. Never invent informal translations.

1. Official Court Names:
${courtExamples}

2. Legal Document Types:
${docExamples}

3. Essential Legal Maxims & Phrases:
${phraseExamples}
`.trim();
}
