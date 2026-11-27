import React from 'react';
import { Language } from '../i18n/translations';
import seeraaiGadaaScalesLogo from '../assets/images/seeraai_gadaa_scales_logo_1795608824385.jpg';
import gurbichaCourtLogo from '../assets/images/gurbicha_court_logo.png';
import { SeeraGadaaScalesVector } from './SeeraGadaaScalesVector';

export interface SeeraAILogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  currentLang?: Language;
  onClick?: () => void;
  courtId?: string; // e.g. 'gurbicha'
  variant?: 'vector' | 'image' | 'hybrid';
}

export const SeeraAILogo: React.FC<SeeraAILogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  currentLang = 'om',
  onClick,
  courtId,
  variant = 'hybrid',
}) => {
  const dimensions = {
    sm: { box: 'w-8 h-8', text: 'text-base', sub: 'text-[9px]', iconSize: 22 },
    md: { box: 'w-10 h-10', text: 'text-lg sm:text-xl', sub: 'text-[10px]', iconSize: 28 },
    lg: { box: 'w-14 h-14', text: 'text-2xl sm:text-3xl', sub: 'text-xs', iconSize: 38 },
    xl: { box: 'w-20 h-20', text: 'text-4xl', sub: 'text-sm', iconSize: 56 },
  }[size];

  const isGurbicha =
    courtId === 'gurbicha' ||
    (typeof window !== 'undefined' && window.location.href.includes('gurbicha'));

  return (
    <div
      className={`flex items-center gap-3 select-none ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Brand Logo Container with Gadaa Justice & Scales Symbolism */}
      <div
        className={`${dimensions.box} rounded-xl bg-slate-900 flex items-center justify-center shadow-xl shadow-amber-500/10 border border-amber-500/30 shrink-0 relative overflow-hidden group`}
      >
        {/* Subtle Brand Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/15 via-transparent to-sky-500/10 opacity-60 group-hover:opacity-100 transition-opacity" />

        {isGurbicha ? (
          <img
            src={gurbichaCourtLogo}
            alt="Aanaa Gurbicha Court Logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain p-0.5 rounded-lg transition-transform duration-500 group-hover:scale-110 relative z-10"
          />
        ) : variant === 'vector' ? (
          <div className="relative z-10 p-0.5">
            <SeeraGadaaScalesVector size={dimensions.iconSize} />
          </div>
        ) : (
          <img
            src={seeraaiGadaaScalesLogo}
            alt="SeeraAI Ethiopian Gadaa Justice & Scales of Justice Platform Logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-lg transition-transform duration-500 group-hover:scale-110 relative z-10"
          />
        )}
      </div>

      {/* Modern Professional Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <h2 className={`font-serif-legal font-bold tracking-tight text-amber-500 ${dimensions.text}`}>
              SEERAAI
            </h2>
            <div className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-mono font-black uppercase tracking-widest shadow-sm">
              PRO
            </div>
          </div>
          <p className={`text-slate-500 font-bold uppercase tracking-widest ${dimensions.sub} opacity-80`}>
            {currentLang === 'om'
              ? 'Qorannoo Seeraa'
              : currentLang === 'am'
                ? 'የሕግ ትንተና'
                : 'Legal Intelligence'}
          </p>
        </div>
      )}
    </div>
  );
};
