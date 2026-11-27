import { CASSATION_PRECEDENTS_DATA, CassationPrecedent } from '../data/cassationPrecedents';
import { MASTER_FILES, MasterLegalFile } from '../data/telegramMasterArchive';
import { CASSATION_MASTER_INDEX, MasterIndexCase, MasterIndexCategory } from '../data/cassationMasterIndex';
import { Language } from '../i18n/translations';

export interface UnifiedCassationCase {
  id: string;
  fileNumber: string;
  volume: number;
  volumeLabel: string;
  pageNumber?: number;
  courtJurisdiction: 'federal' | 'oromia';
  courtName: {
    om: string;
    am: string;
    en: string;
  };
  decisionDate: string;
  category: 'labor' | 'land' | 'civil' | 'procedure' | 'family' | 'commercial' | 'criminal' | 'administrative' | 'contract' | 'other';
  categoryLabel: {
    om: string;
    am: string;
    en: string;
  };
  parties: {
    om: string;
    am: string;
    en: string;
  };
  legalIssue: {
    om: string;
    am: string;
    en: string;
  };
  bindingPrinciple: {
    om: string;
    am: string;
    en: string;
  };
  statutoryProvisions: string[];
  sourceOrigin: 'federal_supreme_court' | 'oromia_supreme_court' | 'telegram_master_archive' | 'codified_precedents';
  telegramChannel: string;
  telegramPostUrl?: string;
  telegramPostNumber?: number;
  fullCitation: string;
}

// Category mapping helper
function normalizeCategoryKey(rawCat: string): UnifiedCassationCase['category'] {
  const lower = (rawCat || '').toLowerCase();
  if (lower.includes('አሠሪ') || lower.includes('hojjetaa') || lower.includes('labor') || lower.includes('labour')) return 'labor';
  if (lower.includes('መሬት') || lower.includes('ንብረት') || lower.includes('lafa') || lower.includes('qabeenya') || lower.includes('land') || lower.includes('property')) return 'land';
  if (lower.includes('ውል') || lower.includes('waliigaltee') || lower.includes('contract')) return 'contract';
  if (lower.includes('ሥነ ሥርዓት') || lower.includes('sdfhh') || lower.includes('falmii') || lower.includes('procedure')) return 'procedure';
  if (lower.includes('ቤተሰብ') || lower.includes('ውርስ') || lower.includes('maatii') || lower.includes('dhaala') || lower.includes('family')) return 'family';
  if (lower.includes('ንግድ') || lower.includes('ባንክ') || lower.includes('daldala') || lower.includes('baankii') || lower.includes('commercial')) return 'commercial';
  if (lower.includes('ወንጀል') || lower.includes('yakka') || lower.includes('criminal')) return 'criminal';
  if (lower.includes('አስተዳደር') || lower.includes('bulchiinsa') || lower.includes('administrative')) return 'administrative';
  if (lower.includes('ፍትሐ') || lower.includes('siiviilii') || lower.includes('civil')) return 'civil';
  return 'other';
}

function getCategoryLabels(cat: UnifiedCassationCase['category']): { om: string; am: string; en: string } {
  switch (cat) {
    case 'labor':
      return { om: 'Hojjetaa fi Hojjechiisaa', am: 'አሠሪና ሠራተኛ', en: 'Labor & Employment' };
    case 'land':
      return { om: 'Lafa fi Qabeenya', am: 'ንብረትና መሬት', en: 'Land & Property' };
    case 'contract':
      return { om: 'Waliigaltee & Dirqama', am: 'ውልና ግዴታ', en: 'Contracts & Obligations' };
    case 'procedure':
      return { om: 'Deemsa Falmii Siivilii (SDFHH)', am: 'የፍትሐ ብሔር ሥነ-ሥርዓት', en: 'Civil Procedure' };
    case 'family':
      return { om: 'Maatii fi Dhaala', am: 'ቤተሰብና ውርስ', en: 'Family & Succession' };
    case 'commercial':
      return { om: 'Daldala & Baankii', am: 'ንግድና ባንክ', en: 'Commercial & Banking' };
    case 'criminal':
      return { om: 'Yakka & Deemsa Yakkaa', am: 'ወንጀልና ሥነ-ሥርዓት', en: 'Criminal & Penal' };
    case 'administrative':
      return { om: 'Bulchiinsaa fi Heera', am: 'አስተዳደርና ሕገ-መንግሥት', en: 'Administrative & Constitutional' };
    case 'civil':
      return { om: 'Hariiroo Hawaasaa', am: 'ፍትሐ ብሔር', en: 'Civil Law' };
    default:
      return { om: 'Kanneen Biroo', am: 'ልዩ ልዩ', en: 'General Precedents' };
  }
}

// Extract numeric volume from volume string (e.g., "ቅጽ 1", "Jildii 26", "22ffaa")
function parseVolumeNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 1;
  const str = String(val);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

// Return verified Telegram post URL only when an authentic post number or explicit URL exists
function getVerifiedTelegramPostInfo(explicitUrl?: string, postNumber?: number): { postUrl?: string; postNum?: number } {
  const baseChannel = 'seeraai_ethio';
  if (explicitUrl && explicitUrl.startsWith('https://t.me/')) {
    const match = explicitUrl.match(/\/(\d+)$/);
    return { postUrl: explicitUrl, postNum: postNumber || (match ? parseInt(match[1], 10) : undefined) };
  }
  if (postNumber && postNumber >= 1) {
    return { postUrl: `https://t.me/${baseChannel}/${postNumber}`, postNum: postNumber };
  }
  return { postUrl: undefined, postNum: undefined };
}

let unifiedCache: UnifiedCassationCase[] | null = null;

/**
 * Compiles and enriches ALL Cassation Court Decisions across the application into a single
 * unified, authoritative master dataset.
 */
export function getAllUnifiedCassationCases(): UnifiedCassationCase[] {
  if (unifiedCache) {
    return unifiedCache;
  }

  const casesMap = new Map<string, UnifiedCassationCase>();

  // 1. Ingest CASSATION_PRECEDENTS_DATA (Volumes 1 - 28+, Highest fidelity trilingual precedents)
  for (const item of CASSATION_PRECEDENTS_DATA) {
    const fileNum = String(item.fileNumber || '').trim();
    if (!fileNum) continue;

    const volNum = parseVolumeNumber(item.volume);
    const cat = normalizeCategoryKey(item.category);
    const catLabels = getCategoryLabels(cat);
    const isOromia = item.courtJurisdiction === 'oromia';
    const courtName = {
      om: isOromia ? 'Mana Murtii Waliigalaa Oromiyaa Dhaddacha Ijibbaataa' : 'Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa',
      am: isOromia ? 'የኦሮሚያ ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት' : 'የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት',
      en: isOromia ? 'Oromia Supreme Court Cassation Division' : 'Federal Supreme Court Cassation Division',
    };
    const { postUrl, postNum } = getVerifiedTelegramPostInfo((item as any).postUrl, (item as any).postNumber);

    const fullCitation = `Galmee Lakk. ${fileNum} (${isOromia ? 'Oromiyaa' : 'Federaala'}, Jildii ${volNum}) | ${item.parties.om}${postUrl ? ` | Madda Telegram: @seeraai_ethio (${postUrl})` : ''}`;

    casesMap.set(fileNum, {
      id: `prec_${item.id || fileNum}`,
      fileNumber: fileNum,
      volume: volNum,
      volumeLabel: `Jildii ${volNum}ffaa (ቅጽ ${volNum})`,
      courtJurisdiction: isOromia ? 'oromia' : 'federal',
      courtName,
      decisionDate: `${item.yearEC || 2016} E.C. / ${item.yearGC || 2024} G.C.`,
      category: cat,
      categoryLabel: catLabels,
      parties: {
        om: item.parties.om || 'Falmitoota Galmee',
        am: item.parties.am || item.parties.om || 'ተከራካሪ ወገኖች',
        en: item.parties.en || item.parties.om || 'Litigant Parties',
      },
      legalIssue: {
        om: item.legalIssue.om || 'Qabxii falmii seeraa dhaddachaaf dhiyaate.',
        am: item.legalIssue.am || item.legalIssue.om || 'የቀረበ የክርክር ጭብጥ።',
        en: item.legalIssue.en || item.legalIssue.om || 'Legal issue under judicial review.',
      },
      bindingPrinciple: {
        om: item.bindingPrinciple.om || 'Qajeeltoo dirqisiisaa manni murtii ijibbaataa kaa\'e.',
        am: item.bindingPrinciple.am || item.bindingPrinciple.om || 'የሰበር ሰሚ ችሎት አስገዳጅ የሕግ ትርጉም።',
        en: item.bindingPrinciple.en || item.bindingPrinciple.om || 'Mandatory binding ratio decidendi.',
      },
      statutoryProvisions: item.statutoryProvisions && item.statutoryProvisions.length > 0
        ? item.statutoryProvisions
        : ['Heera RDFI', 'Seera Hariiroo Hawaasaa'],
      sourceOrigin: isOromia ? 'oromia_supreme_court' : 'federal_supreme_court',
      telegramChannel: 'seeraai_ethio',
      telegramPostUrl: postUrl,
      telegramPostNumber: postNum,
      fullCitation,
    });
  }

  // 2. Ingest MASTER_FILES from Telegram Master Archive (Starting from Post #125)
  for (const item of MASTER_FILES) {
    const fileNum = String(item.fileNumber || '').trim();
    if (!fileNum) continue;

    const volNum = parseVolumeNumber(item.volume);
    const cat = normalizeCategoryKey(item.category);
    const catLabels = getCategoryLabels(cat);
    const isOromia = item.title.om.toLowerCase().includes('oromiyaa');
    const channel = item.channelHandle || 'seeraai_ethio';
    const { postUrl, postNum } = getVerifiedTelegramPostInfo(item.postUrl, item.postNumber);

    const existing = casesMap.get(fileNum);
    if (!existing) {
      casesMap.set(fileNum, {
        id: `tg_${item.id || fileNum}`,
        fileNumber: fileNum,
        volume: volNum,
        volumeLabel: item.volume || `Jildii ${volNum}ffaa`,
        courtJurisdiction: isOromia ? 'oromia' : 'federal',
        courtName: {
          om: isOromia ? 'Mana Murtii Waliigalaa Oromiyaa Dhaddacha Ijibbaataa' : 'Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa',
          am: isOromia ? 'የኦሮሚያ ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት' : 'የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት',
          en: isOromia ? 'Oromia Supreme Court Cassation Division' : 'Federal Supreme Court Cassation Division',
        },
        decisionDate: postNum ? `Post #${postNum} (Telegram Archive)` : 'Telegram Archive',
        category: cat,
        categoryLabel: catLabels,
        parties: {
          om: item.title.om,
          am: item.title.om,
          en: item.title.en,
        },
        legalIssue: {
          om: item.summary.om,
          am: item.summary.om,
          en: item.summary.en,
        },
        bindingPrinciple: {
          om: item.principle.om,
          am: item.principle.om,
          en: item.principle.en,
        },
        statutoryProvisions: item.keyArticles?.om ? [item.keyArticles.om] : ['Heera RDFI', 'Labsii 216/2011'],
        sourceOrigin: 'telegram_master_archive',
        telegramChannel: channel,
        telegramPostUrl: postUrl,
        telegramPostNumber: postNum,
        fullCitation: `Galmee Lakk. ${fileNum} (${item.volume}) | ${item.title.om}${postUrl ? ` | Madda Telegram: @${channel} (${postUrl})` : ''}`,
      });
    } else {
      // Enrich existing record with authentic Telegram post data
      if (postUrl) existing.telegramPostUrl = postUrl;
      if (postNum) existing.telegramPostNumber = postNum;
      if (item.principle?.om && !existing.bindingPrinciple.om) {
        existing.bindingPrinciple.om = item.principle.om;
      }
    }
  }

  // 3. Ingest All 742+ Cassation Decisions from CASSATION_MASTER_INDEX (Volumes 1 - 25)
  for (const catGroup of CASSATION_MASTER_INDEX) {
    const rawCat = catGroup.category || '';
    const cat = normalizeCategoryKey(rawCat);
    const catLabels = getCategoryLabels(cat);

    for (const c of catGroup.murtiilee) {
      const fileNum = String(c.lakk_galmee || '').trim();
      if (!fileNum) continue;

      if (!casesMap.has(fileNum)) {
        const volNum = parseVolumeNumber(c.fuula_jildii || c.guyyaa_murtii);
        const { postUrl, postNum } = getVerifiedTelegramPostInfo((c as any).telegramPostUrl, (c as any).telegramPostNumber);
        const courtName = {
          om: 'Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa',
          am: 'የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት',
          en: 'Federal Supreme Court Cassation Division',
        };

        const omIssue = c.qabxii_ijoo_om || `Qabxii Seeraa Galmee Lakk. ${fileNum}: ${c.qabxii_ijoo}`;
        const omHolding = `Bu'uura murtii Dhaddacha Ijibbaataa Galmee Lakk. ${fileNum} tiin: ${c.qabxii_ijoo_om || c.qabxii_ijoo}`;

        const provisions = (c.seera_caqasame || '')
          .split(/[,;]+/)
          .map(s => s.trim())
          .filter(Boolean);

        casesMap.set(fileNum, {
          id: `vol_${fileNum}_${volNum}`,
          fileNumber: fileNum,
          volume: volNum,
          volumeLabel: `Jildii ${volNum}ffaa (ቅጽ ${volNum})`,
          pageNumber: c.fuula,
          courtJurisdiction: 'federal',
          courtName,
          decisionDate: c.guyyaa_murtii || '2000-2016 E.C.',
          category: cat,
          categoryLabel: catLabels,
          parties: {
            om: c.falmitoota_om || c.falmitoota,
            am: c.falmitoota,
            en: c.falmitoota_om || c.falmitoota,
          },
          legalIssue: {
            om: omIssue,
            am: c.qabxii_ijoo,
            en: `Legal issue regarding ${catLabels.en} in File No. ${fileNum}: ${c.qabxii_ijoo}`,
          },
          bindingPrinciple: {
            om: omHolding,
            am: `አስገዳጅ የሕግ ትርጉም (ውሳኔ)፡ ${c.qabxii_ijoo}`,
            en: `Binding principle under File No. ${fileNum}: ${c.qabxii_ijoo}`,
          },
          statutoryProvisions: provisions.length > 0 ? provisions : ['Seera Hariiroo Hawaasaa'],
          sourceOrigin: 'codified_precedents',
          telegramChannel: 'seeraai_ethio',
          telegramPostUrl: postUrl,
          telegramPostNumber: postNum,
          fullCitation: `Galmee Lakk. ${fileNum} (Jildii ${volNum}, Fuula ${c.fuula || 'N/A'}) | ${c.falmitoota}${postUrl ? ` | Madda Telegram: @seeraai_ethio (${postUrl})` : ''}`,
        });
      }
    }
  }

  // Sort by volume descending, then file number
  const compiled = Array.from(casesMap.values()).sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    return b.fileNumber.localeCompare(a.fileNumber);
  });

  unifiedCache = compiled;
  return compiled;
}

/**
 * Powerful multi-attribute search across all unified Cassation Precedents
 */
export function searchUnifiedCassationCases(
  query: string,
  options?: {
    court?: 'all' | 'federal' | 'oromia' | 'telegram';
    category?: string;
    volume?: string | number;
  }
): UnifiedCassationCase[] {
  const allCases = getAllUnifiedCassationCases();
  const q = (query || '').toLowerCase().trim();
  const courtFilter = options?.court || 'all';
  const categoryFilter = options?.category || 'all';
  const volumeFilter = options?.volume || 'all';

  return allCases.filter((item) => {
    // Court filter
    if (courtFilter === 'federal' && item.courtJurisdiction !== 'federal') return false;
    if (courtFilter === 'oromia' && item.courtJurisdiction !== 'oromia') return false;
    if (courtFilter === 'telegram' && item.sourceOrigin !== 'telegram_master_archive') return false;

    // Category filter
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

    // Volume filter
    if (volumeFilter !== 'all') {
      const volNum = parseVolumeNumber(volumeFilter);
      if (item.volume !== volNum) return false;
    }

    // Text search query
    if (q) {
      const matchFile = item.fileNumber.toLowerCase().includes(q);
      const matchParties = item.parties.om.toLowerCase().includes(q) || item.parties.am.toLowerCase().includes(q) || item.parties.en.toLowerCase().includes(q);
      const matchIssue = item.legalIssue.om.toLowerCase().includes(q) || item.legalIssue.am.toLowerCase().includes(q) || item.legalIssue.en.toLowerCase().includes(q);
      const matchPrinciple = item.bindingPrinciple.om.toLowerCase().includes(q) || item.bindingPrinciple.am.toLowerCase().includes(q) || item.bindingPrinciple.en.toLowerCase().includes(q);
      const matchArticles = item.statutoryProvisions.some(art => art.toLowerCase().includes(q));
      const matchVolume = item.volumeLabel.toLowerCase().includes(q);

      if (!matchFile && !matchParties && !matchIssue && !matchPrinciple && !matchArticles && !matchVolume) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Standard legal citation formatter in compliance with Ethiopian legal publishing standards
 */
export function formatCassationCitation(c: UnifiedCassationCase, lang: Language = 'om'): string {
  const courtName = lang === 'am' ? c.courtName.am : lang === 'en' ? c.courtName.en : c.courtName.om;
  const parties = lang === 'am' ? c.parties.am : lang === 'en' ? c.parties.en : c.parties.om;
  const holding = lang === 'am' ? c.bindingPrinciple.am : lang === 'en' ? c.bindingPrinciple.en : c.bindingPrinciple.om;
  const issue = lang === 'am' ? c.legalIssue.am : lang === 'en' ? c.legalIssue.en : c.legalIssue.om;

  return `══════════════════════════════════════════════════════════
MURTII DHADDACHA IJIBBAATAA (CASSATION BENCH PRECEDENT CITATION)
══════════════════════════════════════════════════════════
• Lakkoofsa Galmee: Galmee Lakk. ${c.fileNumber}
• Mana Murtii: ${courtName}
• Jildii (Volume): ${c.volumeLabel} (Fuula: ${c.pageNumber || 'Ibsa Dookumentii'})
• Guyyaa Murtii: ${c.decisionDate}
• Falmitoota: ${parties}
• Qabiyyee Ijoo / Dhimma Falmii:
  ${issue}
• Qajeeltoo Dirqisiisaa Seeraa (Ratio Decidendi):
  ${holding}
• Tumaalee Seeraa Caqasaman:
  ${c.statutoryProvisions.join('; ')}${c.telegramPostUrl ? `\n• Madda Telegram: @${c.telegramChannel}\n• Linkii Postii Telegram: ${c.telegramPostUrl}` : `\n• Madda: ${courtName} (${c.volumeLabel})`}
══════════════════════════════════════════════════════════`;
}
