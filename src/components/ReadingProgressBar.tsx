import React, { useState, useEffect } from 'react';
import { Language } from '../i18n/translations';
import { ArrowUp, ArrowDown, BookOpen, Clock, CheckCircle2, BookmarkCheck } from 'lucide-react';
import { useReadingMode } from '../context/ReadingModeContext';

interface ReadingProgressBarProps {
  currentLang?: Language;
  showPercent?: boolean;
  className?: string;
  targetRef?: React.RefObject<HTMLElement | null>;
  documentTitle?: string;
  documentId?: string;
  onMarkAsRead?: (docId: string, isRead: boolean) => void;
}

export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({
  currentLang = 'om',
  showPercent = true,
  className = '',
  targetRef,
  documentTitle,
  documentId = 'general_doc',
  onMarkAsRead,
}) => {
  const { isReadingMode } = useReadingMode();
  const [readingProgress, setReadingProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [estimatedMinutesLeft, setEstimatedMinutesLeft] = useState<number | null>(null);
  const [isRead, setIsRead] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`seera_doc_read_${documentId}`) === 'true';
  });

  useEffect(() => {
    const calculateProgress = () => {
      let scrollTop = 0;
      let scrollHeight = 0;
      let clientHeight = 0;

      if (targetRef && targetRef.current) {
        const el = targetRef.current;
        scrollTop = el.scrollTop;
        scrollHeight = el.scrollHeight;
        clientHeight = el.clientHeight;
      } else {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = document.documentElement.clientHeight;
      }

      const totalScrollableDistance = scrollHeight - clientHeight;

      if (totalScrollableDistance > 120) {
        const progress = Math.min(100, Math.max(0, (scrollTop / totalScrollableDistance) * 100));
        setReadingProgress(progress);
        setIsVisible(scrollTop > 20);

        // Estimate remaining reading time
        const remainingPixels = totalScrollableDistance - scrollTop;
        const estMinutes = Math.max(1, Math.ceil((remainingPixels / scrollHeight) * 5));
        setEstimatedMinutesLeft(estMinutes);

        // Auto mark as read if scrolled past 95%
        if (progress >= 95 && !isRead) {
          setIsRead(true);
          localStorage.setItem(`seera_doc_read_${documentId}`, 'true');
          if (onMarkAsRead) onMarkAsRead(documentId, true);
        }
      } else {
        setReadingProgress(0);
        setIsVisible(false);
        setEstimatedMinutesLeft(null);
      }
    };

    if (targetRef && targetRef.current) {
      const el = targetRef.current;
      el.addEventListener('scroll', calculateProgress, { passive: true });
      calculateProgress();
      return () => el.removeEventListener('scroll', calculateProgress);
    } else {
      window.addEventListener('scroll', calculateProgress, { passive: true });
      window.addEventListener('resize', calculateProgress, { passive: true });
      calculateProgress();
      return () => {
        window.removeEventListener('scroll', calculateProgress);
        window.removeEventListener('resize', calculateProgress);
      };
    }
  }, [targetRef, documentId, isRead, onMarkAsRead]);

  const toggleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isRead;
    setIsRead(nextState);
    try {
      localStorage.setItem(`seera_doc_read_${documentId}`, String(nextState));
      window.dispatchEvent(
        new CustomEvent('seera:show_toast', {
          detail: {
            message: nextState
              ? currentLang === 'om'
                ? '✓ Sanadni kun akka dubbifameettoofteera!'
                : currentLang === 'am'
                ? '✓ ሰነዱ እንደተነበበ ምልክት ተደርጎበታል!'
                : '✓ Document marked as read!'
              : currentLang === 'om'
              ? 'Mark as read haquameera.'
              : 'Mark as read removed.',
            emoji: nextState ? '📖' : '🔄',
          },
        })
      );
    } catch {
      // ignore
    }
    if (onMarkAsRead) onMarkAsRead(documentId, nextState);
  };

  const scrollToTop = () => {
    if (targetRef && targetRef.current) {
      targetRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (targetRef && targetRef.current) {
      targetRef.current.scrollTo({ top: targetRef.current.scrollHeight, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  };

  if (!isVisible && readingProgress === 0) {
    return null;
  }

  const getLabel = () => {
    if (currentLang === 'om') return 'Dubbisa';
    if (currentLang === 'am') return 'ንባብ';
    return 'Reading';
  };

  return (
    <div
      className={`sticky ${isReadingMode ? 'top-0' : 'top-16'} z-40 w-full transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
      } ${className}`}
    >
      {/* Background Track with Glass Blur */}
      <div className="w-full h-1.5 bg-slate-900/80 backdrop-blur-md relative overflow-hidden shadow-inner border-y border-slate-800/40">
        {/* Multi-tone Glowing Legal Gradient Progress Line */}
        <div
          role="progressbar"
          aria-valuenow={Math.round(readingProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${getLabel()} ${Math.round(readingProgress)}%`}
          className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-sky-400 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-[width] duration-150 ease-out rounded-r-full relative"
          style={{ width: `${readingProgress}%` }}
        >
          {/* Animated trailing pulse dot */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse" />
        </div>
      </div>

      {/* Floating Reading Badge, Mark as Read Toggle & Quick Controls */}
      {showPercent && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pointer-events-auto">
          <div className={`absolute right-6 ${isReadingMode ? 'top-14' : 'top-2.5'} flex items-center gap-2`}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-amber-500/40 text-xs font-mono text-amber-300 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200">
              <BookOpen className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-bold tracking-wide">
                {getLabel()}: {Math.round(readingProgress)}%
              </span>

              {documentTitle && (
                <span className="hidden sm:inline-block max-w-[130px] truncate text-[11px] text-slate-300 border-l border-slate-700 pl-2">
                  {documentTitle}
                </span>
              )}

              {estimatedMinutesLeft && (
                <span className="hidden md:flex items-center gap-1 text-[11px] text-emerald-400 border-l border-slate-700 pl-2 font-sans">
                  <Clock className="w-3 h-3" />
                  <span>~{estimatedMinutesLeft}m</span>
                </span>
              )}

              {/* Mark as Read Toggle Button */}
              <button
                type="button"
                onClick={toggleMarkAsRead}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  isRead
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={
                  currentLang === 'om'
                    ? 'Akka dubbifamee/xumurameetti mallatteessi (Mark as Read)'
                    : 'Mark as read / unread'
                }
              >
                <BookmarkCheck className={`w-3.5 h-3.5 ${isRead ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="hidden xs:inline">
                  {isRead
                    ? currentLang === 'om'
                      ? 'Dubbifameera'
                      : currentLang === 'am'
                      ? 'ተነቧል'
                      : 'Read'
                    : currentLang === 'om'
                    ? 'Mark as Read'
                    : currentLang === 'am'
                    ? 'እንደተነበበ ምልክት አድርግ'
                    : 'Mark Read'}
                </span>
              </button>

              {/* Quick Jump Action Buttons */}
              <div className="flex items-center gap-1 border-l border-slate-700 pl-2 ml-1">
                <button
                  type="button"
                  onClick={scrollToTop}
                  title={currentLang === 'om' ? 'Gara Gubbaatti' : 'Scroll to top'}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={scrollToBottom}
                  title={currentLang === 'om' ? 'Gara Jalaatti' : 'Scroll to bottom'}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingProgressBar;
