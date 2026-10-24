import { describe, expect, it } from 'vitest'
import { crossYaw, MAX_LAYERS, placeStick, restOf, settle, STICK_HALF, STICK_R, surfaceY, type Lay } from '@/game/coalPile'

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
  it('the heap only goes so deep: no stick rests past the layer limit, and a full heap takes no more', () => {
    let seed = 5
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const lying: Lay[] = []
    let refused = false
    for (let i = 0; i < 120; i++) {
      const spot = placeStick(lying, rnd)
      if (!spot) { refused = true; break }
      expect(spot.rest.y - surfaceY(spot.x, spot.z)).toBeLessThanOrEqual(STICK_R + (MAX_LAYERS - 1) * 2 * STICK_R + 0.06)
      lying.push({ x: spot.x, z: spot.z, yaw: spot.yaw, y: spot.rest.y, slope: spot.rest.slope })
    }
    expect(refused).toBe(true)
  })
  it('a stick never hangs in the air: some part of it touches what holds it up, and none sinks in', () => {
    let seed = 9
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const lying: Lay[] = []
    for (let i = 0; i < 14; i++) {
      const spot = placeStick(lying, rnd)
      if (!spot) break
      // the height of whatever is under it, along its length
      let gap = Infinity
      for (const t of [-STICK_HALF, -0.15, 0, 0.15, STICK_HALF]) {
        const px = spot.x + Math.cos(spot.yaw) * t, pz = spot.z + Math.sin(spot.yaw) * t
        const stick = spot.rest.y + spot.rest.slope * t
        let under = surfaceY(px, pz) + STICK_R
        for (const o of lying) {
          const dx = Math.cos(o.yaw), dz = Math.sin(o.yaw)
          const u = Math.max(-STICK_HALF, Math.min(STICK_HALF, (px - o.x) * dx + (pz - o.z) * dz))
          const d = Math.hypot(px - (o.x + dx * u), pz - (o.z + dz * u))
          if (d < 2 * STICK_R) under = Math.max(under, o.y + o.slope * u + Math.sqrt(Math.max(0, (2 * STICK_R) ** 2 - d * d)))
        }
        expect(stick).toBeGreaterThanOrEqual(under - 0.004)
        gap = Math.min(gap, stick - under)
      }
      expect(gap).toBeLessThan(0.02)
      lying.push({ x: spot.x, z: spot.z, yaw: spot.yaw, y: spot.rest.y, slope: spot.rest.slope })
    }
  })
  it('one let go on a steep part of the heap slides down it', () => {
    const under: Lay[] = [{ x: 0, z: 0, yaw: 0, y: 0.3, slope: 0.8 }, { x: 0.02, z: 0.05, yaw: 1.2, y: 0.34, slope: 0.7 }]
    const end = settle(0.05, 0.02, 0.4, under)
    expect(end.rest.y).toBeLessThan(restOf(0.05, 0.02, 0.4, under).y + 1e-9)
  })
})
