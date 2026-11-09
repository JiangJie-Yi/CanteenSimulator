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
  | 'tools' | 'person' | 'group' | 'search' | 'arrowR' | 'arrowU' | 'ban' | 'plus' | 'eye'

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
  arrowU: [{ d: 'M8 13.8V3.2M4 7.2 8 3.2l4 4', stroke: S }],
  // (no entry: a ring struck through)
  ban: [{ d: 'M8 2a6 6 0 1 1 0 12A6 6 0 1 1 8 2Z', stroke: 1.8 }, { d: 'M3.8 3.8l8.4 8.4', stroke: 1.8 }],
  // (an eye: the view's, as on the views button)
  eye: [{ d: 'M1.4 8S3.8 3.6 8 3.6 14.6 8 14.6 8 12.2 12.4 8 12.4 1.4 8 1.4 8Z', stroke: 1.3 }, { d: 'M8 5.9a2.1 2.1 0 1 1 0 4.2A2.1 2.1 0 1 1 8 5.9Z' }],
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
