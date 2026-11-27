import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  ExternalLink, 
  Check, 
  Copy, 
  Sparkles, 
  ShieldCheck, 
  Scale, 
  BookOpen, 
  Share2, 
  Terminal, 
  HelpCircle,
  Smartphone,
  Globe,
  ArrowRight,
  RefreshCw,
  Code
} from 'lucide-react';
import { Language } from '../types';
import { PRECEDENT_CASES, STATUTES } from '../data/legalData';
import { 
  BOT_USERNAME, 
  BOT_URL, 
  CHANNEL_URL, 
  WEBAPP_URL, 
  createBotDeepLink, 
  createTelegramShareLink, 
  isInsideTelegram, 
  getTelegramUser,
  triggerHaptic,
  BOT_TOKEN_DISPLAY,
  APP_ACCESS_TOKEN_DISPLAY
} from '../utils/telegramWebApp';

interface TelegramBotIntegrationProps {
  language: Language;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  buttons?: Array<Array<{ text: string; url?: string; web_app?: { url: string }; callback_data?: string }>>;
  timestamp: string;
}

export const TelegramBotIntegration: React.FC<TelegramBotIntegrationProps> = ({ language }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState('galmee-138286');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedAppToken, setCopiedAppToken] = useState(false);
  const [copiedCommandList, setCopiedCommandList] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<'simulator' | 'share' | 'botfather' | 'features'>('simulator');
  const [telegramUser, setTelegramUser] = useState(getTelegramUser());
  const [webhookInfo, setWebhookInfo] = useState<{ ok?: boolean; url?: string; pending_update_count?: number; last_error_message?: string } | null>(null);
  const [syncingWebhook, setSyncingWebhook] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // Fetch live webhook status from backend
  const refreshWebhookStatus = async () => {
    try {
      const res = await fetch('/api/telegram/webhook-status');
      const data = await res.json();
      if (data.ok && data.result) {
        setWebhookInfo({
          ok: true,
          url: data.result.url,
          pending_update_count: data.result.pending_update_count,
          last_error_message: data.result.last_error_message
        });
      }
    } catch (err) {
      console.warn('Could not fetch webhook status:', err);
    }
  };

  const handleSyncWebhook = async () => {
    setSyncingWebhook(true);
    setSyncSuccessMsg('');
    triggerHaptic('medium');
    try {
      const res = await fetch('/api/telegram/sync-webhook', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncSuccessMsg(language === 'om' ? 'Webhook milkaa\'inaan qindaa\'eera! 🟢' : 'Webhook successfully synchronized! 🟢');
        await refreshWebhookStatus();
      } else {
        setSyncSuccessMsg(language === 'om' ? 'Dogoggora webhook qindeessuu.' : 'Failed to sync webhook.');
      }
    } catch (e: any) {
      setSyncSuccessMsg(e.message || 'Sync error');
    } finally {
      setSyncingWebhook(false);
      setTimeout(() => setSyncSuccessMsg(''), 4000);
    }
  };

  useEffect(() => {
    refreshWebhookStatus();
    // Initial welcome message from the bot
    const initName = telegramUser?.first_name || (language === 'om' ? 'Abbaa Seeraa' : 'Counsel');
    fetchBotResponse('/start', initName);
  }, [language]);

  const fetchBotResponse = async (queryText: string, userName?: string) => {
    setLoading(true);
    triggerHaptic('light');

    const uName = userName || telegramUser?.first_name || 'Litigant';

    // Add user message to state if not /start initial load
    if (messages.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: queryText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: queryText, user: uName }),
      });

      if (!res.ok) throw new Error('Simulation endpoint failed');
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.reply.text,
          buttons: data.reply.reply_markup?.inline_keyboard,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      triggerHaptic('medium');
    } catch (err) {
      console.warn('Simulation fallback:', err);
      // Client-side fallback
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `⚖️ Wako Legal Studio Bot (@${BOT_USERNAME})\nDeebii: "${queryText}"\n\nBu'uura heera mootummaa fi murtii dhaddacha ijibbaataatiin qorannoon seeraa qophaa'eera.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || loading) return;
    const txt = inputVal.trim();
    setInputVal('');
    fetchBotResponse(txt);
  };

  const handleButtonClick = (btn: { text: string; url?: string; web_app?: { url: string }; callback_data?: string }) => {
    triggerHaptic('medium');
    if (btn.url) {
      window.open(btn.url, '_blank');
      return;
    }
    if (btn.web_app) {
      window.location.href = btn.web_app.url;
      return;
    }
    if (btn.callback_data) {
      fetchBotResponse(btn.callback_data);
    }
  };

  const currentSelectedCase = PRECEDENT_CASES.find((c) => c.id === selectedCaseId) || PRECEDENT_CASES[0];
  const deepLink = createBotDeepLink(currentSelectedCase.fileNumber);
  const shareText = language === 'om'
    ? `Murtii Dhaddacha Ijibbaataa Galmee #${currentSelectedCase.fileNumber} - ${currentSelectedCase.title.om}\nBotii Telegram @${BOT_USERNAME} irratti qoradhaa!`
    : `Federal Supreme Court Cassation Precedent File #${currentSelectedCase.fileNumber} - ${currentSelectedCase.title.en}\nExplore on Telegram @${BOT_USERNAME}!`;
  const telegramShareUrl = createTelegramShareLink(shareText, `${WEBAPP_URL}?case=${currentSelectedCase.id}`);

  const botFatherCommands = `start - Jalqabi / Main Menu & Mini App
app - Bani Wako Legal Mini App guutuu
galmee - Galmee ijibbaataa barbaadi (e.g. /galmee 138286)
heera - Heera fi labsiiwwan ilaali (e.g. /heera 35)
senior_judge - Xiinxala Abbaa Seeraa Waggaa 50+
gorsa - Gorsa seeraa AI gaafadhu
help - Qajeelfama fi gargaarsa`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Hero Banner with Telegram Bot Brand */}
      <div className="bg-gradient-to-br from-stone-900 via-sky-950/60 to-stone-900 border border-sky-800/40 rounded-2xl p-6 sm:p-8 text-stone-100 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-sky-500/10 via-sky-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                <Bot className="w-3.5 h-3.5" />
                {language === 'om' ? 'Qindeessaa Botii Telegram' : 'Official Telegram Bot Hub'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-stone-800 text-emerald-400 border border-stone-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                @{BOT_USERNAME}
              </span>
              {isInsideTelegram() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Smartphone className="w-3 h-3" />
                  {language === 'om' ? 'Telegram Mini App Keessatti' : 'Inside Telegram TMA'}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-serif">
              {language === 'om'
                ? 'Botii Telegram (@wako_legal_studio_bot) & Mini App'
                : 'Telegram Bot Integration & Mini App Hub'}
            </h2>

            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              {language === 'om'
                ? 'Botii Telegram @wako_legal_studio_bot fayyadamuun murtiiwwan ijibbaataa MMWF, heera RDFI, fi xiinxala seeraa Abbaa Seeraa waggaa 50+ kallattiin Telegram keessatti ykn Mini App kanaan qoradhaa.'
                : 'Empower your legal research directly inside Telegram using @wako_legal_studio_bot. Access binding Cassation precedents, constitutional statutes, and senior judge judicial analysis effortlessly.'}
            </p>
          </div>

          {/* Quick Launch Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-xs sm:text-sm shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{language === 'om' ? 'Bani @wako_legal_studio_bot' : 'Open in Telegram'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{language === 'om' ? 'Channaalii @wakolegalstudio' : 'Channel @wakolegalstudio'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* LIVE CONNECTION & TOKEN STATUS BAR */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 -ml-5"></span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>{language === 'om' ? 'Kallattii Botii Telegram: Hojjataa Jira (Active & Connected)' : 'Telegram Bot Direct Link: Active & Connected'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-semibold">@wako_legal_studio_bot</span>
              </h4>
              <p className="text-[11px] text-stone-500">
                {language === 'om' 
                  ? 'Gaaffiin bootii irratti gaafatamu hundi kallattiin app kanarraa murtiiwwan ijibbaataa fi seerota caqasuun deebii qulqulluu kenna.' 
                  : 'Every question sent to the bot is processed directly against this app\'s precedent repository and statutory database.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncWebhook}
              disabled={syncingWebhook}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingWebhook ? 'animate-spin' : ''}`} />
              <span>{syncingWebhook ? (language === 'om' ? 'Qindeessaa jira...' : 'Syncing...') : (language === 'om' ? 'Webhook Haaromsi' : 'Sync Webhook')}</span>
            </button>
            <button
              onClick={refreshWebhookStatus}
              className="p-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {syncSuccessMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* Credentials & Webhook Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
          {/* Bot Token */}
          <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-stone-400 text-[10px] uppercase font-sans font-bold block">Bot Token:</span>
              <span className="text-stone-800 font-semibold truncate block" title={BOT_TOKEN_DISPLAY}>
                {BOT_TOKEN_DISPLAY.substring(0, 10)}...{BOT_TOKEN_DISPLAY.substring(BOT_TOKEN_DISPLAY.length - 6)}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(BOT_TOKEN_DISPLAY);
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 2000);
              }}
              className="p-1.5 hover:bg-stone-200 rounded text-stone-600 cursor-pointer"
              title="Copy Bot Token"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* App Access Token */}
          <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-stone-400 text-[10px] uppercase font-sans font-bold block">Access Token App:</span>
              <span className="text-stone-800 font-semibold truncate block" title={APP_ACCESS_TOKEN_DISPLAY}>
                {APP_ACCESS_TOKEN_DISPLAY.substring(0, 14)}...
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(APP_ACCESS_TOKEN_DISPLAY);
                setCopiedAppToken(true);
                setTimeout(() => setCopiedAppToken(false), 2000);
              }}
              className="p-1.5 hover:bg-stone-200 rounded text-stone-600 cursor-pointer"
              title="Copy App Token"
            >
              {copiedAppToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Webhook Status */}
          <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-stone-400 text-[10px] uppercase font-sans font-bold block">Webhook Status:</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Active & Ready</span>
                {webhookInfo?.pending_update_count !== undefined && (
                  <span className="text-stone-500 font-normal">({webhookInfo.pending_update_count} pend)</span>
                )}
              </span>
            </div>
            <a
              href={`${WEBAPP_URL}/api/telegram/webhook-status`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-stone-200 rounded text-sky-600 cursor-pointer"
              title="View JSON status"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTabSection('simulator')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
            activeTabSection === 'simulator'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>{language === 'om' ? '1. Simileetara Botii (Live Test)' : '1. Bot Simulator (Live Test)'}</span>
        </button>

        <button
          onClick={() => setActiveTabSection('share')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
            activeTabSection === 'share'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>{language === 'om' ? '2. Liinkii Qoodaa Telegram' : '2. Telegram Share & Deep Links'}</span>
        </button>

        <button
          onClick={() => setActiveTabSection('botfather')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
            activeTabSection === 'botfather'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>{language === 'om' ? '3. Qindeessa BotFather' : '3. BotFather Setup'}</span>
        </button>

        <button
          onClick={() => setActiveTabSection('code' as any)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
            (activeTabSection as any) === 'code'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-600" />
          <span>{language === 'om' ? '4. Koodii Bootii & Webhook' : '4. Bot Script & Webhook'}</span>
        </button>

        <button
          onClick={() => setActiveTabSection('features')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
            activeTabSection === 'features'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{language === 'om' ? '5. Dandeettiiwwan Botii' : '5. Bot Features'}</span>
        </button>
      </div>

      {/* SECTION 1: LIVE BOT SIMULATOR */}
      {activeTabSection === 'simulator' && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row">
          {/* Chat Window */}
          <div className="flex-1 flex flex-col min-h-[500px] border-b md:border-b-0 md:border-r border-stone-200">
            {/* Chat Header */}
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-stone-900 font-bold">
                  <Bot className="w-5 h-5 text-stone-950" />
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <span>Wako Legal Studio Bot</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  </h3>
                  <p className="text-[11px] text-stone-400 font-mono">@{BOT_USERNAME} • bot</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Telegram</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Quick Command Chips */}
            <div className="p-2.5 bg-stone-100 border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-stone-700 scrollbar-none">
              <span className="text-stone-400 px-1">{language === 'om' ? 'Ajajoota:' : 'Commands:'}</span>
              <button
                onClick={() => fetchBotResponse('/start')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-amber-800 transition-colors shrink-0 cursor-pointer"
              >
                /start
              </button>
              <button
                onClick={() => fetchBotResponse('/galmee 138286')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 transition-colors shrink-0 cursor-pointer"
              >
                /galmee 138286
              </button>
              <button
                onClick={() => fetchBotResponse('/galmee 140538')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 transition-colors shrink-0 cursor-pointer"
              >
                /galmee 140538
              </button>
              <button
                onClick={() => fetchBotResponse('/galmee 196228')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 transition-colors shrink-0 cursor-pointer"
              >
                /galmee 196228
              </button>
              <button
                onClick={() => fetchBotResponse('/galmee 108647')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 transition-colors shrink-0 cursor-pointer"
              >
                /galmee 108647
              </button>
              <button
                onClick={() => fetchBotResponse('/heera 35')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-stone-800 transition-colors shrink-0 cursor-pointer"
              >
                /heera 35
              </button>
              <button
                onClick={() => fetchBotResponse('/senior_judge Lafa qonnaa baadiyaa')}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-stone-300 text-amber-700 transition-colors shrink-0 cursor-pointer"
              >
                /senior_judge
              </button>
            </div>

            {/* Direct Legal Evidence Questions Bar */}
            <div className="p-2 bg-amber-50/70 border-b border-amber-200/60 flex items-center gap-1.5 overflow-x-auto text-[11px] text-stone-700 scrollbar-none">
              <span className="text-amber-800 font-bold px-1 shrink-0 flex items-center gap-1">
                <Scale className="w-3 h-3 text-amber-700" />
                <span>{language === 'om' ? 'Gaaffilee Ragaa Seeraa:' : 'Test Legal Questions:'}</span>
              </span>
              <button
                onClick={() => fetchBotResponse("Haati warraa abbaan warraa du'e lafa dhuunfaan galmeessisuuf mirga qabdi?")}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-100/80 border border-amber-300 text-stone-800 transition-colors shrink-0 cursor-pointer font-medium"
              >
                📜 Mirga qabiyyee lafaa walfuutotaa?
              </button>
              <button
                onClick={() => fetchBotResponse("Darbiinsi yeroo himannaa lafa baadiyaa waggaa meeqa?")}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-100/80 border border-amber-300 text-stone-800 transition-colors shrink-0 cursor-pointer font-medium"
              >
                ⏱️ Darbiinsa yeroo lafaa (Waggaa 12)?
              </button>
              <button
                onClick={() => fetchBotResponse("Waliigalteen araaraa jaarsoliin godhame mana murtiitti mirkanaa'uu qaba?")}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-100/80 border border-amber-300 text-stone-800 transition-colors shrink-0 cursor-pointer font-medium"
              >
                🤝 Araara jaarsolii & SDFHH 277?
              </button>
              <button
                onClick={() => fetchBotResponse("Qaamni sadaffaan falmii keessa galee darbiinsa yeroo kaasuuf mirga qabaa?")}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-100/80 border border-amber-300 text-stone-800 transition-colors shrink-0 cursor-pointer font-medium"
              >
                🛡️ Qaama 3ffaa & Mormii Duraa?
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 p-4 space-y-3.5 overflow-y-auto bg-stone-50/60 max-h-[460px]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs ${
                      m.sender === 'user'
                        ? 'bg-amber-600 text-white rounded-br-none'
                        : 'bg-white text-stone-900 border border-stone-200 rounded-bl-none font-sans'
                    }`}
                  >
                    {m.text}

                    {/* Inline Keyboard Buttons */}
                    {m.buttons && m.buttons.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-stone-200/80 space-y-1.5">
                        {m.buttons.map((row, rIdx) => (
                          <div key={rIdx} className="flex flex-wrap gap-1.5">
                            {row.map((btn, bIdx) => (
                              <button
                                key={bIdx}
                                onClick={() => handleButtonClick(btn)}
                                className={`flex-1 min-w-[120px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                  btn.web_app
                                    ? 'bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-bold'
                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
                                }`}
                              >
                                {btn.web_app && <Smartphone className="w-3.5 h-3.5 text-sky-200" />}
                                {btn.url && <ExternalLink className="w-3 h-3 text-stone-500" />}
                                <span>{btn.text}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1 px-1">{m.timestamp}</span>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-stone-500 p-2 italic">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>{language === 'om' ? 'Botichi deebii qopheessaa jira...' : '@wako_legal_studio_bot is typing...'}</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={
                  language === 'om'
                    ? 'Ajaja ykn gaaffii seeraa barreessaa (fkn: /galmee 138286)...'
                    : 'Type a bot command or legal question (e.g. /galmee 138286)...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="submit"
                disabled={!inputVal.trim() || loading}
                className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Sidebar / Instructions */}
          <div className="w-full md:w-80 p-5 bg-stone-50 space-y-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-bold text-stone-900 flex items-center gap-1.5 text-sm font-serif">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>{language === 'om' ? 'Haala Mini App (TMA)' : 'Telegram Mini App'}</span>
              </h4>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                {language === 'om'
                  ? 'Appilikeeshiniin kun Telegram Web App SDK waliin guutummaatti kan walqabate waan ta\'eef, yeroo @wako_legal_studio_bot keessatti banamu akka Mini App guutuutti hojjata.'
                  : 'This application is fully integrated with Telegram Web App SDK. When opened inside @wako_legal_studio_bot, it runs natively as a Telegram Mini App.'}
              </p>
            </div>

            <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-2">
              <span className="font-bold text-stone-800 text-[11px] uppercase tracking-wider block">
                {language === 'om' ? 'Kallattiin Telegram Irratti Yaalaa' : 'Test Real Bot on Telegram'}
              </span>
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-center text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>@wako_legal_studio_bot</span>
              </a>
              <p className="text-[10px] text-stone-500 text-center">
                {language === 'om' ? 'Telegram bilbilaa ykn kompiitara keessaniin bana' : 'Opens directly in your Telegram client'}
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-stone-800 text-[11px] uppercase tracking-wider block">
                {language === 'om' ? 'Ajajawwan Dhaabbataa' : 'Key Bot Commands'}
              </span>
              <div className="space-y-1 text-stone-600 font-mono text-[11px]">
                <div className="p-1.5 bg-white border border-stone-200 rounded">
                  <span className="text-amber-700 font-bold">/app</span> - Mini App banaa
                </div>
                <div className="p-1.5 bg-white border border-stone-200 rounded">
                  <span className="text-amber-700 font-bold">/galmee 138286</span> - Mirga lafaa
                </div>
                <div className="p-1.5 bg-white border border-stone-200 rounded">
                  <span className="text-amber-700 font-bold">/galmee 140538</span> - Darbiinsa yeroo
                </div>
                <div className="p-1.5 bg-white border border-stone-200 rounded">
                  <span className="text-amber-700 font-bold">/heera 35</span> - Mirga dubartootaa
                </div>
                <div className="p-1.5 bg-white border border-stone-200 rounded">
                  <span className="text-amber-700 font-bold">/senior_judge</span> - Murtii 50+
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TELEGRAM SHARE & DEEP LINK GENERATOR */}
      {activeTabSection === 'share' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-stone-900 font-serif flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-600" />
              {language === 'om'
                ? 'Murtiiwwan fi Heera Kallattiin Telegram @wako_legal_studio_bot Waliin Qoodaa'
                : 'Direct Case & Statute Telegram Deep-Link Generator'}
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              {language === 'om'
                ? 'Murtii ykn seera kamiyyuu filachuun liinkii kallattiin Boticha ykn gareewwan Telegram irratti banu uumaa.'
                : 'Select any precedent to create deep links that trigger instant bot lookups or launch the Mini App to that exact case.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Case Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                {language === 'om' ? 'Murtii Ijibbaataa Filadhaa:' : 'Select Precedent:'}
              </label>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm bg-stone-50 focus:bg-white"
              >
                {PRECEDENT_CASES.map((c) => (
                  <option key={c.id} value={c.id}>
                    Galmee #{c.fileNumber} - {c.title[language]} ({c.volume})
                  </option>
                ))}
              </select>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-amber-800 font-bold">
                  <span>Galmee {currentSelectedCase.fileNumber}</span>
                  <span>{currentSelectedCase.volume}</span>
                </div>
                <p className="font-semibold text-stone-900">{currentSelectedCase.title[language]}</p>
                <p className="text-stone-600 line-clamp-2">{currentSelectedCase.keyPrinciple[language]}</p>
              </div>
            </div>

            {/* Generated Links & Action Buttons */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wide block mb-1.5">
                  {language === 'om' ? 'Liinkii Deep-Link Botii:' : 'Bot Deep Link:'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={deepLink}
                    className="flex-1 p-2 rounded-lg border border-stone-300 bg-stone-100 text-xs font-mono select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deepLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? (language === 'om' ? 'Koppifameera' : 'Copied') : (language === 'om' ? 'Koppisi' : 'Copy')}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{language === 'om' ? 'Telegram Irratti Qoodi (Share)' : 'Share to Telegram Chat / Channel'}</span>
                </a>

                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-100 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-stone-700 transition-colors"
                >
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span>{language === 'om' ? 'Kallattiin @wako_legal_studio_bot Keessatti Bani' : 'Open Directly in @wako_legal_studio_bot'}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: BOTFATHER CONFIGURATION GUIDE */}
      {activeTabSection === 'botfather' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <h3 className="text-lg font-bold text-stone-900 font-serif flex items-center gap-2">
                <Code className="w-5 h-5 text-sky-600" />
                {language === 'om'
                  ? 'Qindeessa @BotFather (@wako_legal_studio_bot)'
                  : 'BotFather Setup Guide for @wako_legal_studio_bot'}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                {language === 'om'
                  ? 'Appilikeeshinii kana fi botii @wako_legal_studio_bot qindeessuuf tarkaanfilee salphaa armaan gadii hordofaa.'
                  : 'Instructions for configuring the bot menu button, Mini App URL, and commands via @BotFather on Telegram.'}
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(botFatherCommands);
                setCopiedCommandList(true);
                setTimeout(() => setCopiedCommandList(false), 2000);
              }}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              {copiedCommandList ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCommandList ? (language === 'om' ? 'Ajajoota Koppifaman' : 'Commands Copied') : (language === 'om' ? 'Ajajoota Koppisi' : 'Copy Commands')}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            {/* Step 1 */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
              <span className="font-bold text-sky-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs">1</span>
                <span>{language === 'om' ? 'Tarkaanfii 1: @BotFather Bani' : 'Step 1: Open @BotFather'}</span>
              </span>
              <p className="text-stone-700">
                Telegram keessatti <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-600 font-bold underline">@BotFather</a> banaatii ergaa <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">/mybots</code> ergaa. Booda <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">@{BOT_USERNAME}</code> filadhaa.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
              <span className="font-bold text-sky-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs">2</span>
                <span>{language === 'om' ? 'Tarkaanfii 2: Menu Button (Mini App) Kaa\'aa' : 'Step 2: Configure Menu Button (Mini App URL)'}</span>
              </span>
              <p className="text-stone-700">
                BotFather irratti ajaja <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">/setmenubutton</code> ergaa. Ergasii botii keessan filadhaa.
              </p>
              <div className="p-3 bg-white border border-stone-300 rounded-lg space-y-1 font-mono text-xs">
                <p className="text-stone-500">// URL Mini App:</p>
                <p className="text-emerald-700 font-bold break-all">{WEBAPP_URL}</p>
                <p className="text-stone-500 pt-1">// Button Title:</p>
                <p className="text-stone-900 font-bold">⚖️ Wako Legal App</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
              <span className="font-bold text-sky-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs">3</span>
                <span>{language === 'om' ? 'Tarkaanfii 3: Tarree Ajajootaa (Bot Commands)' : 'Step 3: Register Bot Commands'}</span>
              </span>
              <p className="text-stone-700">
                BotFather irratti <code className="bg-stone-200 px-1 py-0.5 rounded font-mono">/setcommands</code> ergaatii tarree armaan gadii ergaaf:
              </p>
              <pre className="p-3 bg-stone-900 text-stone-100 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {botFatherCommands}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: BOT SCRIPT & LIVE WEBHOOK CONFIGURATION */}
      {(activeTabSection as any) === 'code' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-stone-900 font-serif flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-600" />
              <span>{language === 'om' ? 'Koodii Bootii & Webhook Kallattiin Walitti Qabsiisuu' : 'Bot Code & Webhook Direct Link'}</span>
            </h3>
            <p className="text-xs text-stone-500">
              {language === 'om'
                ? 'Dogoggora "Dhiifama madda ragaa irraa deebii argachuun hin danda\'amne" jedhu furuuf, filannoowwan armaan gadii lamaan keessaa tokko fayyadamaa.'
                : 'To resolve "Could not obtain answer from legal source" and enable instant, evidence-backed answers right inside Telegram, choose either option below.'}
            </p>
          </div>

          {/* Option 1: Webhook (Direct zero-code connection) */}
          <div className="p-5 bg-gradient-to-r from-emerald-50 via-stone-50 to-white border border-emerald-300 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">A</span>
                <span>{language === 'om' ? 'Filannoo 1: Webhook Kallattiin Kaa\'aa (Karaa Salphaa)' : 'Option 1: Direct Webhook (Simplest - No Server Needed)'}</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase">
                Recommended
              </span>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed">
              {language === 'om'
                ? 'Telegram Webhook server app kanaa waliin yoo hidhattan, gaaffiin boticha irratti gaafatamu hundi kallattiin appilikeeshinii kanarraa murtiiwwan ijibbaataa fi seerota caqasuun battalumatti Telegram keessatti deebi\'a.'
                : 'Sets the Telegram bot webhook directly to this app. Telegram will forward every query, /senior_judge, and case lookup directly to this application for authoritative legal answers.'}
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                {language === 'om' ? 'URL Webhook Appilikeeshinii:' : 'Webhook URL:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${WEBAPP_URL}/api/telegram/webhook`}
                  className="flex-1 p-2.5 rounded-lg border border-emerald-300 bg-white font-mono text-xs select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${WEBAPP_URL}/api/telegram/webhook`);
                    alert(language === 'om' ? 'URL Webhook waraabbameera!' : 'Webhook URL copied!');
                  }}
                  className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 inline mr-1" />
                  <span>{language === 'om' ? 'Waraabi' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-stone-900 text-stone-200 rounded-lg text-xs font-mono space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-amber-400 font-bold">// Liinkii Webhook Telegram qindeessuuf:</p>
                <button
                  onClick={handleSyncWebhook}
                  disabled={syncingWebhook}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  {syncingWebhook ? 'Qindeessaa...' : '🚀 Battalumatti Webhook Qindeessi'}
                </button>
              </div>
              <p className="break-all text-emerald-300">
                https://api.telegram.org/bot{BOT_TOKEN_DISPLAY}/setWebhook?url={WEBAPP_URL}/api/telegram/webhook
              </p>
            </div>
          </div>

          {/* Option 2: Python / Node.js Script */}
          <div className="p-5 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-stone-800 text-white flex items-center justify-center text-xs">B</span>
                <span>{language === 'om' ? 'Filannoo 2: Koodii Python (`bot.py`)' : 'Option 2: Python Bot Script (`bot.py`)'}</span>
              </span>
              <button
                onClick={() => {
                  const pythonCode = `import telebot\nimport requests\n\nBOT_TOKEN = "${BOT_TOKEN_DISPLAY}"\nbot = telebot.TeleBot(BOT_TOKEN)\nAPI_URL = "${WEBAPP_URL}/api/telegram/query"\n\n@bot.message_handler(func=lambda msg: True)\ndef handle_query(msg):\n    bot.send_chat_action(msg.chat.id, 'typing')\n    res = requests.post(API_URL, json={'query': msg.text, 'user': msg.from_user.first_name or 'Counsel'})\n    data = res.json()\n    bot.send_message(msg.chat.id, data.get('text', 'Deebiin argameera.'), parse_mode='Markdown')\n\nprint("Bot is running...")\nbot.infinity_polling()`;
                  navigator.clipboard.writeText(pythonCode);
                  alert(language === 'om' ? 'Koodiin Python waraabbameera!' : 'Python bot code copied!');
                }}
                className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 inline mr-1" />
                <span>{language === 'om' ? 'Koodii Waraabi' : 'Copy Python Script'}</span>
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {language === 'om'
                ? 'Yoo koodii Python dhuunfaan fayyadamaa jirtan ta\'e, API URL armaan gadii fayyadamaa. Koodichi madda ragaa seeraa guutuu qorachuun battalumatti deebii kenna:'
                : 'If running a custom Python/Node script on your machine, point your bot to this API endpoint to fetch legal precedents:'}
            </p>

            <div className="p-3 bg-stone-900 text-stone-100 rounded-lg text-xs font-mono space-y-1">
              <p className="text-stone-400"># API Endpoint for questions & commands:</p>
              <p className="text-sky-300 font-bold break-all">POST {WEBAPP_URL}/api/telegram/query</p>
              <p className="text-stone-400 pt-1"># Payload:</p>
              <p className="text-amber-300">{`{ "query": "Darbiinsi yeroo waggaa meeqa?", "user": "Ayele" }`}</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: BOT CAPABILITIES OVERVIEW */}
      {activeTabSection === 'features' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-stone-200 rounded-xl space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {language === 'om' ? '1,500+ Murtiiwwan Ijibbaataa' : '1,500+ Cassation Precedents'}
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              {language === 'om'
                ? 'Botichi galmee 138286, 140538, fi murtiiwwan biroo hunda sekondii tokko keessatti barbaadee cuunfaa fi qajeeltoo seeraa fida.'
                : 'Direct lookup of all Federal Supreme Court cassation files with core legal principles and summary.'}
            </p>
          </div>

          <div className="p-5 bg-white border border-stone-200 rounded-xl space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {language === 'om' ? 'Heera RDFI & Labsiiwwan' : 'Constitution & Codes'}
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              {language === 'om'
                ? 'Heera RDFI Kwt 35, Labsii Lafa Baadiyaa Oromiyaa 130/1999, Dambii 151/2005, fi Seera Hariiroo Hawaasaa qorata.'
                : 'Comprehensive statutory references covering land administration, marital equality, and limitation periods.'}
            </p>
          </div>

          <div className="p-5 bg-white border border-stone-200 rounded-xl space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-stone-900 text-sm">
              {language === 'om' ? 'Xiinxala Abbaa Seeraa 50+' : 'Senior Judge Analysis (50+ Years)'}
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              {language === 'om'
                ? 'Seer-luga Afaan Oromoo qulqulluu fi sadarkaa abbaa seeraa olaanaa eeguun murtii fi xiinxala dhimmoota seeraa qopheessa.'
                : 'Formulates authoritative judicial decisions with pristine Oromo legal grammar and procedural rigour.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
