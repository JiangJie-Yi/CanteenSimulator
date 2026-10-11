/*
 * 聞野燒烤's sign, kept plain in the old way: a cream board with a single dark rim, 聞野 in heavy letters, and
 * 炭火燒烤 in small red type between two short rules. At night the letters glow as if the sign were lit.
 */
export function GrillSign({ night }: { night: boolean }) {
  const ink = '#1f1712'
  const red = '#b8261c'
  const cream = night ? '#f4dfb4' : '#efe2c4'
  return (
    <svg className={`grill-sign${night ? ' is-night' : ''}`} viewBox="0 0 300 104" aria-hidden="true">
      <defs>
        <filter id="gs-glow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* the board and one fine line inside its rim */}
      <rect x="3" y="3" width="294" height="98" rx="8" fill={cream} stroke={ink} strokeWidth="3" />
      <rect x="10" y="10" width="280" height="84" rx="4" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.5" />
      <g filter={night ? 'url(#gs-glow)' : undefined} fontFamily="'Zen Antique', 'Noto Serif TC', serif" textAnchor="middle">
        <text x="150" y="62" fontSize="46" fontWeight="900" fill={ink} letterSpacing="14">聞野</text>
        {/* 炭火燒烤 between two short rules */}
        <path d="M86 80 h30 M184 80 h30" stroke={red} strokeWidth="1.4" />
        <text x="150" y="84.5" fontSize="12" fontWeight="700" fill={red} letterSpacing="4">炭火燒烤</text>
      </g>
    </svg>
  )
}
