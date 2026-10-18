import * as THREE from 'three'

/**
 * The shop's lettering: Zen Antique, a retro Mincho with the pen's swell in every stroke (index.html asks for it in a
 * subset of just the characters the signs use: add a new sign's characters to SIGN_CHARS there, and here).
 */
export const SIGN_FONT = '"Zen Antique", "Noto Serif TC", "Noto Serif JP", serif'
/** every character the signs set in it (kept in step with the font request in index.html) */
export const SIGN_CHARS = '聞野炭火銘酒男女廁飲料お手洗い会計結帳生ビール清酒烏龍茶ラムネ缶ハイボール珈琲茶コーラ乳酸菌紀州備長炭千萬兩ごみ屑食堂麵包鼎沸いらっしゃいませ甲粗飽深夜燒烤魚日式令¥0123456789ドリンク·MENWO類牛スポツチュ大漁旬名物本推薦鮭鯖焼歓迎営業中秋刀自慢のすめ御神'

type Painted = { c: HTMLCanvasElement; draw: (g: CanvasRenderingContext2D, w: number, h: number) => void; tex: THREE.CanvasTexture }
const painted: Painted[] = []
let fontsOk = false

/** paint every sign again, now the font's here (they were first drawn in whatever stood in for it) */
function repaintAll() {
  for (const p of painted) {
    const g = p.c.getContext('2d')!
    g.clearRect(0, 0, p.c.width, p.c.height)
    g.setTransform(1, 0, 0, 1, 0, 0)
    p.draw(g, p.c.width, p.c.height)
    p.tex.needsUpdate = true
    for (const f of followers.get(p.tex) ?? []) f.needsUpdate = true
  }
}
/** clones of a sign texture (cut to a part of it, say): they keep their own version, so are told when it's repainted */
const followers = new WeakMap<THREE.Texture, THREE.Texture[]>()
export function followSign(tex: THREE.Texture, clone: THREE.Texture) {
  followers.set(tex, [...(followers.get(tex) ?? []), clone])
}
if (typeof document !== 'undefined' && document.fonts) {
  // (load() answers with no faces at all while the font's page hasn't been asked for yet: not loaded, try again later)
  const ask = () => document.fonts.load('bold 40px "Zen Antique"', SIGN_CHARS).then((faces) => {
    if (!faces.length) return
    fontsOk = true
    repaintAll()
  }).catch(() => {})
  // (the font's page may not have been asked for yet when this runs: once the page has, and the font's in)
  void ask()
  void document.fonts.ready.then(() => { if (!fontsOk) void ask() })
  document.fonts.addEventListener('loadingdone', () => { if (!fontsOk) void ask() })
}

/** a canvas texture painted by `draw`, painted again by it once the sign font has loaded */
export function signTexture(w: number, h: number, draw: Painted['draw'], repeat = false) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  // (drawn above with the font already in if it is; otherwise repainted once it arrives, until the texture is let go)
  const entry = { c, draw, tex }
  painted.push(entry)
  tex.addEventListener('dispose', () => {
    const i = painted.indexOf(entry)
    if (i >= 0) painted.splice(i, 1)
  })
  return tex
}

/**
 * Lettering with some design to it, as a signwriter paints it: a drop shadow under it, an edge round it in a second
 * colour, the fill, and a thin bright line along the top of the strokes (the paint catching the light).
 */
export function brushText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, o: {
  fill: string; edge?: string; shadow?: string; shine?: string; weight?: string; spacing?: number } ) {
  g.save()
  g.font = `${o.weight ?? 'bold'} ${size}px ${SIGN_FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  if (o.spacing) (g as unknown as { letterSpacing: string }).letterSpacing = `${o.spacing}px`
  const off = Math.max(1.2, size * 0.04)
  if (o.shadow) {
    g.fillStyle = o.shadow
    g.fillText(text, x + off, y + off * 1.3)
  }
  if (o.edge) {
    g.strokeStyle = o.edge
    g.lineWidth = Math.max(2, size * 0.1)
    g.strokeText(text, x, y)
  }
  g.fillStyle = o.fill
  g.fillText(text, x, y)
  if (o.shine) {
    g.globalAlpha = 0.5
    g.fillStyle = o.shine
    g.save()
    g.beginPath()
    g.rect(x - size * 3, y - size * 0.62, size * 6, size * 0.2)
    g.clip()
    g.fillText(text, x, y - off * 0.8)
    g.restore()
  }
  g.restore()
}
