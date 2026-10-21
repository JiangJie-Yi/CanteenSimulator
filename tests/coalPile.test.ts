import { describe, expect, it } from 'vitest'
import { crossYaw, restOf, STICK_R, surfaceY, type Lay } from '@/game/coalPile'

describe('coal pile', () => {
  it('a lone stick lies on the bed', () => {
    const r = restOf(0.2, 0.1, 0.3, [])
    expect(r.y).toBeGreaterThan(surfaceY(0.2, 0.1))
    expect(Math.abs(r.slope)).toBeLessThan(0.6)
  })
  it('a stick laid across another rests a stick-width above it', () => {
    const under: Lay = { x: 0, z: 0, yaw: 0, y: 0.2, slope: 0 }
    const r = restOf(0, 0, Math.PI / 2, [under])
    expect(r.y).toBeGreaterThanOrEqual(0.2 + 2 * STICK_R - 1e-6)
  })
  it('sticks far apart do not rest on one another', () => {
    const under: Lay = { x: 0.6, z: 0.6, yaw: 0, y: 0.5, slope: 0 }
    const alone = restOf(-0.4, 0, 0, [])
    expect(restOf(-0.4, 0, 0, [under]).y).toBeCloseTo(alone.y, 6)
  })
  it('one landing near another is laid across it', () => {
    const under: Lay = { x: 0, z: 0, yaw: 0.4, y: 0.2, slope: 0 }
    const yaw = crossYaw(0.05, 0.02, [under], () => 0.5)!
    expect(Math.abs(Math.sin(yaw - 0.4))).toBeGreaterThan(0.9)
    expect(crossYaw(1, 1, [under])).toBeNull()
  })
})
