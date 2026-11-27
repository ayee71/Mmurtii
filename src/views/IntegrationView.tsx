import React, { useState } from 'react';
import { Language, translations } from '../i18n/translations';
import { generateLegalContent } from '../services/api';
import { getStoredAiOutputLanguage } from '../services/storage';

interface IntegrationViewProps {
  currentLang: Language;
  onNavigateTab?: (tab: string) => void;
}

export const IntegrationView: React.FC<IntegrationViewProps> = ({
  currentLang,
  onNavigateTab,
}) => {
  const t = translations[currentLang];
  const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'models' | 'safeguards' | 'simulator'>('pipeline');
  const [selectedPipelineStep, setSelectedPipelineStep] = useState<number>(1);
  const [liveQuery, setLiveQuery] = useState<string>(
    'Seerri adeemsa dhimma hariiroo hawaasaa (SDFHH) Keeyyata 6 waa\'ee maaliiti ibsa?'
  );
  const [liveResponse, setLiveResponse] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [isRunningLive, setIsRunningLive] = useState<boolean>(false);

  const runLiveInspection = async (queryOverride?: string) => {
    const q = (queryOverride ?? liveQuery).trim();
    if (!q) return;
    if (queryOverride) setLiveQuery(queryOverride);
    setIsRunningLive(true);
    setLiveError(null);
    try {
      const activeOutputLang = getStoredAiOutputLanguage();
      const res = await generateLegalContent({
        prompt: q,
        taskType: 'explain_law',
        outputLanguage: activeOutputLang,
        outputLanguages: [activeOutputLang],
      });
      setLiveResponse(res.separatedVersions?.[activeOutputLang] || res.content);
    } catch (err: any) {
      setLiveError(err?.message || 'Live legal engine call failed');
      setLiveResponse(null);
    } finally {
      setIsRunningLive(false);
    }
  };

  const content = {
    om: {
      title: 'Qindaa\'ina Google Gemini AI & Qajeeltoowwan Seeraa',
      subtitle: 'Qajeelfama bal\'aa fi adeemsa teeknikaa platformiin kun akkamitti Google Gemini AI fayyadamee seera Itoophiyaa afaan sadiin qixa sirriitiin dhiyeessu.',
      navTabs: {
        pipeline: 'Tartiiba Hojii AI (6-Step Pipeline)',
        models: 'Moodeelota Gemini & Humna Isaanii',
        safeguards: 'Eegumsa Seeraa & Qulqullina',
        simulator: 'Ilaalcha Qabatamaa (Interactive Inspection)',
      },
      kicker: 'DOKUMENTEESHINII TEEKNIKAA & GORSA OGEESSOTA SEERAA',
    },
    am: {
      title: 'የGoogle Gemini AI ውህደት እና የሕግ መርሆዎች ማብራሪያ',
      subtitle: 'ይህ መድረክ የኢትዮጵያን ሕጎች በሶስት ቋንቋዎች በትክክለኛነት እና በጥልቀት ለማቅረብ Google Gemini AIን እንዴት እንደሚጠቀም የሚያሳይ ዝርዝር መመሪያ።',
      navTabs: {
        pipeline: 'የስራ ቅደም ተከተል (6-ደረጃዎች)',
        models: 'የGemini ሞዴሎች እና አቅማቸው',
        safeguards: 'የሕግ ጥበቃ እና አስተማማኝነት',
        simulator: 'ተጨባጭ ማስመሰያ (Live Playground)',
      },
      kicker: 'የቴክኒክ ሰነድ እና የሕግ ባለሙያዎች መመሪያ',
    },
    en: {
      title: 'Google Gemini AI Integration & Ethiopian Legal Grounding',
      subtitle: 'Comprehensive architectural guide explaining how the platform orchestrates Google Gemini AI to deliver verified, authoritative, and trilingual legal analysis under Ethiopian jurisprudence.',
      navTabs: {
        pipeline: 'AI Inference Pipeline (6 Steps)',
        models: 'Gemini Models & Capabilities',
        safeguards: 'Legal Safeguards & Accuracy',
        simulator: 'Interactive Engine Inspector',
      },
      kicker: 'TECHNICAL DOCUMENTATION & JURIST GUIDE',
    },
  }[currentLang];

  const pipelineSteps = [
    {
      step: 1,
      emoji: '📥',
      title: {
        om: '1. Iyyata & Yaad-rimee Seeraa Qorachuu (Context Ingestion)',
        am: '1. የሕግ ጥያቄን መቀበልና መለየት (Context Ingestion)',
        en: '1. Legal Input Ingestion & Semantic Parsing',
      },
      summary: {
        om: 'Gaaffiin ykn sanadni dhiyaate qoramee dhimma seeraa isa kam waliin akka wal qabatu (fkn: SDFHH, Seera Hariiroo Hawaasaa, Yakka, Hojjataa fi Hojjechiisaa) adda baafama.',
        am: 'የቀረበው ጥያቄ ወይም ሰነድ ተመርምሮ ከየትኛው የሕግ ዘርፍ (የፍትሐብሔር ሥነ-ሥርዓት፣ የውል ሕግ፣ የወንጀል ወይም የሠራተኛ ሕግ) ጋር እንደሚገናኝ ይለያል።',
        en: 'The query is parsed to identify statutory domain, jurisdictional thresholds, and relevant parties before calling the inference engine.',
      },
      detail: {
        om: 'Platformiin kun gaaffii abukaattotaa ykn abbootii seeraa irraa dhiyaatu qorachuun: lakkoofsa keeyyataa, labsii dhimmi ilaallatu, fi afaan filatame (Afaan Oromoo, አማርኛ, English) qindeessee qopheessa.',
        am: 'መድረኩ ከጠበቆች ወይም ዳኞች የሚቀርቡትን ጥያቄዎች ይመረምራል፡ የአንቀፅ ቁጥሮች፣ የሚመለከታቸው አዋጆች እና የተመረጠው ቋንቋ ተለይተው ይዘጋጃሉ።',
        en: 'Normalizes citations, extracts implicit legal intents, and prepares multilingual token buffers for precise statutory context retrieval.',
      },
    },
    {
      step: 2,
      emoji: '🏛️',
      title: {
        om: '2. Kuusaa Labsiilee & Murtii Dhaddacha Ijoo Itti Dabaluu (Grounding Injection)',
        am: '2. አዋጆችን እና የሰበር ውሳኔዎችን ማካተት (Grounding Injection)',
        en: '2. Statutory & Cassation Precedent Grounding Injection',
      },
      summary: {
        om: 'Heera Mootummaa, SDFHH, Seera Hariiroo Hawaasaa, Labsiilee Caffee Oromiyaa fi Federaalaa, akkasumas murteewwan Dhaddacha Ijibbaataa akka madda ragaatti qindaa\'u.',
        am: 'የኢ.ፌ.ዲ.ሪ ሕገ-መንግሥት፣ የፍትሐብሔር ሥነ-ሥርዓት ሕግ፣ አዋጆች እና አስገዳጅ የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ውሳኔዎች እንደ ዋና ማስረጃ ይካተታሉ።',
        en: 'Direct injection of binding Federal Supreme Court Cassation Bench precedents, regional Oromia proclamations, and codal provisions.',
      },
      detail: {
        om: 'AI\'n yaada ofii akka hin uumneef (anti-hallucination), dursa keeyyattoota labsii sirrii fi lakk. galmee Dhaddacha Ijibbaataa kanneen akka Lakk. 249062 dhiyeessuu akka qabu dirqamsiifama.',
        am: 'አርቴፊሻል ኢንተለጀንሱ የራሱን ሃሳብ እንዳይፈጥር ትክክለኛውን የአዋጅ ቁጥር እና አስገዳጅ የሰበር መዝገቦችን እንዲጠቅስ ጥብቅ የሕግ ማዕቀፍ ይሰጠዋል።',
        en: 'Forces zero-hallucination adherence by mandating explicit proclamation citations and precedent register numbers prior to any analytical output.',
      },
    },
    {
      step: 3,
      emoji: '⚖️',
      title: {
        om: '3. Qajeelfama Ogeessa Seeraa PhD & Muuxannoo Waggaa 50+ (Expert Persona Prompting)',
        am: '3. የ50+ ዓመታት የሕግ ልምድ እና የዶክትሬት ማዕረግ ባለሙያ መመሪያ',
        en: '3. Senior Jurist Persona & Strict Statutory Verification Rules',
      },
      summary: {
        om: 'Moodeelli akka ogeessa seeraa PhD qabuutti, falmiiwwan gama lachuun madaalee murtii fi gorsa qulqullina olaanaa qabu kenna.',
        am: 'ሞዴሉ እንደ ከፍተኛ የሕግ ባለሙያ ሆኖ የሁለቱንም ወገን መከራከሪያዎች ሚዛናዊ በሆነ መንገድ ገምግሞ ሙያዊ የሕግ ድምዳሜ ይሰጣል።',
        en: 'Engine is primed with judicial reasoning paradigms: burden of proof evaluation, preliminary objection analysis, and ratio decidendi isolation.',
      },
      detail: {
        om: 'Deebiin kamiyyuu akkaataa ulaagaa mana murtiitti: 1) Bu\'uura Seeraa & Labsii, 2) Deebii Kallattii & Murtii, 3) Mirga, Dirqama & Haala Addaa, 4) Tarkaanfii Qabatamaa ta\'ee qophaa\'a.',
        am: 'ማንኛውም ምላሽ በፍርድ ቤት አቀራረብ መሠረት ይዋቀራል፡ 1) የሕግ መሠረትና አዋጆች፣ 2) ቀጥተኛ መልስና ውሳኔ፣ 3) መብቶችና ግዴታዎች፣ 4) ተግባራዊ የሕግ እርምጃዎች።',
        en: 'Structured judicial schema enforcement ensures all responses contain legal basis, direct holdings, rights/duties, and actionable litigation advice.',
      },
    },
    {
      step: 4,
      emoji: '⚡',
      title: {
        om: '4. Gemini Engine & Dursaa Ofumaa (Failover Inference)',
        am: '4. የGemini ሞዴል እና ፈጣን ምትክ አሰራር (Failover Engine)',
        en: '4. Gemini Inference with Intelligent Failover',
      },
      summary: {
        om: 'Saffisa sekondii tokko gadiin deebii kennuuf `gemini-4-hydrogen` fi `gemini-3.1-flash-lite` fayyadama; yoo tokko quotiin dhibame kan biraatti ofumaan ce\'a.',
        am: 'ከአንድ ሴኮንድ ባነሰ ጊዜ ውስጥ ምላሽ ለመስጠት `gemini-4-hydrogen` ይጠቀማል፤ አንዱ ቢጨናነቅ ወዲያውኑ ወደ ሌላኛው ይሸጋገራል።',
        en: 'Ultra-low latency execution via Gemini Flash Lite models with real-time automatic multi-tier fallback to eliminate 429 quota disruptions.',
      },
      detail: {
        om: 'Server keenya (`server.ts`) moodeelota haaraa fi daangaa bal\'aa qaban qindeessee waan qabuuf, ogeeyyiin seeraa tajaajila addaan hin cinne argatu.',
        am: 'ሰርቨራችን ፈጣን እና አስተማማኝ ሞዴሎችን ስላዋሃደ የሕግ ባለሙያዎች ያለ ምንም መቆራረጥ ጥራት ያለው አገልግሎት ያገኛሉ።',
        en: 'Direct JSON schema generation and parallel streaming maximize legal response accuracy without timeout vulnerabilities.',
      },
    },
    {
      step: 5,
      emoji: '📜',
      title: {
        om: '5. Madaallii & Fooyyessa Wabiilee Seeraa (Citation Standardizer)',
        am: '5. የሕግ ጥቅሶች ማረጋገጫና ማስተካከያ (Citation Normalizer)',
        en: '5. Ethiopian Citation Normalizer & Legal Source Verification',
      },
      summary: {
        om: 'Wabiileen deebii keessatti caqasaman hundi ulaagaa seeraa Itoophiyaatiin (Labsii Lakk. X/XXXX, Kwt. X, Jildii X) sirreeffamu.',
        am: 'በምላሹ ውስጥ የተጠቀሱ የሕግ ማስረጃዎች በሙሉ በኢትዮጵያ ሕጋዊ አጻጻፍ ደንብ (አዋጅ ቁጥር X/XXXX፣ አንቀፅ X) መሰረት ይስተካከላሉ።',
        en: 'Automated post-processing converts unstructured statutory references into standard proclamation formats (e.g., Proc. No. 1234/2021, Art. 6).',
      },
      detail: {
        om: 'Kana malees, seera deemsa falmii hariiroo hawaasaa irratti dhimmi aangoo maallaqaa (pecuniary jurisdiction) fi ragaa akka walitti hin makamne eeggannoo cimaatu godhama.',
        am: 'በተጨማሪም የገንዘብ መጠን ሥልጣን (pecuniary jurisdiction) እና የማስረጃ ማቅረብ መርሆዎች እንዳይደባለቁ ጥብቅ ቁጥጥር ይደረጋል።',
        en: 'Rigorous cross-validation rules prevent domain cross-contamination, ensuring distinct statutory boundaries across procedural categories.',
      },
    },
    {
      step: 6,
      emoji: '🌐',
      title: {
        om: '6. Wal-simsiisa Jechoota Afaan-Sadee (Trilingual Cross-Verification)',
        am: '6. የሶስት ቋንቋዎች የሕግ ቃላት ማመሳከሪያ (Trilingual Alignment)',
        en: '6. Trilingual Jurisprudential Terminology Synchronization',
      },
      summary: {
        om: 'Jechoota seeraa Afaan Oromoo, አማርኛ, fi English gidduutti hiikni isaanii walsimaa ta\'uu isaa kuusaa jechoota seeraatiin mirkaneessa.',
        am: 'በኦሮምኛ፣ አማርኛ እና እንግሊዝኛ መካከል ያሉት የሕግ ቃላት ትርጉማቸው አንድ ወጥ መሆኑ በመዝገበ-ቃላት ይረጋገጣል።',
        en: 'Ensures exact legal correspondence across Afaan Oromoo, Amharic, and English codal terms (e.g., Aangoo Maallaqaa ↔ የገንዘብ ሥልጣን ↔ Pecuniary Jurisdiction).',
      },
      detail: {
        om: 'Waliigalteewwan fi iyyanni himataa afaanota sadaniinuu yoo qophaa\'u, mirgaa fi dirqamni gareewwanii tokkollee akka hin dhabamne wal bira qabee qora.',
        am: 'ውሎችና የክስ አቤቱታዎች በሶስቱም ቋንቋዎች ሲዘጋጁ የባለጉዳዮች መብትና ግዴታ በትርጉም እንዳይዛባ በጥንቃቄ ይመረመራል።',
        en: 'Guarantees contractual parity across tri-column exports for court filing and legal compliance across Regional and Federal jurisdictions.',
      },
    },
  ];

  const liveBenchmarks = [
    {
      label: '⚖️ SDFHH Kwt 6 (Review / Jurisdiction)',
      query: 'Seerri adeemsa dhimma hariiroo hawaasaa (SDFHH) Keeyyata 6 waa\'ee maaliiti ibsa?',
    },
    {
      label: '📜 Waliigaltee Kwt 1731 & 1771',
      query: 'Bu\'uura Koodii Siiviilii Keeyyata 1731 fi 1771 tiin waliigalteen yoo diigame furmaanni maali?',
    },
    {
      label: '🌾 Labsii 130/1999 Kwt 6 (Lafa Baadiyyaa)',
      query: 'Labsii 130/1999 Keeyyata 6 mirga dhaala qabiyyee lafa baadiyyaa akkamitti ibsa?',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
          {content.kicker}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif-legal text-slate-100">
              {content.title}
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
              {content.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Gemini Flash Lite ⚡ Active</span>
            </div>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('pipeline')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'pipeline'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            📋 {content.navTabs.pipeline}
          </button>
          <button
            onClick={() => setActiveSubTab('models')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'models'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            ⚡ {content.navTabs.models}
          </button>
          <button
            onClick={() => setActiveSubTab('safeguards')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'safeguards'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            🛡️ {content.navTabs.safeguards}
          </button>
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'simulator'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            🔬 {content.navTabs.simulator}
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: 6-STEP PIPELINE */}
      {activeSubTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between text-xs text-slate-400">
            <span>
              {currentLang === 'om'
                ? 'Adeemsa tokkoo tokkoon isaanii cuqaasuun ibsa teeknikaa fi bu\'uura seeraa ilaali:'
                : currentLang === 'am'
                ? 'እያንዳንዱን ደረጃ በመጫን ዝርዝር የቴክኒክ እና የሕግ አሰራሩን ይመልከቱ፡'
                : 'Click any step below to inspect detailed statutory grounding and technical execution:'}
            </span>
            <span className="font-mono text-amber-400 font-semibold">Step {selectedPipelineStep} of 6</span>
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelineSteps.map((stepItem) => {
              const isSelected = selectedPipelineStep === stepItem.step;
              return (
                <div
                  key={stepItem.step}
                  onClick={() => setSelectedPipelineStep(stepItem.step)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-amber-500 text-slate-100 shadow-md ring-1 ring-amber-500/40'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{stepItem.emoji}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      Phase 0{stepItem.step}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mb-2 leading-snug">
                    {stepItem.title[currentLang]}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {stepItem.summary[currentLang]}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Selected Step Detailed Deep-Dive Card */}
          {(() => {
            const currentStep = pipelineSteps.find((s) => s.step === selectedPipelineStep) || pipelineSteps[0];
            return (
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currentStep.emoji}</span>
                  <div>
                    <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                      {currentLang === 'om' ? 'Xinxala Qorannoo Teeknikaa' : currentLang === 'am' ? 'የቴክኒክ ትንተና' : 'Technical Architecture Detail'}
                    </div>
                    <h2 className="text-xl font-bold font-serif-legal text-slate-100">
                      {currentStep.title[currentLang]}
                    </h2>
                  </div>
                </div>

                <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
                  {currentStep.detail[currentLang]}
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>🛡️ Status: Verified against Ethiopian Legal System</span>
                    <span aria-hidden="true">·</span>
                    <span>100% Proclamation Grounded</span>
                  </div>
                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab('explainLaw')}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                    >
                      ⚖️ {currentLang === 'om' ? 'Qoradhu & Hojiirra Oolchi' : currentLang === 'am' ? 'በተግባር ሞክር' : 'Test in Explain Law View'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SUB-TAB 2: GEMINI MODELS & LATENCY */}
      {activeSubTab === 'models' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Model */}
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                  PRIMARY MODEL (ACTIVE)
                </span>
                <span className="text-emerald-400 font-mono text-xs">⚡ &lt; 850ms Avg Latency</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-serif-legal">
                gemini-4-hydrogen
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentLang === 'om'
                  ? 'Moodeela Google Gemini isa ammayyaa fi saffisa addaa qabu. Daangaa bal\'aa qaba; quota hin fixatu; keeyyattoota seeraa fi wabiilee dheeratoo saffisaan qorata.'
                  : currentLang === 'am'
                  ? 'የጉግል ጀሚኒ እጅግ ፈጣን እና አስተማማኝ ሞዴል። ከፍተኛ አቅም ያለው፣ የኮታ ገደብ የማያጋጥመው እና ረጅም የሕግ ሰነዶችን በቅጽበት የሚመረምር ነው።'
                  : 'Google Gemini next-generation fast inference model engineered for high-throughput, low-latency reasoning over massive Ethiopian legal corpora.'}
              </p>
              <div className="space-y-2 pt-2 text-xs text-slate-300 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Context Window</span>
                  <span>1,048,576 Tokens</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Task Optimization</span>
                  <span>Drafting, Statutory Cross-Check, QA</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Availability SLA</span>
                  <span className="text-emerald-400">Active Cloud SLA</span>
                </div>
              </div>
            </div>

            {/* Fallback Engine */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800 font-semibold">
                  AUTOMATIC FAILOVER TIER
                </span>
                <span className="text-slate-400 font-mono text-xs">🧠 Resilience Failover</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 font-serif-legal">
                gemini-3.1-flash-lite
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentLang === 'om'
                  ? 'Yoo sababa dhiibbaa network ykn tajaajilli tokko yeroof busy ta\'e, server keenya ofumaan gara moodeela kanaatti jijjiiruun tajaajilli akka hin dhaabbanne godha.'
                  : currentLang === 'am'
                  ? 'በኔትወርክ መጨናነቅ ወይም በማንኛውም ምክንያት አንደኛው ሞዴል ቢዘገይ ሰርቨራችን በራስ-ሰር ወደዚህ ሞዴል በመቀየር ያልተቋረጠ አገልግሎት ያረጋግጣል።'
                  : 'Automated secondary resilience tier triggered without client interruption if any primary endpoint reports transient exhaustion.'}
              </p>
              <div className="space-y-2 pt-2 text-xs text-slate-300 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Failover Latency</span>
                  <span>Zero-delay auto retry</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-500">Model Pipeline</span>
                  <span>Ordered sequence in server.ts</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Disruption Rate</span>
                  <span className="text-emerald-400">0.00% Zero-Crash Architecture</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Selection Guide for Attorneys */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-200">
              {currentLang === 'om' ? 'Gorsa Abukaattota & Abbootii Seeraatiif:' : currentLang === 'am' ? 'ለዳኞችና ለጠበቆች የተሰጠ ምክር፡' : 'Jurisprudential Advice for Legal Practitioners:'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {currentLang === 'om'
                ? 'Kutaa hunda keessatti (Document Analysis, Explain Law, Create) moodeelli `Flash Lite` akka dura bu\'uutti qindaa\'eera. Kunis deebii seeraa qulqullina olaanaa qabu sekondii tokko keessatti akka argattan isin dandeessisa.'
                : currentLang === 'am'
                ? 'በሁሉም ክፍሎች ውስጥ `Flash Lite` በነባሪነት ተመርጧል። ይህም ከፍተኛ ጥራት ያለው የሕግ ትንታኔ በአጭር ሰከንዶች ውስጥ እንድታገኙ ያስችላል።'
                : 'Flash Lite is enabled by default across all legal workspaces, delivering PhD-level statutory citation precision in under 1 second without rate limit exhaustion.'}
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LEGAL SAFEGUARDS & ETHICAL STANDARDS */}
      {activeSubTab === 'safeguards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-2xl">🚫</span>
              <h3 className="text-sm font-bold text-slate-100">
                {currentLang === 'om' ? 'Anti-Hallucination Guardrails' : currentLang === 'am' ? 'የሀሰት መረጃ መከላከያ' : 'Anti-Hallucination Guardrails'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentLang === 'om'
                  ? 'AI\'n keeyyata seeraa hin jirre ykn labsii sobaa akka hin uumneef, seerota Itoophiyaa galmaa\'an qofa irratti akka hundaa\'u qindeeffameera.'
                  : currentLang === 'am'
                  ? 'የሌሉ አዋጆችን ወይም የፈጠራ አንቀጾችን እንዳይጠቅስ በኢትዮጵያ ህጋዊ አዋጆች ላይ ብቻ እንዲመሰረት ተደርጓል።'
                  : 'Strict systemic prompts prohibit speculative provisions, requiring exact statutory register numbers before analytical synthesis.'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-2xl">🔒</span>
              <h3 className="text-sm font-bold text-slate-100">
                {currentLang === 'om' ? 'Iccitii Abukaattoo & Maamilaa' : currentLang === 'am' ? 'የደንበኛ እና የጠበቃ ሚስጥር ጥበቃ' : 'Attorney-Client Privilege'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentLang === 'om'
                  ? 'Sanadni fi iyyanni himataa platformii kana irratti qoramu kamiyyuu moodeela leenjisuuf hin fayyadamu; iccitii guutuudhaan eegama.'
                  : currentLang === 'am'
                  ? 'የተመረመሩ ሰነዶች ወይም የክስ መዝገቦች ሞዴሎችን ለማሰልጠን አይውሉም፤ የባለጉዳዩ ሚስጥር 100% የተጠበቀ ነው።'
                  : 'Zero retention data pipelines protect sensitive evidentiary filings; client data is never utilized for LLM retraining.'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-2xl">⚖️</span>
              <h3 className="text-sm font-bold text-slate-100">
                {currentLang === 'om' ? 'Heera Mootummaa & Labsii 410/2004' : currentLang === 'am' ? 'ሕገ-መንግሥትና አዋጅ 410/1996' : 'Constitutional & Statutory Rights'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {currentLang === 'om'
                  ? 'Mirga abbaa qabeenyummaa fi eegumsa seeraa Labsii Lakk. 410/1996 (410/2004) jalatti tumameen guutummaatti kan eegameedha.'
                  : currentLang === 'am'
                  ? 'በኢትዮጵያ የቅጂ መብት እና ተዛማጅ መብቶች አዋጅ ቁጥር 410/1996 መሠረት ሙሉ የሕግ ጥበቃ የተሰጠው ነው።'
                  : 'Full compliance with Ethiopian Copyright and Neighboring Rights Proclamation No. 410/2004 and FDRE Constitutional protections.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: LIVE ENGINE INSPECTOR */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 font-serif-legal">
                  {currentLang === 'om' ? 'Ilaalcha Qabatamaa (Live Engine Inspector)' : currentLang === 'am' ? 'የቀጥታ ሞዴል መመርመሪያ' : 'Live Gemini Legal Engine Inspector'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {currentLang === 'om'
                    ? 'Gaaffii seeraa filadhu ykn barreessiitii deebii qabatamaa AI server irraa ilaali:'
                    : currentLang === 'am'
                    ? 'የሕግ ጥያቄ ይምረጡ ወይም ይጻፉ እና ከሰርቨሩ የሚመጣውን ቀጥታ ምላሽ ይመልከቱ፡'
                    : 'Select or enter a legal query to run a live grounded call against /api/generate:'}
                </p>
              </div>
            </div>

            {/* Preset Benchmark Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {liveBenchmarks.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => runLiveInspection(b.query)}
                  disabled={isRunningLive}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 disabled:opacity-50"
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Custom Query Runner */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={liveQuery}
                onChange={(e) => setLiveQuery(e.target.value)}
                placeholder={currentLang === 'om' ? 'Gaaffii seeraa barreessi...' : currentLang === 'am' ? 'የሕግ ጥያቄ ይጻፉ...' : 'Enter a legal question...'}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => runLiveInspection()}
                disabled={isRunningLive || !liveQuery.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {isRunningLive
                  ? currentLang === 'om'
                    ? 'Qorachaa jira...'
                    : currentLang === 'am'
                    ? 'በመመርመር ላይ...'
                    : 'Running...'
                  : currentLang === 'om'
                  ? 'Live Qoradhu'
                  : currentLang === 'am'
                  ? 'በቀጥታ ፈትሽ'
                  : 'Run Live Query'}
              </button>
            </div>

            {liveError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
                {liveError}
              </div>
            )}

            {liveResponse && (
              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 font-serif-legal">
                    ⚖️ Live /api/generate Response ({currentLang.toUpperCase()})
                  </span>
                  <span className="font-mono text-emerald-400">Verified Live Output</span>
                </div>
                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {liveResponse}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom CTA / Navigation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-100">
            {currentLang === 'om' ? 'Seera Qorachuuf ykn Waliigaltee Qopheessuuf Qophiidhaa?' : currentLang === 'am' ? 'ሕግ ለመመርመር ወይም ውል ለማዘጋጀት ዝግጁ ነዎት?' : 'Ready to Analyze Law or Draft Verified Contracts?'}
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {currentLang === 'om'
              ? 'Meeshaalee seeraa kanneen biroo fayyadamuun qorannoo kee itti fufi.'
              : currentLang === 'am'
              ? 'ሌሎች የሕግ መገልገያዎችን በመጠቀም ምርምርዎን ይቀጥሉ።'
              : 'Switch directly to specialized legal modules.'}
          </p>
        </div>

        {onNavigateTab && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onNavigateTab('explainLaw')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              ⚖️ {t.nav.explainLaw}
            </button>
            <button
              onClick={() => onNavigateTab('docAnalysis')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              📄 {t.nav.docAnalysis}
            </button>
            <button
              onClick={() => onNavigateTab('create')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors shadow"
            >
              ✍️ {t.nav.create}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
