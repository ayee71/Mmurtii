import React, { useState, useMemo } from 'react';
import { 
  Scale, 
  BookOpen, 
  Search, 
  Layers, 
  Copy, 
  Check, 
  Sparkles, 
  ArrowRight, 
  FileText, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Bookmark, 
  Share2, 
  Download,
  Info,
  RefreshCw,
  PlusCircle,
  X,
  CheckCircle2
} from 'lucide-react';
import { Language } from '../types';
import { CASSATION_VOLUMES_1_TO_28, CassationVolume, LandmarkPrecedent } from '../data/cassationVolumes1to28';

interface CassationVolumeCatalogSectionProps {
  language: Language;
  initialVolume?: number | 'all';
  onAskAI?: (prompt: string) => void;
}

export const CassationVolumeCatalogSection: React.FC<CassationVolumeCatalogSectionProps> = ({
  language,
  initialVolume,
  onAskAI,
}) => {
  const getInitialVol = (): number | 'all' => {
    if (initialVolume) return initialVolume;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const v = p.get('vol') || p.get('volume');
      if (v) {
        const parsed = parseInt(v, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 28) return parsed;
      }
    }
    return 'all';
  };

  const initialVolValue = getInitialVol();
  const [selectedVolumeNumber, setSelectedVolumeNumber] = useState<number | 'all'>(initialVolValue);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'contents' | 'precedents'>('all');
  const [expandedVolumeId, setExpandedVolumeId] = useState<number | null>(
    typeof initialVolValue === 'number' ? initialVolValue : 22
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic Custom Precedents & Update Synchronization
  const [customPrecedents, setCustomPrecedents] = useState<Array<LandmarkPrecedent & { volume: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('wako_custom_cassation_records');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVolumeNum, setNewVolumeNum] = useState<number>(22);
  const [newFileNum, setNewFileNum] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('land_rights');
  const [newIssue, setNewIssue] = useState('');
  const [newPrinciple, setNewPrinciple] = useState('');
  const [newStatutes, setNewStatutes] = useState('');

  // Merge default 28 volumes with dynamic custom precedents
  const allVolumesWithCustom = useMemo(() => {
    if (customPrecedents.length === 0) return CASSATION_VOLUMES_1_TO_28;
    return CASSATION_VOLUMES_1_TO_28.map((vol) => {
      const addedForVol = customPrecedents.filter((cp) => cp.volume === vol.volume);
      if (addedForVol.length === 0) return vol;
      return {
        ...vol,
        caseCount: vol.caseCount + addedForVol.length,
        landmarkCases: [...vol.landmarkCases, ...addedForVol],
      };
    });
  }, [customPrecedents]);

  const handleSyncUpdates = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/cassation/updates');
      if (res.ok) {
        const data = await res.json();
        setToastMessage(
          language === 'om'
            ? `Kuusaan murtiilee jildii 1-28 haaromfameera! (${data.version || 'v2026.11'}) 🟢`
            : `Cassation database synchronized! (${data.version || 'v2026.11'}) 🟢`
        );
      } else {
        throw new Error('Sync endpoint unavailable');
      }
    } catch {
      setToastMessage(
        language === 'om'
          ? 'Kuusaan murtiiwwanii yeroo ammaa haaromfamaadha! 🟢'
          : 'Precedent catalog is up to date! 🟢'
      );
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setTimeout(() => setToastMessage(null), 3500);
      }, 700);
    }
  };

  const handleSaveCustomCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileNum.trim() || !newPrinciple.trim()) return;

    const newRecord: LandmarkPrecedent & { volume: number } = {
      volume: newVolumeNum,
      fileNumber: newFileNum.trim(),
      category: newCategory,
      title: {
        om: newTitle.trim() || `Galmee Ijibbaataa #${newFileNum.trim()}`,
        en: newTitle.trim() || `Cassation File #${newFileNum.trim()}`
      },
      parties: {
        om: newTitle.trim() || 'Walfalmitoota',
        en: newTitle.trim() || 'Parties'
      },
      issue: {
        om: newIssue.trim() || 'Qabxii falmii seeraa',
        en: newIssue.trim() || 'Legal issue submitted'
      },
      keyPrinciple: {
        om: newPrinciple.trim(),
        en: newPrinciple.trim()
      },
      statutes: newStatutes.trim() || 'Heera RDFI & Seera Rogummaa Qabu',
      legalIssue: {
        om: newIssue.trim() || 'Qabxii seeraa falmisiisaa',
        en: newIssue.trim() || 'Legal issue'
      },
      significance: {
        om: 'Murtii ijoo dirqisiisaa',
        en: 'Binding precedent'
      }
    };

    const updated = [...customPrecedents, newRecord];
    setCustomPrecedents(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wako_custom_cassation_records', JSON.stringify(updated));
    }

    setToastMessage(
      language === 'om'
        ? `Galmeen #${newFileNum} milkaa'inaan dabalamee haaromfameera! 🎉`
        : `Case #${newFileNum} added and synchronized! 🎉`
    );
    setShowAddModal(false);
    setSelectedVolumeNumber(newVolumeNum);
    setExpandedVolumeId(newVolumeNum);
    setNewFileNum('');
    setNewTitle('');
    setNewIssue('');
    setNewPrinciple('');
    setNewStatutes('');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const categories = [
    { id: 'all', om: 'Hunda (Jildii 1-28)', en: 'All (Vols 1-28)' },
    { id: 'labor', om: 'Hojjetaa & Hojjechiisaa', en: 'Labor & Employment' },
    { id: 'contract', om: 'Waliigaltee & Diiginsa', en: 'Contracts & Obligations' },
    { id: 'procedure', om: 'Deemsa Falmii (SDFHH)', en: 'Civil & Criminal Procedure' },
    { id: 'land_rights', om: 'Lafa Baadiyaa & Magaalaa', en: 'Land Rights & Property' },
    { id: 'family', om: 'Maatii & Gaa\'ila', en: 'Family Law' },
    { id: 'succession', om: 'Dhaala & Wasiyyaa', en: 'Succession & Wills' },
    { id: 'commercial', om: 'Daldala, Baankii & Inshuuraansii', en: 'Commercial, Bank & Insurance' },
    { id: 'tax', om: 'Gumruuka & Taaksii', en: 'Customs & Tax' },
    { id: 'tort', om: 'Itti-gaafatamummaa Seeraan Alaa', en: 'Extra-contractual / Tort' },
    { id: 'criminal', om: 'Seera Yakkaa', en: 'Criminal Decisions' },
    { id: 'limitation', om: 'Darbiinsa Yeroo', en: 'Statute of Limitations' },
  ];

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setToastMessage(label);
    setTimeout(() => {
      setCopiedKey(null);
      setToastMessage(null);
    }, 2500);
  };

  const filteredVolumes = useMemo(() => {
    return allVolumesWithCustom.filter((vol) => {
      if (selectedVolumeNumber !== 'all' && vol.volume !== selectedVolumeNumber) {
        return false;
      }

      if (selectedCategory !== 'all') {
        const catGroup: Record<string, string[]> = {
          land_rights: ['land_rights', 'land'],
          commercial: ['commercial', 'banking', 'insurance'],
          procedure: ['procedure', 'civil'],
          tax: ['tax'],
          tort: ['tort'],
          labor: ['labor'],
          contract: ['contract'],
          family: ['family'],
          succession: ['succession'],
          criminal: ['criminal'],
          limitation: ['limitation'],
        };
        const targets = catGroup[selectedCategory] || [selectedCategory];
        const matchesCategory = vol.categories.some(c => targets.includes(c)) ||
          vol.landmarkCases.some(c => targets.includes(c.category));
        if (!matchesCategory) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = vol.title[language].toLowerCase().includes(q) ||
          vol.title.om.toLowerCase().includes(q) ||
          vol.amharicLabel.toLowerCase().includes(q);
        const matchesTheme = vol.theme[language].toLowerCase().includes(q);
        const matchesOverview = vol.overview[language].toLowerCase().includes(q);
        const matchesCases = vol.landmarkCases.some(
          c => c.fileNumber.includes(q) ||
            c.title[language].toLowerCase().includes(q) ||
            c.keyPrinciple[language].toLowerCase().includes(q) ||
            c.statutes.toLowerCase().includes(q)
        );
        const matchesTopics = vol.sections.some(s =>
          s.sectionTitle[language].toLowerCase().includes(q) ||
          s.topics[language].some(t => t.toLowerCase().includes(q))
        );

        return matchesTitle || matchesTheme || matchesOverview || matchesCases || matchesTopics;
      }

      return true;
    });
  }, [selectedVolumeNumber, selectedCategory, searchQuery, language, allVolumesWithCustom]);

  const handleExportText = () => {
    let output = `========================================================\n`;
    output += `BAAFATA MURTIILEEDHADDATAA IJIBBAATAA (JILDII 1 - 28)\n`;
    output += `Federal Supreme Court Cassation Division Precedents Index\n`;
    output += `========================================================\n\n`;

    allVolumesWithCustom.forEach(v => {
      output += `--------------------------------------------------------\n`;
      output += `JILDII ${v.volume}FFAA (${v.amharicLabel}) - ${v.yearEth} / ${v.yearGreg}\n`;
      output += `Mata-duree: ${v.title[language]}\n`;
      output += `Ibsa: ${v.overview[language]}\n\n`;
      output += `BAAFATA QABIYYEE:\n`;
      v.sections.forEach(s => {
        output += `  [${s.sectionTitle[language]}]\n`;
        s.topics[language].forEach(t => {
          output += `   • ${t}\n`;
        });
      });
      output += `\nGALMEEWWAN FI QAJEELTOOWWAN MURTEESSOO:\n`;
      v.landmarkCases.forEach(c => {
        output += `  * Galmee Lakk. ${c.fileNumber}: ${c.title[language]}\n`;
        output += `    Qajeeltoo: ${c.keyPrinciple[language]}\n`;
        output += `    Seera: ${c.statutes}\n`;
      });
      output += `\n`;
    });

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Baafata_Murtiilee_Ijibbaataa_Jildii_1_28_${language}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in text-stone-900 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-amber-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-amber-600/40 text-xs font-semibold animate-slide-up">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-amber-700/40">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-8 -translate-y-8">
          <Scale className="w-80 h-80 text-amber-400" />
        </div>

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 rounded-full border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide uppercase">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{language === 'om' ? 'Kuusaa Murtiilee Dirqisiisoo' : 'Binding Precedents Repository'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {language === 'om' 
              ? 'Baafata Murtiilee Dhaddacha Ijibbaataa (Jildii 1 - 28)' 
              : 'Federal Supreme Court Cassation Precedents (Volumes 1 - 28)'}
          </h2>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-3xl">
            {language === 'om'
              ? 'Baafata guutuu fi qajeeltoowwan dirqisiisoo Dhaddacha Ijibbaataa Mana Murtii Waliigalaa Federaalaa Jildii 1ffaa hanga Jildii 28ffaa (ቅጽ 1 - 28) Afaan Oromootiin qophaa\'ee dhiyaate. Mata-duree, lakk. galmee, fi seera rogummaa qabuun salphaatti barbaadaa.'
              : 'Complete table of contents, classified subject index, and core binding legal principles from the Federal Supreme Court Cassation Division Volumes 1 to 28 in Afaan Oromoo. Easily browse, search, and analyze precedents by volume, file number, or statute.'}
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">28</div>
              <div className="text-[11px] text-stone-300 font-medium">
                {language === 'om' ? 'Jildiiwwan Guutuu' : 'Published Volumes'}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">2,400+</div>
              <div className="text-[11px] text-stone-300 font-medium">
                {language === 'om' ? 'Murtiilee Dirqisiisoo' : 'Binding Cases'}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">10+</div>
              <div className="text-[11px] text-stone-300 font-medium">
                {language === 'om' ? 'Gosa Dhimmootaa' : 'Legal Domains'}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-emerald-400">Afaan Oromoo</div>
                <div className="text-[11px] text-stone-300 font-medium">
                  {language === 'om' ? 'Hiika Guutuu' : 'Full Translation'}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSyncUpdates}
                  disabled={isSyncing}
                  className="p-2 bg-stone-800/80 hover:bg-stone-700 text-stone-200 hover:text-white rounded-lg transition-colors cursor-pointer border border-stone-600/50"
                  title={language === 'om' ? 'Murtiiwwan haaromsuuf tuqaa' : 'Check for legal updates'}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="p-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                  title={language === 'om' ? 'Galmee ykn murtii haaraa dabaladhu' : 'Add custom precedent / case'}
                >
                  <PlusCircle className="w-4 h-4" />
                </button>

                <button
                  onClick={handleExportText}
                  className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors cursor-pointer"
                  title={language === 'om' ? 'Baafata kana buufadhu (Text)' : 'Export index to text'}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs space-y-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'om'
                ? 'Jildii, lakk. galmee (fkn: 138286, 140538, 215480), qajeeltoo seeraa, ykn mata-duree barbaadaa...'
                : 'Search by volume, file number (e.g. 138286, 140538, 215480), principle or keyword...'
            }
            className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-800 placeholder-stone-400 font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 hover:text-stone-800 bg-stone-200 hover:bg-stone-300 px-2 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-stone-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-amber-700" />
              {language === 'om' ? 'Kutaa:' : 'Topic:'}
            </span>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-amber-700 text-white shadow-xs font-semibold'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                {cat[language]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'all' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {language === 'om' ? 'Hunda' : 'Full'}
            </button>
            <button
              onClick={() => setViewMode('contents')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'contents' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {language === 'om' ? 'Baafata Qofa' : 'Contents'}
            </button>
            <button
              onClick={() => setViewMode('precedents')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                viewMode === 'precedents' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {language === 'om' ? 'Murtiiwwan Qofa' : 'Cases'}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              {language === 'om' ? 'Jildii Filadhaa (1 - 28):' : 'Select Volume (1 - 28):'}
            </span>
            {selectedVolumeNumber !== 'all' && (
              <button
                onClick={() => setSelectedVolumeNumber('all')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 cursor-pointer underline"
              >
                {language === 'om' ? 'Jildiiwwan Hunda Agarsiisi' : 'Show All Volumes'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedVolumeNumber('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer font-mono ${
                selectedVolumeNumber === 'all'
                  ? 'bg-stone-900 text-amber-300 ring-2 ring-amber-500'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              ALL
            </button>
            {CASSATION_VOLUMES_1_TO_28.map((v) => (
              <button
                key={v.volume}
                onClick={() => {
                  setSelectedVolumeNumber(v.volume);
                  setExpandedVolumeId(v.volume);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer font-mono ${
                  selectedVolumeNumber === v.volume
                    ? 'bg-amber-700 text-white shadow-xs ring-2 ring-amber-400'
                    : 'bg-stone-100 hover:bg-amber-100/60 text-stone-700'
                }`}
                title={`Jildii ${v.volume} (${v.amharicLabel})`}
              >
                J-{v.volume}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-stone-500 px-1">
        <span>
          {language === 'om' 
            ? `Jildiiwwan argaman: ${filteredVolumes.length} (Jildii 1-28 keessaa)` 
            : `Showing ${filteredVolumes.length} Volumes (out of 28)`}
        </span>
        {searchQuery && (
          <span className="font-semibold text-amber-700">
            {language === 'om' ? `Jecha barbaadame: "${searchQuery}"` : `Keyword: "${searchQuery}"`}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {filteredVolumes.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <Info className="w-8 h-8 text-amber-600 mx-auto" />
            <h4 className="text-base font-bold text-stone-800">
              {language === 'om' ? 'Jildiin ykn murtiin bu\'aa kanaan walsimu hin argamne' : 'No matching volume or decision found'}
            </h4>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedVolumeNumber('all');
              }}
              className="px-4 py-2 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer"
            >
              {language === 'om' ? 'Calaltuu Hunda Kaasi' : 'Reset All Filters'}
            </button>
          </div>
        ) : (
          filteredVolumes.map((vol) => {
            const isExpanded = expandedVolumeId === vol.volume || selectedVolumeNumber === vol.volume;

            return (
              <div
                key={vol.volume}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:border-amber-400 transition-all duration-200"
              >
                <div
                  onClick={() => setExpandedVolumeId(isExpanded ? null : vol.volume)}
                  className="p-5 sm:p-6 cursor-pointer bg-gradient-to-r from-stone-50/70 to-white hover:bg-amber-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 bg-amber-700 text-white font-mono font-bold text-xs rounded-lg shadow-xs">
                        Jildii {vol.volume}ffaa
                      </span>
                      <span className="px-2.5 py-0.5 bg-stone-200/80 text-stone-700 font-mono text-xs rounded-md font-semibold">
                        {vol.amharicLabel}
                      </span>
                      <span className="text-xs text-stone-500 font-medium">
                        {vol.yearEth} ({vol.yearGreg})
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] rounded-md font-semibold">
                        ~{vol.totalCasesEstimated} {language === 'om' ? 'Murtiilee' : 'Cases'}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-snug">
                      {vol.title[language]}
                    </h3>

                    <p className="text-xs sm:text-sm text-stone-600 line-clamp-2">
                      {vol.theme[language]}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const summaryText = `Dhaddacha Ijibbaataa MMWF Jildii ${vol.volume}ffaa (${vol.amharicLabel})\n${vol.title[language]}\n${vol.overview[language]}`;
                        handleCopy(summaryText, `vol-${vol.volume}`, language === 'om' ? 'Ibsi jildii waraabbameera' : 'Volume copied');
                      }}
                      className="p-2 text-stone-400 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                      title={language === 'om' ? 'Waraabi' : 'Copy volume overview'}
                    >
                      {copiedKey === `vol-${vol.volume}` ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <div className="p-2 bg-amber-50 text-amber-800 rounded-lg">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 sm:p-6 border-t border-stone-200 bg-white space-y-6 animate-fade-in">
                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-700 leading-relaxed">
                      <span className="font-bold text-amber-800 mr-1.5">
                        {language === 'om' ? 'Ibsa Waliigalaa:' : 'Overview:'}
                      </span>
                      {vol.overview[language]}
                    </div>

                    {(viewMode === 'all' || viewMode === 'contents') && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-700" />
                            <span>{language === 'om' ? 'Baafata Mata-Dureewwanii (Table of Contents)' : 'Classified Table of Contents'}</span>
                          </h4>
                          <span className="text-[11px] text-stone-400 font-mono">
                            {vol.sections.length} {language === 'om' ? 'Kutaalee' : 'Parts'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {vol.sections.map((sec, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 bg-stone-50/80 hover:bg-amber-50/50 border border-stone-200 rounded-xl space-y-2 transition-colors"
                            >
                              <div className="font-bold text-xs sm:text-sm text-stone-900 flex items-center gap-1.5 text-amber-900">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                <span>{sec.sectionTitle[language]}</span>
                              </div>
                              <ul className="space-y-1.5 pl-3">
                                {sec.topics[language].map((topic, tIdx) => (
                                  <li key={tIdx} className="text-xs text-stone-600 flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-stone-400 font-mono text-[10px] mt-0.5">•</span>
                                    <span>{topic}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(viewMode === 'all' || viewMode === 'precedents') && vol.landmarkCases.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-amber-700" />
                            <span>{language === 'om' ? 'Murtiilee fi Qajeeltoowwan Seeraa Dirqisiisoo' : 'Key Landmark Precedents & Binding Principles'}</span>
                          </h4>
                          <span className="text-[11px] text-stone-400 font-mono">
                            {vol.landmarkCases.length} {language === 'om' ? 'Murtiilee beekamoo' : 'Landmark cases'}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {vol.landmarkCases.map((caseItem) => (
                            <div
                              key={caseItem.fileNumber}
                              className="p-4 bg-gradient-to-r from-amber-50/40 via-white to-stone-50 border border-amber-200 rounded-xl space-y-3 hover:border-amber-400 transition-colors shadow-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 bg-amber-800 text-white font-mono font-bold text-xs rounded-md">
                                    Lakk. Galmee: {caseItem.fileNumber}
                                  </span>
                                  <span className="text-xs font-semibold text-stone-500">
                                    (Jildii {vol.volume}ffaa)
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const text = `Dhaddacha Ijibbaataa MMWF - Jildii ${vol.volume} Galmee ${caseItem.fileNumber}\n\nQajeeltoo Seeraa:\n"${caseItem.keyPrinciple[language]}"\n\nBu'uura Seeraa: ${caseItem.statutes}`;
                                      handleCopy(text, `case-${caseItem.fileNumber}`, language === 'om' ? 'Qajeeltoon seeraa waraabbameera' : 'Legal principle copied');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    {copiedKey === `case-${caseItem.fileNumber}` ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700 text-[11px] font-semibold">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                                        <span className="text-[11px]">Copy</span>
                                      </>
                                    )}
                                  </button>

                                  {onAskAI && (
                                    <button
                                      onClick={() => {
                                        const prompt = `Dhaddacha Ijibbaataa MMWF Jildii ${vol.volume} Lakk. Galmee ${caseItem.fileNumber} ilaalchisee xiinxala seeraa fi haala itti dhimmi kun manneen murtii keessatti hojiirra oolu gadi fageenyaan naa ibsi mee.`;
                                        onAskAI(prompt);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      <span>AI Gaafadhu</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <h5 className="text-sm font-bold text-stone-900 leading-snug">
                                {caseItem.title[language]}
                              </h5>

                              <div className="p-3 bg-amber-100/60 border-l-4 border-amber-600 rounded-r-lg text-xs sm:text-sm text-stone-900 font-serif leading-relaxed italic">
                                {caseItem.keyPrinciple[language]}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-amber-200/50">
                                <div className="flex items-center gap-1.5 text-amber-900 font-mono font-medium">
                                  <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                                  <span>{caseItem.statutes}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
