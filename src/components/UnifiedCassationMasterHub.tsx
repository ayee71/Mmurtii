import React, { useState, useMemo, useEffect } from 'react';
import { 
  getAllUnifiedCassationCases, 
  searchUnifiedCassationCases, 
  formatCassationCitation,
  UnifiedCassationCase 
} from '../services/unifiedCassationService';
import { Language } from '../i18n/translations';
import { 
  Gavel, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Download, 
  Star, 
  ExternalLink, 
  BookOpen, 
  ShieldCheck, 
  Layers, 
  FileText, 
  ChevronRight, 
  X, 
  Sparkles,
  Share2,
  RefreshCw,
  Scale
} from 'lucide-react';

interface UnifiedCassationMasterHubProps {
  currentLang: Language;
  onSendToExplain?: (query: string) => void;
  onSendToCaseAnalysis?: (caseItem: UnifiedCassationCase) => void;
}

export const UnifiedCassationMasterHub: React.FC<UnifiedCassationMasterHubProps> = ({
  currentLang,
  onSendToExplain,
  onSendToCaseAnalysis
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [courtFilter, setCourtFilter] = useState<'all' | 'federal' | 'oromia' | 'telegram'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [volumeFilter, setVolumeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'volume_desc' | 'volume_asc' | 'file_asc' | 'file_desc'>('volume_desc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [stars, setStars] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seeraai_unified_cassation_stars');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Selected precedent for full-screen analysis modal
  const [selectedCaseModal, setSelectedCaseModal] = useState<UnifiedCassationCase | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('seeraai_unified_cassation_stars', JSON.stringify(stars));
    } catch {}
  }, [stars]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStars(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
    showToast(stars.includes(id) ? 'Murtichi faayilota filataman keessaa haqameera.' : 'Murtichi faayilota filatamoo keessatti olkaa\'ameera! ⭐');
  };

  const handleCopyCitation = (c: UnifiedCassationCase, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const citation = formatCassationCitation(c, currentLang);
    navigator.clipboard.writeText(citation).then(() => {
      setCopiedId(c.id);
      showToast(`Galmee Lakk. ${c.fileNumber} waraabbameera! 📋`);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      showToast('Waraabuu hin dandeenye.');
    });
  };

  const handleDownloadTxt = (c: UnifiedCassationCase, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const content = formatCassationCitation(c, currentLang);
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Murtii_Ijibbaataa_Galmee_${c.fileNumber}_Jildii_${c.volume}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Faayilli Galmee ${c.fileNumber} buufameera! 📥`);
  };

  // Compile all cases
  const allCases = useMemo(() => {
    return getAllUnifiedCassationCases();
  }, []);

  // Filter & Search
  const filteredCases = useMemo(() => {
    let result = searchUnifiedCassationCases(searchQuery, {
      court: courtFilter,
      category: categoryFilter,
      volume: volumeFilter
    });

    if (favoritesOnly) {
      result = result.filter(c => stars.includes(c.id));
    }

    result.sort((a, b) => {
      if (sortBy === 'volume_desc') return b.volume - a.volume || a.fileNumber.localeCompare(b.fileNumber);
      if (sortBy === 'volume_asc') return a.volume - b.volume || a.fileNumber.localeCompare(b.fileNumber);
      if (sortBy === 'file_asc') return a.fileNumber.localeCompare(b.fileNumber);
      if (sortBy === 'file_desc') return b.fileNumber.localeCompare(a.fileNumber);
      return 0;
    });

    return result;
  }, [allCases, searchQuery, courtFilter, categoryFilter, volumeFilter, favoritesOnly, stars, sortBy]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = allCases.length;
    const federalCount = allCases.filter(c => c.courtJurisdiction === 'federal').length;
    const oromiaCount = allCases.filter(c => c.courtJurisdiction === 'oromia').length;
    const telegramCount = allCases.filter(c => c.sourceOrigin === 'telegram_master_archive').length;
    const volumes = Array.from(new Set(allCases.map(c => c.volume))).filter(v => v > 0).sort((a, b) => a - b);
    return { total, federalCount, oromiaCount, telegramCount, volumes };
  }, [allCases]);

  // Pagination slice
  const totalPages = Math.ceil(filteredCases.length / pageSize) || 1;
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, courtFilter, categoryFilter, volumeFilter, favoritesOnly, sortBy, pageSize]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 px-5 py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-3 border border-amber-300">
          <span>⚖️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Master Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5" />
              <span>Bakka Tokkotti • All-in-One Master Cassation Hub</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {currentLang === 'om'
                ? 'Kuusaa Murtiilee Dhaddacha Ijibbaataa Guutuu (Master Archive)'
                : 'የሰበር ውሳኔዎች ዋና መዝገብ (Master Cassation Decisions Hub)'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentLang === 'om'
                ? 'Murtiilee Dhaddacha Ijibbaataa Mana Murtii Waliigalaa Federaalaa (Jildii 1 hanga 28+), Dhaddacha Ijibbaataa Oromiyaa (Jildii 1 hanga 12+), fi Faayilota Telegram Master Archive (@seeraai_ethio Post #125 hanga har\'aatti) content guutuu, qajeeltoo dirqisiisaa fi linkii postii waliin bakka tokkotti dhihaate.'
                : 'የፌዴራል ጠቅላይ ፍርድ ቤት የሰበር ውሳኔዎች (ቅጽ 1-28+)፣ የኦሮሚያ ሰበር እና የቴሌግራም መዝገብ (@seeraai_ethio ከፖስት #125 ጀምሮ) ሙሉ አስገዳጅ የሕግ ትርጉም፣ የሕግ ድንጋጌዎችና የቴሌግራም ሊንክ በአንድ ላይ።'}
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-amber-300">
                <Gavel className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">{stats.total}+</span>
                <span className="text-slate-400 text-[11px]">Murtiilee Guutuu</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sky-300">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-bold">{stats.federalCount}</span>
                <span className="text-slate-400 text-[11px]">Federaala (Jildii 1-28)</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold">{stats.oromiaCount}</span>
                <span className="text-slate-400 text-[11px]">Oromiyaa (Jildii 1-12)</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-amber-300">
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">@seeraai_ethio</span>
                <span className="text-slate-400 text-[11px]">Post #125+</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch lg:items-end gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                favoritesOnly
                  ? 'bg-amber-500 text-slate-950 border border-amber-400'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-amber-500/40'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current text-slate-950' : 'text-amber-400'}`} />
              <span>{favoritesOnly ? 'Faayilota Filataman Qofa' : `Filatamoo (${stars.length})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Comprehensive Filters Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {/* Main Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              currentLang === 'om'
                ? "Lakk. Galmee, Abbaa Dhimmaa, Qajeeltoo Seeraa, Labsii/Kwt, ykn Jildii barbaadi (fakkeenyaaf: 138286, 18180, lafa, hojjataa, beenyaa, 1156)..."
                : "በመዝገብ ቁጥር፣ ተከራካሪ ወገን፣ አስገዳጅ የሕግ ትርጉም ወይም በአዋጅ ይፈልጉ (ምሳሌ፡ 138286፣ 18180፣ መሬት፣ ሠራተኛ)..."
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pl-11 font-mono transition-all shadow-inner"
          />
          <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Court Filter Tabs & Volume / Sort Selectors */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
          {/* Court Jurisdiction Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Murtiilee Hunda (All Courts)', icon: Scale },
              { id: 'federal', label: 'Federaala (Federal FSC)', icon: Layers },
              { id: 'oromia', label: 'Oromiyaa (Oromia SC)', icon: ShieldCheck },
              { id: 'telegram', label: 'Telegram Archive (@seeraai_ethio)', icon: ExternalLink },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCourtFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  courtFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Volume & Sort Controls */}
          <div className="flex items-center gap-2">
            {/* Volume Filter Dropdown */}
            <select
              value={volumeFilter}
              onChange={(e) => setVolumeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
            >
              <option value="all">Jildii Hunda (All Volumes)</option>
              {stats.volumes.map((vol) => (
                <option key={vol} value={vol}>
                  Jildii {vol}ffaa (ቅጽ {vol})
                </option>
              ))}
            </select>

            {/* Sorting Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500"
            >
              <option value="volume_desc">Jildii: Olaanaa gara Gadaanaa</option>
              <option value="volume_asc">Jildii: Gadaanaa gara Olaanaa</option>
              <option value="file_asc">Lakk. Galmee (A-Z)</option>
              <option value="file_desc">Lakk. Galmee (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Category Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1">Mata Duree:</span>
          {[
            { id: 'all', label: 'Hunda (All)' },
            { id: 'labor', label: 'Hojjetaa (Labour)' },
            { id: 'land', label: 'Lafa & Qabeenya (Property)' },
            { id: 'contract', label: 'Waliigaltee (Contracts)' },
            { id: 'procedure', label: 'SDFHH (Civil Procedure)' },
            { id: 'family', label: 'Maatii & Dhaala (Family)' },
            { id: 'commercial', label: 'Daldala & Baankii (Commercial)' },
            { id: 'criminal', label: 'Yakka (Criminal)' },
            { id: 'administrative', label: 'Bulchiinsa (Admin)' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Case Count and Pagination Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          Argamaniiru: <span className="text-amber-400 font-bold font-mono">{filteredCases.length}</span> murtiilee (Fuula {currentPage} / {totalPages})
        </div>
        <div className="flex items-center gap-2">
          <span>Agarsiisi:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 font-mono"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Precedents Card Grid */}
      {paginatedCases.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center space-y-4">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Murtichi Hin Argamne (No Precedents Found)</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Jecha barbaacha keessan ykn calaltuu (filters) jijjiiruun irra deebi\'aa yaalaa.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCourtFilter('all');
              setCategoryFilter('all');
              setVolumeFilter('all');
              setFavoritesOnly(false);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold cursor-pointer"
          >
            Calaltuu Hunda Qulqulleessi (Reset Filters)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedCases.map((item) => {
            const isStarred = stars.includes(item.id);
            const isOromia = item.courtJurisdiction === 'oromia';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedCaseModal(item)}
                className="bg-slate-900 hover:bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-xl transition-all space-y-4 cursor-pointer group"
              >
                {/* Card Top: Badges & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Court Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                      isOromia
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                    }`}>
                      {isOromia ? 'Dhaddacha Ijibbaata Oromiyaa' : 'Dhaddacha Ijibbaata Federaalaa'}
                    </span>

                    {/* Volume Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      {item.volumeLabel}
                    </span>

                    {/* Category Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {item.categoryLabel.om}
                    </span>

                    {/* Telegram Source Badge (only when verified post link exists) */}
                    {item.telegramPostUrl ? (
                      <a
                        href={item.telegramPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
                        title="Telegram Post Link"
                      >
                        <span>{item.telegramPostNumber ? `Post #${item.telegramPostNumber}` : `@${item.telegramChannel}`}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800/80 text-slate-400 border border-slate-700">
                        Cassation Index
                      </span>
                    )}
                  </div>

                  {/* Top Right Action Icons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => toggleStar(item.id, e)}
                      className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                        isStarred
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title={isStarred ? 'Haqi filatamarraa' : 'Filatamoo taasisi'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleCopyCitation(item, e)}
                      className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                      title="Waraabi (Copy Citation)"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownloadTxt(item, e)}
                      className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                      title="Buufadhu (.txt)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* File Number & Parties */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Galmee Lakk. {item.fileNumber}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      • {item.decisionDate}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.parties.om}
                  </h3>
                </div>

                {/* Legal Issue & Binding Ratio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Qabxii Ijoo Seeraa */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                      Qabxii Seeraa (Legal Issue)
                    </div>
                    <div className="text-slate-300 line-clamp-2 leading-relaxed">
                      {item.legalIssue.om}
                    </div>
                  </div>

                  {/* Qajeeltoo Dirqisiisaa */}
                  <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-1">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                      Qajeeltoo Dirqisiisaa (Ratio Decidendi)
                    </div>
                    <div className="text-slate-200 font-medium line-clamp-2 leading-relaxed">
                      {item.bindingPrinciple.om}
                    </div>
                  </div>
                </div>

                {/* Statutes & Bottom Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5 max-w-2xl">
                    <span className="font-mono text-slate-500">Seera:</span>
                    {item.statutoryProvisions.slice(0, 3).map((art, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px]">
                        {art}
                      </span>
                    ))}
                    {item.statutoryProvisions.length > 3 && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        +{item.statutoryProvisions.length - 3} biroo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-amber-400 group-hover:translate-x-1 transition-transform font-bold text-xs">
                    <span>Dubbisi Guutuu</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold"
          >
            ← Fuula Duraa (Prev)
          </button>

          <span className="font-mono text-slate-400">
            Fuula <span className="text-amber-400 font-bold">{currentPage}</span> / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-bold"
          >
            Fuula Itti Aanu (Next) →
          </button>
        </div>
      )}

      {/* Full Precedent Inspection Modal */}
      {selectedCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Galmee Lakk. {selectedCaseModal.fileNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {selectedCaseModal.volumeLabel}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {selectedCaseModal.categoryLabel.om}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white pt-1">
                  {selectedCaseModal.parties.om}
                </h2>
                <div className="text-xs text-slate-400 font-mono">
                  {selectedCaseModal.courtName.om} • {selectedCaseModal.decisionDate}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCaseModal(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Ratio Decidendi (Highlight Box) */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold font-mono uppercase text-xs">
                  <Scale className="w-4 h-4" />
                  <span>Qajeeltoo Dirqisiisaa Seeraa (Ratio Decidendi)</span>
                </div>
                <p className="text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                  {selectedCaseModal.bindingPrinciple.om}
                </p>
                {selectedCaseModal.bindingPrinciple.am && selectedCaseModal.bindingPrinciple.am !== selectedCaseModal.bindingPrinciple.om && (
                  <p className="text-slate-300 font-serif pt-2 border-t border-amber-500/20">
                    {selectedCaseModal.bindingPrinciple.am}
                  </p>
                )}
              </div>

              {/* Legal Issue & Factual Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                  Qabxii Falmii Seeraa (Legal Issue Under Review)
                </h4>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed">
                  {selectedCaseModal.legalIssue.om}
                </div>
              </div>

              {/* Litigant Parties in 3 Languages */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Falmitoota (Litigant Parties)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Afaan Oromoo:</span>
                    <span className="text-white font-medium">{selectedCaseModal.parties.om}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Afaan Amaaraa:</span>
                    <span className="text-white font-medium">{selectedCaseModal.parties.am}</span>
                  </div>
                </div>
              </div>

              {/* Statutory Provisions Cited */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Tumaalee Seeraa Caqasaman (Statutory Provisions Cited)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCaseModal.statutoryProvisions.map((provision, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
                      📜 {provision}
                    </span>
                  ))}
                </div>
              </div>

              {/* Telegram Source Link Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase font-bold text-amber-400">
                    Madda Seeraa & Telegram Channel
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    {selectedCaseModal.telegramPostUrl
                      ? `Telegram Channel: @${selectedCaseModal.telegramChannel}${selectedCaseModal.telegramPostNumber ? ` • Post #${selectedCaseModal.telegramPostNumber}` : ''}`
                      : `Channel: @${selectedCaseModal.telegramChannel} (${selectedCaseModal.volumeLabel})`}
                  </div>
                  <div className="text-[11px] text-sky-400 font-mono truncate max-w-md">
                    {selectedCaseModal.telegramPostUrl || `https://t.me/${selectedCaseModal.telegramChannel}`}
                  </div>
                </div>

                <a
                  href={selectedCaseModal.telegramPostUrl || `https://t.me/${selectedCaseModal.telegramChannel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  <span>{selectedCaseModal.telegramPostUrl ? 'Telegram irratti Bani' : 'Channel @seeraai_ethio'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyCitation(selectedCaseModal)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Waraabi (Copy Citation)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTxt(selectedCaseModal)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Buufadhu (.txt)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {onSendToCaseAnalysis && (
                  <button
                    type="button"
                    onClick={() => {
                      onSendToCaseAnalysis(selectedCaseModal);
                      setSelectedCaseModal(null);
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gara Xiinxala Galmeetti</span>
                  </button>
                )}

                {onSendToExplain && (
                  <button
                    type="button"
                    onClick={() => {
                      onSendToExplain(`Murtii Dhaddacha Ijibbaataa Galmee Lakk. ${selectedCaseModal.fileNumber} (${selectedCaseModal.volumeLabel}): ${selectedCaseModal.bindingPrinciple.om}`);
                      setSelectedCaseModal(null);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span>AI Xiinxala</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedCassationMasterHub;
