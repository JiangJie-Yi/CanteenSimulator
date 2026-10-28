/**
 * The loading screen's picture: a salt-grilled fish on its skewer over glowing charcoal, steam curling up off it. It cooks as the shop loads:
 * `done` (0..1) takes it from raw silver-blue to a golden brown, the grill's bars searing in across it and the salt crust coming up white.
 */
export function GrillingFish({ done = 0 }: { done?: number }) {
  const d = Math.max(0, Math.min(1, done))
  // (its back: steel blue raw, golden brown done; its belly: pale, then cream)
  const mix = (a: number[], b: number[]) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * d)).join(',')})`
  const back = mix([70, 96, 122], [150, 92, 38])
  const belly = mix([214, 222, 228], [236, 200, 140])
  return (
    <svg className="grilling-fish" viewBox="0 0 240 150" aria-hidden="true">
      <defs>
        <linearGradient id="gf-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={back} />
          <stop offset="0.55" stopColor={belly} />
          <stop offset="1" stopColor={belly} />
        </linearGradient>
        <radialGradient id="gf-ember" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.45" stopColor="#ff7a2a" />
          <stop offset="1" stopColor="#7a1a08" stopOpacity="0" />
        </radialGradient>
        <clipPath id="gf-clip">
          <path d="M42 66 C62 40 120 34 162 48 C176 52 186 58 194 64 C186 70 176 76 162 80 C120 94 62 90 42 66 Z" />
        </clipPath>
      </defs>
      {/* (the charcoal: a row of glowing sticks, breathing) */}
      <g className="gf-coals">
        {[30, 62, 94, 126, 158, 190].map((x, i) => (
          <g key={x}>
            <ellipse cx={x + 10} cy={132} rx={22} ry={10} fill="url(#gf-ember)" className="gf-glow" style={{ animationDelay: `${i * 0.37}s` }} />
            <rect x={x - 4} y={126} width={30} height={9} rx={4} fill="#2a1a12" />
            <rect x={x} y={128} width={20} height={2} rx={1} fill="#ff8a3a" className="gf-crack" style={{ animationDelay: `${i * 0.29}s` }} />
          </g>
        ))}
      </g>
      {/* (the skewer, through the fish's mouth and out along its length) */}
      <line x1="20" y1="72" x2="222" y2="58" stroke="#c99a5a" strokeWidth="3" strokeLinecap="round" />
      {/* (the fish, its tail flicked up as a grilled fish's is) */}
      <g className="gf-fish">
        <path d="M188 64 L218 44 C214 56 214 72 218 84 Z" fill={back} />
        <path d="M42 66 C62 40 120 34 162 48 C176 52 186 58 194 64 C186 70 176 76 162 80 C120 94 62 90 42 66 Z" fill="url(#gf-body)" stroke="#1d1410" strokeWidth="2" />
        <g clipPath="url(#gf-clip)">
          {/* (the bars seared across it, coming in as it cooks) */}
          {[70, 96, 122, 148].map((x) => (
            <path key={x} d={`M${x} 30 L${x - 14} 100`} stroke="#3a1e0c" strokeWidth="5" strokeLinecap="round" opacity={Math.max(0, (d - 0.25) / 0.75) * 0.75} />
          ))}
          {/* (salt crust: white flecks) */}
          {Array.from({ length: 26 }, (_, i) => (
            <circle key={i} cx={52 + ((i * 37) % 130)} cy={52 + ((i * 23) % 30)} r={i % 3 ? 1.2 : 1.8} fill="#fff" opacity={0.35 + 0.55 * d} />
          ))}
        </g>
        <path d="M62 58 C66 66 66 72 60 78" fill="none" stroke="#1d1410" strokeWidth="2" strokeLinecap="round" />
        <circle cx="54" cy="63" r="4.2" fill="#fff" stroke="#1d1410" strokeWidth="1.5" />
        <circle cx="54.5" cy="63.2" r="2" fill="#1d1410" />
        <path d="M120 38 C130 28 146 30 154 42" fill={back} stroke="#1d1410" strokeWidth="1.5" />
      </g>
      {/* (steam curling up off it) */}
      <g className="gf-steam" fill="none" stroke="#f3e7d2" strokeWidth="3" strokeLinecap="round">
        {[86, 118, 150].map((x, i) => (
          <path key={x} d={`M${x} 34 C${x - 8} 24 ${x + 8} 16 ${x} 6`} style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      </g>
    </svg>
  )
}
