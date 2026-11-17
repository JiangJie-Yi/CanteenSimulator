import * as THREE from 'three'

/**
 * A round lacquered tray (丸盆) as a low-poly shape (item 248, the owner's, 2026-11-17: the owner out serving came back from sweeping up
 * glass with "a black plate" in his hands: his tray was a flat disc with no edge to it, read as a plate): a flat floor with a low rim
 * standing round it, the foot's edge bevelled under; `n` round (16), its floor's top and its underside each closed with a ladder of quads
 * straight across, never a fan into its middle (the low-poly rule). Its underside at y = 0; `r` its outer radius, `h` the rim's height,
 * `t` how thick its floor and its rim are. Flat-shaded (no index: each face its own normal), so the rim's top edge reads.
 */
export function rimmedTray(r: number, h: number, t: number, n = 16): THREE.BufferGeometry {
  // (the outline across it, from the foot's edge round over the rim and down inside it to the floor's top, as (radius, height))
  const prof: [number, number][] = [[r * 0.93, 0], [r, t * 0.8], [r, h], [r - t, h], [r - t, t]]
  const ring = (rad: number, y: number) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad)
  })
  const rings = prof.map(([rad, y]) => ring(rad, y))
  const tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = []
  // (each band of the outline round: its quads, facing out from the solid (to the right of the way the outline goes, in (radius, height)))
  for (let k = 0; k < rings.length - 1; k++) {
    const dr = prof[k + 1][0] - prof[k][0], dy = prof[k + 1][1] - prof[k][1]
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i]
      const mid = a.clone().add(c).multiplyScalar(0.5)
      const out = new THREE.Vector3(mid.x, 0, mid.z).normalize().multiplyScalar(dy).add(new THREE.Vector3(0, -dr, 0))
      tris.push([a, b, c, out], [a, c, d, out])
    }
  }
  // (the floor's top, facing up, and the underside, facing down: a ladder of rungs straight across, a triangle at each end)
  const ladder = (pts: THREE.Vector3[], face: THREE.Vector3) => {
    const m = n / 2
    tris.push([pts[0], pts[1], pts[n - 1], face], [pts[m - 1], pts[m], pts[m + 1], face])
    for (let i = 1; i < m - 1; i++) tris.push([pts[i], pts[i + 1], pts[n - i - 1], face], [pts[i], pts[n - i - 1], pts[n - i], face])
  }
  ladder(rings[rings.length - 1], new THREE.Vector3(0, 1, 0))
  ladder(rings[0], new THREE.Vector3(0, -1, 0))
  // (each wound to face the way it should)
  const pos: number[] = []
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  for (const [a, b, c, want] of tris) {
    const flip = e1.subVectors(b, a).cross(e2.subVectors(c, a)).dot(want) < 0
    for (const p of flip ? [a, c, b] : [a, b, c]) pos.push(p.x, p.y, p.z)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}
