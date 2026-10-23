import { describe, expect, it } from 'vitest'
import { binchotanGeo } from '@/shops/grill/Binchotan'

// (the sticks are hollow tubes: the geometry has a bore, rings for ends with the hole in them, and no cap across it)
describe('binchotan stick', () => {
  const g = binchotanGeo(0.5, 0.03, 3)
  const p = g.attributes.position
  it('has no vertex on the axis at either end (the bore is open)', () => {
    let capped = false
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (Math.abs(Math.abs(y) - 0.25) < 1e-3 && Math.hypot(p.getX(i) - bowAt(y), p.getZ(i)) < 0.012) capped = true
    }
    expect(capped).toBe(false)
  })
  it('has surface both at the outside and in the bore', () => {
    let outer = 0, inner = 0
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i) - bowAt(p.getY(i)), p.getZ(i)); if (r > 0.027) outer++; else if (r < 0.018 && r > 0.008) inner++ }
    expect(outer).toBeGreaterThan(20)
    expect(inner).toBeGreaterThan(20)
  })
  it('comes in different lengths and thicknesses', () => {
    const len = (geo: ReturnType<typeof binchotanGeo>) => { geo.computeBoundingBox(); return geo.boundingBox!.max.y - geo.boundingBox!.min.y }
    expect(len(binchotanGeo(0.34, 0.03, 1))).toBeLessThan(len(binchotanGeo(0.56, 0.03, 1)))
  })
})
// (the bow is a smooth bend: the axis near the middle sits off the straight line, so measure from where the bend puts it)
function bowAt(y: number) {
  const L = 0.5, t = y / L + 0.5, ph = 3 * 1.7
  return 0.035 * L * Math.sin(t * Math.PI) * Math.cos(ph)
}
