import React from 'react';

export interface SeeraGadaaScalesVectorProps {
  className?: string;
  size?: number | string;
  primaryColor?: string; // Gold / Amber
  secondaryColor?: string; // Royal Blue / Navy
  accentColor?: string; // Deep Gold / Bronze
  background?: boolean;
}

/**
 * SeeraGadaaScalesVector — Authoritative Minimalist Vector Logo
 *
 * Symmetrical vector emblem fusing the sacred Odaa tree canopy geometry
 * (the ancient symbol of Oromo Gadaa democratic justice, wisdom, and assembly)
 * seamlessly intertwined with the balanced scales of justice.
 */
export const SeeraGadaaScalesVector: React.FC<SeeraGadaaScalesVectorProps> = ({
  className = '',
  size = 48,
  primaryColor = '#f59e0b', // amber-500
  secondaryColor = '#38bdf8', // sky-400
  accentColor = '#d97706', // amber-600
  background = false,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="SeeraAI Gadaa Justice and Balance Scales Vector Logo"
      role="img"
    >
      <defs>
        {/* Subtle radial and linear gradients for refined vector polish */}
        <linearGradient id="gadaaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={accentColor} />
        </linearGradient>

        <linearGradient id="gadaaBlueGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>

        <linearGradient id="gadaaBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <filter id="gadaaGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Optional dark background shield */}
      {background && (
        <rect width="200" height="200" rx="36" fill="url(#gadaaBgGrad)" stroke="#334155" strokeWidth="2" />
      )}

      {/* Outer Sacred Gadaa Rotational Harmony Ring (Minimalist dashed/segmented orbit) */}
      <circle
        cx="100"
        cy="100"
        r="88"
        stroke="url(#gadaaGoldGrad)"
        strokeWidth="1.75"
        strokeOpacity="0.35"
        strokeDasharray="4 8"
      />
      <circle
        cx="100"
        cy="100"
        r="80"
        stroke="url(#gadaaBlueGrad)"
        strokeWidth="1"
        strokeOpacity="0.2"
      />

      <g filter="url(#gadaaGlow)">
        {/* ========================================================
            1. SACRED ODAA TREE CANOPY (Gadaa Assembly & Wisdom)
            Five-pointed geometric canopy leaves honoring the 5 Gadaa Grades
            ======================================================== */}
        {/* Central Apex Leaf / Crown */}
        <path
          d="M 100 24 C 95 38, 93 48, 100 58 C 107 48, 105 38, 100 24 Z"
          fill="url(#gadaaGoldGrad)"
        />
        {/* Inner chevron of wisdom */}
        <path
          d="M 100 36 L 100 52"
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Upper Left Branch / Leaf */}
        <path
          d="M 82 36 C 72 44, 73 55, 85 58 C 88 49, 90 43, 82 36 Z"
          fill="url(#gadaaBlueGrad)"
        />

        {/* Upper Right Branch / Leaf */}
        <path
          d="M 118 36 C 128 44, 127 55, 115 58 C 112 49, 110 43, 118 36 Z"
          fill="url(#gadaaBlueGrad)"
        />

        {/* Middle Left Leaf */}
        <path
          d="M 68 52 C 58 60, 60 72, 74 72 C 76 63, 76 57, 68 52 Z"
          fill="url(#gadaaGoldGrad)"
        />

        {/* Middle Right Leaf */}
        <path
          d="M 132 52 C 142 60, 140 72, 126 72 C 124 63, 124 57, 132 52 Z"
          fill="url(#gadaaGoldGrad)"
        />

        {/* Symmetrical Geometric Trunk Branches (Odaa Branching) */}
        <path
          d="M 100 68 L 78 78 M 100 68 L 122 78"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 100 76 L 86 86 M 100 76 L 114 86"
          stroke="url(#gadaaBlueGrad)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* ========================================================
            2. CENTRAL PILLAR OF JUSTICE (Trunk & Fulcrum)
            ======================================================== */}
        {/* Upper Fulcrum Pin */}
        <circle cx="100" cy="88" r="4.5" fill="#0f172a" stroke="url(#gadaaGoldGrad)" strokeWidth="2.5" />

        {/* Vertical Beam of Truth */}
        <line
          x1="100"
          y1="93"
          x2="100"
          y2="152"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line
          x1="100"
          y1="98"
          x2="100"
          y2="148"
          stroke="url(#gadaaBlueGrad)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Rooted Base / Pedestal (Stable Foundation of Rule of Law) */}
        <path
          d="M 72 162 L 128 162"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 80 156 L 120 156"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 90 152 L 110 152"
          stroke="url(#gadaaBlueGrad)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* ========================================================
            3. HORIZONTAL BALANCE CROSSBEAM (Scales of Equity)
            ======================================================== */}
        <path
          d="M 44 94 Q 100 86 156 94"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Left and Right Pivot Notches */}
        <circle cx="44" cy="94" r="3" fill="url(#gadaaGoldGrad)" />
        <circle cx="156" cy="94" r="3" fill="url(#gadaaGoldGrad)" />

        {/* ========================================================
            4. LEFT SCALE PAN (Oromia / Regional Equity)
            ======================================================== */}
        {/* Cords */}
        <line x1="44" y1="96" x2="28" y2="124" stroke="url(#gadaaGoldGrad)" strokeWidth="1.3" strokeOpacity="0.85" />
        <line x1="44" y1="96" x2="60" y2="124" stroke="url(#gadaaGoldGrad)" strokeWidth="1.3" strokeOpacity="0.85" />
        
        {/* Left Pan (Concave geometric dish) */}
        <path
          d="M 24 124 C 24 138, 64 138, 64 124 Z"
          fill="url(#gadaaGoldGrad)"
          fillOpacity="0.25"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M 30 128 C 34 134, 54 134, 58 128"
          stroke="url(#gadaaBlueGrad)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* ========================================================
            5. RIGHT SCALE PAN (Federal / Constitutional Equity)
            ======================================================== */}
        {/* Cords */}
        <line x1="156" y1="96" x2="140" y2="124" stroke="url(#gadaaGoldGrad)" strokeWidth="1.3" strokeOpacity="0.85" />
        <line x1="156" y1="96" x2="172" y2="124" stroke="url(#gadaaGoldGrad)" strokeWidth="1.3" strokeOpacity="0.85" />

        {/* Right Pan */}
        <path
          d="M 136 124 C 136 138, 176 138, 176 124 Z"
          fill="url(#gadaaGoldGrad)"
          fillOpacity="0.25"
          stroke="url(#gadaaGoldGrad)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M 142 128 C 146 134, 166 134, 170 128"
          stroke="url(#gadaaBlueGrad)"
          strokeWidth="1.2"
          fill="none"
        />
      </g>
    </svg>
  );
};
