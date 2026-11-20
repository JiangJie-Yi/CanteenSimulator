/**
 * The game's small drawn icons as plain path data (the owner's: designed pictures, never an emoji or a special character), so one drawing
 * serves everywhere: React (GameIcons' Glyph), the DOM-built developer panel (glyphSvg), and pictures painted on a canvas for the 3D scene
 * (drawGlyph). Each is a 16-unit square; a part is filled or stroked in the colour of what's around it, or cut out of it (`cut`: the
 * background's colour, --icon-cut, for the hole in a coin, the lines on a receipt).
 */
export type GlyphPart = { d: string; stroke?: number; cut?: boolean; o?: number }
export type GlyphId =
  | 'fast' | 'menu' | 'close' | 'minus' | 'chevL' | 'chevR' | 'caretR' | 'caretD' | 'refresh' | 'undo'
  | 'note' | 'notes' | 'heart' | 'coin' | 'bolt' | 'drop' | 'receipt' | 'tissue' | 'globe' | 'box'
  | 'tools' | 'person' | 'group' | 'search' | 'arrowR' | 'arrowU' | 'ban' | 'plus' | 'eye' | 'gamepad' | 'thumb' | 'towel' | 'soap' | 'check' | 'calendar' | 'list' | 'people'
  | 'fish' | 'steam' | 'crossFace' | 'gladFace' | 'climb'

const S = 1.6
export const GLYPHS: Record<GlyphId, GlyphPart[]> = {
  // (fast forward: two filled wedges, nose to tail)
  fast: [{ d: 'M1.8 3.4 8 8 1.8 12.6Z' }, { d: 'M8 3.4 14.2 8 8 12.6Z' }],
  // (the tools' menu: three bars)
  menu: [{ d: 'M2.5 4.2h11M2.5 8h11M2.5 11.8h11', stroke: S }],
  close: [{ d: 'M4 4l8 8M12 4l-8 8', stroke: S }],
  minus: [{ d: 'M3.5 8h9', stroke: S }],
  plus: [{ d: 'M8 3.5v9M3.5 8h9', stroke: S }],
  chevL: [{ d: 'M10 3.2 5.2 8 10 12.8', stroke: S }],
  chevR: [{ d: 'M6 3.2 10.8 8 6 12.8', stroke: S }],
  // (a group shut or open in a list: a small filled wedge)
  caretR: [{ d: 'M5.5 3.8 11 8l-5.5 4.2Z' }],
  caretD: [{ d: 'M3.8 5.5h8.4L8 11Z' }],
  // (pull to refresh: a circling arrow, clockwise; undo: the same the other way)
  refresh: [{ d: 'M12.8 9.2A5 5 0 1 1 11 4.2', stroke: S }, { d: 'M13.4 1.8v4.4H9Z' }],
  undo: [{ d: 'M3.2 9.2A5 5 0 1 0 5 4.2', stroke: S }, { d: 'M2.6 1.8v4.4H7Z' }],
  // (a quaver, its head leaning, its flag curling down; two beamed together)
  note: [{ d: 'M5.4 13.6c-1.5.4-2.8-.2-2.8-1.3s1.1-2 2.6-2.3c.6-.1 1.1-.1 1.6.1V2.2h1.6c.4 1.8 1.6 2.9 3.4 3.8.9.5 1.4 1.4 1.3 2.6-.6-1.3-2-2-3.5-2.4v5.6c0 1-.9 1.6-2.2 1.8Z' }],
  notes: [{ d: 'M4.4 14.2c-1.4.3-2.6-.2-2.6-1.2s1-1.8 2.4-2c.4-.1.8 0 1.2.1V3.6l8-1.8v8.8c0 .9-.9 1.6-2.2 1.8-1.4.3-2.6-.2-2.6-1.2s1-1.8 2.4-2c.4-.1.8 0 1.2.1V5.2l-5.2 1.2v6c0 .9-.9 1.6-2.6 1.8Z' }],
  heart: [{ d: 'M8 14.2 2.3 8.6A3.4 3.4 0 0 1 8 4.1a3.4 3.4 0 0 1 5.7 4.5Z' }],
  // (an old coin, a square hole through it)
  coin: [{ d: 'M8 1.6a6.4 6.4 0 1 1 0 12.8A6.4 6.4 0 1 1 8 1.6Z' }, { d: 'M8 3.4a4.6 4.6 0 1 1 0 9.2A4.6 4.6 0 1 1 8 3.4Z', stroke: 0.8, cut: true },
    { d: 'M6.6 6.6h2.8v2.8H6.6Z', cut: true }],
  // (electricity: a bolt; water: a drop with a gleam)
  bolt: [{ d: 'M9.4 1.4 3.4 9.2h4l-1.2 5.4 6.4-8.4H8.6Z' }],
  drop: [{ d: 'M8 1.6c2.7 3.6 4.7 6 4.7 8.6a4.7 4.7 0 0 1-9.4 0c0-2.6 2-5 4.7-8.6Z' }, { d: 'M5.8 10.2c0 1.2.7 2.1 1.6 2.4', stroke: 1.1, cut: true }],
  // (a receipt: a slip torn in zigzags at its foot, printed lines)
  receipt: [{ d: 'M3.4 1.6h9.2v12.8l-1.53-1.1-1.53 1.1-1.54-1.1L6.47 14.4l-1.53-1.1-1.54 1.1Z' },
    { d: 'M5.4 4.8h5.2M5.4 7.3h5.2M5.4 9.8h3.2', stroke: 1.1, cut: true }],
  // (a roll of tissue stood on end, its core showing, a sheet hanging off its side)
  tissue: [{ d: 'M2.4 5v7.2a4.3 1.8 0 0 0 8.6 0V5Z' }, { d: 'M6.7 3.2a4.3 1.8 0 1 1 0 3.6a4.3 1.8 0 1 1 0-3.6Z', stroke: 0.9, cut: true },
    { d: 'M6.7 4.5a1.3.55 0 1 1 0 1.1a1.3.55 0 1 1 0-1.1Z', cut: true }, { d: 'M11.6 6.6h2.4v7.8l-.8-.5-.8.5-.8-.5Z' }],
  // (paper towels: a stack of folded sheets, the top one drawn up out of it, its fold showing)
  towel: [{ d: 'M2.2 9.4h11.6v4.8H2.2Z' }, { d: 'M2.2 11.8h11.6', stroke: 0.9, cut: true }, { d: 'M4.4 2.2h7.2l1.4 6.2H3Z' },
    { d: 'M4.2 5.4h7.6', stroke: 0.8, cut: true }],
  // (hand soap: a pump bottle, its head and spout on its neck, a label across it)
  soap: [{ d: 'M4.6 6.8h6.8a1.3 1.3 0 0 1 1.3 1.3v5.6a1.3 1.3 0 0 1-1.3 1.3H4.6a1.3 1.3 0 0 1-1.3-1.3V8.1a1.3 1.3 0 0 1 1.3-1.3Z' },
    { d: 'M6.9 4.2h2.2v2.6H6.9Z' }, { d: 'M5.4 2.4h5.6v1.8H5.4ZM11 2.4h2.4v1.1H11Z' }, { d: 'M5.2 9.6h5.6v2.6H5.2Z', cut: true }],
  // (world space: a globe, its meridian and parallels; object space: a box seen from a corner)
  globe: [{ d: 'M8 2a6 6 0 1 1 0 12A6 6 0 1 1 8 2Z', stroke: 1.3 }, { d: 'M8 2c-2.2 2-2.2 10 0 12M8 2c2.2 2 2.2 10 0 12M2.3 6h11.4M2.3 10h11.4', stroke: 1 }],
  box: [{ d: 'M8 1.8 13.6 4.6v6.8L8 14.2 2.4 11.4V4.6ZM2.4 4.6 8 7.4l5.6-2.8M8 7.4v6.8', stroke: 1.3 }],
  // (the developer's tools: a spanner; the character view: a bust)
  tools: [{ d: 'M10.8 1.8a3.4 3.4 0 0 0-3.2 4.5L2.2 11.7a1.5 1.5 0 0 0 2.1 2.1l5.4-5.4a3.4 3.4 0 0 0 4.5-3.2l-2 2-2-.5-.5-2Z' }],
  person: [{ d: 'M8 1.8a3 3 0 1 1 0 6A3 3 0 1 1 8 1.8Z' }, { d: 'M2.4 14.2c.4-3.2 2.6-5 5.6-5s5.2 1.8 5.6 5Z' }],
  // (a group: a frame with a filled square in it)
  group: [{ d: 'M2.4 2.4h11.2v11.2H2.4Z', stroke: 1.3 }, { d: 'M5.2 5.2h5.6v5.6H5.2Z' }],
  search: [{ d: 'M6.8 2.2a4.6 4.6 0 1 1 0 9.2A4.6 4.6 0 1 1 6.8 2.2Z', stroke: S }, { d: 'M10.2 10.2 14 14', stroke: 2 }],
  arrowR: [{ d: 'M2.2 8h10.6M8.8 4 12.8 8l-4 4', stroke: S }],
  // (a tick: a step done (the editor's start-up, item 190))
  check: [{ d: 'M3 8.6 6.3 11.6 13 4.6', stroke: S }],
  // (the back office's (item 184): a day's page, a list, two people)
  calendar: [{ d: 'M2.8 4.2h10.4v9H2.8zM2.8 7h10.4M5.4 2.6v3M10.6 2.6v3', stroke: S }],
  list: [{ d: 'M6 4.5h7.2M6 8h7.2M6 11.5h7.2M2.9 4.5h.2M2.9 8h.2M2.9 11.5h.2', stroke: S }],
  people: [{ d: 'M6 7.4a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM2.3 13.2c0-2.1 1.7-3.7 3.7-3.7s3.7 1.6 3.7 3.7M10.9 7a1.8 1.8 0 1 0 0-3.6M12 9.7c1.2.4 1.9 1.7 1.9 3.3', stroke: S }],
  arrowU: [{ d: 'M8 13.8V3.2M4 7.2 8 3.2l4 4', stroke: S }],
  // (no entry: a ring struck through)
  ban: [{ d: 'M8 2a6 6 0 1 1 0 12A6 6 0 1 1 8 2Z', stroke: 1.8 }, { d: 'M3.8 3.8l8.4 8.4', stroke: 1.8 }],
  // (a game pad: a rounded body, a cross on its left, two buttons on its right: one of the staff slacking at their handheld game)
  gamepad: [{ d: 'M4.6 4.4h6.8c2 0 3.3 1.6 3.6 3.6l.6 3.4c.2 1.4-1.3 2.4-2.4 1.5L11.2 11H4.8l-2 1.9c-1.1.9-2.6-.1-2.4-1.5L1 8c.3-2 1.6-3.6 3.6-3.6Z' },
    { d: 'M4.6 6.4v3M3.1 7.9h3', stroke: 1.1, cut: true }, { d: 'M10.6 7.3a.75.75 0 1 1 0 1.5a.75.75 0 1 1 0-1.5ZM12.4 8.6a.75.75 0 1 1 0 1.5a.75.75 0 1 1 0-1.5Z', cut: true }],
  // (an eye: the view's, as on the views button)
  eye: [{ d: 'M1.4 8S3.8 3.6 8 3.6 14.6 8 14.6 8 12.2 12.4 8 12.4 1.4 8 1.4 8Z', stroke: 1.3 }, { d: 'M8 5.9a2.1 2.1 0 1 1 0 4.2A2.1 2.1 0 1 1 8 5.9Z' }],
  // (a review found useful: a thumb up, its cuff beside it)
  thumb: [{ d: 'M1.6 7.2h2.8v6.6H1.6Z' }, { d: 'M5.4 7.2 8.2 2.3c.5-.9 2-.6 2 .6v3.3h3.1c.9 0 1.6.8 1.4 1.7l-1.1 5.1c-.2.7-.8 1.2-1.5 1.2H5.4Z' }],
  // (the game's guide (item 388): a fish, head to the left, its eye and gill cut out of it, its tail forked)
  fish: [{ d: 'M1.2 8C2.8 4.7 5.9 3.6 8.4 3.9c2 .2 3.3 1.5 4.2 2.6L15.2 4.4v7.2l-2.6-2.1c-.9 1.1-2.2 2.4-4.2 2.6C5.9 12.4 2.8 11.3 1.2 8Z' },
    { d: 'M5.5 7.2a.95.95 0 1 1-1.9 0a.95.95 0 1 1 1.9 0Z', cut: true }, { d: 'M7.4 5.4Q8.7 8 7.4 10.6', stroke: 1.1, cut: true }],
  // (a customer's steam: three wisps rising; their cross face: brows down, a frown; their delight: eyes shut with smiling, mouth wide)
  steam: [{ d: 'M4 14c-1.6-2 1.6-3 0-5s1.6-3 0-5M8 13c-1.6-2 1.6-3 0-5s1.6-3 0-5M12 14c-1.6-2 1.6-3 0-5s1.6-3 0-5', stroke: 1.4 }],
  crossFace: [{ d: 'M8 1.9a6.1 6.1 0 1 1 0 12.2A6.1 6.1 0 1 1 8 1.9Z', stroke: 1.3 }, { d: 'M4.6 5.4l2.2 1.2M11.4 5.4l-2.2 1.2', stroke: 1.3 },
    { d: 'M6 8.4h.1M10 8.4h.1', stroke: 1.9 }, { d: 'M5.6 11.9q2.4-1.9 4.8 0', stroke: 1.3 }],
  gladFace: [{ d: 'M8 1.9a6.1 6.1 0 1 1 0 12.2A6.1 6.1 0 1 1 8 1.9Z', stroke: 1.3 }, { d: 'M4.7 7.4q1.1-1.5 2.2 0M9.1 7.4q1.1-1.5 2.2 0', stroke: 1.3 },
    { d: 'M4.8 9.4h6.4a3.2 3 0 0 1-6.4 0Z' }],
  // (one going up a stair (item 428, the owner's 「cursor 需克制化，一個人走樓梯的樣子」): four treads rising to the right, filled; on them one
  // climbing, leaning into it, the back foot on the first tread, the front on the second, the arms swinging)
  climb: [{ d: 'M1 15v-2.6h3.5V9.9H8V7.4h3.5V4.9H15V15Z' },
    { d: 'M6.6 1.3a1.45 1.45 0 1 1 0 2.9a1.45 1.45 0 1 1 0-2.9Z' },
    { d: 'M6.3 4.9 5.3 8.2M5.3 8.2 4.4 10.3 3.6 12.2M5.3 8.2 7.4 8.7 7.7 9.7M6.1 5.6 4.3 7.1M6.1 5.6 8.1 6.3', stroke: 1.25 }],
}

/** the icon as SVG markup, for the DOM the developer panel builds by hand */
export function glyphSvg(id: GlyphId, size = 12) {
  const parts = GLYPHS[id].map((p) => {
    const col = p.cut ? 'var(--icon-cut, #fff)' : 'currentColor'
    return p.stroke ? `<path d="${p.d}" fill="none" stroke="${col}" stroke-width="${p.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="${p.d}" fill="${col}"/>`
  }).join('')
  return `<svg class="game-icon" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">${parts}</svg>`
}

/** the icon as the mouse's pointer (a CSS cursor): `size` across, dark with a pale halo round it so it reads on any ground, its point at
 * `hot` (its own 16 units); the hand after it where a picture's not taken */
export function glyphCursor(id: GlyphId, hot: [number, number] = [2, 2], size = 32) {
  const INK = '#24160c', HALO = '#fff6e6'
  const halo = GLYPHS[id].filter((p) => !p.cut).map((p) => (p.stroke
    ? `<path d="${p.d}" fill="none" stroke="${HALO}" stroke-width="${p.stroke + 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${p.d}" fill="${HALO}" stroke="${HALO}" stroke-width="1.5" stroke-linejoin="round"/>`)).join('')
  const ink = GLYPHS[id].map((p) => (p.stroke
    ? `<path d="${p.d}" fill="none" stroke="${p.cut ? HALO : INK}" stroke-width="${p.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${p.d}" fill="${p.cut ? HALO : INK}"/>`)).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 18 18" width="${size}" height="${size}">${halo}${ink}</svg>`
  const k = size / 18
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round((hot[0] + 1) * k)} ${Math.round((hot[1] + 1) * k)}, pointer`
}

/** the icon painted on a canvas: its top left at (x, y), `size` across, in `ink` (cut parts in `cut`, the background's colour) */
export function drawGlyph(g: CanvasRenderingContext2D, id: GlyphId, x: number, y: number, size: number, ink: string, cut = 'transparent') {
  g.save()
  g.translate(x, y)
  g.scale(size / 16, size / 16)
  g.lineCap = 'round'; g.lineJoin = 'round'
  for (const p of GLYPHS[id]) {
    const path = new Path2D(p.d)
    const col = p.cut ? cut : ink
    if (col === 'transparent') {
      // (a hole: cut through what's under it)
      g.globalCompositeOperation = 'destination-out'
    }
    if (p.stroke) { g.lineWidth = p.stroke; g.strokeStyle = col === 'transparent' ? '#000' : col; g.stroke(path) }
    else { g.fillStyle = col === 'transparent' ? '#000' : col; g.fill(path) }
    g.globalCompositeOperation = 'source-over'
  }
  g.restore()
}
