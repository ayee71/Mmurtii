import React, { useState } from 'react';
import {
  Building2,
  Workflow,
  Scale,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Language } from '../i18n/translations';

interface CourtWorkflowAndCredentialsCardProps {
  currentLang?: Language;
  onNavigateToCourtWork?: () => void;
}

export const CourtWorkflowAndCredentialsCard: React.FC<CourtWorkflowAndCredentialsCardProps> = ({
  currentLang = 'om',
  onNavigateToCourtWork
}) => {
  const [activeTab, setActiveTab] = useState<'workflow' | 'tiers'>('workflow');

  const courtTiers = [
    {
      level: '1ffaa',
      nameOm: '1. Mana Murtii Aanaa (District / First Instance Court)',
      nameAm: '1. የመጀመሪያ ደረጃ ፍርድ ቤት (District Court)',
      desc: 'Galmeen haaraan jalqaba irratti kan banamu, kaffaltiin taaksii fi dambii lakk. 08 kan qulqullaa\'u fi ragaan dhugaa jalqabaa kan qoratamu.',
      jurisdiction: 'Aangoo dhimma jalqabaatti ilaaluu (Initial Trial Jurisdiction)'
    },
    {
      level: '2ffaa',
      nameOm: '2. Mana Murtii Olaanaa Godinaa / Magaalaa (High Court)',
      nameAm: '2. ከፍተኛ ፍርድ ቤት (High Court)',
      desc: 'Murtiiwwan mana murtii aanaa irraa ol\'iyyaannoon dhiyaatan kan ilaalu fi dhimmoota gurguddoo daldala, lafaafi yakkaa kan qoratu.',
      jurisdiction: 'Aangoo Ol-iyyataa fi Dhimma Gurguddoo'
    },
    {
      level: '3ffaa',
      nameOm: '3. Mana Murtii Waliigalaa Oromiyaa (Oromia Supreme Court)',
      nameAm: '3. የኦሮሚያ ጠቅላይ ፍርድ ቤት (Oromia Supreme Court)',
      desc: 'Manneen murtii ol\'aanaa irraa murtii kennaman irratti ol\'iyyaannoo fudhachuun qoratu, qajeeltoota seeraa diriirsuu fi dhimmoota olaanoo hordofu.',
      jurisdiction: 'Aangoo Ol-iyyataa Waliigalaa Naannichaa'
    },
    {
      level: '4ffaa',
      nameOm: '4. Dhaddacha Ijibbaataa Mana Murtii Waliigalaa (Cassation Bench)',
      nameAm: '4. የጠቅላይ ፍርድ ቤት ሰበር ችሎት (Cassation Bench)',
      desc: 'Dogoggora bu\'uura seeraa (Fundamental errors of law) qorachuun murtii dhumaa kan kennu fi manneen murtii hundaaf dirqamaan hojiirra oolu.',
      jurisdiction: 'Aangoo Ijibbaataa Seeraa (Binding Precedent Authority)'
    }
  ];

  return (
    <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Scale className="w-48 h-48 text-amber-400" />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>SEERAAI - Oromia Judicial System Hub (Sadarkaa 4n & Adeemsa Hojii)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('workflow')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'workflow'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Workflow (Adeemsa)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tiers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tiers'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Manneen Murtii (4 Tiers)</span>
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-serif-legal font-bold text-white leading-tight">
            {activeTab === 'workflow'
              ? 'Adeemsa Hojii Manneen Murtii (Workflow & Chain of Custody)'
              : 'Sadarkaalee Manneen Murtii Naannoo Oromiyaa (4 Tiers)'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
            {activeTab === 'workflow'
              ? currentLang === 'am'
                ? 'መዝገብ ከመዝጋቢ ጀምሮ ወደ አስተባባሪ እና ለዳኛ እንዴት እንደሚተላለፍ እና በተረጋገጠ መለያ ብቻ መግባት እንደሚቻል ያሳያል።'
                : 'Galmeen ofisara seeraarraa ka\'ee hanga qindeessaatti, achirraas gara abbaa seeraatti akkamitti akka dabarfamu agarsiisa. Seensi sirna dhaddachaa hayyama Firebase/Court Auth mirkanaa\'een qofa gaggeeffama.'
              : 'Mana Murtii Aanaa, Mana Murtii Olaanaa, Mana Murtii Waliigalaa Oromiyaa fi Dhaddacha Ijibbaataa hunda hammateera.'}
          </p>
        </div>

        {activeTab === 'workflow' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30">1</div>
                <h4 className="text-xs font-bold text-white">Intake Desk (Ofisara Seeraa)</h4>
                <p className="text-[11px] text-slate-300">Galmeen haaraan banama, kaffaltiin taaksii Dambii Lakk. 08 mirkanaa'ee gara qindeessaatti dabarsama.</p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-500/30">2</div>
                <h4 className="text-xs font-bold text-white">Qindeessaa Galmee (KTAS)</h4>
                <p className="text-[11px] text-slate-300">Galmee dhufe qorachuun abbaa seeraa tokko ykn abbootii seeraa hedduu (Collaborative Bench) ramada.</p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-sm border border-purple-500/30">3</div>
                <h4 className="text-xs font-bold text-white">Abbaa Seeraa (Assigned Judge)</h4>
                <p className="text-[11px] text-slate-300">Galmee banee beellama qabata, kora dhaddachaa gaggeessee murtii qopheessee mallatteessa.</p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">4</div>
                <h4 className="text-xs font-bold text-white">Oliyyannoo & Ijibbaata</h4>
                <p className="text-[11px] text-slate-300">Murtii kenneetti mormii yoo qabaate abbaan dhimmaa ol'iyyaannoo mana murtii ol'aanaatti ykn ijibbaataatti dhiheessa.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Seensa Mirkanaa&apos;aa fi To&apos;annoo Adeemsichaa (Authenticated Judicial Access)</span>
                </h5>
                <p className="text-[11px] text-slate-300">
                  Hojjettoonni mana murtii (Judge, Registrar, Court Admin) akkuma hayyama dhaabbata isaanii Firebase Auth tiin mirkaneessaniin hojii dhaddachaa keessa seenu.
                </p>
              </div>
              {onNavigateToCourtWork && (
                <button
                  type="button"
                  onClick={onNavigateToCourtWork}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Gara Dhaddachaa (CourtWork)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tiers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {courtTiers.map((tier) => (
              <div key={tier.level} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30">
                    Sadarkaa {tier.level}
                  </span>
                  <span className="text-[11px] text-amber-400 font-medium">{tier.jurisdiction}</span>
                </div>
                <h4 className="text-sm font-bold text-white">
                  {tier.nameOm}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {tier.desc}
                </p>
                <div className="text-[11px] text-slate-400 font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  {tier.nameAm}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
