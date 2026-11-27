import React, { useState } from 'react';
import { X, Copy, Check, Share2, Mail, Send, MessageCircle, Globe, ExternalLink } from 'lucide-react';
import { Language } from '../i18n/translations';
import { CassationPrecedent } from '../data/cassationPrecedents';
import { buildPrecedentDeepLink } from '../services/shareUrl';

interface SharePrecedentModalProps {
  precedent: CassationPrecedent;
  currentLang: Language;
  onClose: () => void;
}

export const SharePrecedentModal: React.FC<SharePrecedentModalProps> = ({
  precedent,
  currentLang,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const deepLink = buildPrecedentDeepLink(precedent.id, precedent.fileNumber, currentLang);
  const isOromia = precedent.courtJurisdiction === 'oromia' || precedent.id.startsWith('oromia_');
  const courtLabel = isOromia
    ? currentLang === 'am'
      ? 'የኦሮሚያ ጠቅላይ ፍርድ ቤት ሰበር ችሎት'
      : currentLang === 'en'
      ? 'Oromia Supreme Court Cassation Division'
      : 'Mana Murtii Waliigalaa Oromiyaa Dhaddacha Ijibbaataa'
    : currentLang === 'am'
    ? 'የፌዴራል ጠቅላይ ፍርድ ቤት ሰበር ሰሚ ችሎት'
    : currentLang === 'en'
    ? 'Federal Supreme Court Cassation Division'
    : 'Mana Murtii Waliigalaa Federaalaa Dhaddacha Ijibbaataa';

  const partiesText = precedent.parties[currentLang] || precedent.parties.om || precedent.parties.en;
  const principleText = precedent.bindingPrinciple[currentLang] || precedent.bindingPrinciple.om || precedent.bindingPrinciple.en;

  const shareHeadline =
    currentLang === 'am'
      ? `የሰበር ውሳኔ መዝገብ ቁጥር ${precedent.fileNumber} (ቅጽ ${precedent.volume})`
      : currentLang === 'en'
      ? `Cassation Precedent File No. ${precedent.fileNumber} (Vol. ${precedent.volume})`
      : `Murtii Dhaddacha Ijoo Lakk. Galmee ${precedent.fileNumber} (Jildii ${precedent.volume})`;

  const shareBody = `${shareHeadline}\n${courtLabel}\n${partiesText}\n\n${principleText.slice(0, 260)}${principleText.length > 260 ? '...' : ''}\n\n${deepLink}`;

  const encodedUrl = encodeURIComponent(deepLink);
  const encodedText = encodeURIComponent(`${shareHeadline} — ${partiesText}\n${principleText.slice(0, 180)}...`);
  const encodedMailSubject = encodeURIComponent(`[SeeraAI] ${shareHeadline}`);
  const encodedMailBody = encodeURIComponent(shareBody);

  const labels = {
    om: {
      title: 'Murtii Dhaddacha Ijoo Qoodi (Deep Link Share)',
      subtitle: 'Linkiin kun kallattiin gara murtii kanaa fi odeeffannoo guutuu isaatti geessa.',
      linkLabel: 'Deep Link Murtii Kanaa:',
      copy: 'Linkii Waraabi',
      copied: 'Waraabameera!',
      nativeShare: 'Appii Birootiin Qoodi (Share)',
      channels: 'Karaa Miidiyaa Hawaasaa fi Imeelii Qoodi:',
      email: 'Imeeliin Ergi (Email)',
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      x: 'X (Twitter)',
      close: 'Cufi',
    },
    am: {
      title: 'የሰበር ውሳኔ ሊንክ ያጋሩ (Deep Link Share)',
      subtitle: 'ይህ ሊንክ ተቀባዩን በቀጥታ ወደዚህ ውሳኔ ይወስዳል።',
      linkLabel: 'የውሳኔው ቀጥታ ሊንክ (Deep Link):',
      copy: 'ሊንኩን ቅዳ',
      copied: 'ተቀድቷል!',
      nativeShare: 'በመሣሪያ አጋራ (Share)',
      channels: 'በማህበራዊ ሚዲያ ወይም በኢሜይል ያጋሩ:',
      email: 'በኢሜይል ላክ (Email)',
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      x: 'X (Twitter)',
      close: 'ዝጋ',
    },
    en: {
      title: 'Share Cassation Precedent (Deep Link)',
      subtitle: 'This deep link opens directly to this specific precedent with context.',
      linkLabel: 'Precedent Deep Link:',
      copy: 'Copy Link',
      copied: 'Copied!',
      nativeShare: 'Share via Device',
      channels: 'Share via Social Media or Email:',
      email: 'Send via Email',
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      x: 'X (Twitter)',
      close: 'Close',
    },
  }[currentLang];

  const handleCopy = async () => {
    setShareError(null);
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareError('Clipboard copy was blocked by browser permissions. Please copy the link manually.');
    }
  };

  const handleNativeShare = async () => {
    setShareError(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareHeadline,
          text: `${courtLabel} — ${partiesText}`,
          url: deepLink,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setShareError(err?.message || 'Unable to launch native share dialog.');
        }
      }
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-sky-500/40 shadow-2xl p-6 space-y-5 text-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          aria-label={labels.close}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 font-serif-legal">{labels.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{labels.subtitle}</p>
          </div>
        </div>

        {/* Precedent Preview */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[11px] font-mono font-bold">
              File {precedent.fileNumber}
            </span>
            <span className="text-[11px] text-amber-300 font-mono">
              Vol. {precedent.volume} • {precedent.yearEC} E.C.
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 line-clamp-2">{partiesText}</p>
          <p className="text-[11px] text-slate-400 line-clamp-2">{principleText}</p>
        </div>

        {/* Deep Link Copy Bar */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {labels.linkLabel}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={deepLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? labels.copied : labels.copy}</span>
            </button>
          </div>
        </div>

        {shareError && (
          <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2">
            {shareError}
          </p>
        )}

        {/* Native Share + Social & Email Channels */}
        <div className="space-y-2.5">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {labels.channels}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <a
              href={`mailto:?subject=${encodedMailSubject}&body=${encodedMailBody}`}
              className="px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs font-semibold text-amber-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>{labels.email}</span>
            </a>

            <a
              href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-xs font-semibold text-sky-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{labels.telegram}</span>
            </a>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${shareHeadline}\n${partiesText}\n${deepLink}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{labels.whatsapp}</span>
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-xs font-semibold text-blue-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>{labels.facebook}</span>
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-500 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{labels.x}</span>
            </a>

            {canNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="px-3 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-xs font-bold text-sky-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>{labels.nativeShare}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharePrecedentModal;
