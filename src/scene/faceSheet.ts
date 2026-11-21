import * as THREE from 'three'

/**
 * Every face in the shop, painted (the owner's, 2026-11-09: Overcooked's simple cartoon way, not the big glossy anime eyes there were):
 * small solid dark bean eyes with one tiny white dot, closed into arcs ^ ^ when happy, a little lidded at work, rounder in a fright; thick
 * rounded brows that carry the mood (pressed in at work, lifted in a fright, drooped when sad); a mouth of a line or two (a short curve,
 * a small O, a little open D when it tastes good); a faint apricot blush; a nose and the owner's moustache left as shapes. Painted in degrees round the head (az across, el up from the eyes' line's
 * middle) so one painter draws them all: the owner's and the staff's face patch (blender/boss.py: a sheet of four by two, the patch's UVs
 * slid from one frame to the next) and the customers' strips of eight (blender/folk.py's order, slid by their material).
 */
// (item 368, the owner's 「人物表情實在很僵硬」: eight more, the in-betweens and the moods: eyes half shut (a blink's way down and up, so it
// closes and opens rather than jumping), the mouth open wide (a word's syllables between it, the small O and shut), the eyes to one side and
// the other (a glance, looking where the head's about to turn), tired, shy, cross, surprised; the customers' chewing's other half, a laugh)
export const FACES = ['idle', 'blink', 'happy', 'focused', 'panic', 'proud', 'drink', 'talk', 'half', 'talkWide', 'lookL', 'lookR', 'tired', 'shy', 'mad', 'surprised'] as const
/** a face the owner and the staff make (setExpression's states) */
export type CrewFace = (typeof FACES)[number]
/** the customers' strip, in its order (blender/folk.py's EXPR, the first eight; the second row item 368's) */
export const GUEST_FACES = ['idle', 'blink', 'happy', 'mad', 'sad', 'chew', 'talk', 'surprised', 'half', 'talkWide', 'lookL', 'lookR', 'tired', 'shy', 'chew2', 'laugh'] as const
export type GuestFace = (typeof GUEST_FACES)[number]
type Face = CrewFace | GuestFace
export type FaceKind = 'boss' | 'male' | 'female' | 'elder' | 'kid'

const INK = '#1c1410'
const EYE_AZ = 19.5
const EYE_EL = 3.2
const BROW_EL = 21
/** where each kind's mouth is (degrees down from the eyes' line): the owner's under his moustache */
const MOUTH_EL: Record<FaceKind, number> = { boss: -29, male: -20.6, female: -20.6, elder: -20, kid: -20 }
/** how big each kind's eyes are (the owner's under his glasses a little smaller) */
const BIG: Record<FaceKind, number> = { boss: 0.86, male: 0.95, female: 1, elder: 0.85, kid: 1.1 }

/**
 * A face's own design (item 466, the owner's, 2026-11-21: 「你的臉都豆子臉?? 看一下五官怎設計」: every face had the same bean eyes, a dot of a
 * nose and two blushes): its eyes' build (the bean as before; almond, a white, an iris and an upper lid that rests as low as the face is
 * heavy-lidded; round and white, wide-eyed; an old face's smiling arcs), its brows' (thick, bushy, thin and arched, short, stern), a line
 * by a customer's nose (a shadow under it, or its hook down its side), its mouth's width and its lips' colour, and its marks: lashes,
 * freckles, a mole, stubble, a forehead's lines, crow's feet, the folds by the mouth, bags under the eyes, rosy cheeks. A mood is made by
 * the brows, the lids and the mouth together on every design.
 */
export type Look = {
  eye: 'bean' | 'almond' | 'round' | 'smile'
  /** where its upper lid rests over the white, in the eye's heights (0 wide open; 0.35 heavy-lidded) */
  lid: number
  /** its eyes' size, over its kind's */
  size: number
  brow: 'thick' | 'bushy' | 'thin' | 'short' | 'stern'
  /** its brows' colour, else its kind's */
  browC?: string
  /** (a customer's) a shadow under the nose, or a hook down its side; the owner's and the staff's noses are big enough as they are */
  nose: 'plain' | 'shadow' | 'hook'
  /** its mouth's width, over its kind's */
  mouth: number
  /** its lips coloured, a fuller mouth at rest */
  lips?: string
  marks: ('lashes' | 'freckles' | 'mole' | 'stubble' | 'wrinkles' | 'crowsfeet' | 'folds' | 'bags' | 'rosy')[]
}
/**
 * The designs each kind has: the owner his own; the staff one by their place (the male cook's the first, the server's the second, the stock
 * keeper's the third; the women cooks' and servers' the first two of theirs); the customers one of their kind's, by who they are
 */
export const LOOKS: Record<FaceKind, Look[]> = {
  // (the master: almond eyes a little lidded under his glasses, bushy brows, the lines of his years at their corners)
  boss: [{ eye: 'almond', lid: 0.2, size: 1, brow: 'bushy', nose: 'plain', mouth: 1, marks: ['crowsfeet'] }],
  male: [
    // (steady: almond eyes a little lidded, thick straight brows, a shadow under his nose)
    { eye: 'almond', lid: 0.14, size: 1, brow: 'thick', nose: 'shadow', mouth: 1, marks: [] },
    // (bright: round white eyes, short brows, freckles, a wide mouth)
    { eye: 'round', lid: 0, size: 1, brow: 'short', nose: 'plain', mouth: 1.15, marks: ['freckles'] },
    // (weary: heavy lids, stern brows, his nose's hook, stubble, bags under his eyes)
    { eye: 'almond', lid: 0.34, size: 0.95, brow: 'stern', nose: 'hook', mouth: 0.9, marks: ['stubble', 'bags'] },
  ],
  female: [
    // (poised: almond eyes, lashes, thin arched brows, red lips, a mole by her mouth)
    { eye: 'almond', lid: 0.08, size: 1, brow: 'thin', nose: 'plain', mouth: 0.95, lips: '#c4524a', marks: ['lashes', 'mole'] },
    // (lively: round eyes and lashes, short brows, freckles)
    { eye: 'round', lid: 0, size: 0.95, brow: 'short', nose: 'shadow', mouth: 0.85, marks: ['lashes', 'freckles'] },
    // (sweet: the bean eyes, lashes, thin brows, lips, rosy cheeks)
    { eye: 'bean', lid: 0, size: 1, brow: 'thin', nose: 'plain', mouth: 0.9, lips: '#b8483e', marks: ['lashes', 'rosy'] },
  ],
  elder: [
    // (kindly: eyes smiling shut, bushy grey brows, a forehead's lines, crow's feet, the folds by the mouth)
    { eye: 'smile', lid: 0, size: 1, brow: 'bushy', browC: '#a49e96', nose: 'shadow', mouth: 1, marks: ['wrinkles', 'crowsfeet', 'folds'] },
    // (shrewd: heavy almond eyes, thin grey brows, his nose's hook, bags, crow's feet, a mole)
    { eye: 'almond', lid: 0.3, size: 0.92, brow: 'thin', browC: '#8a8580', nose: 'hook', mouth: 0.9, marks: ['bags', 'crowsfeet', 'mole'] },
  ],
  kid: [
    { eye: 'bean', lid: 0, size: 1.12, brow: 'short', nose: 'plain', mouth: 1, marks: ['freckles', 'rosy'] },
    { eye: 'round', lid: 0, size: 1.05, brow: 'short', nose: 'plain', mouth: 1.05, marks: ['rosy'] },
  ],
}
/** a kind's design by its number (the first if there's no such) */
export const lookOf = (kind: FaceKind, n: number) => LOOKS[kind][n] ?? LOOKS[kind][0]

/** a frame on a sheet: where on it, and how degrees round the head land on it */
type Frame = { place: (az: number, el: number) => [number, number]; sx: number; sy: number }

/** the lines of age and the like, a warm brown a little darker than skin */
const LINE_C = '#b07a5a'
/** a customer's nose (blender/folk.py: a ball 7.4 degrees under the eyes' line, 4.7 round): its foot, in degrees */
const GUEST_NOSE_FOOT = -12.4

/** one face painted into `f`, as `look` has it designed; `crew`: a sheet of the owner's or the staff's (their noses big balls of their own) */
function paintFace(g: CanvasRenderingContext2D, f: Frame, kind: FaceKind, face: Face, look: Look, crew: boolean) {
  const big = BIG[kind] * look.size
  // (bean eyes: a little taller than wide, small in the face)
  const rx = 5.4 * big, ry = 6.8 * big
  const lip = kind === 'female' ? '#b8483e' : '#6a2a20'
  const browC = look.browC ?? (kind === 'elder' ? '#8a8580' : '#2e1c12')
  const browW = { boss: 3.4, male: 2.8, female: 1.9, elder: 2.4, kid: 2.4 }[kind]
  const marks = new Set(look.marks)
  const mouthEl = MOUTH_EL[kind]
  // (drawn about a point (az, el) in degrees, x across and y down, a degree to the unit)
  const at = (az: number, el: number, draw: () => void) => {
    const [x, y] = f.place(az, el)
    g.save()
    g.translate(x, y)
    g.scale(f.sx, f.sy)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    draw()
    g.restore()
  }
  const strokeIt = (w: number, path: () => void, colour = INK) => { g.strokeStyle = colour; g.lineWidth = w; g.beginPath(); path(); g.stroke() }
  const blush = (colour: string, w: number) => {
    for (const sd of [-1, 1]) at(sd * 30, -12, () => { g.fillStyle = colour; g.beginPath(); g.ellipse(0, 0, w, w * 0.6, 0, 0, Math.PI * 2); g.fill() })
  }
  // (faint, a soft apricot: solid all the same, the figures being hashed on their alpha (a see-through blush came out a scatter of dots), so
  // a pale tint near the skin's own rather than a see-through one; rosier on a rosy-cheeked design)
  const bw = (kind === 'boss' || kind === 'male' ? 4.6 : 5.4) * (marks.has('rosy') ? 1.22 : 1)
  if (face === 'shy') {
    blush('#ef9584', bw * 1.3)
    // (and its hatching: three short strokes over each cheek)
    for (const sd of [-1, 1]) at(sd * 30, -12, () => {
      g.strokeStyle = '#d0614e'; g.lineWidth = 0.9
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 2.4 - 1, 1.4); g.lineTo(i * 2.4 + 1, -1.4); g.stroke() }
    })
  } else blush(face === 'proud' || face === 'happy' || face === 'laugh' ? '#f4ae9a' : marks.has('rosy') ? '#f3b3a1' : '#f6c3b2', bw)
  // ---- the marks under the features: freckles over the cheeks, the forehead's lines, the folds from the nose to the mouth, stubble
  if (marks.has('freckles')) for (const sd of [-1, 1]) at(sd * 27, -10.5, () => {
    g.fillStyle = '#c98a6a'
    for (const [x, y] of [[-2.6, 0.4], [0, -0.9], [2.6, 0.5], [1.2, 1.9]]) { g.beginPath(); g.arc(sd * x, y, 0.72, 0, Math.PI * 2); g.fill() }
  })
  if (marks.has('wrinkles')) at(0, 29, () => {
    strokeIt(0.9, () => { g.moveTo(-9, 0); g.quadraticCurveTo(0, -1.5, 9, 0) }, LINE_C)
    strokeIt(0.9, () => { g.moveTo(-6.5, 3.2); g.quadraticCurveTo(0, 2, 6.5, 3.2) }, LINE_C)
  })
  if (marks.has('folds') && face !== 'surprised' && face !== 'panic') for (const sd of [-1, 1]) at(0, 0, () => {
    strokeIt(0.9, () => { g.moveTo(sd * 6.6, 10.5); g.quadraticCurveTo(sd * 10.6, 15.5, sd * 9.4, -mouthEl + 1.2) }, '#c08a6a')
  })
  if (marks.has('stubble')) at(0, mouthEl, () => {
    // (a scatter of short flecks round the mouth and down the chin and jaw)
    g.strokeStyle = '#7d6e66'; g.lineWidth = 0.75
    for (const [x, y] of [[-6.4, -2.2], [-7.6, 1.2], [-5.2, 3.8], [-2.4, 5.4], [0.6, 6.2], [3.2, 5.2], [5.8, 3.6], [7.4, 0.8], [6.2, -2.4],
      [-1.2, 8.4], [1.8, 8.8], [-4.2, 7.6], [4.6, 7.4], [-9.6, -1.4], [9.4, -1.8]]) { g.beginPath(); g.moveTo(x - 0.4, y - 0.3); g.lineTo(x + 0.4, y + 0.3); g.stroke() }
  })
  // ---- the nose (a customer's): a shadow under its ball, or its hook down one side of it and under (the owner's and the staff's big balls
  // of their own need none)
  if (!crew && look.nose === 'shadow') at(0, GUEST_NOSE_FOOT - 0.6, () => strokeIt(1.1, () => { g.moveTo(-2.4, -0.2); g.quadraticCurveTo(0, 1.6, 2.4, -0.2) }, '#c0806a'))
  if (!crew && look.nose === 'hook') at(0, 0, () => strokeIt(1.15, () => {
    g.moveTo(1.6, 1.2); g.quadraticCurveTo(5.9, 5.2, 4.9, 10.4); g.quadraticCurveTo(4.1, 13.4, 0.6, 13.2)
  }, LINE_C))
  for (const sd of [-1, 1]) {
    const cx = sd * EYE_AZ
    // ---- the eyes
    // (how wide each eye is to its corners, for the marks beside it)
    let wide = rx
    at(cx, EYE_EL, () => {
      // (one tiny white dot, up toward the outside: no more)
      const dot = (k = 1) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.3 * rx * sd, -0.4 * ry, 0.26 * rx * k, 0, Math.PI * 2); g.fill() }
      const bean = (sx = 1, sy = 1) => { g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, rx * sx, ry * sy, 0, 0, Math.PI * 2); g.fill() }
      const stroke = (w: number, path: () => void, colour = INK) => strokeIt(w, path, colour)
      // (a lid come down to `lid` (in the bean's heights from its middle, down positive): the bean above it cut off, its edge drawn)
      const lidded = (lid: number, sx = 1, sy = 1, dx = 0, dy = 0) => {
        g.save(); g.translate(dx * rx, dy * ry)
        g.save(); g.beginPath(); g.rect(-2 * rx, lid * ry, 4 * rx, 2 * ry); g.clip(); bean(sx, sy); dot(0.85); g.restore()
        const half = Math.sqrt(Math.max(0, 1 - lid * lid / (sy * sy))) * rx * sx
        stroke(1.8, () => { g.moveTo(-half - 0.15 * rx, lid * ry); g.lineTo(half + 0.15 * rx, lid * ry) })
        g.restore()
      }
      const shut = face === 'happy' || face === 'proud' || face === 'chew' || face === 'chew2' || face === 'laugh'
      const arcs = (w: number, k = 1) => stroke(w, () => { g.moveTo(-rx * 1.2 * k, 0.35 * ry); g.quadraticCurveTo(0, -1.0 * ry, rx * 1.2 * k, 0.35 * ry) })
      const blinkLine = (k = 1) => stroke(2.2, () => { g.moveTo(-rx * 1.1 * k, 0.5); g.quadraticCurveTo(0, 0.35 * ry, rx * 1.1 * k, 0.5) })
      const squeeze = () => stroke(2.4, () => { g.moveTo(sd * 1.1 * rx, -0.6 * ry); g.lineTo(-sd * 0.8 * rx, 0); g.lineTo(sd * 1.1 * rx, 0.6 * ry) })
      if (look.eye === 'almond' || look.eye === 'round') {
        // ---- (item 466) an eye with its white: the white's outline (an almond's pointed corners, its outer one a little up; or round), its
        // iris one dark round with its tiny light, all below the upper lid's line; the lid's line thick, the lower one fine
        const almond = look.eye === 'almond'
        const W = almond ? rx * 1.3 : rx * 1.08
        wide = W
        // (the face's lid, its tilt (its inner end down when cross, its outer when sad), the iris's look, how open)
        const lidAt = face === 'half' ? Math.max(look.lid, 0.5) : face === 'tired' ? Math.max(look.lid, 0.6) : face === 'focused' ? Math.max(look.lid, 0.3)
          : face === 'mad' ? Math.max(look.lid, 0.32) : face === 'sad' ? Math.max(look.lid, 0.2) : face === 'shy' ? look.lid + 0.1
          : face === 'panic' || face === 'surprised' ? 0 : look.lid
        const open = face === 'panic' || face === 'surprised' ? 1.14 : 1
        const H = (almond ? ry * 0.8 : ry * 0.92) * open
        const inner = face === 'mad' ? 0.55 : face === 'focused' ? 0.12 : 0, outer = face === 'sad' ? 0.5 : 0
        const lx = face === 'lookL' ? -0.5 : face === 'lookR' ? 0.5 : face === 'shy' ? -0.3 : 0, ly = face === 'shy' ? 0.45 : face === 'sad' ? 0.2 : 0
        const irisK = face === 'panic' || face === 'surprised' ? 0.55 : 1
        // (x's toward the outside of the face: `sd` across)
        const X = (x: number) => x * sd
        const whitePath = () => {
          g.beginPath()
          if (almond) {
            g.moveTo(X(-W), 0.1 * H)
            g.bezierCurveTo(X(-0.5 * W), -1.1 * H, X(0.5 * W), -1.12 * H, X(W), -0.12 * H)
            g.bezierCurveTo(X(0.55 * W), 0.9 * H, X(-0.55 * W), 0.94 * H, X(-W), 0.1 * H)
          } else g.ellipse(0, 0, W, H, 0, 0, Math.PI * 2)
          g.closePath()
        }
        // (the white's top at its middle and corners, the lid's line from the inner corner over to the outer, down by `lidAt`)
        const topMid = almond ? -0.84 * H : -H, cornerIn = almond ? 0.1 * H : -0.2 * H, cornerOut = almond ? -0.12 * H : -0.2 * H
        const yIn = cornerIn + (lidAt + inner) * 0.9 * H, yOut = cornerOut + (lidAt + outer) * 0.9 * H, yMid = topMid + lidAt * 2.1 * H + (inner + outer) * 0.5 * H
        const flat = face === 'focused' || face === 'mad'
        const lidPath = () => { g.moveTo(X(-W * 1.02), yIn); g.quadraticCurveTo(0, flat ? (yIn + yOut) / 2 - 0.05 * H : 2 * yMid - (yIn + yOut) / 2, X(W * 1.02), yOut) }
        if (shut) arcs(face === 'laugh' ? 3 : 2.6, W / (rx * 1.2))
        else if (face === 'blink') blinkLine(W / (rx * 1.1))
        else if (face === 'drink') squeeze()
        else {
          g.save()
          whitePath(); g.clip()
          // (below the lid's line only)
          g.beginPath(); lidPath(); g.lineTo(X(W * 1.4), 3 * H); g.lineTo(X(-W * 1.4), 3 * H); g.closePath(); g.clip()
          g.fillStyle = '#ffffff'; g.fillRect(-W * 1.5, -2 * H, W * 3, 4 * H)
          const ir = (almond ? H * 0.74 : H * 0.6) * irisK, ix = lx * W * 0.42, iy = 0.14 * H + ly * H * 0.4
          g.fillStyle = INK; g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill()
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ix + 0.34 * ir * sd, iy - 0.36 * ir, 0.3 * ir, 0, Math.PI * 2); g.fill()
          g.restore()
          // (the lower line fine (on an almond only its outer two thirds), the lid's line thick)
          if (almond) stroke(1.05, () => { g.moveTo(X(-0.35 * W), 0.7 * H); g.quadraticCurveTo(X(0.45 * W), 0.82 * H, X(W), -0.12 * H) })
          else stroke(1.05, () => { g.ellipse(0, 0, W, H, 0, 0.15 * Math.PI, 0.85 * Math.PI) })
          stroke(look.lid > 0.25 || lidAt > 0.25 ? 2.6 : 2.3, lidPath)
        }
        if (marks.has('lashes') && face !== 'drink') {
          // (two short lashes off the outer end of the upper lid)
          const closed = shut || face === 'blink'
          const y0 = shut ? 0.2 * ry : face === 'blink' ? 0.5 : yOut
          stroke(1.1, () => { g.moveTo(X(W * 0.98), y0); g.lineTo(X(W * 1.32), y0 - 1.9) })
          stroke(1.1, () => { g.moveTo(X(W * 0.72), y0 - (closed ? 0.9 : 0.55 * H)); g.lineTo(X(W * 0.92), y0 - (closed ? 2.6 : 0.55 * H + 1.9)) })
        }
        if ((marks.has('bags') || face === 'tired') && !shut) stroke(0.85, () => { g.moveTo(X(-0.7 * W), 1.28 * H); g.quadraticCurveTo(X(0.1 * W), 1.62 * H, X(0.8 * W), 1.18 * H) }, '#b88a7a')
        return
      }
      if (look.eye === 'smile') {
        // ---- (item 466) an old face's eyes smiling shut: soft arcs; open into small beans in a fright, a flat line at work or cross,
        // turned down when sad, low when tired
        if (face === 'panic' || face === 'surprised') { bean(0.8, 0.85); dot() }
        else if (face === 'drink') squeeze()
        else if (face === 'focused' || face === 'mad') stroke(2.2, () => { g.moveTo(-rx * 1.05, 0.2 * ry); g.lineTo(rx * 1.05, 0.2 * ry) })
        else if (face === 'sad') stroke(2.2, () => { g.moveTo(-rx * 1.05, -0.1 * ry); g.quadraticCurveTo(0, 0.75 * ry, rx * 1.05, -0.1 * ry) })
        else if (face === 'tired') stroke(2, () => { g.moveTo(-rx, 0.5 * ry); g.quadraticCurveTo(0, 0.2 * ry, rx, 0.5 * ry) })
        else arcs(shut ? 2.6 : 2.2, shut ? 1 : 0.9)
        wide = rx * 1.1
        return
      }
      if (face === 'blink') blinkLine()
      // (on the way shut or open: the lid half down over the bean)
      else if (face === 'half') lidded(0.15)
      // (happy, proud, a mouthful that's good, a laugh: closed into arcs, ^ ^)
      else if (shut) arcs(face === 'laugh' ? 3 : 2.6)
      // (a glance: the bean and its dot to one side of where it sits, a little narrower as it turns)
      else if (face === 'lookL' || face === 'lookR') {
        g.save(); g.translate((face === 'lookL' ? -0.42 : 0.42) * rx, 0); bean(0.9, 1); dot(); g.restore()
      }
      // (tired: heavy lids most of the way down, a faint shadow under)
      else if (face === 'tired') {
        lidded(0.05, 0.95, 0.9)
        stroke(0.9, () => { g.moveTo(-0.9 * rx, 1.25 * ry); g.quadraticCurveTo(0, 1.55 * ry, 0.9 * rx, 1.25 * ry) }, '#b07a6a')
      }
      // (shy: smaller, looking down and away)
      else if (face === 'shy') { g.save(); g.translate(sd * -0.2 * rx, 0.3 * ry); bean(0.82, 0.8); dot(0.8); g.restore() }
      // (gulping it down: > <)
      else if (face === 'drink') squeeze()
      // (a fright: rounder and a touch bigger, the dot as ever)
      else if (face === 'panic' || face === 'surprised') { bean(1.15, 1.0); dot(1.1) }
      // (at work, cross: the top of the bean cut flat by a lid, a little smaller)
      else if (face === 'focused' || face === 'mad') {
        g.save(); g.beginPath(); g.rect(-2 * rx, -0.25 * ry, 4 * rx, 2 * ry); g.clip(); bean(0.95, 0.95); g.restore()
        stroke(1.8, () => { g.moveTo(-1.15 * rx, -0.25 * ry); g.lineTo(1.15 * rx, -0.25 * ry) })
        g.save(); g.beginPath(); g.rect(-2 * rx, -0.25 * ry, 4 * rx, 2 * ry); g.clip(); dot(0.85); g.restore()
      } else if (face === 'sad') { bean(0.9, 0.85); dot(0.9) }
      else { bean(); dot() }
      // (lashes off a bean's outer top)
      if (marks.has('lashes') && face !== 'drink') {
        const closed = shut || face === 'blink'
        const y0 = shut ? 0.1 * ry : face === 'blink' ? 0.5 : -0.62 * ry
        stroke(1.1, () => { g.moveTo(sd * rx * 0.78, y0); g.lineTo(sd * rx * 1.25, y0 - 1.7) })
        stroke(1.1, () => { g.moveTo(sd * rx * 0.4, y0 - (closed ? 0.6 : 0.3 * ry)); g.lineTo(sd * rx * 0.62, y0 - (closed ? 2.3 : 0.3 * ry + 1.8)) })
      }
      if (marks.has('bags') && face !== 'tired' && !shut) stroke(0.85, () => { g.moveTo(-0.8 * rx, 1.25 * ry); g.quadraticCurveTo(0, 1.5 * ry, 0.8 * rx, 1.25 * ry) }, '#b88a7a')
    })
    // ---- crow's feet: three short lines fanning from the eye's outer corner (deeper when it smiles)
    if (marks.has('crowsfeet')) at(cx + sd * (wide + 1.6), EYE_EL - 0.6, () => {
      const k = face === 'happy' || face === 'laugh' || face === 'proud' ? 1.25 : 1
      for (const [a, b] of [[-1.2, -2.4], [0, 0], [1.2, 2.4]]) strokeIt(0.8, () => { g.moveTo(0, a * 0.6); g.lineTo(sd * 2.7 * k, b * 0.75 * k) }, LINE_C)
    })
    // ---- the brows: their build, tilted and lifted by the mood (inner end down when focused or cross, up when worried)
    // (the inner end down when at work or cross, up and the whole brow sagging when sad, lifted high in a fright; a stern brow's inner end
    // down a little at rest too)
    const tilt = (face === 'focused' || face === 'mad' || face === 'drink' ? 3.6 : face === 'sad' ? -4.2 : face === 'panic' ? -2.4 : face === 'tired' ? -3.2
      : face === 'shy' ? -2.2 : 0) + (look.brow === 'stern' ? 2 : 0)
    const lift = face === 'panic' || face === 'surprised' ? 6 : face === 'happy' || face === 'proud' ? 2 : face === 'laugh' ? 3 : face === 'mad' ? -1.5 : face === 'sad' ? -1
      : face === 'tired' ? -2 : face === 'shy' ? 1 : 0
    at(cx, BROW_EL - 3 + lift, () => {
      g.strokeStyle = browC; g.fillStyle = browC
      if (look.brow === 'bushy') {
        // (a thick brush, tapering out, its top tufted in three; its inner end down by the tilt)
        const yIn = tilt, yOut = -tilt * 0.3, L = 5.6
        const y = (u: number) => yIn + (yOut - yIn) * u - 1.4 * Math.sin(u * Math.PI)
        g.beginPath()
        g.moveTo(-sd * L, y(0) + 1.6)
        for (let k = 0; k < 3; k++) {
          const u1 = (k + 1) / 3, um = (k + 0.5) / 3
          g.quadraticCurveTo(sd * L * (2 * um - 1), y(um) - 3.6 + k * 0.5, sd * L * (2 * u1 - 1), y(u1) - 1.6 + (k === 2 ? 1.4 : 0))
        }
        g.quadraticCurveTo(sd * L * 0.2, y(0.5) + 2.2, -sd * L, y(0) + 1.6)
        g.closePath(); g.fill()
        return
      }
      if (look.brow === 'thin') {
        g.lineWidth = Math.max(1.2, browW * 0.62)
        g.beginPath(); g.moveTo(-sd * 4.9, tilt * 0.9 + 0.4); g.quadraticCurveTo(sd * 0.6, -2.4 - Math.abs(tilt) * 0.15, sd * 5.4, -tilt * 0.3 + 0.8); g.stroke()
        return
      }
      if (look.brow === 'short') {
        g.lineWidth = browW * 1.25
        g.beginPath(); g.moveTo(-sd * 2.4, tilt * 0.6); g.quadraticCurveTo(0, -1 - Math.abs(tilt) * 0.12, sd * 2.2, -tilt * 0.2); g.stroke()
        return
      }
      g.lineWidth = browW * (look.brow === 'stern' ? 1.4 : 1.25)
      g.beginPath()
      g.moveTo(-sd * 4.6, tilt); g.quadraticCurveTo(0, -1.2 - Math.abs(tilt) * 0.15, sd * 4.6, -tilt * 0.3)
      g.stroke()
    })
  }
  // ---- the mouth
  at(0, mouthEl, () => {
    const dark = '#5a1810', tongue = '#e8786a'
    const m = look.mouth
    const lipC = look.lips ?? lip
    const line = (w: number, path: () => void) => { g.strokeStyle = lipC; g.lineWidth = w; g.beginPath(); path(); g.stroke() }
    // (a mouth at rest: a short gentle curve; or, coloured lips, a fuller one: its two lips and the line between)
    const rest = () => {
      if (look.lips) {
        g.fillStyle = look.lips
        g.beginPath(); g.moveTo(-3.3 * m, 0.2); g.quadraticCurveTo(-1.2 * m, -1.3, 0, -0.5); g.quadraticCurveTo(1.2 * m, -1.3, 3.3 * m, 0.2)
        g.quadraticCurveTo(0, 2.8, -3.3 * m, 0.2); g.closePath(); g.fill()
        g.strokeStyle = '#7a2820'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-3 * m, 0.3); g.quadraticCurveTo(0, 1, 3 * m, 0.3); g.stroke()
      } else line(1.7, () => { g.moveTo(-3.4 * m, -0.2); g.quadraticCurveTo(0, 2, 3.4 * m, -0.2) })
    }
    if (face === 'idle' || face === 'blink' || face === 'half' || face === 'lookL' || face === 'lookR') rest()
    // (a word's open syllable: a D taller than the happy one, the tongue low in it)
    else if (face === 'talkWide') {
      g.beginPath(); g.moveTo(-3.6 * m, -1.4); g.lineTo(3.6 * m, -1.4); g.ellipse(0, -1.4, 3.6 * m, 4.6, 0, 0, Math.PI); g.closePath()
      g.fillStyle = dark; g.fill()
      g.save(); g.clip()
      g.fillStyle = tongue; g.beginPath(); g.ellipse(0, 3.2, 2.4 * m, 1.6, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    }
    // (tired: a short flat line, sagging at its ends)
    else if (face === 'tired') line(1.5, () => { g.moveTo(-2.6 * m, 0.9); g.quadraticCurveTo(0, 0.1, 2.6 * m, 0.9) })
    // (shy: a small wavering line)
    else if (face === 'shy') line(1.4, () => { g.moveTo(-2.4 * m, 0.4); g.bezierCurveTo(-1.4 * m, -0.8, -0.6 * m, 1.2, 0, 0.3); g.bezierCurveTo(0.6 * m, -0.6, 1.4 * m, 1.2, 2.4 * m, 0.2) })
    // (the other half of chewing: shut, the cheek puffed to one side)
    else if (face === 'chew2') line(1.6, () => { g.moveTo(-3 * m, 0.6); g.quadraticCurveTo(-0.4 * m, 1.8, 1.4 * m, 0.2); g.quadraticCurveTo(2.6 * m, -0.6, 3.4 * m, 0.4) })
    else if (face === 'happy' || face === 'proud' || face === 'laugh') {
      // (a little open D: its top flat, a hint of tongue at the bottom; a laugh's wide open)
      const w = face === 'laugh' ? 5.6 : face === 'proud' ? 4.8 : 4.2
      g.beginPath(); g.moveTo(-w * m, -1); g.lineTo(w * m, -1); g.ellipse(0, -1, w * m, w * 0.95, 0, 0, Math.PI); g.closePath()
      g.fillStyle = dark; g.fill()
      g.save(); g.clip()
      g.fillStyle = tongue; g.beginPath(); g.ellipse(0, w * 0.75, w * 0.6 * m, w * 0.4, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    } else if (face === 'panic' || face === 'surprised' || face === 'talk') {
      // (a small O: rounder as they gasp, wider and shallower as they talk)
      const [w, h] = face === 'talk' ? [2.8 * m, 2.2] : [2.4, 3.2]
      g.beginPath(); g.ellipse(0, 0.8, w, h, 0, 0, Math.PI * 2)
      g.fillStyle = dark; g.fill()
    } else if (face === 'focused') line(1.7, () => { g.moveTo(-3 * m, 0.4); g.lineTo(3 * m, 0.2) })
    else if (face === 'drink') { g.fillStyle = dark; g.beginPath(); g.ellipse(0, 0.4, 1.6, 1.4, 0, 0, Math.PI * 2); g.fill() }
    else if (face === 'mad') line(1.7, () => { g.moveTo(-3.6 * m, 1.4); g.quadraticCurveTo(0, -1.6, 3.6 * m, 1.4) })
    else if (face === 'sad') line(1.5, () => { g.moveTo(-3.2 * m, 1.2); g.quadraticCurveTo(0, -0.8, 3.2 * m, 1.2) })
    // (munching: a little wobbly line)
    else if (face === 'chew') line(1.6, () => { g.moveTo(-3.4 * m, 0); g.bezierCurveTo(-2 * m, -1.6, -1 * m, 1.6, 0, 0); g.bezierCurveTo(1 * m, -1.6, 2 * m, 1.6, 3.4 * m, 0) })
  })
  // ---- a mole by the mouth
  if (marks.has('mole')) at(9.6, mouthEl - 3.2, () => { g.fillStyle = '#4a2a20'; g.beginPath(); g.arc(0, 0, 0.85, 0, Math.PI * 2); g.fill() })
  // ---- a bead of sweat on the brow (focused at its work; two in a panic)
  if (face === 'focused' || face === 'panic') for (const sd of face === 'panic' ? [-1, 1] : [1]) {
    at(sd * 31, 19, () => {
      g.beginPath(); g.moveTo(0, -3.4); g.quadraticCurveTo(2.8, 0.8, 0, 2.6); g.quadraticCurveTo(-2.8, 0.8, 0, -3.4)
      g.fillStyle = '#9ad8ff'; g.fill()
      g.strokeStyle = '#3a7bb0'; g.lineWidth = 0.7; g.stroke()
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-0.7, 0.6, 0.7, 0, Math.PI * 2); g.fill()
    })
  }
}

/** every pixel of a painted sheet either there or not (its edges' soft alpha, under the figures' hashed alpha, was a scatter of dots) */
function solidify(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  // (and where nothing's drawn, white under the clear: a material that missed the face's own mode multiplies it by the skin and gets the
  // skin, never black (a page hot-swapped mid-play showed a black face))
  for (let i = 3; i < d.length; i += 4) {
    d[i] = d[i] >= 110 ? 255 : 0
    if (!d[i]) d[i - 3] = d[i - 2] = d[i - 1] = 255
  }
  g.putImageData(img, 0, 0)
}

/** a canvas whose see-through parts stay see-through when it's packed into an atlas (scene/atlasMerge) */
export type SeeThrough = HTMLCanvasElement & { seeThrough?: boolean }

// ---- the owner's and the staff's: a sheet of four by two frames, each the front of the head itself (blender/boss.py: the head's faces within
// 45 degrees of its middle are the face, their UVs by bearing and elevation, az -45..45 across a frame, el 45..-45 down it)
const SPAN = 45
/** a frame's pixels (sixteen of them now, four by four (item 368): 243 for eight) */
const CELL = 200
/** the frames' rows on the sheet, and on the sheet the model's face patch was made for (blender/boss.py: four by two) */
const ROWS = 4
const MODEL_ROWS = 2
const crewSheets = new Map<string, THREE.CanvasTexture>()
/** the sheet of faces for the owner (`boss`) or the staff (`male`, `female`), in their kind's design `look` (item 466) */
export function crewFaceSheet(kind: FaceKind, look = 0) {
  const key = `${kind}:${look}`
  let t = crewSheets.get(key)
  if (t) return t
  const c = document.createElement('canvas') as SeeThrough
  c.width = CELL * 4
  c.height = CELL * ROWS
  c.seeThrough = true
  const g = c.getContext('2d')!
  const k = CELL / (2 * SPAN)
  FACES.forEach((face, i) => {
    const ox = (i % 4) * CELL, oy = Math.floor(i / 4) * CELL
    paintFace(g, { place: (az, el) => [ox + (az + SPAN) * k, oy + (SPAN - el) * k], sx: k, sy: k }, kind, face, lookOf(kind, look), true)
  })
  solidify(c)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false
  crewSheets.set(key, t)
  return t
}

// ---- the customers': a strip of eight frames 256 square each, painted in degrees (az −62 to 62 across, el 42 down to −52; blender/folk.py);
// two rows of them since item 368 (the face's UVs halved in height and slid down a row in FolkFigure's shader)
const guestStrips = new Map<string, HTMLCanvasElement>()
/** the customers' strip of faces for their face type, in its design `look` (item 466), painted as the owner's are */
export function guestFaceStrip(kind: FaceKind, look = 0) {
  const key = `${kind}:${look}`
  let c = guestStrips.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 2048
  c.height = 512
  const g = c.getContext('2d')!
  GUEST_FACES.forEach((face, i) => {
    const ox = (i % 8) * 256, oy = Math.floor(i / 8) * 256
    paintFace(g, { place: (az, el) => [ox + ((az + 62) / 124) * 256, oy + ((42 - el) / 94) * 256], sx: 256 / 124, sy: 256 / 94 }, kind, face, lookOf(kind, look), false)
  })
  solidify(c)
  guestStrips.set(key, c)
  return c
}

// ---- a figure's face, made and changed
/** where the face patch is in a figure's one mesh: its vertices (from `start`, `count`), their UVs on the first frame, and a frame's step */
export type FaceRange = { start: number; count: number; base: Float32Array; du: number; dv: number }
/** the face patch's place in the mesh, from the pieces it's built of (the patch's piece at `index`), once the atlas has placed its UVs */
export function faceRange(pieces: { geo: THREE.BufferGeometry }[], index: number): FaceRange | null {
  if (index < 0) return null
  let start = 0
  for (let i = 0; i < index; i++) start += pieces[i].geo.attributes.position.count
  const uv = pieces[index].geo.attributes.uv as THREE.BufferAttribute
  const base = new Float32Array(uv.array as ArrayLike<number>)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
  for (let i = 0; i < uv.count; i++) { u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i)) }
  // (the model's patch spans a frame of a sheet two rows high; the sheet's four now (item 368): squeezed to one of them, from its top)
  const k = MODEL_ROWS / ROWS
  for (let i = 1; i < base.length; i += 2) base[i] = v0 + (base[i] - v0) * k
  return { start, count: uv.count, base, du: u1 - u0, dv: (v1 - v0) * k }
}
const RANGES = new WeakMap<THREE.BufferGeometry, FaceRange>()
/** the figure template's mesh's face (kept by its shape: the copies share it) */
export function markFace(mesh: THREE.Mesh, r: FaceRange | null) {
  if (!r) return
  const uv = mesh.geometry.attributes.uv as THREE.BufferAttribute | undefined
  if (uv) { for (let i = 0; i < r.count; i++) uv.setXY(r.start + i, r.base[i * 2], r.base[i * 2 + 1]); uv.needsUpdate = true }
  RANGES.set(mesh.geometry, r)
  // (and on the template itself, for a figure drawn as its template (the owner in the room): its face changed in place)
  mesh.geometry.userData.face = r
}

/**
 * A copy's own shape over its template's: its UVs its own (so its face is its own), and its colours too when `colour` says how (the staff's
 * skin and hair); the rest shared. Undone by the function it gives back: the template's shape put back, only its own attributes let go.
 */
export function ownShape(root: THREE.Object3D, colour?: (m: THREE.Mesh, col: THREE.BufferAttribute) => boolean) {
  const swapped: [THREE.Mesh, THREE.BufferGeometry, THREE.BufferGeometry][] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.geometry
    const face = RANGES.get(src)
    const col = colour && src.attributes.color ? (src.attributes.color as THREE.BufferAttribute).clone() : null
    const coloured = !!col && colour!(m, col)
    if (!face && !coloured) return
    const g = new THREE.BufferGeometry()
    for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, a)
    g.setIndex(src.index)
    if (coloured) g.setAttribute('color', col!)
    if (face) { g.setAttribute('uv', (src.attributes.uv as THREE.BufferAttribute).clone()); g.userData.face = face }
    src.computeBoundingSphere()
    g.boundingSphere = src.boundingSphere
    m.geometry = g
    swapped.push([m, src, g])
  })
  return () => {
    for (const [m, src, g] of swapped) {
      m.geometry = src
      for (const k of Object.keys(g.attributes)) if (g.attributes[k] === src.attributes[k]) g.deleteAttribute(k)
      g.setIndex(null)
      g.dispose()
    }
  }
}

/** setExpression: the face a figure (its copy, made its own by ownShape) shows; a no-op if it's showing it */
export function setFace(root: THREE.Object3D, face: CrewFace) {
  const k = FACES.indexOf(face)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    const r = m.isMesh ? (m.geometry.userData.face as FaceRange | undefined) : undefined
    if (!r || m.geometry.userData.faceNow === k) return
    m.geometry.userData.faceNow = k
    const uv = m.geometry.attributes.uv as THREE.BufferAttribute
    const du = (k % 4) * r.du, dv = Math.floor(k / 4) * r.dv
    for (let i = 0; i < r.count; i++) uv.setXY(r.start + i, r.base[i * 2] + du, r.base[i * 2 + 1] + dv)
    uv.clearUpdateRanges()
    uv.addUpdateRange(r.start * 2, r.count * 2)
    uv.needsUpdate = true
  })
}

/** the faces whose eyes are shut already (a smile's arcs, a gulp's squeeze): no blink, no glance over them */
const SHUT_EYES = new Set<string>(['blink', 'happy', 'proud', 'drink', 'chew', 'chew2', 'laugh'])
/** the faces a word's syllables can be said over (the talking frames have their eyes and brows as these have them, near enough) */
const SAID_OVER = new Set<string>(['idle', 'focused', 'tired', 'shy', 'surprised'])
/** a moment of a face's life (game/faceLife's faceNow) */
type Moment = { blink: 'open' | 'half' | 'shut'; look: -1 | 0 | 1; mouth: 0 | 1 | 2 }
/**
 * The frame for a moment of a face's life (item 368): its eyes half or all shut in a blink (a tired face's heavy lids straight to shut);
 * a word's syllables over a face that can say them, shut, a little open, wide; a glance aside from a face at ease; else the face itself
 */
export function crewFrame(face: CrewFace, m: Moment): CrewFace {
  if (!SHUT_EYES.has(face) && m.blink !== 'open') return m.blink === 'shut' || face === 'tired' ? 'blink' : 'half'
  if (m.mouth && SAID_OVER.has(face)) return m.mouth === 2 ? 'talkWide' : 'talk'
  if (m.look && face === 'idle') return m.look > 0 ? 'lookR' : 'lookL'
  return face
}
/** the same for a customer's strip: chewing by turns (`jaw`), a laugh between a delighted face's words */
export function guestFrame(face: GuestFace, m: Moment, jaw = false): GuestFace {
  if (face === 'chew') return jaw ? 'chew' : 'chew2'
  if (!SHUT_EYES.has(face) && m.blink !== 'open') return m.blink === 'shut' || face === 'tired' ? 'blink' : 'half'
  if (m.mouth && face === 'happy') return m.mouth === 2 ? 'laugh' : 'happy'
  if (m.mouth && (face === 'idle' || face === 'tired' || face === 'surprised')) return m.mouth === 2 ? 'talkWide' : 'talk'
  if (m.look && face === 'idle') return m.look > 0 ? 'lookR' : 'lookL'
  return face
}

/**
 * Overcooked's squash and stretch, `t` seconds after it's set off (a word said, something picked up): squashed (1.12, 0.88), sprung up
 * (0.95, 1.08) a tenth and a half of a second on, back to its size; [across, up] scales, 1 once it's over.
 */
export function squash(t: number): [number, number] {
  if (t < 0 || t > 0.42) return [1, 1]
  const ease = (a: number, b: number, u: number) => a + (b - a) * (1 - (1 - u) * (1 - u))
  if (t < 0.08) { const u = t / 0.08; return [ease(1, 1.12, u), ease(1, 0.88, u)] }
  if (t < 0.23) { const u = (t - 0.08) / 0.15; return [ease(1.12, 0.95, u), ease(0.88, 1.08, u)] }
  const u = (t - 0.23) / 0.19
  return [ease(0.95, 1, u), ease(1.08, 1, u)]
}
