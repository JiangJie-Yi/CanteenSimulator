import { memo } from 'react'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'

// the shop's name: 聞野 日式烤魚 ("smelt from out in the fields"), carved on a wooden board cut like a fish
const NAMES: Record<string, Record<Lang, { main: string; sub: string }>> = {
  grilledfish: { zh: { main: '聞野', sub: '日式烤魚' }, ja: { main: '聞野', sub: '炭火焼' }, en: { main: '聞野', sub: 'Charcoal Grill' } },
}

type Pt = [number, number]
const f1 = (v: number) => v.toFixed(1)
/** a smooth run through the points (Catmull-Rom, as cubic Béziers), from the first to the last (the caller has moved to the first) */
function through(p: Pt[]) {
  let d = ''
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)]
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d
}

/**
 * The grill's board, a fish (a sea bream's lines) nose to the left, in a 300 x 110 box: its back and belly a smooth profile (blunt at the
 * nose, deepest a third of the way along, narrowing to the root of the tail), a low scalloped fin along its back, a small fin under its
 * belly, a forked tail; and the gold line inlaid a little in from its edge round the body.
 */
const SIGN = (() => {
  const X0 = 8, X1 = 246, CY = 56, TOP = 47, BOT = 45, PED = 14, N = 90, INSET = 5.5
  const g = (t: number) => Math.sqrt(t) * Math.pow(1 - t, 0.8)
  const G = g(0.5 / 1.3)
  const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  // (half the board's depth at t along it: the profile, kept from going thinner than the tail's root toward the end)
  const half = (t: number, H: number) => { const b = (H * g(t)) / G; return b + PED * sm(0.55, 1, t) * (1 - b / H) }
  const fin = (x: number) => { const s = (x - 96) / 100; return s <= 0 || s >= 1 ? 0 : 5.5 * Math.pow(Math.sin(Math.PI * s), 0.8) * (0.8 + 0.2 * Math.cos(2 * Math.PI * 4.5 * s)) }
  const pelvic = (x: number) => { const s = (x - 98) / 30; return s <= 0 || s >= 1 ? 0 : 6 * Math.pow(s < 0.7 ? s / 0.7 : (1 - s) / 0.3, 1.2) }
  const xAt = (t: number) => X0 + t * (X1 - X0)
  // (closer together toward the nose, where it turns quickest)
  const ts = Array.from({ length: N + 1 }, (_, k) => Math.pow(k / N, 1.5))
  const top: Pt[] = ts.map((t) => [xAt(t), CY - half(t, TOP) - fin(xAt(t))])
  const bot: Pt[] = ts.map((t) => [xAt(t), CY + half(t, BOT) + pelvic(xAt(t))])
  const outline = `M${X0} ${CY}${through(top)}C258 36 276 20 293 7Q297.5 5 295.5 11.5C289 26 282 42 279 56C282 70 289 86 295.5 100.5Q297.5 107 293 105`
    + `C276 92 258 76 ${X1} ${CY + PED}${through([...bot].reverse())}Z`
  // (the inlaid line: the same profile less the fins, in from the edge, closed round at the nose and in a shallow curve at the tail's root)
  const inner = ts.filter((t) => half(t, BOT) > INSET + 3)
  const topIn: Pt[] = inner.map((t) => [xAt(t), CY - half(t, TOP) + INSET])
  const botIn: Pt[] = inner.map((t) => [xAt(t), CY + half(t, BOT) - INSET])
  const a = topIn[0], e = topIn[topIn.length - 1], e2 = botIn[botIn.length - 1]
  const rule = `M${f1(a[0])} ${f1(a[1])}${through(topIn)}Q${f1(e[0] - 7)} ${CY} ${f1(e2[0])} ${f1(e2[1])}${through([...botIn].reverse())}`
    + `Q${f1(a[0] - 9)} ${CY} ${f1(a[0])} ${f1(a[1])}Z`
  // (where the cords are tied: a brass screw-eye on the edge of its back either side of its middle)
  const edgeAt = (x: number) => { const t = Math.pow((x - X0) / (X1 - X0), 1), k = top.findIndex((p) => p[0] >= x); return k > 0 ? top[k][1] : CY - half(t, TOP) }
  const eyes: Pt[] = [[70, edgeAt(70)], [190, edgeAt(190)]]
  // (scales, carved in rows over the back of its body behind the name, each a little arc open toward the head)
  let scales = ''
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 6; j++) {
      const x = 207 + i * 7.5, y = 30 + j * 9 + (i % 2) * 4.5
      const t = (x - X0) / (X1 - X0)
      if (y < CY - half(t, TOP) + INSET + 4 || y > CY + half(t, BOT) - INSET - 4) continue
      scales += `M${f1(x)} ${f1(y - 4)}Q${f1(x + 4.5)} ${f1(y)} ${f1(x)} ${f1(y + 4)}`
    }
  }
  return { outline, rule, eyes, scales }
})()
/** the sign's lettering under the name, per language, and how wide it's spread */
const SUB_WIDTH: Record<Lang, number> = { zh: 78, ja: 62, en: 96 }

// (memo: the sign's picture is the same from one of the app's renders to the next, which come many times a second while it's open)
const FishSign = memo(function FishSign({ main, sub, lang }: { main: string; sub: string; lang: Lang }) {
  const sw = SUB_WIDTH[lang]
  return (
    <svg className="fs-svg" viewBox="0 0 300 110" aria-hidden="true">
      <defs>
        <clipPath id="fs-clip"><path d={SIGN.outline} /></clipPath>
        {/* (the zelkova's grain: long wavering streaks along the board, and softer patches) */}
        <filter id="fs-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.17" numOctaves="3" seed="4" result="n" />
          <feTurbulence type="fractalNoise" baseFrequency="0.005 0.035" numOctaves="2" seed="9" result="w" />
          <feDisplacementMap in="n" in2="w" scale="20" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.1  0 0 0 0 0.04  4 0 0 0 -1.75" />
        </filter>
        {/* (the figure's rings: drawn as nested arcs, bent by a slow noise into the zelkova's wandering flame) */}
        <filter id="fs-warp" filterUnits="userSpaceOnUse" x="0" y="0" width="300" height="110">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves="2" seed="21" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="fs-patch" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.07" numOctaves="3" seed="12" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0 0.07  0 0 0 1.3 -0.55" />
        </filter>
        <filter id="fs-shadow" x="-10%" y="-20%" width="120%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#140a04" floodOpacity="0.55" />
        </filter>
        <filter id="fs-raised" x="-10%" y="-20%" width="120%" height="150%">
          <feDropShadow dx="0.4" dy="1.4" stdDeviation="0.5" floodColor="#1e0f05" floodOpacity="0.8" />
        </filter>
        <filter id="fs-glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id="fs-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b98450" />
          <stop offset="0.55" stopColor="#9c6a3c" />
          <stop offset="1" stopColor="#7c5230" />
        </linearGradient>
        <radialGradient id="fs-light" cx="0.32" cy="0.18" r="0.75">
          <stop offset="0" stopColor="#fff2d6" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff2d6" stopOpacity="0" />
        </radialGradient>
        {/* (the oiled face's sheen: a soft band of light across the top of the body) */}
        <linearGradient id="fs-sheen" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0.18" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.27" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.36" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* (the bevel round the edge: lit along the top, in shadow along the bottom) */}
        <linearGradient id="fs-bevel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="110">
          <stop offset="0" stopColor="#ffeccc" stopOpacity="0.85" />
          <stop offset="0.42" stopColor="#ffeccc" stopOpacity="0.12" />
          <stop offset="0.58" stopColor="#2a1406" stopOpacity="0.1" />
          <stop offset="1" stopColor="#2a1406" stopOpacity="0.7" />
        </linearGradient>
        {/* (gold leaf: bright, a dark band through it as polished metal shows, warm at its foot) */}
        <linearGradient id="fs-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4c8" />
          <stop offset="0.32" stopColor="#f2c867" />
          <stop offset="0.5" stopColor="#b47c2c" />
          <stop offset="0.56" stopColor="#d9a548" />
          <stop offset="0.8" stopColor="#f6d68a" />
          <stop offset="1" stopColor="#a56d27" />
        </linearGradient>
        <linearGradient id="fs-goldline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9c06a" />
          <stop offset="0.5" stopColor="#c8953f" />
          <stop offset="1" stopColor="#e9c06a" />
        </linearGradient>
      </defs>
      <g filter="url(#fs-shadow)">
        {/* the board's thickness under its face, then the face: the wood, its grain and patches, lit from the upper left */}
        <path d={SIGN.outline} transform="translate(0 3.2)" fill="#3a2212" />
        <path d={SIGN.outline} fill="url(#fs-wood)" />
        <g clipPath="url(#fs-clip)">
          <rect width="300" height="110" filter="url(#fs-patch)" opacity="0.55" />
          <g filter="url(#fs-warp)" fill="none" stroke="#4e2c12" opacity="0.4">
            {Array.from({ length: 17 }, (_, k) => <ellipse key={k} cx="150" cy="132" rx={26 + k * 17} ry={12 + k * 7.2} strokeWidth={k % 3 === 0 ? 2.1 : 1.1} />)}
          </g>
          <rect width="300" height="110" filter="url(#fs-grain)" opacity="0.9" />
          <rect width="300" height="110" fill="url(#fs-light)" />
          <rect width="300" height="110" fill="url(#fs-sheen)" />
          <path className="fs-night" d={SIGN.outline} fill="#120803" />
          <path d={SIGN.outline} fill="none" stroke="url(#fs-bevel)" strokeWidth="5" />
        </g>
      </g>
      {/* the carving: the gill's line, the mouth, the pectoral fin's rays, the scales, the tail's rays (a dark cut, its lower lip catching the light) */}
      <g className="fs-carve" fill="none" strokeLinecap="round">
        {[0, 1].map((k) => (
          <g key={k} transform={k ? 'translate(0.7 0.9)' : undefined} stroke={k ? 'rgb(255 232 190 / 0.42)' : 'rgb(46 24 10 / 0.78)'} strokeWidth={k ? 0.9 : 1.6}>
            <path d="M57 21C67 40 67 72 57 91" />
            <path d="M9 58.5C14 60.5 19 60.5 23.5 58.5" />
            <path d="M62 72L75 77M62 73L75.5 81.5M62 74L73 86M62 75L69.5 89" />
            <path d={SIGN.scales} strokeWidth={k ? 0.7 : 1.1} />
            <path d="M250 51L287 15M251 54L283 33M251 58L283 79M250 61L287 97" />
          </g>
        ))}
      </g>
      {/* the gold line inlaid round the body, seated in a fine dark cut */}
      <path d={SIGN.rule} fill="none" stroke="rgb(30 14 5 / 0.55)" strokeWidth="1.7" transform="translate(0 0.6)" />
      <path d={SIGN.rule} fill="none" stroke="url(#fs-goldline)" strokeWidth="1.3" />
      {/* the eye: an inlaid gold ring, the eye black and wet, a glint */}
      <circle cx="30" cy="44" r="6.2" fill="#1b1009" stroke="url(#fs-gold)" strokeWidth="1.8" />
      <circle cx="28.4" cy="42.3" r="1.4" fill="#fff8e6" opacity="0.9" />
      {/* the screw-eyes the cords are tied through */}
      {SIGN.eyes.map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y + 1.2} r="1.2" fill="#2a160a" />
          <circle cx={x} cy={y - 2.4} r="2.6" fill="none" stroke="#c99a48" strokeWidth="1.4" />
        </g>
      ))}
      {/* the name, gold leaf on the wood: at night it glows (a blurred copy behind it) */}
      <text className="fs-glow" x="144" y="47" textAnchor="middle" dominantBaseline="central" fontSize="54" letterSpacing="12" filter="url(#fs-glow)" fill="#ffad45">{main}</text>
      <text className="fs-name" x="144" y="47" textAnchor="middle" dominantBaseline="central" fontSize="54" letterSpacing="12" fill="url(#fs-gold)"
        stroke="#3a2010" strokeWidth="1.1" paintOrder="stroke" filter="url(#fs-raised)">{main}</text>
      {/* and under it, small, between two short gold rules with a diamond at each inner end */}
      <g className="fs-subline">
        {/* (a solid colour: a gradient sized to a flat line's box has no height to spread over, and isn't drawn; none in English, whose
            longer line would run the rules into the fin) */}
        {lang !== 'en' && <path d={`M${138 - sw / 2 - 26} 83H${138 - sw / 2 - 8}M${138 + sw / 2 + 8} 83H${138 + sw / 2 + 26}`} stroke="#d6a650" strokeWidth="1.1" />}
        <path d={`M${138 - sw / 2 - 8} 80.6l2.4 2.4-2.4 2.4-2.4-2.4zM${138 + sw / 2 + 8} 80.6l2.4 2.4-2.4 2.4-2.4-2.4z`} fill="#d6a650" />
      </g>
      <text className={`fs-sub fs-sub-${lang}`} x="138" y="83.5" textAnchor="middle" dominantBaseline="central" textLength={sw} lengthAdjust="spacing"
        fill="url(#fs-gold)" stroke="#3a2010" strokeWidth="0.5" paintOrder="stroke">{sub}</text>
    </svg>
  )
})

/**
 * The shop's sign, top-left: it hangs from two cords and sways a little in the breeze, and at night its lettering
 * lights up (and a 深夜 stamp is pressed on beside it).
 */
export function Brand({ night, lang, shop = 'grilledfish', dark = false, ignite = 0, onClick }:
  { night: boolean; lang: Lang; shop?: string; dark?: boolean; ignite?: number; onClick?: () => void }) {
  const { main, sub } = (NAMES[shop] ?? NAMES.grilledfish)[lang]
  const fish = shop === 'grilledfish'
  // (the grill's cords come down to the screw-eyes on its back: where those are, in the board's box)
  const cord = (i: number) => fish
    ? { left: `calc(${(SIGN.eyes[i][0] / 3).toFixed(2)}% - 1.5px)`, right: 'auto', height: `calc(var(--hang) + ${((SIGN.eyes[i][1] - 4) / 1.1).toFixed(2)}%)` }
    : undefined
  return (
    // dark: the business hasn't been founded yet (the sign is unlit); ignite: it's just been founded (it comes to life)
    <h1 key={`${shop}-${ignite}`} className={`brand brand-${shop}${night ? ' brand-night' : ''} brand-${lang}${dark ? ' brand-dark' : ''}${ignite ? ' brand-ignite' : ''}`}
      lang={tl(lang, 'zh-Hant', 'ja', 'en')} aria-label={`${main}${sub}${night ? ' 深夜' : ''}`}
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      style={onClick ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}>
      <span className="brand-plate" aria-hidden="true">
        <span className="brand-cord brand-cord-left" style={cord(0)} />
        <span className="brand-cord brand-cord-right" style={cord(1)} />
        {fish ? <FishSign main={main} sub={sub} lang={lang} /> : (
          <>
            <span className="brand-main">{main}</span>
            <span className="brand-sub">{sub}</span>
          </>
        )}
      </span>
      {night && <span key="night" className="brand-late" aria-hidden="true">深夜</span>}
    </h1>
  )
}
