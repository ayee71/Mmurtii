import React from 'react';
import { Language, translations } from '../i18n/translations';
import { CassationPrecedent } from '../data/cassationPrecedents';
import { Network, ArrowRight } from 'lucide-react';

interface RelatedPrecedentsSectionProps {
  currentPrecedent: CassationPrecedent;
  allPrecedents: CassationPrecedent[];
  currentLang: Language;
  onSelectRuling: (precedent: CassationPrecedent) => void;
  onScrollToRulingCard: (fileNumber: string) => void;
}

export const RelatedPrecedentsSection: React.FC<RelatedPrecedentsSectionProps> = ({
  currentPrecedent,
  allPrecedents,
  currentLang,
  onSelectRuling,
  onScrollToRulingCard,
}) => {
  const t = translations[currentLang];

  // Compute related precedents based on shared category, jurisdiction, or matching statutory provisions / keywords
  const related = allPrecedents
    .filter((p) => p.id !== currentPrecedent.id)
    .map((p) => {
      let score = 0;
      // Same category match (+3)
      if (p.category === currentPrecedent.category) {
        score += 3;
      }
      // Same court jurisdiction (+2)
      if (p.courtJurisdiction === currentPrecedent.courtJurisdiction) {
        score += 2;
      }
      // Shared statutory provisions (+2 per match)
      const currentProvs = new Set(currentPrecedent.statutoryProvisions.map((s) => s.toLowerCase()));
      const sharedProvCount = p.statutoryProvisions.filter((s) => currentProvs.has(s.toLowerCase())).length;
      score += sharedProvCount * 2;

      // Shared keywords in legal issue or binding principle (+1)
      const currentText = `${currentPrecedent.legalIssue.om} ${currentPrecedent.bindingPrinciple.om}`.toLowerCase();
      const pText = `${p.legalIssue.om} ${p.bindingPrinciple.om}`.toLowerCase();
      const currentWords = currentText.split(/\s+/).filter((w) => w.length > 4);
      const matches = currentWords.filter((w) => pText.includes(w)).length;
      score += Math.min(matches, 4);

      return { precedent: p, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.precedent);

  if (related.length === 0) return null;

  return (
    <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3" data-testid="related-precedents-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
          <Network className="w-4 h-4 text-amber-400" />
          <span>Murtiiwwan Walitti Dhufeenya Qaban (Related Precedents)</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
          {related.length} Found
        </span>
      </div>

      <p className="text-[11px] text-slate-400">
        {currentLang === 'om'
          ? "Murtiiwwan kanaa gadii qajeeltoo seeraa, gosa dhimmaa ykn keeyyatoota wal fakkaatan qabu."
          : currentLang === 'am'
          ? "ከዚህ በታች የተዘረዘሩት ውሳኔዎች ተመሳሳይ የሕግ መርሆዎች፣ የጉዳይ ዓይነቶች ወይም አንቀጾች አሏቸው።"
          : "Related rulings sharing similar legal principles, statutory articles, or subject categories."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {related.map((rel) => {
          const title = rel.parties[currentLang] || rel.parties.om;
          const principle = rel.bindingPrinciple[currentLang] || rel.bindingPrinciple.om;
          return (
            <div
              key={rel.id}
              onClick={() => {
                onSelectRuling(rel);
                onScrollToRulingCard(rel.fileNumber);
              }}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400/60 transition-all cursor-pointer group space-y-1.5 flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold">
                  Lakk. Galmee {rel.fileNumber} (Vol. {rel.volume})
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-amber-400 transition-colors flex items-center gap-1 font-semibold">
                  <span>Ilaali</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              <div className="text-xs font-bold text-slate-200 line-clamp-1 group-hover:text-amber-200 transition-colors">
                {title}
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                {principle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
