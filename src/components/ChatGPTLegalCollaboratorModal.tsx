import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Copy,
  Check,
  Send,
  ShieldCheck,
  RefreshCw,
  X,
  Layers,
  Database,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import {
  runSeeraAIWorkflow,
  getSeeraAIWorkflowStatus,
  sendWorkflowSummaryToTelegram,
  SeeraAIWorkflowEngineStatus,
} from '../services/seeraAiWorkflowClient';
import { AiOutputLanguageSelector } from './AiOutputLanguageSelector';
import { AiOutputLanguage } from '../shared/aiOutputLanguage';
import { getStoredAiOutputLanguage } from '../services/storage';

interface ChatGPTLegalCollaboratorModalProps {
  currentLang: Language;
  documentTitle?: string;
  documentText?: string;
  onClose: () => void;
}

export const ChatGPTLegalCollaboratorModal: React.FC<ChatGPTLegalCollaboratorModalProps> = ({
  currentLang,
  documentTitle = 'Sanada Seeraa / Legal Document',
  documentText = '',
  onClose,
}) => {
  const isOm = currentLang === 'om';

  const [customPrompt, setCustomPrompt] = useState<string>(
    isOm
      ? `Akka ogeessa seeraa Itoophiyaa fi Oromiyaatti, sanada/galmee seeraa koo qorachuun keeyyattoota labsii, mirgoota qaamolee, fi hanqinaalee seeraa adda baasi.`
      : `As an expert in Ethiopian Federal and Oromia law, perform an exhaustive legal analysis of this court document.`
  );

  const [chatGptResponse, setChatGptResponse] = useState<string>('');
  const [geminiResponse, setGeminiResponse] = useState<string>('');
  const [synthesisResponse, setSynthesisResponse] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'collaborate' | 'compare' | 'workflow'>('collaborate');
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [saveToFirebase, setSaveToFirebase] = useState(true);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramNotice, setTelegramNotice] = useState<string | null>(null);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [engineStatus, setEngineStatus] = useState<SeeraAIWorkflowEngineStatus | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<AiOutputLanguage>(() => getStoredAiOutputLanguage());

  useEffect(() => {
    getSeeraAIWorkflowStatus()
      .then(setEngineStatus)
      .catch(() => {});
  }, []);

  const runDualAnalysis = async () => {
    setLoading(true);
    setSaveNotice(null);
    setTelegramNotice(null);
    try {
      const wf = await runSeeraAIWorkflow({
        prompt: customPrompt,
        context: `DOCUMENT (${documentTitle}):\n${documentText.slice(0, 12000)}`,
        mode: 'dual',
        outputLanguage,
        saveToFirebase,
      });

      setChatGptResponse(wf.openaiResponse || 'Analysis complete.');
      setGeminiResponse(wf.geminiResponse || '');
      setSynthesisResponse(wf.synthesis || '');

      if (wf.savedToFirebase && wf.analysisId) {
        setSaveNotice(
          isOm
            ? `Firebase (seeraai_analyses) irratti olkaa'ameera (#${wf.analysisId})`
            : `Saved to Firebase (#${wf.analysisId})`
        );
      } else if (wf.firebaseNotice) {
        setSaveNotice(wf.firebaseNotice);
      }
    } catch (e: any) {
      console.error('Dual AI Legal Collaboration error:', e);
      setChatGptResponse(
        isOm
          ? `Xiinxalli hin milkoofne: ${e?.message || 'Dogoggora tajaajilaa'}`
          : `Analysis error: ${e?.message || 'Service unavailable'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const fullExportPrompt = `You are a Senior Legal Advocate & Ethiopian Statutory Expert. Analyze the following court case document and provide a structured legal opinion citing relevant Proclamations and Cassation Precedents:

DOCUMENT TITLE: ${documentTitle}
${documentText ? `DOCUMENT CONTENT:\n${documentText}` : ''}

USER SPECIFIC QUERY:
${customPrompt}`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(fullExportPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(synthesisResponse || chatGptResponse || geminiResponse);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleDispatchTelegram = async () => {
    if (!telegramChatId.trim()) return;
    const text = synthesisResponse || geminiResponse || chatGptResponse;
    if (!text) return;
    setSendingTelegram(true);
    setTelegramNotice(null);
    try {
      await sendWorkflowSummaryToTelegram(telegramChatId.trim(), text);
      setTelegramNotice(isOm ? 'Telegram irratti milkaa\'inaan ergameera!' : 'Dispatched to Telegram!');
    } catch (err: any) {
      setTelegramNotice(err?.message || 'Telegram erguun hin milkoofne.');
    } finally {
      setSendingTelegram(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xl shadow-inner">
              ⚖️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider font-mono">
                  ChatGPT + Gemini 4 Hydrogen
                </span>
                <span className="text-xs text-slate-400 font-mono">SEERAAI Dual Workflow</span>
              </div>
              <h3 className="text-lg font-bold text-white font-serif-legal">
                {isOm ? 'Qorannoo Seeraa Dual-AI (Gemini + ChatGPT)' : 'Dual-Model Legal Analysis & Collaboration'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('collaborate')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'collaborate'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>{isOm ? 'Xiinxala Dual-AI' : 'Dual Analysis'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'compare'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isOm ? 'Wal-Bira Qabuu (Gemini vs ChatGPT)' : 'Gemini vs ChatGPT Comparison'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'workflow'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{isOm ? 'Firebase & Telegram' : 'Firebase & Telegram'}</span>
          </button>
        </div>

        {/* Tab 1: Dual Collaboration */}
        {activeTab === 'collaborate' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>{isOm ? 'Gaaffii ykn Ibsa Qorannoo Seeraa Galchaa:' : 'Enter Specific Legal Query / Focus Area:'}</span>
              </label>

              <AiOutputLanguageSelector
                currentLang={currentLang}
                value={outputLanguage}
                onChange={setOutputLanguage}
                variant="compact"
              />

              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter query for Dual AI legal evaluation..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 min-h-[70px]"
              />

              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={runDualAnalysis}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                    <span>
                      {loading
                        ? isOm ? 'Gemini & GPT-4o Xiinxalaa Jira...' : 'Analyzing...'
                        : isOm ? 'Dual AI (Gemini + GPT-4o) n Qoradhu' : 'Run Dual AI Analysis'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{copiedPrompt ? 'Copied Prompt!' : 'Copy Prompt'}</span>
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToFirebase}
                    onChange={(e) => setSaveToFirebase(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>{isOm ? 'Firebase irratti olkaa\'i' : 'Save to Firebase'}</span>
                </label>
              </div>
            </div>

            {saveNotice && (
              <div className="text-xs px-4 py-2 rounded-xl bg-emerald-950/50 border border-emerald-700/40 text-emerald-300">
                ✓ {saveNotice}
              </div>
            )}

            {(synthesisResponse || chatGptResponse) && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>
                      {synthesisResponse
                        ? 'SEERAAI Unified Synthesis (Wal-fakkoommii • Gargar-ba\'iinsa)'
                        : 'ChatGPT (OpenAI GPT-4o) Legal Audit Result:'}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    className="text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied!' : 'Copy Analysis'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap max-h-[320px] overflow-y-auto pr-1">
                  {synthesisResponse || chatGptResponse}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Gemini vs ChatGPT Dual-Model Side-by-Side Comparison */}
        {activeTab === 'compare' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Google Gemini 4 Hydrogen</span>
                </span>
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-wrap max-h-[320px] overflow-y-auto leading-relaxed">
                {geminiResponse || (isOm ? 'Xiinxala Gemini agarsiisuuf "Dual AI n Qoradhu" tuqaa.' : 'Run analysis to display Gemini engine evaluation.')}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>ChatGPT (OpenAI GPT-4o) Engine</span>
                </span>
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-wrap max-h-[320px] overflow-y-auto leading-relaxed">
                {chatGptResponse || (isOm ? 'Xiinxala ChatGPT agarsiisuuf "Dual AI n Qoradhu" tuqaa.' : 'Run analysis to display ChatGPT engine evaluation.')}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Server Engine Status & Telegram Dispatch */}
        {activeTab === 'workflow' && (
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Server Engine Status & Telegram Dispatch</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {isOm
                  ? 'Furtuuwwan API (GEMINI_API_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN) Server-side Secrets keessatti nageenyaan eegamu.'
                  : 'All AI and Telegram credentials are managed securely server-side in Settings > Secrets.'}
              </p>
            </div>

            {engineStatus && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Gemini ({engineStatus.geminiModel})</span>
                  <span className={engineStatus.geminiAvailable ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {engineStatus.geminiAvailable ? 'Ready' : 'Not Set'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">OpenAI ({engineStatus.openaiModel})</span>
                  <span className={engineStatus.openaiAvailable ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {engineStatus.openaiAvailable ? 'Ready' : 'Optional'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Telegram Bot</span>
                  <span className={engineStatus.telegramAvailable ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {engineStatus.telegramAvailable ? 'Ready' : 'Optional'}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300 block">
                {isOm ? 'Cuunfaa gara Telegram Chat ID Ergi:' : 'Send Analysis Summary to Telegram Chat ID:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="123456789 or @channel_handle"
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-sky-300 font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  disabled={sendingTelegram || !telegramChatId.trim() || (!synthesisResponse && !geminiResponse && !chatGptResponse)}
                  onClick={handleDispatchTelegram}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingTelegram ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
              {telegramNotice && (
                <p className="text-xs text-sky-300 pt-1">{telegramNotice}</p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
          >
            {isOm ? 'Cufi' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
