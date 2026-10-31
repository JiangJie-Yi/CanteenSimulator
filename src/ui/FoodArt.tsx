import { useId } from 'react'

/*
 * A food's picture for the pantry: a hand-inked illustration in SVG, drawn the way the workers' faces are (ui/Avatar): flat colours cel-shaded
 * (each form lit from the top left, its shade a crisp darker tone, not a blur), little white highlights where the light catches, one ink line,
 * no shadow under it. On a round tile tinted by where it's kept (its faint dashed ring as the faces have), or cropped close across a card's
 * band. And the details that make each itself (a fish's scales, gill cover, rayed fins and eye; a fillet's flakes
 * and skin; the corn's kernels, the shiitake's cross cut, the squid's scoring...).
 */
const INK = '#3b2a20'
/** a colour a little lighter (k > 0) or darker (k < 0), as ui/Avatar shades */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

type Fish = { back: string; belly: string; len: number; deep: number; fin: string; stripe?: string; spots?: string; beak?: string; scutes?: boolean
  bars?: string; fillet?: { flesh: string; deep: string; skin: string; fat?: string } }
const FISH: Record<string, Fish> = {
  ExtraFish: { back: '#5d7e66', belly: '#ece6c9', len: 1, deep: 0.36, fin: '#d9b45a', spots: '#f0c84a' },                       // ayu, a golden spot behind the gill
  Saury: { back: '#2f5487', belly: '#eef2f6', len: 1.28, deep: 0.2, fin: '#8aa0b8', beak: '#f0b23a' },                         // long, slim, a yellow beak
  Mackerel: { back: '#2c6a70', belly: '#eef1f2', len: 1.05, deep: 0.3, fin: '#8aa8a8', bars: '#14363c' },                      // wavy bars on the back
  Aji: { back: '#5f7887', belly: '#eff1ec', len: 0.95, deep: 0.36, fin: '#c8c08a', stripe: '#e8c45a', scutes: true },            // horse mackerel
  Iwashi: { back: '#3a5c8c', belly: '#f2f4f6', len: 0.9, deep: 0.3, fin: '#9ab0c8', spots: '#1a2a44' },                        // sardine, a row of dots
  Shishamo: { back: '#a48c5c', belly: '#f4e6c6', len: 0.85, deep: 0.28, fin: '#d8c49a' },
  Hokke: { back: '#857455', belly: '#f0e8d4', len: 1, deep: 0.4, fin: '#b8a47a', bars: '#5a4a32' },
  Buri: { back: '#34567a', belly: '#f0f3f1', len: 1.05, deep: 0.36, fin: '#d8c05a', stripe: '#ecc63a' },                       // yellowtail
  Nodoguro: { back: '#d8473a', belly: '#f8d2c4', len: 0.95, deep: 0.42, fin: '#c03424' },                                       // blackthroat, red
  Salmon: { back: '#e8826a', belly: '#f6b8a0', len: 1, deep: 0.5, fin: '#e8826a', fillet: { flesh: '#f5946c', deep: '#e66e48', skin: '#8a9aa6', fat: '#fde2cf' } },
  Gindara: { back: '#34343c', belly: '#fbf6ec', len: 1, deep: 0.5, fin: '#34343c', fillet: { flesh: '#fbf5ea', deep: '#ede0c8', skin: '#2e2e36', fat: '#fffdf8' } },
}

const ground = (store: string) => (store === 'frozen' ? ['#d6ecfb', '#9ec8ea'] : store === 'ambient' ? ['#fbecd2', '#e8c58e'] : ['#def4e8', '#a6d6b8'])

/** a whole fish, head to the left: shaped body, scales, gill cover, rayed fins, eye, and its own markings */
function FishArt({ f, u }: { f: Fish; u: string }) {
  const L = 22 * f.len, H = 22 * f.deep, cy = 30
  const x0 = 32 - L, x1 = 32 + L * 0.74
  const top = cy - H, bot = cy + H
  // (the body: a rounded snout, the back rising to its highest a little behind the head, narrowing to the tail's root; the belly fuller)
  const body = `M${x0} ${cy + H * 0.08}
    C${x0} ${cy - H * 0.45} ${x0 + L * 0.22} ${top + H * 0.05} ${x0 + L * 0.55} ${top}
    C${x0 + L * 0.95} ${top - H * 0.02} ${x1 - L * 0.3} ${cy - H * 0.38} ${x1} ${cy - H * 0.16}
    L${x1} ${cy + H * 0.16}
    C${x1 - L * 0.32} ${cy + H * 0.42} ${x0 + L * 0.95} ${bot} ${x0 + L * 0.5} ${bot - H * 0.02}
    C${x0 + L * 0.2} ${bot - H * 0.08} ${x0 + 1} ${cy + H * 0.5} ${x0} ${cy + H * 0.08} Z`
  const er = Math.max(1.8, H * 0.24), ex = x0 + L * 0.17, ey = cy - H * 0.15
  const tailTip = Math.max(H * 0.95, 6)
  return (
    <g>
      <defs>
        {/* (cel-shaded: the back, a lighter band where the light falls along it, the pale belly, and its shade a crisp darker tone underneath) */}
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(f.back, -0.08)} /><stop offset="0.22" stopColor={shade(f.back, -0.08)} />
          <stop offset="0.22" stopColor={f.back} /><stop offset="0.5" stopColor={f.back} />
          <stop offset="0.5" stopColor={f.belly} /><stop offset="0.8" stopColor={f.belly} />
          <stop offset="0.8" stopColor={shade(f.belly, -0.12)} /><stop offset="1" stopColor={shade(f.belly, -0.12)} />
        </linearGradient>
        <linearGradient id={`${u}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(f.fin, 0.15)} /><stop offset="0.55" stopColor={shade(f.fin, 0.15)} /><stop offset="0.55" stopColor={f.fin} /><stop offset="1" stopColor={f.fin} /></linearGradient>
        <pattern id={`${u}s`} width="3.2" height="2.6" patternUnits="userSpaceOnUse">
          <path d="M0 2.6 A1.6 1.6 0 0 1 3.2 2.6" fill="none" stroke="#fff" strokeWidth="0.4" opacity="0.38" />
          <path d="M-1.6 1.3 A1.6 1.6 0 0 1 1.6 1.3 M1.6 1.3 A1.6 1.6 0 0 1 4.8 1.3" fill="none" stroke="#000" strokeWidth="0.3" opacity="0.1" />
        </pattern>
        <clipPath id={`${u}c`}><path d={body} /></clipPath>
      </defs>
      {/* tail: forked, its rays fanning out */}
      <path d={`M${x1 - 1} ${cy - H * 0.14} L${x1 + 10} ${cy - tailTip} Q${x1 + 7.5} ${cy - tailTip * 0.2} ${x1 + 6} ${cy}
        Q${x1 + 7.5} ${cy + tailTip * 0.2} ${x1 + 10} ${cy + tailTip} L${x1 - 1} ${cy + H * 0.14} Z`} fill={`url(#${u}f)`} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      {[-0.75, -0.4, 0.4, 0.75].map((k) => <path key={k} d={`M${x1} ${cy + k * H * 0.12} L${x1 + 8.5} ${cy + k * tailTip * 0.95}`} stroke={INK} strokeWidth="0.45" opacity="0.45" />)}
      {/* dorsal fin, its spines, and the anal fin under the rear */}
      <path d={`M${x0 + L * 0.42} ${top + H * 0.08} L${x0 + L * 0.52} ${top - H * 0.55} L${x0 + L * 0.7} ${top - H * 0.42} L${x0 + L * 0.9} ${top - H * 0.2}
        L${x0 + L * 1.1} ${top + H * 0.12} Z`} fill={`url(#${u}f)`} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      {[0.5, 0.62, 0.74, 0.86, 0.98].map((t) => <path key={t} d={`M${x0 + L * t} ${top + H * 0.05} L${x0 + L * (t + 0.03)} ${top - H * (0.55 - (t - 0.5) * 0.7)}`} stroke={INK} strokeWidth="0.45" opacity="0.5" />)}
      <path d={`M${x0 + L * 1.05} ${bot - H * 0.28} L${x0 + L * 1.15} ${bot + H * 0.12} L${x0 + L * 1.4} ${cy + H * 0.36} Z`} fill={`url(#${u}f)`} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      {/* the body, shaded back to belly, scaled, a sheen along its back */}
      <path d={body} fill={`url(#${u}b)`} stroke={INK} strokeWidth="1.5" />
      <g clipPath={`url(#${u}c)`}>
        <rect x={x0 + L * 0.35} y={top - 2} width={L * 1.5} height={H * 2 + 4} fill={`url(#${u}s)`} />
        {f.bars && [0.5, 0.65, 0.8, 0.95, 1.1, 1.25].map((t) => <path key={t} d={`M${x0 + L * t} ${top} q2 ${H * 0.3} -1 ${H * 0.55} q3 ${H * 0.2} 1 ${H * 0.4}`} fill="none" stroke={f.bars} strokeWidth="1.3" opacity="0.75" />)}
        {f.stripe && <path d={`M${x0 + L * 0.35} ${cy - H * 0.05} C${x0 + L * 0.8} ${cy - H * 0.2} ${x1 - L * 0.4} ${cy - H * 0.12} ${x1} ${cy}`} fill="none" stroke={f.stripe} strokeWidth="1.8" opacity="0.9" />}
        {f.scutes && [0.85, 0.95, 1.05, 1.15, 1.25, 1.35, 1.45].map((t) => <path key={t} d={`M${x0 + L * t} ${cy + H * 0.08} l1.4 -0.8 l1.4 0.8`} fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.8" />)}
        {/* (the head: a shade over it, the gill cover's edge) */}
        <path d={`M${x0 - 2} ${top - 2} H${x0 + L * 0.36} C${x0 + L * 0.42} ${cy - H * 0.3} ${x0 + L * 0.42} ${cy + H * 0.3} ${x0 + L * 0.34} ${bot + 2} H${x0 - 2} Z`} fill="#000" opacity="0.07" />
        <path d={`M${x0 + L * 0.5} ${top} C${x0 + L * 0.9} ${top + H * 0.15} ${x1 - L * 0.25} ${cy - H * 0.3} ${x1} ${cy - H * 0.12}`} fill="none" stroke="#fff" strokeWidth={Math.max(1.4, H * 0.18)} strokeLinecap="round" opacity="0.38" />
      </g>
      {/* lateral line, gill cover, pectoral fin */}
      <path d={`M${x0 + L * 0.38} ${cy - H * 0.28} C${x0 + L * 0.8} ${cy - H * 0.38} ${x1 - L * 0.3} ${cy - H * 0.1} ${x1} ${cy}`} fill="none" stroke={INK} strokeWidth="0.6" opacity="0.4" />
      <path d={`M${x0 + L * 0.33} ${cy - H * 0.62} C${x0 + L * 0.42} ${cy - H * 0.1} ${x0 + L * 0.42} ${cy + H * 0.25} ${x0 + L * 0.3} ${cy + H * 0.68}`} fill="none" stroke={INK} strokeWidth="1.1" opacity="0.75" />
      {/* (the pectoral fin: a little fan laid back along the flank behind the gill cover, its rays spreading) */}
      <path d={`M${x0 + L * 0.4} ${cy + H * 0.18} C${x0 + L * 0.5} ${cy + H * 0.02} ${x0 + L * 0.62} ${cy + H * 0.06} ${x0 + L * 0.68} ${cy + H * 0.16}
        C${x0 + L * 0.66} ${cy + H * 0.3} ${x0 + L * 0.56} ${cy + H * 0.42} ${x0 + L * 0.4} ${cy + H * 0.18} Z`} fill={shade(f.fin, 0.25)} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
      {[0.12, 0.2, 0.28].map((t) => <path key={t} d={`M${x0 + L * 0.41} ${cy + H * 0.18} L${x0 + L * 0.65} ${cy + H * t}`} stroke={INK} strokeWidth="0.35" opacity="0.45" />)}
      {f.spots && (f.spots === '#f0c84a'
        ? <ellipse cx={x0 + L * 0.48} cy={cy - H * 0.32} rx="2.4" ry="1.5" fill={f.spots} opacity="0.95" />
        : [0.5, 0.68, 0.86, 1.04, 1.22].map((t) => <circle key={t} cx={x0 + L * t} cy={cy - H * 0.18} r="1.05" fill={f.spots} opacity="0.85" />))}
      {/* the mouth, and the eye: a gold iris, a dark pupil, the light caught in it */}
      <path d={`M${x0 + 0.6} ${cy + H * 0.12} q${L * 0.07} ${H * 0.05} ${L * 0.12} ${-H * 0.02}`} fill="none" stroke={INK} strokeWidth="0.9" strokeLinecap="round" />
      {f.beak && <path d={`M${x0 + 0.5} ${cy + H * 0.1} L${x0 - 5} ${cy + H * 0.2} L${x0 + 0.5} ${cy + H * 0.34} Z`} fill={f.beak} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />}
      <circle cx={ex} cy={ey} r={er} fill="#f4e9c8" stroke={INK} strokeWidth="0.9" />
      <circle cx={ex + er * 0.08} cy={ey} r={er * 0.62} fill="#1a1612" />
      <circle cx={ex - er * 0.2} cy={ey - er * 0.28} r={er * 0.24} fill="#fff" />
    </g>
  )
}

/** a fillet (切り身): a thick slab, its flakes in white arcs, the fat between, the skin a band along its back */
function FilletArt({ f, u }: { f: NonNullable<Fish['fillet']>; u: string }) {
  const slab = 'M9 30 C9 21 18 15 33 15 C47 15 55 21 55 28 C55 36 47 41 32 41 C17 41 9 37 9 30 Z'
  return (
    <g>
      <defs>
        <linearGradient id={`${u}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={f.flesh} /><stop offset="0.62" stopColor={f.flesh} /><stop offset="0.62" stopColor={f.deep} /><stop offset="1" stopColor={f.deep} /></linearGradient>
        <clipPath id={`${u}k`}><path d={slab} /></clipPath>
      </defs>
      {/* (the side of the slab, its thickness, below the face) */}
      <path d="M9 30 C9 37 17 44 32 44 C47 44 55 39 55 31 L55 28 C55 36 47 41 32 41 C17 41 9 37 9 30 Z" fill={f.deep} stroke={INK} strokeWidth="1.3" />
      <path d={slab} fill={`url(#${u}l)`} stroke={INK} strokeWidth="1.5" />
      <g clipPath={`url(#${u}k)`}>
        {[14, 21, 28, 35, 42, 49].map((x) => <path key={x} d={`M${x} 13 C${x + 6} 20 ${x - 4} 25 ${x + 2} 30 C${x + 7} 35 ${x - 2} 39 ${x + 3} 44`} fill="none" stroke={f.fat ?? '#fff'} strokeWidth="1.5" opacity="0.85" />)}
        <path d="M6 20 C20 13 46 12 58 20 L58 14 L6 14 Z" fill={f.skin} />
        <path d="M6 20 C20 13 46 12 58 20" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
        <path d="M14 25 C22 20 36 19 46 22" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
      </g>
    </g>
  )
}

/** the rest, each its own small picture */
function OtherArt({ id, u }: { id: string; u: string }) {
  const s = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const shine = (d: string, w = 2) => <path d={d} fill="none" stroke="#fff" strokeWidth={w} strokeLinecap="round" opacity="0.55" />
  // (two flat tones, cel-shaded: lit side and shade, a crisp edge between, the light from the top left)
  const grad = (k: string, a: string, b: string, vertical = true) => (
    <linearGradient id={`${u}${k}`} x1="0" y1="0" x2={vertical ? 0.35 : 1} y2={vertical ? 1 : 0.35}>
      <stop offset="0" stopColor={a} /><stop offset="0.58" stopColor={a} /><stop offset="0.58" stopColor={b} /><stop offset="1" stopColor={b} />
    </linearGradient>
  )
  const skewer = <g><line x1="9" y1="50" x2="56" y2="13" stroke="#8a6436" strokeWidth="3" strokeLinecap="round" /><line x1="9" y1="50" x2="56" y2="13" stroke="#d8ae6c" strokeWidth="1.6" strokeLinecap="round" /></g>
  switch (id) {
    case 'GrilledCorn':
      return <g><defs>{grad('k', '#ffd862', '#e8a628')}</defs>
        <g transform="rotate(-32 32 32)">
          <path d="M32 7 C42 9 45 21 45 32 C45 45 39 54 32 56 C25 54 19 45 19 32 C19 21 22 9 32 7 Z" fill={`url(#${u}k)`} {...s} />
          {Array.from({ length: 8 }, (_, r) => Array.from({ length: 4 }, (_, c) => (
            <rect key={`${r}${c}`} x={22.6 + c * 5.2} y={12 + r * 5.3} width="4.4" height="4.4" rx="1.6" fill="#ffe27a" stroke="#c98c22" strokeWidth="0.6" />
          )))}
          <path d="M22 50 C13 42 11 28 17 16 C21 30 25 44 31 55 Z" fill="#7caa4a" {...s} />
          <path d="M42 50 C49 44 51 34 49 24 C46 34 42 44 36 54 Z" fill="#94bc5c" {...s} />
          {shine('M26 14 C24 20 24 26 25 30', 2.4)}
        </g></g>
    case 'GrilledShiitake':
      return <g><defs><radialGradient id={`${u}c`} cx="0.4" cy="0.3" r="0.7"><stop offset="0" stopColor="#a06a3e" /><stop offset="0.6" stopColor="#a06a3e" /><stop offset="0.6" stopColor="#5e3a1e" /><stop offset="1" stopColor="#5e3a1e" /></radialGradient>{grad('t', '#f6ecd6', '#d8c4a0')}</defs>
        
        <path d="M27 33 L25 52 Q32 56 39 52 L37 33 Z" fill={`url(#${u}t)`} {...s} />
        <path d="M8 34 C8 14 56 14 56 34 C50 37 14 37 8 34 Z" fill={`url(#${u}c)`} {...s} />
        <path d="M11 34 C20 38 44 38 53 34 C46 41 18 41 11 34 Z" fill="#e6d4b2" {...s} />
        {[14, 20, 26, 32, 38, 44, 50].map((x) => <path key={x} d={`M${x} 36.5 L${32 + (x - 32) * 0.5} 39`} stroke="#b8a07a" strokeWidth="0.6" />)}
        <path d="M22 22 L42 30 M42 22 L22 30" stroke="#f2e2c2" strokeWidth="2.6" strokeLinecap="round" />
        {[[16, 28], [47, 27], [30, 19], [38, 33]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" fill="#e8d4b0" opacity="0.8" />)}
        {shine('M15 26 C17 21 22 18 27 17', 2)}</g>
    case 'KingOyster':
      return <g><defs>{grad('t', '#fbf4e6', '#e2d2b4', false)}{grad('c', '#b48a5e', '#7e5a36')}</defs>
        <path d="M23 28 C21 42 22 52 32 55 C42 52 43 42 41 28 Z" fill={`url(#${u}t)`} {...s} />
        <path d="M14 29 C14 17 50 17 50 29 C50 33 14 33 14 29 Z" fill={`url(#${u}c)`} {...s} />
        {[27, 31, 35, 39].map((x) => <path key={x} d={`M${x} 34 C${x - 1} 42 ${x} 48 ${x - 0.5} 52`} fill="none" stroke="#d6c4a2" strokeWidth="0.8" />)}
        {shine('M19 25 C22 21 28 20 32 20', 2)}{shine('M26 36 C25 42 25 47 27 51', 1.6)}</g>
    case 'Onigiri':
      return <g><defs>{grad('r', '#ffffff', '#ece8dc')}{grad('n', '#2c3a2c', '#141c16')}</defs>
        <path d="M32 8 C41 8 55 38 51 48 C48 54 16 54 13 48 C9 38 23 8 32 8 Z" fill={`url(#${u}r)`} {...s} />
        {[[24, 20], [33, 15], [40, 24], [28, 30], [36, 33], [21, 37], [44, 37], [30, 38]].map(([x, y], k) => (
          <ellipse key={k} cx={x} cy={y} rx="1.6" ry="0.8" transform={`rotate(${k * 37} ${x} ${y})`} fill="none" stroke="#cfc8b4" strokeWidth="0.6" />
        ))}
        <path d="M19 38 H45 L46 53 Q32 55 18 53 Z" fill={`url(#${u}n)`} {...s} />
        {[22, 27, 32, 37, 42].map((x) => <path key={x} d={`M${x} 39 L${x + 1} 53`} stroke="#3e4e3e" strokeWidth="0.6" />)}
        <circle cx="32" cy="27" r="3" fill="#c8384a" opacity="0.9" />
        {shine('M25 15 C23 19 21 23 20 27', 2.2)}</g>
    case 'ShrimpSkewer':
      return <g><defs>{grad('p', '#ff9a66', '#d84a2a')}</defs>{skewer}
        <path d="M16 44 C9 34 15 20 29 17 C41 15 50 22 47 32 C45 38 38 39 36 34 C35 30 39 28 41 30" fill={`url(#${u}p)`} {...s} />
        {[[22, 22, 25, 33], [28, 19, 30, 30], [34, 18, 35, 28], [40, 19, 40, 27]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} Q${(a + c) / 2 + 2} ${(b + d) / 2} ${c} ${d}`} fill="none" stroke="#b83a1e" strokeWidth="1" />)}
        <path d="M16 44 L9 52 L14 52 L19 47 Z" fill="#e8603a" {...s} />
        {[0, 1, 2, 3].map((k) => <path key={k} d={`M${24 + k * 4} ${34 + k * 0.5} l-2 6`} stroke="#c8502a" strokeWidth="0.9" />)}
        <path d="M45 26 C52 20 56 12 58 6 M44 24 C50 16 52 10 51 4" fill="none" stroke="#c8502a" strokeWidth="0.8" />
        <circle cx="43" cy="24" r="1.5" fill={INK} /><circle cx="42.6" cy="23.5" r="0.45" fill="#fff" />
        {shine('M21 23 C25 19 31 18 36 18', 2)}</g>
    case 'Sausage':
      return <g><defs>{grad('s', '#d8684a', '#94321e')}</defs>{skewer}
        <g transform="rotate(-38 33 31)">
          <rect x="13" y="23" width="40" height="16" rx="8" fill={`url(#${u}s)`} {...s} />
          {[22, 30, 38, 46].map((x) => <path key={x} d={`M${x} 24.5 l-4 13`} stroke="#5a1a0e" strokeWidth="1.6" opacity="0.75" />)}
          {shine('M19 27 H46', 2)}
        </g></g>
    case 'Potato':
      return <g><defs><radialGradient id={`${u}p`} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#ecc888" /><stop offset="0.6" stopColor="#ecc888" /><stop offset="0.6" stopColor="#b88a4a" /><stop offset="1" stopColor="#b88a4a" /></radialGradient></defs>
        <path d="M12 32 C12 20 25 13 36 15 C49 17 54 28 51 37 C48 47 36 50 25 48 C16 46 12 40 12 32 Z" fill={`url(#${u}p)`} {...s} />
        {[[22, 25], [38, 22], [31, 38], [45, 35], [18, 37]].map(([x, y]) => <g key={x}><path d={`M${x - 1.6} ${y} q1.6 -1.4 3.2 0`} fill="none" stroke="#7a5a2a" strokeWidth="0.9" /><circle cx={x} cy={y + 0.6} r="0.6" fill="#7a5a2a" /></g>)}
        {[[28, 30], [42, 27], [24, 42]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="0.5" fill="#8a6a3a" />)}
        {shine('M18 26 C21 20 27 17 33 17', 2.2)}</g>
    case 'SweetPotato':
      return <g><defs>{grad('p', '#b44a6c', '#7a2440')}</defs>
        <path d="M7 38 C14 22 39 13 53 20 C59 24 52 40 37 45 C24 49 11 47 7 38 Z" fill={`url(#${u}p)`} {...s} />
        <path d="M44 41 C48 38 52 33 53 28 L56 30 C55 36 51 41 47 43 Z" fill="#f2d07a" {...s} />
        {[[18, 36, 30, 31], [28, 39, 40, 33], [22, 30, 34, 25]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} Q${(a + c) / 2} ${(b + d) / 2 - 2} ${c} ${d}`} fill="none" stroke="#5a1a30" strokeWidth="0.8" opacity="0.7" />)}
        <path d="M53 20 L58 15 M7 38 L3 41" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        {shine('M15 33 C24 25 36 21 47 21', 2)}</g>
    case 'Yakitori': case 'PorkBelly': case 'BloodCake':
      return <g><defs>{grad('y', '#e0964a', '#a8582a')}{grad('p', '#f6c6ae', '#d8927a')}{grad('b', '#4a2c2a', '#241414')}</defs>
        {skewer}{[0, 1, 2].map((k) => {
          const cx = 19 + k * 12, cy = 42 - k * 9.5
          if (id === 'BloodCake') return <g key={k}><rect x={cx - 6.5} y={cy - 6.5} width="13" height="13" rx="2.4" fill={`url(#${u}b)`} {...s} />{[[-2, -2], [2, 1], [-1, 3]].map(([a, b]) => <circle key={a} cx={cx + a} cy={cy + b} r="0.9" fill="#f2ead6" />)}</g>
          if (id === 'PorkBelly') return <g key={k}><rect x={cx - 7.5} y={cy - 6.5} width="15" height="13" rx="3" fill={`url(#${u}p)`} {...s} /><path d={`M${cx - 7.5} ${cy - 2} h15 M${cx - 7.5} ${cy + 2.5} h15`} stroke="#fff4ea" strokeWidth="1.8" /><path d={`M${cx - 5} ${cy - 6.5} l3 13 M${cx + 2} ${cy - 6.5} l3 13`} stroke="#7a3a1e" strokeWidth="1.1" opacity="0.6" /></g>
          // (chicken, and a length of leek between: ねぎま)
          return <g key={k}>{k === 1
            ? <g><rect x={cx - 6} y={cy - 5} width="12" height="10" rx="4" fill="#eef4dc" {...s} /><path d={`M${cx - 4} ${cy - 5} v10 M${cx} ${cy - 5} v10`} stroke="#9ab86a" strokeWidth="0.8" /></g>
            : <g><path d={`M${cx - 7.5} ${cy} C${cx - 8} ${cy - 8} ${cx + 7} ${cy - 9} ${cx + 7.5} ${cy - 1} C${cx + 8} ${cy + 7} ${cx - 7} ${cy + 8} ${cx - 7.5} ${cy} Z`} fill={`url(#${u}y)`} {...s} />
              <path d={`M${cx - 4} ${cy + 3} l3 -6 M${cx + 1} ${cy + 4} l3 -6`} stroke="#6a2e12" strokeWidth="1.3" opacity="0.7" />{shine(`M${cx - 4} ${cy - 4} l4 -1.5`, 1.4)}</g>}</g>
        })}</g>
    case 'Squid':
      return <g><defs>{grad('q', '#fbf0e6', '#e8c8b4')}</defs>
        <path d="M32 5 L45 20 C46 33 41 40 37 42 H27 C23 40 18 33 19 20 Z" fill={`url(#${u}q)`} {...s} />
        <path d="M32 5 L45 20 L40 22 L32 12 L24 22 L19 20 Z" fill="#f4dcd0" {...s} />
        {[[22, 27, 42, 33], [22, 33, 42, 27]].map(([a, b, c, d]) => [0, 5, 10].map((o) => <path key={`${a}${b}${o}`} d={`M${a} ${b + o - 5} L${c} ${d + o - 5}`} stroke="#d2a48c" strokeWidth="0.7" />))}
        {[[24, 30, 34], [27, 36, 31], [36, 26, 33]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="0.8" fill="#a65a6a" opacity="0.7" />)}
        {[23, 27, 31, 35, 39, 41].map((x, k) => <path key={x} d={`M${x} 42 C${x + (k % 2 ? 3 : -3)} 49 ${x} 53 ${x + (k - 2.5) * 1.3} 58`} fill="none" stroke="#e8c8b4" strokeWidth="2.6" strokeLinecap="round" />)}
        {[23, 27, 31, 35, 39, 41].map((x, k) => <path key={`o${x}`} d={`M${x} 42 C${x + (k % 2 ? 3 : -3)} 49 ${x} 53 ${x + (k - 2.5) * 1.3} 58`} fill="none" stroke={INK} strokeWidth="0.6" opacity="0.5" />)}
        <circle cx="27" cy="38" r="1.7" fill={INK} /><circle cx="37" cy="38" r="1.7" fill={INK} />
        {shine('M25 18 C24 24 24 30 25 34', 2)}</g>
    case 'Asparagus':
      return <g><defs>{grad('a', '#8cbc52', '#4e7a2a', false)}</defs>
        {[0, 1, 2].map((k) => <g key={k} transform={`rotate(${-20 + k * 14} 32 52)`}>
          <path d="M29.5 53 L29.5 15 Q32 7 34.5 15 L34.5 53 Z" fill={`url(#${u}a)`} {...s} />
          <path d="M29.6 15 Q32 9 34.4 15 Q32 13 29.6 15 Z" fill="#6a4a7a" opacity="0.6" />
          {[22, 30, 38, 45].map((y, j) => <path key={y} d={j % 2 ? `M34.5 ${y} l2.4 -3` : `M29.5 ${y} l-2.4 -3`} stroke="#3a6a24" strokeWidth="1.1" />)}
          {shine('M31 20 V48', 1)}
        </g>)}</g>
    case 'Okra':
      return <g><defs>{grad('o', '#7cb44a', '#3e7024', false)}</defs>
        <path d="M22 14 L29 9 L33 15 C41 25 45 39 43 52 C39 55 34 53 32 48 C26 36 22 25 22 14 Z" fill={`url(#${u}o)`} {...s} />
        <path d="M27 15 C33 27 37 39 38 51 M31 14 C37 26 41 38 41 50" fill="none" stroke="#2e5a1a" strokeWidth="1" opacity="0.7" />
        <path d="M22 14 L29 9 L33 15 L28 13 Z" fill="#5a7a2a" {...s} />
        {[[30, 26], [35, 36], [33, 44]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="0.5" fill="#cde0a8" />)}
        {shine('M25 19 C28 28 31 36 33 44', 1.6)}</g>
    case 'Shishito':
      return <g><defs>{grad('sh', '#6aa83a', '#2e6a1a')}</defs>
        <path d="M12 45 C14 31 29 18 45 15 C50 14 53 19 48 24 C41 32 30 44 17 49 C13 50 11 48 12 45 Z" fill={`url(#${u}sh)`} {...s} />
        <path d="M17 42 C24 38 33 30 41 22" fill="none" stroke="#24521a" strokeWidth="0.9" opacity="0.6" />
        <path d="M46 15 C48 13 50 13 51 15 L49 17 Z" fill="#4a6a24" {...s} />
        <path d="M50 14 C52 10 54 8 57 7" fill="none" stroke="#5a7a2a" strokeWidth="2" strokeLinecap="round" />
        {shine('M19 40 C26 33 34 25 43 19', 1.8)}</g>
    case 'Scallop':
      return <g><defs>{grad('h', '#f6d2aa', '#d8946a')}<radialGradient id={`${u}m`} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#fffaf0" /><stop offset="0.6" stopColor="#fffaf0" /><stop offset="0.6" stopColor="#ecdcc0" /><stop offset="1" stopColor="#ecdcc0" /></radialGradient></defs>
        
        <path d="M32 53 L10 27 C14 10 50 10 54 27 Z" fill={`url(#${u}h)`} {...s} />
        {[-16, -11, -5.5, 0, 5.5, 11, 16].map((d) => <path key={d} d={`M32 53 Q${32 + d * 0.7} 34 ${32 + d * 1.35} 14`} fill="none" stroke="#b8704a" strokeWidth="1" />)}
        <path d="M24 53 h16 l-3 6 h-10 Z" fill="#e2a272" {...s} />
        <ellipse cx="32" cy="31" rx="9.5" ry="7.5" fill={`url(#${u}m)`} {...s} />
        <path d="M23 34 C26 40 38 40 41 34" fill="none" stroke="#f0a060" strokeWidth="2.4" opacity="0.8" />
        {shine('M27 27 C29 25 32 24 35 25', 1.6)}</g>
    case 'NetMochi':
      return <g><defs>{grad('w', '#ffffff', '#ece4d2')}</defs>
        <rect x="11" y="22" width="42" height="24" rx="7" fill={`url(#${u}w)`} {...s} />
        <path d="M11 37 C21 30 41 29 53 35 L53 39 C51 44 47 46 46 46 H18 C14 46 11 43 11 39 Z" fill="#e2b468" opacity="0.75" />
        {[18, 26, 34, 42].map((x) => <path key={x} d={`M${x} 23 l6 22`} stroke="#8a5a2a" strokeWidth="1.2" opacity="0.5" />)}
        <path d="M30 22 C30 16 36 16 36 21" fill="#fff" {...s} />
        {shine('M16 27 H30', 2.2)}</g>
    case 'MisoSoup':
      return <g><defs>{grad('b', '#9a2a1a', '#4a0e08')}<radialGradient id={`${u}s`} cx="0.5" cy="0.5" r="0.6"><stop offset="0" stopColor="#d89a4e" /><stop offset="0.6" stopColor="#d89a4e" /><stop offset="0.6" stopColor="#a8682a" /><stop offset="1" stopColor="#a8682a" /></radialGradient></defs>
        
        <path d="M9 27 H55 C55 42 46 53 32 53 C18 53 9 42 9 27 Z" fill={`url(#${u}b)`} {...s} />
        <path d="M24 53 h16 v3 h-16 Z" fill="#2a0a06" {...s} />
        <ellipse cx="32" cy="27" rx="23" ry="6.5" fill={`url(#${u}s)`} {...s} />
        <rect x="22" y="24" width="5" height="5" rx="0.8" fill="#fbf6ea" stroke="#d8c8a8" strokeWidth="0.5" />
        <rect x="35" y="26" width="5" height="5" rx="0.8" fill="#fbf6ea" stroke="#d8c8a8" strokeWidth="0.5" />
        <path d="M28 29 C30 26 34 25 36 27" fill="none" stroke="#2e5a1e" strokeWidth="2" strokeLinecap="round" />
        {[18, 44, 30].map((x) => <circle key={x} cx={x} cy={x === 30 ? 23 : 27} r="0.9" fill="#4a8a2a" />)}
        <path d="M24 18 C22 14 26 12 24 8 M34 18 C32 14 36 12 34 8" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.6" />
        {shine('M13 32 C14 38 17 43 21 46', 2)}</g>
    case 'Sake':
      return <g><defs>{grad('k', '#ffffff', '#e6e2d8', false)}</defs>
        <path d="M27 6 H37 V12 C45 18 48 29 48 40 C48 51 41 57 32 57 C23 57 16 51 16 40 C16 29 19 18 27 12 Z" fill={`url(#${u}k)`} {...s} />
        <path d="M27 6 H37 V9 H27 Z" fill="#2a4a8a" {...s} />
        <path d="M17.5 44 C26 47 38 47 46.5 44" fill="none" stroke="#2a4a8a" strokeWidth="2.6" />
        <rect x="26" y="22" width="12" height="16" rx="1" fill="#c82a20" {...s} />
        <text x="32" y="33.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="serif">酒</text>
        {shine('M21 26 C19 32 19 40 21 46', 2.4)}</g>
    default:
      return <circle cx="32" cy="32" r="12" fill="#d8b890" {...s} />
  }
}

/** `band`: drawn across the top of a card (no round tile, the food cropped close to fill the band; the card's band behind it) */
export function FoodArt({ id, store, size = 34, band = false }: { id: string; store: string; size?: number; band?: boolean }) {
  const u = `fa${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const f = FISH[id]
  const [g0, g1] = ground(store)
  // (cropped on a card's band to the food itself: a whole fish to its own outline, tail and fins and all)
  const fishView = (q: Fish) => {
    const L = 22 * q.len, H = 22 * q.deep, x0 = 32 - L - (q.beak ? 6 : 2), x1 = 32 + L * 0.74 + 11
    const y0 = 30 - H * 1.6 - 1, y1 = 30 + Math.max(H, 6) + 5
    return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`
  }
  const view = !band ? '0 0 64 64' : f ? (f.fillet ? '7 12 50 34' : fishView(f)) : '4 3 56 56'
  return (
    <svg className="food-art" width={band ? undefined : size} height={band ? undefined : size} viewBox={view} aria-hidden="true">
      <defs>
        <radialGradient id={`${u}g`} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} /></radialGradient>
      </defs>
      {!band && <circle cx="32" cy="32" r="30" fill={`url(#${u}g)`} />}
      {!band && <circle cx="32" cy="32" r="30" fill="none" stroke={INK} strokeWidth="1.5" />}
      {!band && <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1" strokeDasharray="2 3" />}
      {f ? (f.fillet ? <FilletArt f={f.fillet} u={u} /> : <FishArt f={f} u={u} />) : <OtherArt id={id} u={u} />}
    </svg>
  )
}
