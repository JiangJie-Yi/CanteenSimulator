/*
 * 聞野's sign: a thick board of dark old wood (欅) with deep grain running along it, its edges eased and darkened with
 * age; 聞野 carved deep into it and filled with old cream paint, 日式烤魚 smaller beneath. At night the letters glow as if the
 * board were lit from the front.
 */
export function GrillSign({ night }: { night: boolean }) {
  return (
    <svg className={`grill-sign${night ? ' is-night' : ''}`} viewBox="0 0 300 104" aria-hidden="true">
      <defs>
        <linearGradient id="gs-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e5a2e" />
          <stop offset="0.5" stopColor="#7a4a24" />
          <stop offset="1" stopColor="#5e3618" />
        </linearGradient>
        {/* the grain: noise stretched far along the board, in darker brown lines */}
        <filter id="gs-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.2" numOctaves="4" seed="7" />
          <feColorMatrix values="0 0 0 0 0.16 0 0 0 0 0.08 0 0 0 0 0.03 0 0 0 4.2 -1.6" />
        </filter>
        <filter id="gs-fine" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.25 0 0 0 0 0.14 0 0 0 0 0.06 0 0 0 1.6 -0.7" />
        </filter>
        {/* the edges darkened with years of smoke and hands */}
        <radialGradient id="gs-age" cx="50%" cy="45%" r="65%">
          <stop offset="0.6" stopColor="#3a1f0c" stopOpacity="0" />
          <stop offset="1" stopColor="#3a1f0c" stopOpacity="0.55" />
        </radialGradient>
        <clipPath id="gs-board"><rect x="3" y="3" width="294" height="98" rx="6" /></clipPath>
        <filter id="gs-glow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g clipPath="url(#gs-board)">
        <rect x="3" y="3" width="294" height="98" fill="url(#gs-wood)" />
        <rect x="3" y="3" width="294" height="98" filter="url(#gs-grain)" opacity="1" />
        <rect x="3" y="3" width="294" height="98" filter="url(#gs-fine)" opacity="0.8" />
        {/* a knot, and the grain bending round it */}
        <ellipse cx="248" cy="78" rx="7" ry="3.2" fill="#6b4122" opacity="0.7" />
        <path d="M200 74 C225 70 236 72 248 73.5 S272 76 297 72 M200 84 C226 86 238 84 248 82.6 S274 81 297 85"
          stroke="#6b4122" strokeWidth="0.8" fill="none" opacity="0.55" />
        <rect x="3" y="3" width="294" height="98" fill="url(#gs-age)" />
      </g>
      {/* the eased edge: light along the top, shadow along the bottom */}
      <rect x="3.5" y="3.5" width="293" height="97" rx="6" fill="none" stroke="#5a3418" strokeWidth="2" />
      <path d="M9 5.5 H291" stroke="#e2b27a" strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
      <path d="M9 98.5 H291" stroke="#3a1f0c" strokeWidth="1.4" opacity="0.6" strokeLinecap="round" />
      {/* carved letters filled with old gold-cream paint: the cut's shadow first, then the paint */}
      <g fontFamily="'Zen Antique', 'Noto Serif TC', serif" textAnchor="middle" fontWeight="900">
        <text x="150" y="64.4" fontSize="48" fill="#1e0f06" opacity="0.85" letterSpacing="16">聞野</text>
        <text x="150" y="90.2" fontSize="15.5" fill="#1e0f06" opacity="0.85" letterSpacing="7">日式烤魚</text>
        <g filter={night ? 'url(#gs-glow)' : undefined}>
          <text x="150" y="63" fontSize="48" fill={night ? '#ffe7b8' : '#ecd6a6'} letterSpacing="16">聞野</text>
          <text x="150" y="89" fontSize="15.5" fill={night ? '#ffb878' : '#d99a5a'} letterSpacing="7">日式烤魚</text>
        </g>
      </g>
    </svg>
  )
}
