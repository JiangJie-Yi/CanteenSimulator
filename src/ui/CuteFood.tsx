/*
 * The pantry's pictures of the foods, cute (the owner's, 2026-11-12: the fine inked drawings and the pictures rendered from the models both
 * not right; cute and neat, cartoon). Each food a round, chunky form in one ink line (thick, a warm dark brown, its corners rounded), filled
 * with its colour lit softly from the top left (a gradient, lighter there, deeper at the bottom right), a white gleam on it; none with a
 * face or an eye (the owner's, 2026-11-12: food doesn't grow eyes because it's cute). Drawn on a 128 square, the food in
 * the middle of it, about 100 across.
 */
import type { ReactNode } from 'react'

const INK = '#4b3426'
const LINE = 3.4
const FINE = 2
/** a colour lighter (k > 0) or darker (k < 0) */
const tone = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `#${[ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
/** an ellipse as a path */
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`
/** a rounded rectangle as a path */
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`

type Ctx = { u: string; n: number }
/** a form: its outline filled with its colour lit from the top left, inked */
function Blob({ c, d, k, at, sw = LINE, tf }: { c: Ctx; d: string; k: string; at?: [number, number]; sw?: number; tf?: string }) {
  const id = `${c.u}g${c.n++}`
  const [cx, cy] = at ?? [35, 30]
  return (
    <>
      <defs>
        <radialGradient id={id} cx={`${cx}%`} cy={`${cy}%`} r="85%">
          <stop offset="0" stopColor={tone(k, 0.42)} /><stop offset="0.5" stopColor={k} /><stop offset="1" stopColor={tone(k, -0.24)} />
        </radialGradient>
      </defs>
      <path d={d} fill={`url(#${id})`} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" transform={tf} />
    </>
  )
}
/** a white gleam */
const Gleam = ({ x, y, rx = 6, ry = 3.4, rot = -30, o = 0.85 }: { x: number; y: number; rx?: number; ry?: number; rot?: number; o?: number }) =>
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#ffffff" opacity={o} transform={`rotate(${rot} ${x} ${y})`} />
/** a bamboo skewer from one end to the other, inked */
const Stick = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <g strokeLinecap="round">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="7" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2c48e" strokeWidth="3.6" />
  </g>
)
const line = (d: string, color = INK, w = FINE, key?: string | number) => <path key={key} d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />

type FishLook = { back: string; belly: string; fin: string; len?: number; deep?: number; spot?: string; stripes?: string; bars?: string; dots?: string; beak?: string; roe?: boolean }
const FISH: Record<string, FishLook> = {
  ExtraFish: { back: '#6f9a6a', belly: '#f4f0d8', fin: '#e6c76e', spot: '#f2c34a' },
  Saury: { back: '#2f5f9c', belly: '#eef3fa', fin: '#9fb6d4', len: 1.18, deep: 0.72, beak: '#f2b43a' },
  Mackerel: { back: '#2f7f88', belly: '#f0f5f4', fin: '#9fc2c2', stripes: '#174a50' },
  Aji: { back: '#6a8a9a', belly: '#f4f4ee', fin: '#e2d08e', stripes: '#e8c45a' },
  Iwashi: { back: '#3a63a2', belly: '#f2f6fa', fin: '#a8bcd6', deep: 0.9, dots: '#1d2e52' },
  Shishamo: { back: '#b39a68', belly: '#fbecc8', fin: '#e6d4a8', deep: 0.9, roe: true },
  Hokke: { back: '#8a7856', belly: '#f4ead2', fin: '#c8b084', bars: '#5a4a30' },
  Nodoguro: { back: '#d9473e', belly: '#fde2d6', fin: '#e8826e', deep: 1.05 },
}
/** a fish, cute: a round plump body facing left, its back's colour fading to its pale belly, a round tail, small fins, no eye */
function Fish({ c, f }: { c: Ctx; f: FishLook }) {
  const L = 44 * (f.len ?? 1), D = 26 * (f.deep ?? 1), cx = 58, cy = 64
  const id = `${c.u}f${c.n++}`
  const body = `M${cx - L} ${cy} C${cx - L} ${cy - D * 1.1} ${cx + L * 0.55} ${cy - D * 1.15} ${cx + L * 0.8} ${cy - D * 0.2} L${cx + L * 0.8} ${cy + D * 0.2} C${cx + L * 0.55} ${cy + D * 1.15} ${cx - L} ${cy + D * 1.1} ${cx - L} ${cy} Z`
  const tx = cx + L * 0.78
  const tail = `M${tx} ${cy} C${tx + 8} ${cy - 6} ${tx + 14} ${cy - D * 0.95} ${tx + 22} ${cy - D * 0.8} C${tx + 17} ${cy - 6} ${tx + 17} ${cy + 6} ${tx + 22} ${cy + D * 0.8} C${tx + 14} ${cy + D * 0.95} ${tx + 8} ${cy + 6} ${tx} ${cy} Z`
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone(f.back, 0.12)} /><stop offset="0.45" stopColor={f.back} /><stop offset="0.62" stopColor={tone(f.belly, -0.04)} /><stop offset="1" stopColor={f.belly} />
        </linearGradient>
      </defs>
      <Blob c={c} k={f.fin} d={tail} at={[20, 30]} />
      {/* (a fin on its back and one under it) */}
      <Blob c={c} k={f.fin} d={`M${cx - 4} ${cy - D * 0.9} Q${cx + 6} ${cy - D * 1.55} ${cx + 18} ${cy - D * 0.82} Z`} sw={2.6} />
      <Blob c={c} k={f.fin} d={`M${cx + 8} ${cy + D * 0.86} Q${cx + 16} ${cy + D * 1.4} ${cx + 24} ${cy + D * 0.7} Z`} sw={2.6} />
      <path d={body} fill={`url(#${id})`} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      {f.stripes && [0, 1, 2, 3].map((k) => line(`M${cx - 6 + k * 11} ${cy - D * 0.82} q4 ${D * 0.25} 0 ${D * 0.5}`, f.stripes, 2.4, k))}
      {f.bars && [0, 1, 2].map((k) => line(`M${cx + k * 12} ${cy - D * 0.85} v${D * 0.7}`, f.bars, 3, k))}
      {f.dots && [0, 1, 2, 3].map((k) => <circle key={k} cx={cx - 8 + k * 10} cy={cy - 2} r="2.2" fill={f.dots} />)}
      {f.spot && <ellipse cx={cx - L * 0.12} cy={cy - D * 0.15} rx="5" ry="3.4" fill={f.spot} opacity="0.9" />}
      {f.roe && <ellipse cx={cx + 2} cy={cy + D * 0.45} rx="14" ry="5" fill="#f6b24c" opacity="0.55" />}
      {f.beak && <path d={`M${cx - L - 1} ${cy - 1} l-7 1.5 l7 1.5 Z`} fill={f.beak} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {/* (the gill's curve) */}
      {line(`M${cx - L * 0.3} ${cy - D * 0.62} Q${cx - L * 0.18} ${cy} ${cx - L * 0.3} ${cy + D * 0.62}`, tone(f.back, -0.35), 2)}
      <Gleam x={cx - 2} y={cy - D * 0.62} rx={10} ry={3} rot={-8} o={0.7} />
    </g>
  )
}
/** a fillet: a thick rounded slab, its flesh's colour with the white lines of its fat curving across it, its skin a dark strip along its top */
function Fillet({ c, flesh, skin, fat }: { c: Ctx; flesh: string; skin: string; fat: string }) {
  return (
    <g>
      <Blob c={c} k={flesh} d="M20 52 C20 40 30 36 44 37 L96 40 C108 41 112 48 110 60 L106 84 C104 94 96 96 84 95 L32 92 C22 91 18 84 18 74 Z" />
      <path d="M22 50 C26 40 36 36 46 37 L96 40 C104 41 109 45 110 52 C96 47 70 44 22 50 Z" fill={skin} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      {[0, 1, 2, 3].map((k) => line(`M${36 + k * 17} 54 C${30 + k * 17} 66 ${40 + k * 17} 78 ${34 + k * 17} 90`, fat, 2.6, k))}
      <Gleam x={40} y={58} rx={8} ry={3} rot={-20} />
    </g>
  )
}

/** what each food looks like (null: not drawn) */
function draw(id: string, c: Ctx): ReactNode {
  if (FISH[id]) return <Fish c={c} f={FISH[id]} />
  switch (id) {
    case 'Salmon': return <Fillet c={c} flesh="#f48a5c" skin="#8a96a6" fat="#ffe2cc" />
    case 'Buri': return <Fillet c={c} flesh="#d9897a" skin="#5d6f82" fat="#fbd8cc" />
    case 'Gindara': return <Fillet c={c} flesh="#f7efe2" skin="#3a3a42" fat="#ffffff" />
    case 'ShrimpSkewer': return <g>
      <Stick x1={10} y1={98} x2={116} y2={34} />
      {[[44, 74], [80, 52]].map(([x, y], k) => (
        <g key={k} transform={`rotate(-30 ${x} ${y})`}>
          <Blob c={c} k="#f2694a" d={`M${x - 20} ${y + 2} C${x - 20} ${y - 14} ${x + 14} ${y - 18} ${x + 20} ${y - 2} C${x + 22} ${y + 6} ${x + 14} ${y + 10} ${x + 8} ${y + 6} C${x + 4} ${y - 4} ${x - 10} ${y - 4} ${x - 12} ${y + 6} Z`} />
          {[-8, 0, 8].map((dx) => line(`M${x + dx} ${y - 12} q3 6 0 10`, '#c94a30', 1.8, dx))}
          <path d={`M${x - 20} ${y + 2} l-8 -4 l2 8 Z`} fill="#f2694a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={x + 14} cy={y - 5} r="2" fill={INK} />
        </g>
      ))}
    </g>
    case 'Squid': return <g>
      {[0, 1, 2, 3, 4].map((k) => line(`M${46 + k * 9} 84 C${44 + k * 9} 96 ${50 + k * 9} 104 ${48 + k * 9} 112`, INK, 7, `i${k}`))}
      {[0, 1, 2, 3, 4].map((k) => line(`M${46 + k * 9} 84 C${44 + k * 9} 96 ${50 + k * 9} 104 ${48 + k * 9} 112`, '#f3e2d2', 3.4, `t${k}`))}
      <Blob c={c} k="#f6e6d6" d="M64 16 C80 26 88 48 86 70 C85 80 78 86 64 86 C50 86 43 80 42 70 C40 48 48 26 64 16 Z" />
      <Blob c={c} k="#f1d8c4" d="M64 16 C72 20 84 26 92 24 C90 32 84 36 78 34 Z" sw={2.6} />
      <Blob c={c} k="#f1d8c4" d="M64 16 C56 20 44 26 36 24 C38 32 44 36 50 34 Z" sw={2.6} />
      {[0, 1, 2].map((k) => line(`M${52} ${42 + k * 10} l24 4`, '#e2b8a0', 1.8, k))}
      <Gleam x={56} y={36} rx={4} ry={8} rot={10} />
    </g>
    case 'Scallop': return <g>
      <Stick x1={12} y1={96} x2={116} y2={36} />
      {[[40, 78], [76, 58]].map(([x, y], k) => (
        <g key={k}>
          <Blob c={c} k="#f8eedc" d={ell(x, y, 16, 13)} />
          <path d={ell(x, y + 7, 15, 5)} fill="#efd9b6" opacity="0.7" />
          <Gleam x={x - 7} y={y - 6} rx={4} ry={2} />
        </g>
      ))}
    </g>
    case 'Yakitori': case 'PorkBelly': case 'BloodCake': {
      const piece = id === 'Yakitori' ? '#e8a05a' : id === 'PorkBelly' ? '#f2b8a2' : '#4a2a2e'
      return <g>
        <Stick x1={10} y1={98} x2={118} y2={34} />
        {[[30, 86], [56, 71], [82, 56]].map(([x, y], k) => (
          <g key={k}>
            {id === 'Yakitori' && k === 1
              ? <Blob c={c} k="#f2f2d8" d={rrect(x - 8, y - 13, 16, 26, 7)} tf={`rotate(-30 ${x} ${y})`} />
              : <Blob c={c} k={piece} d={rrect(x - 12, y - 13, 24, 26, 9)} tf={`rotate(-30 ${x} ${y})`} />}
            {id === 'PorkBelly' && line(`M${x - 10} ${y + 2} q10 -6 20 -12`, '#ffffff', 2.6)}
            {id === 'BloodCake' && [0, 1, 2].map((j) => <circle key={j} cx={x - 5 + j * 5} cy={y - 4 + (j % 2) * 6} r="1.4" fill="#f6f0e8" opacity="0.7" />)}
          </g>
        ))}
        {id === 'Yakitori' && <path d="M53 58 q4 -6 8 -4" fill="none" stroke="#7fb24a" strokeWidth="3" strokeLinecap="round" />}
        <Gleam x={76} y={48} rx={4} ry={2} />
      </g>
    }
    case 'Sausage': return <g>
      {/* (its casing twisted off at both ends) */}
      <Blob c={c} k="#b8442e" d={ell(18, 68, 5, 4)} sw={2.4} />
      <Blob c={c} k="#b8442e" d={ell(112, 70, 5, 4)} sw={2.4} />
      <Blob c={c} k="#c9573e" d="M22 70 C20 56 36 48 64 50 C92 52 110 56 108 70 C106 82 90 88 64 86 C36 84 24 82 22 70 Z" />
      {[44, 64, 84].map((x) => line(`M${x - 4} 54 l8 6`, '#8a2f20', 2.2, x))}
      <Gleam x={42} y={56} rx={10} ry={3} rot={-6} />
    </g>
    case 'GrilledCorn': return <g>
      <Blob c={c} k="#8cbf4e" d="M18 76 C30 58 54 50 70 54 L50 92 C36 92 22 88 18 76 Z" sw={2.8} />
      <Blob c={c} k="#f4c844" d="M30 64 C40 40 76 30 100 40 C116 48 114 70 98 82 C78 96 44 96 34 86 C26 80 26 72 30 64 Z" />
      {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((k) => <ellipse key={`${r}${k}`} cx={44 + k * 11 - r * 1.5} cy={48 + r * 9} rx="3.6" ry="3" fill="#fbe08a" stroke="#d9a53a" strokeWidth="1" />))}
      <Blob c={c} k="#9ccc5a" d="M24 82 C38 86 58 88 76 94 C58 100 34 98 24 82 Z" sw={2.8} />
      <Gleam x={60} y={44} rx={10} ry={3} rot={-14} />
    </g>
    case 'GrilledShiitake': return <g>
      <Blob c={c} k="#efe1c6" d={rrect(54, 64, 20, 34, 8)} />
      <Blob c={c} k="#9a6a44" d="M18 66 C18 38 42 24 64 24 C86 24 110 38 110 66 C98 74 30 74 18 66 Z" />
      {line('M46 40 L82 56 M82 40 L46 56', '#f4e6cc', 3.4)}
      <Gleam x={42} y={38} rx={9} ry={3.4} rot={-24} />
    </g>
    case 'KingOyster': return <g>
      <Blob c={c} k="#f3ead8" d="M44 46 C44 70 40 96 48 106 C58 112 74 112 82 104 C90 94 84 70 84 46 Z" />
      <Blob c={c} k="#b48a5e" d="M30 50 C30 30 46 20 64 20 C82 20 98 30 98 50 C86 56 42 56 30 50 Z" />
      <Gleam x={46} y={32} rx={8} ry={3} rot={-20} />
    </g>
    case 'Shishito': return <g>
      <Blob c={c} k="#5aa040" d="M20 62 C30 48 64 46 92 50 C104 52 110 58 108 64 C104 72 76 80 50 80 C32 80 16 74 20 62 Z" />
      <path d="M106 58 C112 52 116 46 118 40" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M106 58 C112 52 116 46 118 40" fill="none" stroke="#6aa848" strokeWidth="3" strokeLinecap="round" />
      <Gleam x={46} y={56} rx={10} ry={3} rot={-6} />
    </g>
    case 'Okra': return <g>
      <Blob c={c} k="#6cae4a" d="M22 64 C34 50 70 44 98 52 L108 60 L98 70 C72 80 34 78 22 64 Z" />
      {line('M36 58 L98 56 M36 70 L96 64', '#4a8a30', 2)}
      <Blob c={c} k="#8cc05e" d={rrect(100, 52, 14, 18, 5)} sw={2.8} />
      <Gleam x={46} y={56} rx={9} ry={2.4} rot={-6} />
    </g>
    case 'Asparagus': return <g>
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`rotate(${-18 + k * 4} 64 64)`}>
          <Blob c={c} k="#7cb84e" d={rrect(14, 52 + k * 12, 92, 10, 5)} sw={2.8} />
          <Blob c={c} k="#5e9a3a" d={`M100 ${52 + k * 12} C110 ${50 + k * 12} 116 ${55 + k * 12} 116 ${57 + k * 12} C116 ${59 + k * 12} 110 ${64 + k * 12} 100 ${62 + k * 12} Z`} sw={2.8} />
          {[34, 56, 78].map((x) => line(`M${x} ${55 + k * 12} l4 2`, '#4a7e2c', 1.6, x))}
        </g>
      ))}
    </g>
    case 'Potato': return <g>
      <Blob c={c} k="#d9b47a" d="M22 66 C20 44 42 34 66 36 C92 38 110 50 108 70 C106 88 84 96 62 94 C38 92 24 84 22 66 Z" />
      {[[40, 50], [86, 52], [92, 78], [36, 80]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.6" ry="1.6" fill="#9a7444" />)}
      <Gleam x={44} y={46} rx={9} ry={3.4} rot={-18} />
    </g>
    case 'SweetPotato': return <g>
      <Blob c={c} k="#b03e5e" d="M14 70 C24 52 50 44 72 44 C96 44 114 56 116 66 C110 78 92 88 66 88 C42 88 24 82 14 70 Z" />
      {line('M30 62 q8 4 14 2 M78 54 q8 4 14 2 M84 80 q6 -3 12 -2', '#7e2440', 1.8)}
      <Gleam x={48} y={56} rx={10} ry={3} rot={-10} />
    </g>
    case 'Onion': return <g>
      <Blob c={c} k="#e0a050" d="M64 24 C70 34 98 44 100 70 C102 92 84 102 64 102 C44 102 26 92 28 70 C30 44 58 34 64 24 Z" />
      {line('M64 30 C56 50 52 76 56 100 M64 30 C72 50 76 76 72 100', '#b8762e', 1.8)}
      <path d="M64 24 L62 14 M64 24 L68 15" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <Gleam x={46} y={58} rx={4} ry={9} rot={18} />
    </g>
    case 'Negi': return <g transform="rotate(-20 64 64)">
      <Blob c={c} k="#f6f6e6" d={rrect(14, 54, 66, 20, 9)} />
      <Blob c={c} k="#8ccf5c" d="M76 54 C92 46 108 46 118 50 L118 58 C108 56 96 58 84 64 L84 74 C96 70 108 72 118 76 L116 82 C102 80 90 80 76 74 Z" sw={2.8} />
      {line('M20 58 v12', '#cfd4b4', 1.6)}
      <Gleam x={30} y={58} rx={8} ry={2.4} rot={0} />
    </g>
    case 'Carrot': return <g>
      <Blob c={c} k="#5ea83c" d="M88 34 C92 22 100 16 106 14 C104 22 100 30 94 38 Z" sw={2.6} />
      <Blob c={c} k="#5ea83c" d="M92 38 C102 30 114 28 120 30 C114 36 104 40 96 42 Z" sw={2.6} />
      <Blob c={c} k="#f08a2c" d="M16 104 C30 86 66 54 86 36 C94 32 100 38 98 46 C80 66 46 96 22 108 C18 110 14 108 16 104 Z" />
      {line('M46 76 l6 5 M62 62 l6 5 M74 50 l5 4', '#c4641a', 2)}
      <Gleam x={78} y={44} rx={6} ry={2} rot={-40} />
    </g>
    case 'Gobo': return <g transform="rotate(-24 64 64)">
      {[0, 1].map((k) => <Blob key={k} c={c} k="#8a6a48" d={rrect(10, 52 + k * 16, 108, 13, 6)} sw={2.8} />)}
      {[30, 54, 78, 98].map((x) => line(`M${x} 55 v8 M${x + 6} 71 v8`, '#5e4428', 1.6, x))}
    </g>
    case 'Daikon': return <g>
      <Blob c={c} k="#7ab84c" d="M52 30 C46 18 50 10 58 8 C60 18 62 24 64 30 Z" sw={2.6} />
      <Blob c={c} k="#7ab84c" d="M64 30 C66 18 74 10 82 12 C80 20 74 26 70 32 Z" sw={2.6} />
      <Blob c={c} k="#f6f4ea" d="M44 34 C56 28 76 28 86 34 C90 56 86 84 70 104 C66 110 60 110 56 104 C42 84 40 56 44 34 Z" />
      <Gleam x={52} y={50} rx={3.6} ry={10} rot={6} />
    </g>
    // ---- the summer vegetables (the owner's, 2026-11-12)
    case 'Tomato': return <g>
      <Blob c={c} k="#ec3a2c" d="M24 64 C24 42 42 32 64 32 C86 32 104 42 104 64 C104 88 86 100 64 100 C42 100 24 88 24 64 Z" />
      <Blob c={c} k="#5ea83c" d="M64 30 L56 40 L64 38 L70 44 L72 36 L82 36 L72 30 L74 22 L66 28 L58 22 Z" sw={2.4} />
      <Gleam x={44} y={48} rx={9} ry={4} rot={-30} />
    </g>
    case 'Cucumber': return <g transform="rotate(-18 64 64)">
      <Blob c={c} k="#3f8a34" d="M14 66 C14 54 30 50 64 50 C98 50 114 54 114 66 C114 78 98 82 64 82 C30 82 14 78 14 66 Z" />
      {[[30, 58], [52, 56], [76, 57], [98, 60], [40, 74], [66, 76], [90, 72]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="#cfe6a8" />)}
      <path d="M112 64 l6 -3" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <Gleam x={40} y={56} rx={12} ry={2.6} rot={0} />
    </g>
    case 'Eggplant': return <g>
      <Blob c={c} k="#5a2a6e" d="M34 42 C44 30 62 34 74 48 C88 60 106 70 106 88 C106 102 92 108 78 104 C62 100 48 84 40 68 C34 58 30 48 34 42 Z" />
      <Blob c={c} k="#3e7a34" d="M28 36 C34 28 46 28 52 34 C48 40 44 46 38 50 C34 46 30 42 28 36 Z" sw={2.6} />
      <path d="M32 34 L22 24" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M32 34 L22 24" stroke="#3e7a34" strokeWidth="2.4" strokeLinecap="round" />
      <Gleam x={60} y={52} rx={10} ry={3.6} rot={36} />
    </g>
    case 'Piman': return <g>
      <Blob c={c} k="#2f8a26" d="M30 44 C38 32 54 34 64 38 C74 34 90 32 98 44 C106 58 100 84 88 96 C80 102 72 98 64 94 C56 98 48 102 40 96 C28 84 22 58 30 44 Z" />
      {line('M64 40 C60 60 60 80 64 94', '#1f6a18', 2)}
      <Blob c={c} k="#5ea83c" d={rrect(58, 26, 12, 14, 4)} sw={2.6} />
      <Gleam x={44} y={52} rx={4} ry={10} rot={14} />
    </g>
    case 'Paprika': return <g>
      {([['#f2b414', 40, 66], ['#e23a22', 84, 62]] as [string, number, number][]).map(([k, x, y], j) => (
        <g key={j}>
          <Blob c={c} k={k} d={`M${x - 24} ${y - 16} C${x - 16} ${y - 28} ${x} ${y - 26} ${x} ${y - 24} C${x} ${y - 26} ${x + 16} ${y - 28} ${x + 24} ${y - 16} C${x + 30} ${y} ${x + 24} ${y + 28} ${x} ${y + 30} C${x - 24} ${y + 28} ${x - 30} ${y} ${x - 24} ${y - 16} Z`} />
          <Blob c={c} k="#5ea83c" d={rrect(x - 5, y - 34, 10, 12, 3)} sw={2.4} />
          <Gleam x={x - 12} y={y - 10} rx={3.4} ry={8} rot={14} />
        </g>
      ))}
    </g>
    case 'Onigiri': return <g>
      <Blob c={c} k="#fffdf6" d="M64 20 C76 20 106 70 104 88 C102 102 26 102 24 88 C22 70 52 20 64 20 Z" />
      <path d="M38 74 H90 L94 100 Q64 104 34 100 Z" fill="#26342c" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      {line('M50 76 v24 M64 76 v26 M78 76 v24', '#3c5044', 1.6)}
      <Gleam x={48} y={42} rx={8} ry={3} rot={-50} />
    </g>
    case 'NetMochi': return <g>
      {[[44, 70], [84, 66]].map(([x, y], k) => (
        <g key={k}>
          <Blob c={c} k="#fbf6ea" d={`M${x - 20} ${y + 10} C${x - 22} ${y - 8} ${x - 8} ${y - 22} ${x + 4} ${y - 18} C${x + 16} ${y - 14} ${x + 22} ${y} ${x + 20} ${y + 12} C${x + 10} ${y + 18} ${x - 10} ${y + 18} ${x - 20} ${y + 10} Z`} />
          <ellipse cx={x + 4} cy={y + 10} rx="10" ry="3" fill="#e7b76a" opacity="0.6" />
        </g>
      ))}
      <Gleam x={36} y={56} rx={6} ry={2.6} />
    </g>
    case 'MisoSoup': return <g>
      <Blob c={c} k="#b02a20" d="M18 56 H110 C110 80 92 100 64 100 C36 100 18 80 18 56 Z" />
      <Blob c={c} k="#d8a35a" d={ell(64, 56, 46, 12)} />
      {[[48, 54], [70, 58], [80, 52]].map(([x, y]) => <rect key={`${x}${y}`} x={x - 4} y={y - 3} width="8" height="6" rx="1.6" fill="#fffaf0" stroke={INK} strokeWidth="1.4" />)}
      {[[56, 58], [92, 56]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#5ea83c" stroke={INK} strokeWidth="1.2" />)}
      {line('M44 40 q-6 -10 0 -18 M64 38 q-6 -10 0 -18 M84 40 q-6 -10 0 -18', '#c8c0b4', 2.4)}
      <Gleam x={34} y={70} rx={4} ry={8} rot={20} />
    </g>
    case 'Sake': return <g>
      <Blob c={c} k="#dfece6" d="M54 14 H74 V30 C74 40 92 46 92 62 V104 C92 110 88 112 84 112 H44 C40 112 36 110 36 104 V62 C36 46 54 40 54 30 Z" />
      <Blob c={c} k="#c8342a" d={rrect(52, 10, 24, 10, 3)} sw={2.6} />
      <Blob c={c} k="#fbf5e6" d={rrect(42, 62, 44, 34, 4)} sw={2.6} />
      <text x="64" y="86" textAnchor="middle" fontSize="20" fontWeight="700" fill="#2a2a2a" fontFamily="serif">酒</text>
      <Gleam x={46} y={54} rx={2.6} ry={10} rot={0} o={0.75} />
    </g>
    case 'Nori': return <g>
      <Blob c={c} k="#2c3a30" d={rrect(22, 30, 84, 68, 6)} />
      {[0, 1, 2, 3, 4].map((k) => line(`M${30 + k * 16} 34 v60`, '#3e5244', 1.4, k))}
      <Gleam x={36} y={40} rx={10} ry={2.6} rot={0} o={0.35} />
    </g>
    case 'RiceBag': return <g>
      <Blob c={c} k="#f2ead6" d="M28 30 C40 24 88 24 100 30 L104 102 C90 108 38 108 24 102 Z" />
      <path d="M28 30 C40 36 88 36 100 30" fill="none" stroke={INK} strokeWidth="2.4" />
      <text x="64" y="76" textAnchor="middle" fontSize="28" fontWeight="700" fill="#2a2a2a" fontFamily="serif">米</text>
      <circle cx="88" cy="90" r="6" fill="#d04558" />
      <Gleam x={38} y={48} rx={3} ry={10} rot={4} o={0.7} />
    </g>
    default: return null
  }
}
/** the foods there's a cute picture of */
export const CUTE_IDS = new Set(['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Hokke', 'Nodoguro', 'Salmon', 'Buri', 'Gindara',
  'ShrimpSkewer', 'Squid', 'Scallop', 'Yakitori', 'PorkBelly', 'BloodCake', 'Sausage', 'GrilledCorn', 'GrilledShiitake', 'KingOyster', 'Shishito',
  'Okra', 'Asparagus', 'Potato', 'SweetPotato', 'Onion', 'Negi', 'Carrot', 'Gobo', 'Daikon', 'Tomato', 'Cucumber', 'Eggplant', 'Piman', 'Paprika',
  'Onigiri', 'NetMochi', 'MisoSoup', 'Sake', 'Nori', 'RiceBag'])
/** a food's cute picture, on the 128 square (`u`: the ids of its gradients, unique to this picture) */
export function CuteFood({ id, u }: { id: string; u: string }) {
  return <g>{draw(id, { u, n: 0 })}</g>
}
