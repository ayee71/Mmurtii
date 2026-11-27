import { OROMIA_AND_FEDERAL_LEGISLATION_DB, LegalEnactment } from '../../data/legislationDatabase';

export type FaqLanguage = 'om' | 'am' | 'en';

export interface FaqProclamationMatch {
  id: string;
  number: string;
  jurisdiction: 'oromia' | 'federal';
  status: 'active' | 'amended' | 'repealed';
  title: string;
  summary: string;
  keyArticles: string[];
  appUrl: string;
  telegramUrl: string;
  score: number;
}

export interface FaqMatchResult {
  matches: FaqProclamationMatch[];
  isDirectFaqLookup: boolean;
  isFaqOverviewRequest: boolean;
}

interface ExtraProclamationMeta {
  keywords: string[];
  telegramPostUrl?: string;
}

const PROCLAMATION_KEYWORDS: Record<string, ExtraProclamationMeta> = {
  fed_proc_1156_2019: {
    keywords: [
      '1156',
      '1156/2019',
      '1156/2011',
      'labor',
      'labour',
      'employment',
      'worker',
      'employee',
      'employer',
      'severance',
      'dismissal',
      'termination',
      'annual leave',
      'hojjetaa',
      'hojjachiisaa',
      'boqonnaa',
      'ariisaa',
      'waliigaltee hojii',
      'አሰሪ',
      'ሰራተኛ',
      'የስራ ውል',
      'ስንብት',
      'ካሳ',
    ],
    telegramPostUrl: 'https://t.me/wakolegalstudio/1480',
  },
  oro_proc_248_2015: {
    keywords: [
      '248',
      '248/2015',
      '130/1999',
      'rural land',
      'lafa baadiyyaa',
      'qonnaan bulaa',
      'qabiyyee lafaa',
      'ገጠር መሬት',
      'የመሬት ይዞታ',
    ],
  },
  oro_proc_130_1999: {
    keywords: ['130/1999', 'labsii 130'],
  },
  oro_proc_242_2014: {
    keywords: [
      '242',
      '242/2014',
      '242/2022',
      'urban land',
      'lafa magaalaa',
      'liizii',
      'lease',
      'ከተማ መሬት',
      'ሊዝ',
    ],
  },
  oro_proc_213_2011: {
    keywords: [
      '213/2011',
      '213/2019',
      'oromia courts',
      'mana murtii oromiyaa',
      'aangoo mana murtii',
      'የኦሮሚያ ፍርድ ቤቶች',
    ],
  },
  oro_reg_210_2013: {
    keywords: ['210/2013', '210/2021', 'dambii 210'],
  },
  oro_dir_05_2015: {
    keywords: ['05/2015', 'qajeelfama 05', 'biiroo lafaa'],
  },
  fed_proc_1243_2021: {
    keywords: [
      '1243',
      '1243/2021',
      '1243/2013',
      'commercial code',
      'business organization',
      'plc',
      'share company',
      'bankruptcy',
      'daldala',
      'koodii daldalaa',
      'ንግድ ሕግ',
    ],
  },
  fed_proc_1161_2019: {
    keywords: [
      '1161',
      '1161/2019',
      '1161/2011',
      'expropriation',
      'beenyaa lafaa',
      'gadhiisiisa',
      'የመሬት ካሳ',
    ],
  },
  fed_reg_472_2020: {
    keywords: ['472', '472/2020', '472/2012', 'dambii 472'],
  },
  sdfhh_proc_52_1958: {
    keywords: [
      'sdfhh',
      '52/1958',
      'civil procedure',
      'hariiroo hawaasaa',
      'res judicata',
      'preliminary objection',
      'ፍትሐብሔር ሥነ-ሥርዓት',
    ],
  },
  fed_proc_1410_2018: {
    keywords: [
      '1410',
      '1410/2018',
      '1410/2026',
      'criminal procedure',
      'falmii yakkaa',
      'ወንጀለኛ መቅጫ',
    ],
  },
  fed_proc_1324_2024: {
    keywords: ['1324', '1324/2024', '1324/2016', 'federal rural land'],
  },
  fed_proc_1360_2025: {
    keywords: ['1360', '1360/2025', '1360/2017', 'banking', 'foreign bank', 'baankii', 'የባንክ ሥራ'],
  },
  fed_proc_1321_2024: {
    keywords: [
      '1321',
      '1321/2024',
      '1321/2016',
      'data protection',
      'privacy',
      'personal data',
      'daataa dhuunfaa',
      'የግል መረጃ',
    ],
  },
  fed_proc_1320_2024: {
    keywords: [
      '1320',
      '1320/2024',
      '1320/2016',
      'rent control',
      'kiraa',
      'kireeffataa',
      'landlord',
      'tenant',
      'ኪራይ',
    ],
  },
  fed_proc_1389_2025: {
    keywords: [
      '1389',
      '1389/2025',
      '1389/2017',
      'overseas employment',
      'migrant worker',
      'biyya alaa',
      'የውጭ አገር ሥራ',
    ],
  },
};

// Curated Federal Civil Procedure & Evidence Code Proc. 1332/2016 (from @seeraai_ethio/245)
const EXTRA_TELEGRAM_PROCLAMATION: LegalEnactment = {
  id: 'fed_proc_1332_2016',
  type: 'proclamation',
  jurisdiction: 'federal',
  number: 'Labsii 1332/2016',
  title: {
    om: 'Labsii Sirna Falmii Sivilii fi Ragaa Federaalaa Haaraa Lakk. 1332/2016 (Dhaddacha Dijitaalaa)',
    am: 'አዲሱ የፌዴራል የፍትሐብሔር ሥነ-ሥርዓትና የማስረጃ ሕግ አዋጅ ቁጥር 1332/2016',
    en: 'Federal Civil Procedure & Evidence Code Proclamation No. 1332/2024 (Digital Hearings)',
  },
  authority: {
    om: 'Mana Marii Bakka Bu\'oota Uummata FDRE',
    am: 'የኢፌዴሪ የሕዝብ ተወካዮች ምክር ቤት',
    en: 'FDRE House of Peoples\' Representatives',
  },
  yearEC: 2016,
  yearGC: 2024,
  category: 'procedure_evidence',
  summary: {
    om: 'Labsichi waraabbata sagalee fi viidiyoo dhaddachaa akkasumas ragaa elektirooniksii akka ragaa seera qabeessaatti fudhata.',
    am: 'አዋጁ የችሎት ድምፅና ቪዲዮ ቀረጻዎችን እና የዲጂታል ማስረጃዎችን እንደ ህጋዊ ማስረጃነት ይቀበላል።',
    en: 'Recognizes remote digital hearings, live courtroom audio/video recordings, and electronic evidence in judicial proceedings.',
  },
  fullTextArticles: [
    {
      articleNumber: 'Keeyyata 88',
      title: 'Ragaa Dijitaalaa',
      content: {
        om: 'Ragaan elektirooniksii qulqullinni isaa mirkanaa\'e mana murtii keessatti fudhatama qaba.',
        am: 'ትክክለኛነቱ የተረጋገጠ የኤሌክትሮኒክስ ማስረጃ በችሎት ፊት ተቀባይነት አለው።',
        en: 'Verified electronic evidence holds statutory admissibility in civil proceedings.',
      },
    },
    {
      articleNumber: 'Keeyyata 142',
      title: 'Dhaddacha Fageenyaa',
      content: {
        om: 'Dhaddachi viidiyoo fi teeknooloojii dijitaalaatiin geggeeffamu seera qabeessa.',
        am: 'በቪዲዮና በዲጂታል ቴክኖሎጂ የሚካሄድ ችሎት ህጋዊ ነው።',
        en: 'Authorizes remote court hearings conducted via verified digital video infrastructure.',
      },
    },
  ],
  status: 'active',
  lastUpdatedDate: '2026-03-20',
  sourceUrl: 'https://t.me/seeraai_ethio/245',
  tags: ['Federal', 'Digital Evidence', '1332/2016', 'Dhaddacha Dijitaalaa'],
};

const ALL_FAQ_ENACTMENTS: LegalEnactment[] = [
  ...OROMIA_AND_FEDERAL_LEGISLATION_DB.filter((e) => e.type !== 'cassation_decision'),
  EXTRA_TELEGRAM_PROCLAMATION,
];

const EXTRA_1332_KEYWORDS = [
  '1332',
  '1332/2016',
  '1332/2024',
  'digital evidence',
  'ragaa dijitaalaa',
  'dhaddacha dijitaalaa',
  'remote hearing',
  'የዲጂታል ችሎት',
];

function getKeywordsForEnactment(e: LegalEnactment): string[] {
  if (e.id === 'fed_proc_1332_2016') return EXTRA_1332_KEYWORDS;
  return PROCLAMATION_KEYWORDS[e.id]?.keywords || [];
}

function getTelegramUrlForEnactment(e: LegalEnactment): string {
  if (e.sourceUrl && e.sourceUrl.startsWith('https://')) {
    return e.sourceUrl;
  }
  const extra = PROCLAMATION_KEYWORDS[e.id]?.telegramPostUrl;
  if (extra) return extra;
  return 'https://t.me/seeraai_ethio';
}

export function resolvePublicAppBaseUrl(explicitBaseUrl?: string): string {
  const candidates = [
    explicitBaseUrl,
    process.env.APP_URL,
    process.env.PUBLIC_URL,
    process.env.SITE_URL,
    process.env.AIS_PRE_URL,
    process.env.AIS_DEV_URL,
    'https://ais-pre-xzwimedqi24aks652sacj3-551578258786.europe-west3.run.app',
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().startsWith('https://')) {
      return candidate
        .trim()
        .replace('ais-dev-', 'ais-pre-')
        .replace(/\/+$/, '');
    }
  }
  return 'https://ais-pre-xzwimedqi24aks652sacj3-551578258786.europe-west3.run.app';
}

function buildLegislationDeepLink(appBaseUrl: string, enactment: LegalEnactment, lang: FaqLanguage): string {
  const cleanQuery = enactment.number.replace(/\(.*?\)/g, '').trim();
  const params = new URLSearchParams({
    tab: 'legislation',
    q: cleanQuery,
    lang,
  });
  return `${appBaseUrl}/?${params.toString()}`;
}

export function matchTelegramFaqProclamations(
  rawQuery: string,
  options: {
    lang?: string;
    appBaseUrl?: string;
    limit?: number;
  } = {}
): FaqMatchResult {
  const lang: FaqLanguage =
    options.lang === 'am' || options.lang === 'en' ? options.lang : 'om';
  const appBaseUrl = resolvePublicAppBaseUrl(options.appBaseUrl);
  const limit = Math.max(1, Math.min(options.limit ?? 4, 8));

  const query = String(rawQuery || '').trim();
  const qLower = query.toLowerCase();

  const isFaqOverviewRequest =
    /^\/?faq\b/i.test(qLower) ||
    /^(proclamations|labsiiwwan|labsiilee|laws|popular laws|አዋጆች)$/i.test(qLower);

  if (isFaqOverviewRequest && qLower.split(/\s+/).length <= 3) {
    const featuredIds = [
      'fed_proc_1156_2019',
      'fed_proc_1332_2016',
      'oro_proc_248_2015',
      'oro_proc_242_2014',
      'fed_proc_1243_2021',
      'fed_proc_1320_2024',
    ];
    const featured = ALL_FAQ_ENACTMENTS.filter((e) => featuredIds.includes(e.id))
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        number: e.number,
        jurisdiction: e.jurisdiction,
        status: e.status,
        title: e.title[lang] || e.title.om,
        summary: e.summary[lang] || e.summary.om,
        keyArticles: (e.fullTextArticles || []).map((a) => a.articleNumber).slice(0, 4),
        appUrl: buildLegislationDeepLink(appBaseUrl, e, lang),
        telegramUrl: getTelegramUrlForEnactment(e),
        score: 100,
      }));

    return {
      matches: featured,
      isDirectFaqLookup: true,
      isFaqOverviewRequest: true,
    };
  }

  if (!qLower) {
    return { matches: [], isDirectFaqLookup: false, isFaqOverviewRequest: false };
  }

  const queryNumbers = qLower.match(/\b\d{2,4}(?:\/\d{2,4})?\b/g) || [];

  const scored: FaqProclamationMatch[] = [];
  for (const enactment of ALL_FAQ_ENACTMENTS) {
    const keywords = getKeywordsForEnactment(enactment);
    const searchable = [
      enactment.number,
      enactment.title.om,
      enactment.title.am,
      enactment.title.en,
      ...enactment.tags,
      ...keywords,
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;

    // Exact proclamation number match (strongest signal)
    const enactmentNumberLower = enactment.number.toLowerCase();
    for (const num of queryNumbers) {
      if (num.length >= 3 && (enactmentNumberLower.includes(num) || keywords.some((k) => k === num))) {
        score += 55;
      }
    }

    // Keyword hits
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (qLower.includes(kwLower)) {
        score += kwLower.includes('/') || kwLower.includes(' ') ? 32 : 20;
      }
    }

    // Tag & title overlap for multi-word queries
    const tokens = qLower.split(/[\s,?.!;:()]+/).filter((t) => t.length >= 3);
    for (const token of tokens) {
      if (searchable.includes(token)) {
        score += 8;
      }
    }

    // Prefer active laws over repealed ones unless user explicitly entered repealed number
    if (enactment.status === 'repealed') {
      const explicitlyRequestedRepealed = queryNumbers.some((n) => enactmentNumberLower.includes(n));
      if (!explicitlyRequestedRepealed) {
        score -= 40;
      }
    } else if (score > 0) {
      score += 6;
    }

    if (score >= 20) {
      scored.push({
        id: enactment.id,
        number: enactment.number,
        jurisdiction: enactment.jurisdiction,
        status: enactment.status,
        title: enactment.title[lang] || enactment.title.om,
        summary: enactment.summary[lang] || enactment.summary.om,
        keyArticles: (enactment.fullTextArticles || []).map((a) => a.articleNumber).slice(0, 4),
        appUrl: buildLegislationDeepLink(appBaseUrl, enactment, lang),
        telegramUrl: getTelegramUrlForEnactment(enactment),
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const matches = scored.slice(0, limit);

  if (matches.length === 0) {
    return { matches: [], isDirectFaqLookup: false, isFaqOverviewRequest: false };
  }

  const wordCount = qLower.split(/\s+/).filter(Boolean).length;
  const asksLinkOrFaqExplicitly =
    /\b(link|url|download|pdf|faq|send|give|ergi|barbaada|linkii|liinkii|ላክልኝ|ሊንክ)\b/i.test(qLower);
  const asksDeepLegalQuestion =
    /[?？]/.test(query) ||
    /\b(explain|why|how|what does|difference|compare|maal jedha|akkamitti|maaliif|hiika|ibs|ከተባረረ|ምንድን ነው|እንዴት|አብራራ)\b/i.test(
      qLower
    );

  const isDirectFaqLookup =
    asksLinkOrFaqExplicitly ||
    (wordCount <= 5 && !asksDeepLegalQuestion && matches[0].score >= 30);

  return {
    matches,
    isDirectFaqLookup,
    isFaqOverviewRequest: false,
  };
}

export function formatTelegramFaqAutoReply(
  result: FaqMatchResult,
  lang: FaqLanguage = 'om'
): string {
  if (!result.matches.length) return '';

  const header =
    lang === 'am'
      ? result.isFaqOverviewRequest
        ? '📚 በተደጋጋሚ የሚጠየቁ አዋጆች እና ፈጣን ሊንኮች (SEERAAI FAQ)፡'
        : '📌 ተዛማጅ አዋጆች እና ፈጣን ሊንኮች (SEERAAI FAQ)፡'
      : lang === 'en'
        ? result.isFaqOverviewRequest
          ? '📚 Frequently Requested Ethiopian & Oromia Proclamations (SEERAAI FAQ):'
          : '📌 Instant Proclamation Links (SEERAAI FAQ):'
        : result.isFaqOverviewRequest
          ? '📚 Labsiilee Yeroo Baay\'ee Gaafataman fi Linkii Saffisaa (SEERAAI FAQ):'
          : '📌 Linkii Saffisaa Labsiilee Seeraa (SEERAAI FAQ):';

  const lines = [header, ''];

  result.matches.forEach((m, idx) => {
    const statusLabel =
      m.status === 'repealed'
        ? lang === 'am'
          ? ' [የተሻረ / Repealed]'
          : lang === 'en'
            ? ' [Repealed — Superseded by Proc. 248/2015]'
            : ' [Haqameera — Labsii 248/2015 tiin bakka bu\'e]'
        : '';

    lines.push(`${idx + 1}. ${m.title}${statusLabel}`);
    lines.push(`   ${m.summary}`);
    if (m.keyArticles.length > 0) {
      const artPrefix = lang === 'am' ? 'ዋና አንቀጾች' : lang === 'en' ? 'Key Articles' : 'Keeyyattoota Ijoo';
      lines.push(`   ${artPrefix}: ${m.keyArticles.join(', ')}`);
    }
    lines.push(`   SEERAAI App: ${m.appUrl}`);
    lines.push(`   Telegram: ${m.telegramUrl}`);
    lines.push('');
  });

  const footer =
    lang === 'am'
      ? '💡 ስለ አንድ አንቀጽ ዝርዝር የሕግ ትንታኔ ከፈለጉ ጥያቄዎን በሙሉ ይጻፉ።'
      : lang === 'en'
        ? '💡 Send a full question (e.g., "What does Labor Proclamation 1156/2019 Art. 39 say about severance?") for a detailed AI legal analysis.'
        : '💡 Hiika keeyyata tokkoo gadi fageenyaan argachuuf gaaffii guutuu ergaa (fkn: "Labsii 1156/2019 keeyyata 39 maal jedha?").';

  lines.push(footer);
  return lines.join('\n').trim();
}
