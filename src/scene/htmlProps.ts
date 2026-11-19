/**
 * drei's <Html> props kept the same object from one render to the next (item 374): it draws its DOM in a React root of its own, and works its
 * styles out again and draws that root again whenever its `style` or `zIndexRange` is a new object, as an inline `{{ ... }}` or `[a, b]` is
 * every time whatever holds it redraws (the shop open: some 23 times a second, each a commit of the page's own)
 */
/** a label or a bubble the pointer goes through */
export const NO_POINTER = { pointerEvents: 'none' } as const
const RANGES = new Map<string, [number, number]>()
/** the z-index range [highest, lowest] as one array for each pair, the same every time */
export function zr(hi: number, lo: number): [number, number] {
  const k = `${hi}:${lo}`
  let v = RANGES.get(k)
  if (!v) RANGES.set(k, (v = [hi, lo]))
  return v
}
