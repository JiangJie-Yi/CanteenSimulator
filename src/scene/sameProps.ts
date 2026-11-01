/**
 * Props compared for `memo` where a position comes as a fresh array each time its parent draws (`[x, y, z]`, `v.toArray()`): equal when each
 * prop is the same, or is an array of the same numbers. Anything else new (an object, a callback, children) still counts as a change.
 */
export function sameProps<P extends object>(a: P, b: P): boolean {
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    const x = (a as Record<string, unknown>)[k], y = (b as Record<string, unknown>)[k]
    if (Object.is(x, y)) continue
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, i) => Object.is(v, y[i]))) continue
    return false
  }
  return true
}
