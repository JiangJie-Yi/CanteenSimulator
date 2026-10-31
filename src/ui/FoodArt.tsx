import { useId } from 'react'

/*
 * A food's picture for the pantry: a hand-inked illustration in SVG, drawn the way the workers' faces are (ui/Avatar). Flat colours,
 * cel-shaded: each form lit from the top left, its shade one crisp darker shape and its light a clean white highlight; one ink line round the
 * outside only, the details inside drawn in a deeper tone of their own colour, so nothing looks heavy; no shadow under it. Drawn on a
 * 128-unit square for fine lines and smooth curves. On a round tile tinted by where it's kept (the faces' faint dashed ring), or cropped close
 * across a card's band. And each has what makes it itself: a fish its curved fins and their rays, a soft scale pattern along its back, the
 * gill cover, a bright eye and its own markings; a fillet its flakes and skin; the corn its kernels, the shiitake its cross cut, the squid its
 * scoring...
 */
const INK = '#3b2a20'
/** the ink line round the outside, and the lines inside, on the 128 square */
const OUT = 2.4
const IN = 1.3
/** a colour a little lighter (k > 0) or darker (k < 0), as ui/Avatar shades */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

type Fish = { back: string; belly: string; len: number; deep: number; fin: string; iris?: string; stripe?: string; spot?: string; dots?: string
  beak?: string; scutes?: boolean; bars?: string; roe?: boolean; eye?: number
  fillet?: { flesh: string; skin: string; line: string } }
const FISH: Record<string, Fish> = {
  ExtraFish: { back: '#6b8a6a', belly: '#efe9cf', len: 1, deep: 0.33, fin: '#e2be62', spot: '#f2c94c', iris: '#e8c45a' },          // ayu, a golden spot
  Saury: { back: '#2f5a90', belly: '#eef2f7', len: 1.3, deep: 0.17, fin: '#90a6c0', beak: '#f2b43a', iris: '#d8dce4' },            // long and slim
  Mackerel: { back: '#2e7078', belly: '#eef2f2', len: 1.05, deep: 0.28, fin: '#93b0b0', bars: '#173f45', iris: '#d8dce0' },          // wavy bars
  Aji: { back: '#62808f', belly: '#f1f2ed', len: 0.96, deep: 0.33, fin: '#d2c88e', stripe: '#ecc65a', scutes: true, iris: '#e8d27a', eye: 1.2 },
  Iwashi: { back: '#3d5f92', belly: '#f3f5f7', len: 0.9, deep: 0.28, fin: '#a2b6cc', dots: '#1d2c48', iris: '#d8dce4' },
  Shishamo: { back: '#a8905e', belly: '#f6e9c9', len: 0.86, deep: 0.27, fin: '#dccaa0', roe: true, iris: '#d8c890' },
  Hokke: { back: '#86765a', belly: '#f2ead6', len: 1, deep: 0.36, fin: '#bea980', bars: '#5c4c34', iris: '#d8c890' },
  Buri: { back: '#36597e', belly: '#f2f4f2', len: 1.05, deep: 0.33, fin: '#dcc45e', stripe: '#efc83c', iris: '#d8dce0' },
  Nodoguro: { back: '#d9483a', belly: '#f9d6c8', len: 0.95, deep: 0.38, fin: '#c63a2c', iris: '#e8d27a', eye: 1.45 },
  Salmon: { back: '', belly: '', len: 1, deep: 0.5, fin: '', fillet: { flesh: '#f6966e', skin: '#8e9ea9', line: '#fde3d2' } },
  Gindara: { back: '', belly: '', len: 1, deep: 0.5, fin: '', fillet: { flesh: '#fbf5ea', skin: '#30303a', line: '#e9dcc2' } },
}

const ground = (store: string) => (store === 'frozen' ? ['#d6ecfb', '#9ec8ea'] : store === 'ambient' ? ['#fbecd2', '#e8c58e'] : ['#def4e8', '#a6d6b8'])

/** a whole fish's measures, head to the left, centred on (64, 64) */
function fishParts(f: Fish) {
  const L = 44 * f.len, H = 44 * f.deep, cy = 64
  const x0 = 64 - L, xt = 64 + L * 0.76
  return { L, H, cy, x0, xt, T: Math.max(H * 0.95, 11) }
}
function FishArt({ f, u }: { f: Fish; u: string }) {
  const { L, H, cy, x0, xt, T } = fishParts(f)
  const X = (k: number) => x0 + L * k
  const belly = f.roe ? 1.15 : 1
  // (the body: a rounded snout, the forehead rising to the back's highest a little behind the head, narrowing to the tail's root; the belly
  // fuller, round with roe for a shishamo)
  const body = `M${x0 + 1} ${cy + H * 0.12}
    C${x0 - 1} ${cy - H * 0.45} ${X(0.2)} ${cy - H} ${X(0.58)} ${cy - H}
    C${X(1.02)} ${cy - H} ${xt - L * 0.36} ${cy - H * 0.36} ${xt} ${cy - H * 0.16}
    L${xt} ${cy + H * 0.16}
    C${xt - L * 0.36} ${cy + H * 0.4} ${X(1.02)} ${cy + H * belly} ${X(0.55)} ${cy + H * belly}
    C${X(0.22)} ${cy + H * belly} ${x0 + 2} ${cy + H * 0.62} ${x0 + 1} ${cy + H * 0.12} Z`
  // (the line where the dark back meets the pale belly, a little wave in it)
  const backLine = `M${x0 - 4} ${cy + H * 0.02} C${X(0.3)} ${cy - H * 0.12} ${X(0.75)} ${cy + H * 0.02} ${X(1.1)} ${cy - H * 0.02} S${xt} ${cy} ${xt + 6} ${cy}`
  const backD = `${backLine} L${xt + 6} ${cy - H - 6} L${x0 - 4} ${cy - H - 6} Z`
  const finDark = shade(f.fin, -0.28)
  const er = Math.max(3.4, H * 0.2) * (f.eye ?? 1), ex = X(0.16), ey = cy - H * 0.18
  return (
    <g>
      <defs>
        <clipPath id={`${u}c`}><path d={body} /></clipPath>
        <pattern id={`${u}s`} width="6" height="5" patternUnits="userSpaceOnUse">
          <path d="M0 5 A3 3 0 0 1 6 5 M-3 2.5 A3 3 0 0 1 3 2.5 M3 2.5 A3 3 0 0 1 9 2.5" fill="none" stroke={shade(f.back, 0.45)} strokeWidth="0.6" opacity="0.55" />
        </pattern>
      </defs>
      {/* tail: forked, its two lobes curving, rays fanning out */}
      <path d={`M${xt - 2} ${cy - H * 0.14} C${xt + 5} ${cy - H * 0.3} ${xt + 13} ${cy - T * 0.75} ${xt + 21} ${cy - T}
        C${xt + 17} ${cy - T * 0.45} ${xt + 14} ${cy - T * 0.15} ${xt + 13} ${cy}
        C${xt + 14} ${cy + T * 0.15} ${xt + 17} ${cy + T * 0.45} ${xt + 21} ${cy + T}
        C${xt + 13} ${cy + T * 0.75} ${xt + 5} ${cy + H * 0.3} ${xt - 2} ${cy + H * 0.14} Z`} fill={f.fin} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      <path d={`M${xt} ${cy} C${xt + 6} ${cy + T * 0.25} ${xt + 13} ${cy + T * 0.6} ${xt + 19} ${cy + T * 0.92} C${xt + 13} ${cy + T * 0.72} ${xt + 6} ${cy + T * 0.4} ${xt} ${cy + H * 0.14} Z`} fill={finDark} opacity="0.35" />
      {[-0.7, -0.38, -0.12, 0.12, 0.38, 0.7].map((k) => <path key={k} d={`M${xt + 1} ${cy + k * H * 0.12} Q${xt + 9} ${cy + k * T * 0.45} ${xt + 16 + Math.abs(k) * 3} ${cy + k * T * 0.9}`} fill="none" stroke={finDark} strokeWidth="0.8" opacity="0.7" />)}
      {/* dorsal fin: a curved sail on the back, rays along it; the anal fin under the rear, the pelvic under the middle */}
      <path d={`M${X(0.42)} ${cy - H * 0.97} C${X(0.46)} ${cy - H * 1.5} ${X(0.6)} ${cy - H * 1.62} ${X(0.72)} ${cy - H * 1.5}
        C${X(0.86)} ${cy - H * 1.32} ${X(1.0)} ${cy - H * 1.0} ${X(1.12)} ${cy - H * 0.66} Z`} fill={f.fin} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((t) => <path key={t} d={`M${X(t)} ${cy - H * (0.98 - (t - 0.5) * 0.5)} L${X(t + 0.05)} ${cy - H * (1.5 - Math.max(0, t - 0.6) * 1.4)}`} stroke={finDark} strokeWidth="0.8" opacity="0.7" />)}
      {/* (the anal and pelvic fins: pointed, sweeping back from the belly, as a fish's lie flat when it swims) */}
      <path d={`M${X(1.0)} ${cy + H * 0.66} Q${X(1.1)} ${cy + H * 1.22} ${X(1.38)} ${cy + H * 1.02} Q${X(1.3)} ${cy + H * 0.62} ${X(1.3)} ${cy + H * 0.38} Z`} fill={f.fin} stroke={INK} strokeWidth={OUT * 0.8} strokeLinejoin="round" />
      <path d={`M${X(0.56)} ${cy + H * 0.94} Q${X(0.62)} ${cy + H * 1.36} ${X(0.84)} ${cy + H * 1.24} Q${X(0.75)} ${cy + H * 1.02} ${X(0.74)} ${cy + H * 0.9} Z`} fill={f.fin} stroke={INK} strokeWidth={OUT * 0.8} strokeLinejoin="round" />
      {/* the body: the pale belly, the dark back over it, a soft scale pattern along the back, the shade along the underside, the light along the top */}
      <path d={body} fill={f.belly} />
      <g clipPath={`url(#${u}c)`}>
        <path d={backD} fill={f.back} />
        <path d={backD} fill={`url(#${u}s)`} />
        {f.bars && [0.48, 0.64, 0.8, 0.96, 1.12, 1.28, 1.44].map((t) => <path key={t} d={`M${X(t)} ${cy - H * 1.1} q4 ${H * 0.3} -1 ${H * 0.55} q5 ${H * 0.25} 1 ${H * 0.55}`} fill="none" stroke={f.bars} strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />)}
        {f.stripe && <path d={`M${X(0.3)} ${cy - H * 0.06} C${X(0.8)} ${cy - H * 0.16} ${X(1.25)} ${cy - H * 0.06} ${xt + 4} ${cy}`} fill="none" stroke={f.stripe} strokeWidth="3" strokeLinecap="round" />}
        {f.roe && <ellipse cx={X(0.62)} cy={cy + H * 0.62} rx={L * 0.32} ry={H * 0.34} fill="#f6c88a" opacity="0.55" />}
        <path d={`M${x0 - 4} ${cy + H * 0.62} C${X(0.4)} ${cy + H * 0.85} ${X(1.0)} ${cy + H * 0.5} ${xt + 6} ${cy + H * 0.12} L${xt + 6} ${cy + H + 8} L${x0 - 4} ${cy + H + 8} Z`} fill={shade(f.belly, -0.14)} />
        {/* (the head: a touch darker, the gill cover's edge curving down behind the eye) */}
        <path d={`M${x0 - 4} ${cy - H - 4} L${X(0.32)} ${cy - H - 4} C${X(0.4)} ${cy - H * 0.35} ${X(0.4)} ${cy + H * 0.35} ${X(0.3)} ${cy + H + 4} L${x0 - 4} ${cy + H + 4} Z`} fill="#000" opacity="0.06" />
        <path d={`M${X(0.48)} ${cy - H * 0.82} C${X(0.8)} ${cy - H * 0.86} ${X(1.15)} ${cy - H * 0.55} ${xt - 2} ${cy - H * 0.2}`} fill="none" stroke="#fff" strokeWidth={Math.max(2.4, H * 0.16)} strokeLinecap="round" opacity="0.4" />
      </g>
      {/* lateral line; the scutes of a horse mackerel along its rear; a sardine's row of dots; the ayu's golden spot */}
      <path d={`M${X(0.34)} ${cy - H * 0.36} C${X(0.75)} ${cy - H * 0.46} ${X(1.15)} ${cy - H * 0.16} ${xt} ${cy}`} fill="none" stroke={shade(f.back, -0.3)} strokeWidth="0.9" opacity="0.6" />
      {f.scutes && [0.86, 0.96, 1.06, 1.16, 1.26, 1.36, 1.46].map((t) => <path key={t} d={`M${X(t)} ${cy - H * 0.04 + (t - 0.86) * H * 0.1} l2.6 -1.6 l2.6 1.6`} fill="none" stroke={shade(f.back, -0.35)} strokeWidth="1" />)}
      {f.dots && [0.48, 0.64, 0.8, 0.96, 1.12, 1.28].map((t) => <circle key={t} cx={X(t)} cy={cy - H * 0.2 + (t - 0.48) * H * 0.12} r="1.9" fill={f.dots} />)}
      {f.spot && <ellipse cx={X(0.46)} cy={cy - H * 0.34} rx="4.2" ry="2.6" fill={f.spot} stroke={shade(f.spot, -0.3)} strokeWidth="0.8" />}
      <path d={`M${X(0.31)} ${cy - H * 0.62} C${X(0.4)} ${cy - H * 0.15} ${X(0.4)} ${cy + H * 0.25} ${X(0.28)} ${cy + H * 0.66}`} fill="none" stroke={shade(f.back, -0.35)} strokeWidth={IN} strokeLinecap="round" />
      {/* the outline over it all */}
      <path d={body} fill="none" stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {/* pectoral fin: a little fan behind the gill cover, laid back along the flank */}
      <path d={`M${X(0.36)} ${cy + H * 0.2} C${X(0.44)} ${cy + H * 0.02} ${X(0.58)} ${cy + H * 0.02} ${X(0.62)} ${cy + H * 0.14}
        C${X(0.6)} ${cy + H * 0.34} ${X(0.48)} ${cy + H * 0.44} ${X(0.36)} ${cy + H * 0.2} Z`} fill={shade(f.fin, 0.35)} fillOpacity="0.85" stroke={finDark} strokeWidth={IN} strokeLinejoin="round" />
      {[0.12, 0.2, 0.28].map((t) => <path key={t} d={`M${X(0.38)} ${cy + H * 0.2} L${X(0.6)} ${cy + H * t}`} stroke={finDark} strokeWidth="0.7" opacity="0.7" />)}
      {/* the mouth; a saury's yellow beak */}
      {f.beak && <path d={`M${x0 + 2} ${cy + H * 0.02} L${x0 - 9} ${cy + H * 0.16} L${x0 + 2} ${cy + H * 0.34} Z`} fill={f.beak} stroke={INK} strokeWidth={IN} strokeLinejoin="round" />}
      <path d={`M${x0 + 1.5} ${cy + H * 0.14} q${L * 0.06} ${H * 0.08} ${L * 0.11} ${-H * 0.01}`} fill="none" stroke={INK} strokeWidth={IN} strokeLinecap="round" />
      {/* the eye: a pale ring, the iris, a dark pupil, the light caught twice */}
      <circle cx={ex} cy={ey} r={er} fill="#fbf6e8" stroke={INK} strokeWidth={IN} />
      <circle cx={ex + er * 0.06} cy={ey + er * 0.04} r={er * 0.72} fill={f.iris ?? '#d8dce0'} />
      <circle cx={ex + er * 0.1} cy={ey + er * 0.06} r={er * 0.46} fill="#1c1612" />
      <circle cx={ex - er * 0.18} cy={ey - er * 0.22} r={er * 0.2} fill="#fff" />
      <circle cx={ex + er * 0.3} cy={ey + er * 0.3} r={er * 0.09} fill="#fff" />
    </g>
  )
}

/** a fillet (切り身): a thick slab, the flakes of the muscle in pale arcs across it, the skin a band along its back, its cut side below */
function FilletArt({ f, u }: { f: NonNullable<Fish['fillet']>; u: string }) {
  const top = 'M20 62 C20 44 38 34 66 34 C92 34 108 44 108 58 C108 72 92 82 64 82 C36 82 20 76 20 62 Z'
  return (
    <g>
      <defs><clipPath id={`${u}k`}><path d={top} /></clipPath></defs>
      {/* (its thickness, the side below the face) */}
      <path d="M20 62 C20 74 34 90 64 90 C94 90 108 80 108 64 L108 58 C108 72 92 82 64 82 C36 82 20 76 20 62 Z" fill={shade(f.flesh, -0.18)} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      <path d={top} fill={f.flesh} />
      <g clipPath={`url(#${u}k)`}>
        {[30, 43, 56, 69, 82, 95].map((x) => <path key={x} d={`M${x} 30 C${x + 10} 42 ${x - 7} 52 ${x + 3} 60 C${x + 12} 70 ${x - 3} 78 ${x + 5} 88`} fill="none" stroke={f.line} strokeWidth="2.6" strokeLinecap="round" />)}
        <path d="M14 72 C40 84 88 84 112 66 L112 92 L14 92 Z" fill="#000" opacity="0.06" />
        <path d="M14 44 C40 30 92 28 114 42 L114 26 L14 26 Z" fill={f.skin} />
        <path d="M16 45 C42 32 90 30 112 43" fill="none" stroke={shade(f.skin, 0.4)} strokeWidth="1.2" />
        <path d="M32 54 C46 46 68 44 86 47" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity="0.45" />
      </g>
      <path d={top} fill="none" stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
    </g>
  )
}

/** the rest, each its own small picture, on the 128 square */
function OtherArt({ id }: { id: string }) {
  const o = { stroke: INK, strokeWidth: OUT, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const line = (c: string, w = IN) => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const })
  const hi = (d: string, w = 3.4) => <path d={d} fill="none" stroke="#fff" strokeWidth={w} strokeLinecap="round" opacity="0.6" />
  /** a bamboo skewer from lower left to upper right */
  const skewer = <g><path d="M16 104 L112 26" stroke={INK} strokeWidth="6.4" strokeLinecap="round" /><path d="M16 104 L112 26" stroke="#e2bc7c" strokeWidth="3.6" strokeLinecap="round" /></g>
  switch (id) {
    case 'GrilledCorn':
      return <g transform="rotate(-30 64 64)">
        <path d="M64 14 C84 18 90 42 90 64 C90 88 78 106 64 110 C50 106 38 88 38 64 C38 42 44 18 64 14 Z" fill="#f7cf48" {...o} />
        <path d="M64 14 C74 16 80 30 82 46 C74 40 70 28 64 14 Z M90 64 C90 88 78 106 64 110 C74 100 84 84 86 64 Z" fill="#e3a72c" />
        {Array.from({ length: 9 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
          const y = 24 + r * 9.4, w = Math.sqrt(Math.max(0, 1 - ((y - 62) / 50) ** 2)) * 25
          const x = 64 - w + (c + 0.5) * (2 * w / 5)
          return w > 6 ? <rect key={`${r}${c}`} x={x - w / 5 + 0.8} y={y - 4} width={2 * w / 5 - 1.6} height="8" rx="3" fill="#fde07a" stroke="#c88e22" strokeWidth="0.9" /> : null
        }))}
        <path d="M44 96 C28 82 24 56 34 32 C40 56 48 82 62 108 Z" fill="#82b04e" {...o} />
        <path d="M84 98 C98 86 102 66 98 46 C92 66 84 84 72 106 Z" fill="#9cc466" {...o} />
        <path d="M40 92 C34 76 34 58 38 44" {...line('#5c8a34')} />
        {hi('M52 28 C48 38 47 50 48 60')}
      </g>
    case 'GrilledShiitake':
      return <g>
        <path d="M53 66 L50 104 Q64 112 78 104 L75 66 Z" fill="#f4e8d0" {...o} />
        <path d="M66 68 L67 106 Q73 106 78 104 L75 66 Z" fill="#dcc8a4" />
        <path d="M14 68 C14 26 114 26 114 68 C100 76 28 76 14 68 Z" fill="#8a5630" {...o} />
        <path d="M76 34 C98 38 112 52 114 68 C104 72 90 74 78 74 C88 62 88 46 76 34 Z" fill="#6e4224" />
        <path d="M20 70 C38 80 90 80 108 70 C96 84 32 84 20 70 Z" fill="#ead8b6" {...o} />
        {[28, 40, 52, 64, 76, 88, 100].map((x) => <path key={x} d={`M${x} 74 L${64 + (x - 64) * 0.55} 80`} {...line('#c4aa80', 1)} />)}
        <path d="M44 44 L84 60 M84 44 L44 60" {...line('#f6e8cc', 5)} />
        <path d="M44 44 L84 60 M84 44 L44 60" {...line('#c8a878', 1)} opacity="0.5" />
        {[[30, 56], [96, 54], [62, 36], [74, 66], [40, 64]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="#e8d0a8" />)}
        {hi('M28 52 C32 42 42 36 52 34')}
      </g>
    case 'KingOyster':
      return <g>
        <path d="M44 56 C40 84 42 104 64 110 C86 104 88 84 84 56 Z" fill="#f8f0e0" {...o} />
        <path d="M68 58 C72 80 72 98 66 108 C82 102 86 84 84 56 Z" fill="#e2d2b2" />
        {[54, 62, 70, 78].map((x) => <path key={x} d={`M${x} 66 C${x - 2} 82 ${x} 94 ${x - 1} 104`} {...line('#d8c8a4', 1)} />)}
        <path d="M26 58 C26 32 102 32 102 58 C102 66 26 66 26 58 Z" fill="#a37a50" {...o} />
        <path d="M74 40 C92 44 102 50 102 58 C102 62 90 64 76 64 C84 56 82 46 74 40 Z" fill="#86603a" />
        {hi('M38 50 C44 42 56 38 66 38')}
      </g>
    case 'Onigiri':
      return <g>
        <path d="M64 14 C80 14 108 74 102 94 C98 106 30 106 26 94 C20 74 48 14 64 14 Z" fill="#fefdf8" {...o} />
        <path d="M80 30 C92 52 106 82 102 94 C100 100 90 104 80 104 C92 84 90 54 80 30 Z" fill="#ebe6d6" />
        {[[46, 42, 20], [62, 30, 70], [78, 48, 140], [54, 60, 10], [72, 66, 100], [42, 74, 50], [86, 72, 160], [60, 76, 30]].map(([x, y, a]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3.4" ry="1.7" transform={`rotate(${a} ${x} ${y})`} fill="none" stroke="#d4ccb6" strokeWidth="1" />
        ))}
        <path d="M36 76 H92 L94 104 Q64 108 34 104 Z" fill="#22302a" {...o} />
        {[42, 52, 62, 72, 82].map((x) => <path key={x} d={`M${x} 78 L${x + 2} 104`} {...line('#3a4c40', 1)} />)}
        <circle cx="64" cy="52" r="6" fill="#d04558" stroke={shade('#d04558', -0.3)} strokeWidth="1" />
        {hi('M50 30 C46 38 42 46 40 54')}
      </g>
    case 'ShrimpSkewer':
      return <g>{skewer}
        <path d="M32 88 C18 68 30 40 58 34 C82 30 100 44 94 64 C90 76 76 78 72 68 C70 60 78 56 82 60" fill="#f58a5a" {...o} />
        <path d="M32 88 C26 74 30 60 40 52 C44 66 52 76 62 80 C52 84 42 88 32 88 Z" fill="#d85a34" />
        {[[44, 42, 50, 66], [56, 37, 60, 61], [68, 35, 70, 58], [80, 38, 80, 56]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} Q${(a + c) / 2 + 4} ${(b + d) / 2} ${c} ${d}`} {...line('#b8401e')} />)}
        <path d="M32 88 L18 104 L28 104 L38 94 Z" fill="#ec6a40" {...o} />
        {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${46 + k * 7} ${70 + k} l-4 11`} {...line('#c8502a', 1.2)} />)}
        <path d="M90 52 C104 40 112 24 116 12 M88 48 C100 32 104 20 102 8" {...line('#c8502a', 1.1)} />
        <circle cx="86" cy="48" r="3" fill="#1c1612" /><circle cx="85" cy="47" r="0.9" fill="#fff" />
        {hi('M42 46 C50 40 62 36 72 36')}
      </g>
    case 'Sausage':
      return <g>{skewer}<g transform="rotate(-38 66 62)">
        <rect x="26" y="46" width="80" height="32" rx="16" fill="#c95a3e" {...o} />
        <path d="M30 70 C50 78 86 78 104 68 C102 74 96 78 90 78 H42 C36 78 31 75 30 70 Z" fill="#9a3c26" />
        {[44, 60, 76, 92].map((x) => <path key={x} d={`M${x} 49 l-8 26`} {...line('#6e2414', 3)} />)}
        {hi('M38 54 H90', 3.6)}
      </g></g>
    case 'Potato':
      return <g>
        <path d="M24 64 C24 40 50 26 72 30 C98 34 108 56 102 74 C96 94 72 100 50 96 C32 92 24 80 24 64 Z" fill="#e2bc7c" {...o} />
        <path d="M100 58 C104 70 100 86 86 94 C72 100 54 98 42 94 C62 92 82 86 92 74 C98 68 100 62 100 58 Z" fill="#c49a58" />
        {[[44, 50], [76, 44], [62, 76], [90, 70], [36, 74]].map(([x, y]) => <g key={x}><path d={`M${x - 3.4} ${y} q3.4 -2.8 6.8 0`} {...line('#8a6430', 1.2)} /><circle cx={x} cy={y + 1.2} r="1.1" fill="#8a6430" /></g>)}
        {hi('M36 52 C42 40 54 34 66 34')}
      </g>
    case 'SweetPotato':
      return <g>
        <path d="M14 76 C28 44 78 26 106 40 C118 48 104 80 74 90 C48 98 22 94 14 76 Z" fill="#b04a6c" {...o} />
        <path d="M24 86 C46 92 74 88 92 76 C100 70 106 62 108 54 C110 66 98 82 74 90 C54 96 34 94 24 86 Z" fill="#863050" />
        <path d="M88 82 C96 76 104 66 106 56 L112 60 C110 72 102 82 94 86 Z" fill="#f6d684" {...o} />
        {[[34, 72, 58, 62], [54, 78, 78, 66], [44, 60, 66, 50]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} Q${(a + c) / 2} ${(b + d) / 2 - 4} ${c} ${d}`} {...line('#6a2240', 1.2)} />)}
        <path d="M106 40 L116 30 M14 76 L6 82" stroke={INK} strokeWidth={OUT} strokeLinecap="round" />
        {hi('M30 66 C48 50 72 42 94 42')}
      </g>
    case 'Yakitori': case 'PorkBelly': case 'BloodCake':
      return <g>{skewer}{[0, 1, 2].map((k) => {
        const cx = 38 + k * 24, cy = 86 - k * 19.5
        if (id === 'BloodCake') return <g key={k}><rect x={cx - 13} y={cy - 13} width="26" height="26" rx="5" fill="#4a2c2a" {...o} />
          <path d={`M${cx + 2} ${cy + 13} H${cx + 8} Q${cx + 13} ${cy + 13} ${cx + 13} ${cy + 8} V${cy - 6}`} {...line('#2a1414', 4)} />
          {[[-5, -4], [4, 2], [-2, 6], [6, -6]].map(([a, b]) => <circle key={a} cx={cx + a} cy={cy + b} r="1.6" fill="#f4ecd8" />)}</g>
        if (id === 'PorkBelly') return <g key={k}><rect x={cx - 15} y={cy - 13} width="30" height="26" rx="6" fill="#f2bea6" {...o} />
          <path d={`M${cx - 15} ${cy - 4} h30 M${cx - 15} ${cy + 5} h30`} {...line('#fff6ee', 3.4)} />
          <path d={`M${cx - 15} ${cy + 8} h30 Q${cx + 15} ${cy + 13} ${cx + 9} ${cy + 13} h-18 Q${cx - 15} ${cy + 13} ${cx - 15} ${cy + 8} Z`} fill="#d8927a" />
          <path d={`M${cx - 9} ${cy - 13} l6 26 M${cx + 4} ${cy - 13} l6 26`} {...line('#8a3e20', 2)} opacity="0.55" /></g>
        // (chicken thigh, and a length of leek between: ねぎま)
        return <g key={k}>{k === 1
          ? <g><rect x={cx - 12} y={cy - 10} width="24" height="20" rx="8" fill="#f0f6de" {...o} /><path d={`M${cx - 6} ${cy - 10} v20 M${cx + 1} ${cy - 10} v20`} {...line('#a2c070', 1.1)} /><path d={`M${cx + 4} ${cy - 10} h3 q5 0 5 5 v10 q0 5 -5 5 h-3 Z`} fill="#d6e4b4" /></g>
          : <g><path d={`M${cx - 15} ${cy} C${cx - 16} ${cy - 16} ${cx + 14} ${cy - 18} ${cx + 15} ${cy - 2} C${cx + 16} ${cy + 14} ${cx - 14} ${cy + 16} ${cx - 15} ${cy} Z`} fill="#d8944c" {...o} />
            <path d={`M${cx - 12} ${cy + 8} C${cx - 2} ${cy + 14} ${cx + 12} ${cy + 8} ${cx + 15} ${cy - 2} C${cx + 16} ${cy + 14} ${cx - 8} ${cy + 16} ${cx - 12} ${cy + 8} Z`} fill="#b06630" />
            <path d={`M${cx - 8} ${cy + 6} l6 -12 M${cx + 2} ${cy + 8} l6 -12`} {...line('#7a3612', 2.4)} />{hi(`M${cx - 8} ${cy - 8} l8 -3`, 2.6)}</g>}</g>
      })}</g>
    case 'Squid':
      return <g>
        <path d="M64 10 L90 40 C92 66 82 80 74 84 H54 C46 80 36 66 38 40 Z" fill="#fbf1e8" {...o} />
        <path d="M64 10 L90 40 L80 44 L64 24 L48 44 L38 40 Z" fill="#f2d8cc" {...o} />
        <path d="M76 46 C82 60 80 76 74 84 C84 80 92 66 90 40 Z" fill="#ecd2c2" />
        {[0, 12, 24].map((d) => <path key={d} d={`M44 ${46 + d} L84 ${60 + d - 12}`} {...line('#dcb4a0', 1)} />)}
        {[0, 12, 24].map((d) => <path key={`b${d}`} d={`M44 ${58 + d - 12} L84 ${44 + d}`} {...line('#dcb4a0', 1)} />)}
        {[[50, 58], [72, 52], [62, 72]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="#b4687a" opacity="0.8" />)}
        {[46, 54, 62, 70, 78, 84].map((x, k) => <path key={x} d={`M${x} 84 C${x + (k % 2 ? 6 : -6)} 98 ${x} 106 ${x + (k - 2.5) * 2.6} 118`} fill="none" stroke={INK} strokeWidth="6.6" strokeLinecap="round" />)}
        {[46, 54, 62, 70, 78, 84].map((x, k) => <path key={`f${x}`} d={`M${x} 84 C${x + (k % 2 ? 6 : -6)} 98 ${x} 106 ${x + (k - 2.5) * 2.6} 118`} fill="none" stroke="#f0d4c4" strokeWidth="3.6" strokeLinecap="round" />)}
        <circle cx="54" cy="76" r="3.4" fill="#1c1612" /><circle cx="74" cy="76" r="3.4" fill="#1c1612" />
        <circle cx="53" cy="75" r="1" fill="#fff" /><circle cx="73" cy="75" r="1" fill="#fff" />
        {hi('M50 36 C48 48 48 58 50 66')}
      </g>
    case 'Asparagus':
      return <g>{[0, 1, 2].map((k) => <g key={k} transform={`rotate(${-18 + k * 13} 64 108)`}>
        <path d="M59 108 L59 32 Q64 18 69 32 L69 108 Z" fill="#7cae46" {...o} />
        <path d="M65 34 L69 32 L69 108 L65 108 Z" fill="#5a8a30" />
        <path d="M59.5 32 Q64 20 68.5 32 Q64 28 59.5 32 Z" fill="#7a5a8c" />
        {[48, 62, 76, 90].map((y, j) => <path key={y} d={j % 2 ? `M69 ${y} l5 -6` : `M59 ${y} l-5 -6`} {...line('#3e6a24', 1.6)} />)}
        {hi('M62 40 V100', 1.8)}
      </g>)}</g>
    case 'Okra':
      return <g>
        <path d="M44 26 L58 18 L66 30 C82 50 90 78 86 104 C78 110 68 106 64 96 C52 72 44 50 44 26 Z" fill="#6ea840" {...o} />
        <path d="M70 34 C82 54 88 78 86 104 C80 106 76 104 74 100 C80 80 78 56 70 34 Z" fill="#4e8a2c" />
        {[[54, 30, 76, 102], [62, 28, 82, 100]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} C${a + 10} ${(b + d) / 2} ${c} ${d - 20} ${c} ${d}`} {...line('#3a6a20', 1.2)} />)}
        <path d="M44 26 L58 18 L66 30 L56 26 Z" fill="#587a2a" {...o} />
        {[[60, 52], [70, 72], [66, 88]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" fill="#d6eab4" />)}
        {hi('M50 38 C56 56 62 72 66 88', 2.8)}
      </g>
    case 'Shishito':
      return <g>
        <path d="M24 90 C28 62 58 36 90 30 C100 28 106 38 96 48 C82 64 60 88 34 98 C26 100 22 96 24 90 Z" fill="#5c9e38" {...o} />
        <path d="M32 96 C56 86 80 64 96 48 C100 44 102 40 101 36 C104 44 96 54 86 62 C70 78 52 92 34 98 Z" fill="#3e7a24" />
        <path d="M92 30 C96 26 100 26 102 30 L98 34 Z" fill="#4e6e24" {...o} />
        <path d="M100 28 C104 20 108 16 114 14" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M100 28 C104 20 108 16 114 14" stroke="#6a8a34" strokeWidth="2.4" strokeLinecap="round" />
        {hi('M38 80 C52 66 68 50 86 38')}
      </g>
    case 'Scallop':
      return <g>
        <path d="M64 106 L20 52 C28 20 100 20 108 52 Z" fill="#f6d0a6" {...o} />
        <path d="M64 106 L88 70 C96 58 104 54 108 52 Z" fill="#dea47a" />
        {[-32, -22, -11, 0, 11, 22, 32].map((d) => <path key={d} d={`M64 106 Q${64 + d * 0.7} 68 ${64 + d * 1.35} 28`} {...line('#bc7c52', 1.2)} />)}
        <path d="M48 106 h32 l-6 12 h-20 Z" fill="#e6aa7a" {...o} />
        <ellipse cx="64" cy="62" rx="20" ry="15" fill="#fffaf0" {...o} />
        <path d="M72 50 C82 54 86 62 82 70 C78 74 70 76 64 77 C76 70 78 58 72 50 Z" fill="#efe2c8" />
        <path d="M46 68 C52 80 76 80 82 68" fill="none" stroke="#f2a466" strokeWidth="4.4" strokeLinecap="round" />
        {hi('M54 54 C58 50 64 48 70 49', 3)}
      </g>
    case 'NetMochi':
      return <g>
        <rect x="22" y="44" width="84" height="48" rx="14" fill="#fffdf6" {...o} />
        <path d="M22 74 C42 60 82 58 106 70 V80 C106 87 100 92 92 92 H36 C28 92 22 87 22 80 Z" fill="#e8bc72" />
        <path d="M22 84 C42 76 82 76 106 82 V80 C106 87 100 92 92 92 H36 C28 92 22 87 22 84 Z" fill="#c8964c" />
        {[36, 52, 68, 84].map((x) => <path key={x} d={`M${x} 46 l12 44`} {...line('#8a5a2a', 2)} opacity="0.55" />)}
        <path d="M58 44 C58 32 72 32 72 42" fill="#fffdf6" {...o} />
        <rect x="22" y="44" width="84" height="48" rx="14" fill="none" {...o} />
        {hi('M32 54 H58', 3.6)}
      </g>
    case 'MisoSoup':
      return <g>
        <path d="M18 54 H110 C110 84 92 106 64 106 C36 106 18 84 18 54 Z" fill="#a8301e" {...o} />
        <path d="M80 56 H110 C110 84 92 106 64 106 C84 98 94 80 96 56 Z" fill="#7a1a0e" />
        <path d="M48 106 h32 v6 h-32 Z" fill="#3a0e08" {...o} />
        <ellipse cx="64" cy="54" rx="46" ry="13" fill="#d89c52" {...o} />
        <path d="M30 58 C46 64 82 64 98 58" {...line('#b8783a', 1.4)} />
        <rect x="44" y="47" width="10" height="10" rx="1.6" fill="#fffaf0" stroke="#d8c8a4" strokeWidth="1" />
        <rect x="70" y="51" width="10" height="10" rx="1.6" fill="#fffaf0" stroke="#d8c8a4" strokeWidth="1" />
        <path d="M56 58 C60 52 68 50 72 54" {...line('#2e5a1e', 4)} />
        {[36, 88, 62].map((x) => <circle key={x} cx={x} cy={x === 62 ? 46 : 54} r="2" fill="#4e8e2c" />)}
        <path d="M48 36 C44 28 52 24 48 16 M68 36 C64 28 72 24 68 16" {...line('#ffffff', 2.2)} opacity="0.7" />
        {hi('M26 64 C28 76 34 86 42 92', 3.4)}
      </g>
    case 'Sake':
      return <g>
        <path d="M54 12 H74 V24 C90 36 96 58 96 80 C96 102 82 114 64 114 C46 114 32 102 32 80 C32 58 38 36 54 24 Z" fill="#fdfcf7" {...o} />
        <path d="M74 26 C88 38 96 58 96 80 C96 100 84 112 68 114 C82 104 88 86 86 66 C84 48 80 34 74 26 Z" fill="#e6e2d6" />
        <path d="M54 12 H74 V18 H54 Z" fill="#2a4a8a" {...o} />
        <path d="M34 88 C52 94 76 94 94 88" {...line('#2a4a8a', 5)} />
        <rect x="52" y="44" width="24" height="32" rx="2" fill="#c82a20" {...o} />
        <text x="64" y="66" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" fontFamily="serif">酒</text>
        {hi('M42 52 C38 64 38 80 42 92', 4)}
      </g>
    default:
      return <circle cx="64" cy="64" r="24" fill="#d8b890" {...o} />
  }
}

/** `band`: drawn across the top of a card (no round tile, the food cropped close to fill the band; the card's band behind it) */
export function FoodArt({ id, store, size = 34, band = false }: { id: string; store: string; size?: number; band?: boolean }) {
  const u = `fa${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const f = FISH[id]
  const [g0, g1] = ground(store)
  // (cropped on a card's band to the food itself: a whole fish to its own outline, tail and fins and all)
  const fishView = (q: Fish) => {
    const { H, cy, x0, xt, T } = fishParts(q)
    const a = x0 - (q.beak ? 12 : 4), b = xt + 25, y0 = cy - H * 1.65 - 3, y1 = cy + Math.max(H * 1.05, T) + 4
    return `${a} ${y0} ${b - a} ${y1 - y0}`
  }
  const view = !band ? '0 0 128 128' : f ? (f.fillet ? '14 26 100 70' : fishView(f)) : '6 4 116 116'
  return (
    <svg className="food-art" width={band ? undefined : size} height={band ? undefined : size} viewBox={view} aria-hidden="true">
      {!band && <>
        <defs>
          <radialGradient id={`${u}g`} cx="50%" cy="28%" r="75%"><stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} /></radialGradient>
          <clipPath id={`${u}t`}><circle cx="64" cy="64" r="58" /></clipPath>
        </defs>
        <circle cx="64" cy="64" r="60" fill={`url(#${u}g)`} stroke={INK} strokeWidth="3" />
        <circle cx="64" cy="64" r="50" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="2" strokeDasharray="4 6" />
      </>}
      <g clipPath={band ? undefined : `url(#${u}t)`} transform={band ? undefined : 'translate(64 64) scale(0.86) translate(-64 -64)'}>
        {f ? (f.fillet ? <FilletArt f={f.fillet} u={u} /> : <FishArt f={f} u={u} />) : <OtherArt id={id} />}
      </g>
    </svg>
  )
}
