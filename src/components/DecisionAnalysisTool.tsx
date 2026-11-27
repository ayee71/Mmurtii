import React, { useState } from 'react';
import { Gavel, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Language } from '../i18n/translations';
import { getApiHeaders } from '../services/api';
import { getStoredAiOutputLanguage } from '../services/storage';

interface DecisionAnalysisToolProps {
  decisionContent: string;
  precedents: any[];
  currentLang: Language;
}

export const DecisionAnalysisTool: React.FC<DecisionAnalysisToolProps> = ({ decisionContent, precedents, currentLang: _currentLang }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeOutputLang = getStoredAiOutputLanguage();
      const response = await fetch('/api/analyze-decision', {
        method: 'POST',
        headers: await getApiHeaders(),
        body: JSON.stringify({
          documentContent: decisionContent,
          precedents,
          outputLanguage: activeOutputLang,
          language: activeOutputLang,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
      setAnalysis(data.analysis || '');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Decision analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg mt-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Gavel className="w-5 h-5 text-amber-500" />
        Decision Legal Accuracy Audit
      </h3>
      <button
        type="button"
        onClick={runAnalysis}
        disabled={loading}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Analyze Decision vs Precedents
      </button>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="mt-6 p-4 bg-slate-950 rounded-xl text-slate-300 text-sm whitespace-pre-wrap border border-slate-800">
          {analysis}
        </div>
      )}
    </div>
  );
};
