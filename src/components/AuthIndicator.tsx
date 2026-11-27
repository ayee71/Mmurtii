import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Language } from '../i18n/translations';

export interface AuthIndicatorProps {
  currentLang?: Language;
  className?: string;
}

/**
 * AuthIndicator — Compact Authentication Status Indicator
 *
 * Shows a small green dot when the user is logged in and authenticated,
 * and a yellow dot when in guest mode or unauthenticated.
 */
export const AuthIndicator: React.FC<AuthIndicatorProps> = ({ currentLang = 'om', className = '' }) => {
  const { user, authClaims } = useAuth();

  const isGuest = Boolean(authClaims?.isGuest || !user);
  const isAuthenticated = Boolean(user && !isGuest);

  const statusText = isAuthenticated
    ? currentLang === 'om'
      ? 'Mirkanaa\'e (Authenticated)'
      : currentLang === 'am'
        ? 'የተረጋገጠ ተጠቃሚ'
        : 'Authenticated'
    : currentLang === 'om'
      ? 'Guest Mode (Istayilii Keessummaa)'
      : currentLang === 'am'
        ? 'የእንግዳ ሁነታ (Guest)'
        : 'Guest Mode';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] font-mono shadow-sm ${className}`}
      title={statusText}
    >
      <span className="relative flex h-2.5 w-2.5">
        {isAuthenticated && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            isAuthenticated ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm' : 'bg-amber-400'
          }`}
        />
      </span>
      <span className="hidden sm:inline text-slate-300 font-semibold truncate max-w-[120px]">
        {isAuthenticated ? (user?.email || 'Active User') : 'Guest Mode'}
      </span>
    </div>
  );
};
