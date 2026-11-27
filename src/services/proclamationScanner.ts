/**
 * Service utility for regex-scanning legal text for standard Ethiopian proclamation formats
 * (e.g. 'Proclamation No. 123/2010', 'Labsii Lakk. 1156/2019', 'አዋጅ ቁጥር 123/2010')
 * and providing interactive summaries and lookup data.
 */

export interface ProclamationSummary {
  proclamationNumber: string;
  title: {
    om: string;
    am: string;
    en: string;
  };
  summary: {
    om: string;
    am: string;
    en: string;
  };
  yearEnacted: number;
}

// Database of common Ethiopian Proclamations for instant summary fetching on hover/click
export const ETHIOPIAN_PROCLAMATIONS_DB: Record<string, ProclamationSummary> = {
  '1156/2019': {
    proclamationNumber: '1156/2019',
    title: {
      om: 'Labsii Hojii Hojjetaa Labii Lakk. 1156/2011 (2019)',
      am: 'የአሠሪና ሠራተኛ ጉዳይ አዋጅ ቁጥር 1156/2011',
      en: 'Labor Proclamation No. 1156/2019',
    },
    summary: {
      om: 'Mirgaa fi dirqama hojjetaa fi hojjachiisaa, haala walii galtee hojii, sababa walitti buiinsa hojiitiin hojjetaa gaggeessuu, kafaltii kafaltii humnaa fi beenyaa tuma.',
      am: 'የአሠሪና ሠራተኛን መብትና ግዴታ፣ የሥራ ውል አቆጣጠር፣ ከሥራ ስለመሰናበት እና ካሳን የሚወስን አዋጅ።',
      en: 'Governs employment relations, rights and obligations of employers and employees, termination, and severance compensation in Ethiopia.',
    },
    yearEnacted: 2019,
  },
  '1234/2021': {
    proclamationNumber: '1234/2021',
    title: {
      om: 'Labsii Manneen Murtii Federaalaa Lakk. 1234/2013 (2021)',
      am: 'የፌዴራል ፍርድ ቤቶች አዋጅ ቁጥር 1234/2013',
      en: 'Federal Courts Proclamation No. 1234/2021',
    },
    summary: {
      om: 'Aangoo Manneen Murtii Federaalaa fi dirqisiisummaa hiikkaa seeraa Dhaddacha Ijibbaataa Mana Murtii Waliigalaa Federaalaa tuma.',
      am: 'የፌዴራል ፍርድ ቤቶችን ስልጣን እና የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት የህግ ትርጉም አስገዳጅነትን የሚወስን አዋጅ።',
      en: 'Establishes the jurisdiction of Federal Courts and the binding legal interpretation authority of the Federal Supreme Court Cassation Division.',
    },
    yearEnacted: 2021,
  },
  '410/2004': {
    proclamationNumber: '410/2004',
    title: {
      om: 'Labsii Mirga Abbaa Qabeenya Sammuu Lakk. 410/1996',
      am: 'የቅጂ እና አዋሳኝ መብቶች ጥበቃ አዋጅ ቁጥር 410/1996',
      en: 'Copyright and Neighboring Rights Protection Proclamation No. 410/2004',
    },
    summary: {
      om: 'Mirga abbaa qabeenya sammuu, kitaabota, qorannoo seeraa, fi hojiiwwan kalaqaa seeraan eeguuf kan bahe.',
      am: 'የቅጂ መብትን፣ የኪነ-ጥበብ ስራዎችን እና የአእምሮ ንብረትን ከህገ-ወጥ ቅጅ የሚከላከል አዋጅ።',
      en: 'Protects intellectual property, literary works, legal software creations, and author rights against unauthorized duplication in Ethiopia.',
    },
    yearEnacted: 2004,
  },
  '1243/2021': {
    proclamationNumber: '1243/2021',
    title: {
      om: 'Seera Daldalaa Itoophiyaa (Labsii Lakk. 1243/2013 / 2021)',
      am: 'የኢትዮጵያ የንግድ ሕግ አዋጅ ቁጥር 1243/2013',
      en: 'Commercial Code of Ethiopia Proclamation No. 1243/2021',
    },
    summary: {
      om: 'Dhaabbilee daldalaa, waldaa aksiyoonaa, walii galtee daldalaa fi kasaaraa daldalaa Itoophiyaa keessatti ni qajeelcha.',
      am: 'የንግድ ማህበራት ምስረታ፣ የአክሲዮን ኩባንያዎች እና የንግድ ግዴታዎችን የሚመራ የንግድ ሕግ።',
      en: 'Governs traders, business organizations, share companies, commercial obligations, and insolvency in Ethiopia.',
    },
    yearEnacted: 2021,
  },
};

export interface ScannedProclamationMatch {
  raw: string;
  proclamationNumber: string;
  summaryData?: ProclamationSummary;
  index: number;
  length: number;
}

/**
 * Scans legal text using regular expressions to detect standard Ethiopian Proclamation citations
 * (e.g. 'Proclamation No. 1156/2019', 'Labsii Lakk. 1234/2021', 'አዋጅ ቁጥር 410/2004')
 */
export function scanProclamationsInText(text: string): ScannedProclamationMatch[] {
  if (!text) return [];

  const proclamationRegex = /(?:Proclamation\s+No\.?|Labsii\s+Lakk\.?|አዋጅ\s*ቁጥር)\s*(\d+\/\d{4})/gi;
  const matches: ScannedProclamationMatch[] = [];

  let match: RegExpExecArray | null;
  while ((match = proclamationRegex.exec(text)) !== null) {
    const raw = match[0];
    const num = match[1];
    const summaryData = ETHIOPIAN_PROCLAMATIONS_DB[num];

    matches.push({
      raw,
      proclamationNumber: num,
      summaryData,
      index: match.index,
      length: raw.length,
    });
  }

  return matches;
}

/**
 * Looks up a verified proclamation summary from the local statutory dictionary (returns null if unverified).
 */
export async function fetchProclamationSummaryAsync(proclamationNum: string): Promise<ProclamationSummary | null> {
  const cleanNum = proclamationNum.trim();
  return ETHIOPIAN_PROCLAMATIONS_DB[cleanNum] || null;
}
