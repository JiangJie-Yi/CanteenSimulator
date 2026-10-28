/*
 * A food's picture for the pantry, drawn in the same hand-inked style as the workers' faces (ui/Avatar): a round tile tinted by where it's kept,
 * lit from the top, and the food on it in flat colours with a soft shade, a highlight and one weight of ink line. Each fish its own shape and
 * colours (the saury long and steel-blue, the salmon a pink fillet, the yellowtail its yellow stripe...), the rest each their own little picture.
 */
const INK = '#2e2118'

type Fish = { back: string; belly: string; len: number; deep: number; stripe?: string; spots?: string; fin?: string; fillet?: boolean }
const FISH: Record<string, Fish> = {
  ExtraFish: { back: '#5f7f6a', belly: '#e9e4c8', len: 1, deep: 0.36, spots: '#e6c25a', fin: '#d9b45a' },             // ayu, golden spot
  Saury: { back: '#3c5a86', belly: '#e8eef4', len: 1.25, deep: 0.22, fin: '#e2b04a' },                                // long, slim, yellow beak
  Mackerel: { back: '#2f6a6e', belly: '#e8eef0', len: 1.05, deep: 0.32, stripe: '#173a40' },                          // wavy bars on the back
  Aji: { back: '#6a7f8a', belly: '#eef0ec', len: 0.95, deep: 0.36, stripe: '#e6c25a' },                               // horse mackerel, a yellow line
  Iwashi: { back: '#3f5f8a', belly: '#f0f2f4', len: 0.9, deep: 0.3, spots: '#1c2a40' },                                // sardine, a row of dots
  Shishamo: { back: '#a08a5a', belly: '#f2e2c0', len: 0.85, deep: 0.28 },
  Salmon: { back: '#e8826a', belly: '#f6b8a0', len: 1, deep: 0.5, fillet: true },
  Hokke: { back: '#8a7a5a', belly: '#efe6d0', len: 1, deep: 0.4, stripe: '#5a4a32' },
  Buri: { back: '#3a5a7a', belly: '#eef2f0', len: 1.05, deep: 0.36, stripe: '#e6c23a' },                               // yellowtail
  Gindara: { back: '#34343c', belly: '#fbf6ec', len: 1, deep: 0.5, fillet: true },                                    // black cod: snow-white flesh, its skin near black
  Nodoguro: { back: '#d8443a', belly: '#f6c8b8', len: 0.95, deep: 0.4, fin: '#b82a20' },                               // blackthroat, red
}

const ground = (store: string) => (store === 'frozen' ? ['#d6ecfb', '#9ec8ea'] : store === 'ambient' ? ['#fbecd2', '#e8c58e'] : ['#def4e8', '#a6d6b8'])

function FishArt({ f, uid }: { f: Fish; uid: string }) {
  if (f.fillet) {
    // (a fillet: a thick slab, its flakes in pale lines, the skin a darker edge)
    return (
      <g>
        <path d="M10 28 C10 20 18 15 32 15 C46 15 54 20 54 27 C54 35 46 40 32 40 C18 40 10 36 10 28 Z" fill={`url(#${uid}b)`} stroke={INK} strokeWidth="1.6" />
        <path d="M11 33 C20 40 44 41 53 31" fill="none" stroke={f.back} strokeWidth="3" opacity="0.6" />
        {[18, 25, 32, 39, 46].map((x) => <path key={x} d={`M${x} 18 C${x + 4} 25 ${x - 2} 31 ${x + 2} 38`} fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.65" />)}
        <ellipse cx="24" cy="21" rx="7" ry="2" fill="#fff" opacity="0.45" />
      </g>
    )
  }
  const L = 22 * f.len, H = 22 * f.deep
  const x0 = 32 - L, x1 = 32 + L * 0.7
  const body = `M${x0} 30 C${x0 + L * 0.4} ${30 - H} ${x1 - L * 0.3} ${30 - H * 0.9} ${x1} 30 C${x1 - L * 0.3} ${30 + H * 0.9} ${x0 + L * 0.4} ${30 + H} ${x0} 30 Z`
  return (
    <g>
      <path d={`M${x1 - 1} 30 L${x1 + 9} ${30 - H * 0.9} Q${x1 + 6} 30 ${x1 + 9} ${30 + H * 0.9} Z`} fill={f.back} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={`M${x0 + L * 0.7} ${30 - H * 0.85} Q${x0 + L} ${30 - H * 1.45} ${x0 + L * 1.3} ${30 - H * 0.85}`} fill={f.fin ?? f.back} stroke={INK} strokeWidth="1.2" />
      <path d={body} fill={`url(#${uid}b)`} stroke={INK} strokeWidth="1.6" />
      {f.stripe && <path d={`M${x0 + 6} ${30 - H * 0.2} C${x0 + L * 0.8} ${30 - H * 0.35} ${x1 - 8} ${30 - H * 0.25} ${x1 - 2} 30`} fill="none" stroke={f.stripe} strokeWidth="2" strokeLinecap="round" opacity="0.9" />}
      {f.spots && [0.35, 0.6, 0.85, 1.1].map((t) => <circle key={t} cx={x0 + L * t} cy={30 - H * 0.15} r="1.3" fill={f.spots} />)}
      <path d={`M${x0 + L * 0.35} ${30 - H * 0.6} C${x0 + L * 0.42} ${30 - H * 0.1} ${x0 + L * 0.42} ${30 + H * 0.2} ${x0 + L * 0.33} ${30 + H * 0.6}`} fill="none" stroke={INK} strokeWidth="1.1" opacity="0.7" />
      <circle cx={x0 + L * 0.18} cy={30 - H * 0.15} r="2.3" fill="#fff" stroke={INK} strokeWidth="1" />
      <circle cx={x0 + L * 0.18 + 0.3} cy={30 - H * 0.15} r="1.1" fill={INK} />
      <path d={`M${x0 + L * 0.5} ${30 - H * 0.55} C${x0 + L} ${30 - H * 0.75} ${x1 - L * 0.4} ${30 - H * 0.6} ${x1 - 6} ${30 - H * 0.35}`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      {f.fin === '#e2b04a' && <path d={`M${x0} 30 L${x0 - 5} 29.4`} stroke="#e2b04a" strokeWidth="2.2" strokeLinecap="round" />}
    </g>
  )
}

/** the rest, each its own small picture */
function OtherArt({ id }: { id: string }) {
  const s = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' as const }
  const skewer = <line x1="10" y1="48" x2="54" y2="14" stroke="#c99a5a" strokeWidth="2.2" strokeLinecap="round" />
  switch (id) {
    case 'GrilledCorn':
      return <g transform="rotate(-35 32 32)"><path d="M32 8 C42 10 44 22 44 32 C44 44 38 54 32 56 C26 54 20 44 20 32 C20 22 22 10 32 8 Z" fill="#f2c040" {...s} />
        {Array.from({ length: 6 }, (_, r) => <path key={r} d={`M22 ${16 + r * 7} H42`} stroke="#c9902a" strokeWidth="1" />)}
        <path d="M22 50 C14 42 12 30 18 20 C20 32 24 44 30 54 Z" fill="#7aa64a" {...s} /><circle cx="27" cy="18" r="3" fill="#fff" opacity="0.5" /></g>
    case 'GrilledShiitake': case 'KingOyster':
      return id === 'KingOyster'
        ? <g><path d="M24 30 C24 46 26 54 32 54 C38 54 40 46 40 30 Z" fill="#f0e6d0" {...s} /><path d="M16 30 C16 18 48 18 48 30 C48 34 16 34 16 30 Z" fill="#a8825a" {...s} /><ellipse cx="26" cy="24" rx="5" ry="2" fill="#fff" opacity="0.4" /></g>
        : <g><path d="M27 34 L26 52 Q32 55 38 52 L37 34 Z" fill="#efe2c8" {...s} /><path d="M10 34 C10 16 54 16 54 34 Z" fill="#7a4a2a" {...s} /><path d="M20 26 L28 30 M36 24 L32 31 M44 27 L38 31" stroke="#e8d8b8" strokeWidth="1.8" strokeLinecap="round" /></g>
    case 'Onigiri':
      return <g><path d="M32 10 C40 10 54 40 50 48 C47 54 17 54 14 48 C10 40 24 10 32 10 Z" fill="#fbfaf4" {...s} /><path d="M20 38 H44 V54 H20 Z" fill="#1f2a22" {...s} /><circle cx="26" cy="22" r="1.2" fill="#ddd" /><circle cx="36" cy="28" r="1.2" fill="#ddd" /><ellipse cx="28" cy="18" rx="4" ry="2" fill="#fff" /></g>
    case 'ShrimpSkewer':
      return <g>{skewer}<path d="M18 42 C10 30 22 16 36 18 C46 20 48 32 40 36 C34 38 32 30 36 28" fill="#f07a4a" {...s} /><path d="M24 22 L30 30 M30 19 L34 27 M37 20 L38 27" stroke="#c8502a" strokeWidth="1.3" /><path d="M18 42 L12 50 L22 46 Z" fill="#e85a3a" {...s} /><circle cx="35" cy="22" r="1.2" fill={INK} /></g>
    case 'Sausage':
      return <g>{skewer}<rect x="16" y="22" width="34" height="16" rx="8" transform="rotate(-38 33 30)" fill="#b8503a" {...s} />{[0, 1, 2].map((k) => <path key={k} d={`M${24 + k * 7} ${36 - k * 5} l5 -6`} stroke="#7a2a1a" strokeWidth="1.4" />)}<path d="M22 32 l14 -11" stroke="#fff" strokeWidth="1.6" opacity="0.4" /></g>
    case 'Potato': case 'SweetPotato':
      return id === 'Potato'
        ? <g><path d="M14 32 C14 20 26 14 36 16 C48 18 52 28 50 36 C48 46 36 50 26 48 C18 46 14 40 14 32 Z" fill="#d8b070" {...s} />{[[24, 26], [38, 24], [32, 38], [44, 36]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" fill="#8a6a3a" />)}<ellipse cx="26" cy="22" rx="6" ry="2.5" fill="#fff" opacity="0.35" /></g>
        : <g><path d="M8 38 C16 22 40 14 54 22 C58 26 50 40 36 44 C24 48 12 46 8 38 Z" fill="#9a3a5a" {...s} /><path d="M16 36 C26 30 40 26 50 26" fill="none" stroke="#c86a8a" strokeWidth="2" opacity="0.6" /><path d="M54 22 L58 18" stroke={INK} strokeWidth="1.5" /></g>
    case 'Yakitori': case 'PorkBelly': case 'BloodCake':
      return <g>{skewer}{[0, 1, 2].map((k) => {
        const cx = 20 + k * 11, cy = 41 - k * 9
        return id === 'BloodCake'
          ? <rect key={k} x={cx - 6} y={cy - 6} width="12" height="12" rx="2" fill="#3a2422" {...s} />
          : id === 'PorkBelly'
            ? <g key={k}><rect x={cx - 7} y={cy - 6} width="14" height="12" rx="3" fill="#e8b49a" {...s} /><path d={`M${cx - 7} ${cy - 1} h14 M${cx - 7} ${cy + 3} h14`} stroke="#fbeee4" strokeWidth="1.6" /></g>
            : <g key={k}><path d={`M${cx - 7} ${cy} C${cx - 7} ${cy - 8} ${cx + 7} ${cy - 8} ${cx + 7} ${cy} C${cx + 7} ${cy + 7} ${cx - 7} ${cy + 7} ${cx - 7} ${cy} Z`} fill="#c87a3a" {...s} /><path d={`M${cx - 3} ${cy - 3} l3 -1`} stroke="#fff" strokeWidth="1.4" opacity="0.5" /></g>
      })}</g>
    case 'Squid':
      return <g><path d="M32 6 L44 22 C44 34 40 40 36 42 H28 C24 40 20 34 20 22 Z" fill="#f4e6dc" {...s} />{[24, 28, 32, 36, 40].map((x, k) => <path key={x} d={`M${x} 42 C${x + (k % 2 ? 3 : -3)} 50 ${x} 54 ${x + (k - 2)} 58`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />)}<circle cx="27" cy="36" r="1.6" fill={INK} /><circle cx="37" cy="36" r="1.6" fill={INK} /></g>
    case 'Shishito': case 'Okra': case 'Asparagus':
      return id === 'Asparagus'
        ? <g>{[0, 1, 2].map((k) => <g key={k} transform={`rotate(${-20 + k * 14} 32 50)`}><path d={`M30 52 L30 14 Q32 8 34 14 L34 52 Z`} fill="#6a9a3a" {...s} /><path d="M30 24 l-3 -3 M34 30 l3 -3 M30 38 l-3 -3" stroke="#3a6a2a" strokeWidth="1.2" /></g>)}</g>
        : id === 'Okra'
          ? <g><path d="M22 14 L28 10 L32 16 C40 26 44 40 42 52 C38 54 34 52 32 48 C26 36 22 24 22 14 Z" fill="#5a9a3a" {...s} /><path d="M28 16 C34 28 38 40 38 50" fill="none" stroke="#3a6a2a" strokeWidth="1.3" /></g>
          : <g><path d="M14 44 C16 30 30 18 46 16 C50 16 52 20 48 24 C40 32 30 44 18 48 C15 49 13 47 14 44 Z" fill="#4a8a2a" {...s} /><path d="M46 16 L52 10" stroke="#3a5a1a" strokeWidth="2.4" strokeLinecap="round" /><path d="M20 40 C28 32 36 26 44 22" fill="none" stroke="#9ad06a" strokeWidth="1.8" opacity="0.6" /></g>
    case 'Scallop':
      return <g><path d="M32 52 L12 26 C16 12 48 12 52 26 Z" fill="#f2c8a0" {...s} />{[-12, -6, 0, 6, 12].map((d) => <path key={d} d={`M32 52 L${32 + d * 1.4} 16`} stroke="#c88a5a" strokeWidth="1.2" />)}<path d="M26 52 h12 l-3 6 h-6 Z" fill="#e8a878" {...s} /></g>
    case 'NetMochi':
      return <g><rect x="12" y="24" width="40" height="22" rx="7" fill="#fbf6ea" {...s} /><path d="M12 36 C22 26 42 26 52 34 L52 38 C42 32 22 32 12 42 Z" fill="#d8a85a" opacity="0.7" /><ellipse cx="24" cy="28" rx="6" ry="2" fill="#fff" /></g>
    case 'MisoSoup':
      return <g><path d="M10 28 H54 C54 42 46 52 32 52 C18 52 10 42 10 28 Z" fill="#7a2a1a" {...s} /><ellipse cx="32" cy="28" rx="22" ry="6" fill="#c8823a" {...s} /><rect x="24" y="25" width="5" height="5" fill="#fbf6ea" /><rect x="34" y="27" width="5" height="5" fill="#fbf6ea" /><path d="M20 26 h8" stroke="#3a7a2a" strokeWidth="2" /></g>
    case 'Sake':
      return <g><path d="M26 8 H38 V14 C46 20 48 30 48 40 C48 50 42 56 32 56 C22 56 16 50 16 40 C16 30 18 20 26 14 Z" fill="#fbf8f0" {...s} /><path d="M18 40 H46" stroke="#2a4a8a" strokeWidth="3" /><rect x="27" y="24" width="10" height="14" fill="#c82a20" {...s} /><ellipse cx="24" cy="30" rx="2.5" ry="7" fill="#fff" opacity="0.7" /></g>
    default:
      return <circle cx="32" cy="32" r="12" fill="#d8b890" {...s} />
  }
}

/** `band`: drawn across the top of a card (no round tile, the food cropped close to fill the band; the card's band behind it) */
export function FoodArt({ id, store, size = 34, band = false }: { id: string; store: string; size?: number; band?: boolean }) {
  const uid = `fa${id}`
  const f = FISH[id]
  const [g0, g1] = ground(store)
  return (
    <svg className="food-art" width={band ? undefined : size} height={band ? undefined : size} viewBox={!band ? '0 0 64 64' : f ? (f.fillet ? '6 11 52 33' : '1 13 62 34') : '4 6 56 52'} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}g`} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} /></radialGradient>
        {f && <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={f.back} /><stop offset="0.55" stopColor={f.belly} /><stop offset="1" stopColor={f.belly} /></linearGradient>}
      </defs>
      {!band && <circle cx="32" cy="32" r="30" fill={`url(#${uid}g)`} />}
      {!band && <circle cx="32" cy="32" r="30" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.7" />}
      {f ? <FishArt f={f} uid={uid} /> : <OtherArt id={id} />}
    </svg>
  )
}
