/*
 * 聞野燒烤's sign, done as an old 昭和 enamel sign (ホーロー看板): a cream board with a red rim and four rivets, worn
 * at the edges and spotted with a little rust; a round crest on the left (a fish over the coals, in a ring of
 * flames); 聞野 in fat black letters with a red shadow; a red ribbon under it reading 炭火燒烤; and 創業 昭和
 * 三十三年 in small type. At night the letters and the crest glow as if the sign were lit from the front.
 */
export function GrillSign({ night }: { night: boolean }) {
  const ink = '#1f1712'
  const red = '#b8261c'
  const cream = night ? '#f4dfb4' : '#efe2c4'
  return (
    <svg className={`grill-sign${night ? ' is-night' : ''}`} viewBox="0 0 300 104" aria-hidden="true">
      <defs>
        <filter id="gs-wear" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" />
          <feColorMatrix values="0 0 0 0 0.45 0 0 0 0 0.3 0 0 0 0 0.15 0 0 0 2.2 -1.25" />
        </filter>
        <filter id="gs-rust" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="11" />
          <feColorMatrix values="0 0 0 0 0.52 0 0 0 0 0.26 0 0 0 0 0.1 0 0 0 5 -3.6" />
        </filter>
        <radialGradient id="gs-sheen" cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="gs-glow">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* the board: red rim, cream face, a fine inner line */}
      <rect x="2" y="2" width="296" height="100" rx="10" fill={red} />
      <rect x="9" y="9" width="282" height="86" rx="6" fill={cream} />
      <rect x="13" y="13" width="274" height="78" rx="4" fill="none" stroke={red} strokeWidth="1.4" />
      {/* rivets in the corners */}
      {[[8, 8], [292, 8], [8, 96], [292, 96]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="3.4" fill="#d9c9a8" stroke="#6b4a2a" strokeWidth="1" />
          <circle cx={x - 0.9} cy={y - 0.9} r="1" fill="#fff" opacity="0.7" />
        </g>
      ))}
      {/* the crest: a ring of flames round a fish on the coals */}
      <g transform="translate(52 52)" filter={night ? 'url(#gs-glow)' : undefined}>
        <circle r="30" fill={red} />
        <circle r="25.5" fill={cream} />
        <circle r="23" fill="none" stroke={red} strokeWidth="1.2" />
        {Array.from({ length: 12 }, (_, k) => (
          <path key={k} transform={`rotate(${k * 30})`} d="M0 -30 c3 -4 3 -7 0 -10 c-1 4 -4 5 -3 9 z" fill={red} />
        ))}
        {/* the fish, arched as it grills */}
        <path d="M-15 1 c6 -9 20 -9 26 -2 c-6 7 -20 8 -26 2 z" fill={ink} />
        <path d="M11 -1 l7 -5 v11 z" fill={ink} />
        <circle cx="-9" cy="-1.5" r="1.4" fill={cream} />
        <path d="M-2 -4 q3 3 0 6 M3 -4.5 q3 3 0 6.5" stroke={cream} strokeWidth="1" fill="none" />
        {/* the coals under it */}
        <path d="M-14 13 h28 M-11 17 h22" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M-6 10.5 q1 -3 2 0 M2 10.5 q1 -3 2 0" stroke={red} strokeWidth="1.6" fill="none" />
      </g>
      {/* 聞野: fat black letters with a red drop shadow */}
      <g fontFamily="'Zen Antique', 'Noto Serif TC', serif" fontWeight="900" filter={night ? 'url(#gs-glow)' : undefined}>
        <text x="172" y="60" fontSize="44" textAnchor="middle" fill={red} letterSpacing="6">聞野</text>
        <text x="170" y="58" fontSize="44" textAnchor="middle" fill={ink} stroke={cream} strokeWidth="0.8" letterSpacing="6">聞野</text>
      </g>
      {/* the ribbon: 炭火燒烤 */}
      <g transform="translate(172 76)">
        <path d="M-58 -8 h116 l-6 8 l6 8 h-116 l6 -8 z" fill={red} />
        <path d="M-58 -8 l-8 3 l4 5 l-4 5 l8 3 M58 -8 l8 3 l-4 5 l4 5 l-8 3" fill="#8a1c14" />
        <text y="4.5" fontSize="12" textAnchor="middle" fill={cream} letterSpacing="5"
          fontFamily="'Zen Antique', 'Noto Serif TC', serif" fontWeight="700">炭火燒烤</text>
      </g>
      {/* founded, in small type down the right */}
      <g fontFamily="'Noto Serif TC', serif" fontSize="6.4" fill={ink} opacity="0.8">
        <text x="270" y="22" writingMode="vertical-rl" letterSpacing="1">創業昭和三十三年</text>
      </g>
      {/* wear: chipped enamel round the edge, a few rust blooms, and the shine of the glaze */}
      <rect x="2" y="2" width="296" height="100" rx="10" filter="url(#gs-wear)" opacity="0.55" />
      <rect x="2" y="2" width="296" height="100" rx="10" filter="url(#gs-rust)" opacity="0.5" />
      <rect x="9" y="9" width="282" height="86" rx="6" fill="url(#gs-sheen)" />
    </svg>
  )
}
