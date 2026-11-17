import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { HANGS, registryEntries, useEditSel } from './edit'

/**
 * Where things meet what they stand on, darker (item 306, the owner's: 「光照跟陰影感還不行，尤其是白天，不太真實」: 物件與桌面地面接觸處的接觸
 * 陰影): under every piece that stands (the shop's own pieces, the editor's Movables, all but those hung on a wall), a soft shade on the
 * floor or the table round its foot, as the room's light all round leaves under and close about a thing, the sun's own shadow being
 * straight down at noon. Its box's foot (as the editor measures it, turned as the piece is) with a band round it fading out, the band as
 * wide however big the piece (a nine-slice of one little picture: its middle stretched, its edges not), a taller piece's a little wider.
 * All of them one mesh, one draw, made once the shop's loaded and again as the editor's put away (where things stand is changed there).
 */
const SHADE = (() => {
  if (typeof document === 'undefined') return null
  const N = 64
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  const img = g.createImageData(N, N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N, v = (y + 0.5) / N
    // (0 inside the middle (0.4..0.6 both ways), 1 at the picture's edge: the band's fall, its corners round)
    const dx = Math.max(0, Math.abs(u - 0.5) - 0.1) / 0.4, dy = Math.max(0, Math.abs(v - 0.5) - 0.1) / 0.4
    const d = Math.min(1, Math.hypot(dx, dy))
    const k = (1 - d) ** 2.2
    const i = (y * N + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
    img.data[i + 3] = Math.round(255 * k)
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
/** black, see-through by its picture, lifted off what it lies on (the blob shadows' kind: their program) */
const MAT = new THREE.MeshBasicMaterial({ color: '#000000', map: SHADE, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true,
  polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
/** the nine-slice's picture coordinates: its band from the edge in to where the middle starts */
const UV = [0, 0.4, 0.6, 1]

/** one piece's shade: its foot's four corners (the box's bottom: c00, c01 along its depth, c10 along its width), how tall it is */
function shadeQuad(c00: THREE.Vector3, c01: THREE.Vector3, c10: THREE.Vector3, tall: number, pos: number[], uv: number[], idx: number[]) {
  const ex = c10.clone().sub(c00), ez = c01.clone().sub(c00)
  const lx = ex.length(), lz = ez.length()
  if (lx < 1e-4 || lz < 1e-4) return
  ex.divideScalar(lx); ez.divideScalar(lz)
  const mid = c00.clone().addScaledVector(ex, lx / 2).addScaledVector(ez, lz / 2)
  // (the band: out past the foot by 8 cm, up to 30 for a tall one; in under it by 2 cm, so the darkest's just inside its edge)
  const out = THREE.MathUtils.clamp(0.08 + 0.16 * tall, 0.08, 0.3), inn = Math.min(0.02, lx / 4, lz / 4)
  const xs = [-(lx / 2 + out), -(lx / 2 - inn), lx / 2 - inn, lx / 2 + out], zs = [-(lz / 2 + out), -(lz / 2 - inn), lz / 2 - inn, lz / 2 + out]
  const base = pos.length / 3
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const p = mid.clone().addScaledVector(ex, xs[i]).addScaledVector(ez, zs[j])
    pos.push(p.x, mid.y + 0.004, p.z)
    uv.push(UV[i], UV[j])
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const a = base + j * 4 + i
    // (wound to face up whichever way its corners came: the slice's normal turned up)
    const up = ex.clone().cross(ez).y < 0
    if (up) idx.push(a, a + 1, a + 5, a, a + 5, a + 4)
    else idx.push(a, a + 5, a + 1, a, a + 4, a + 5)
  }
}

/** the pieces' shades, made from where they stand now (each's box's eight corners in the world, from the editor) */
function build(): THREE.BufferGeometry | null {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (const [id, e] of registryEntries()) {
    if (HANGS.test(id) || !e.corners) continue
    const cs = e.corners()
    if (!cs || cs.length < 8) continue
    const v = cs.map((c) => new THREE.Vector3(...c))
    // (the box's bottom four (the corners come in pairs, foot then top) and how tall it stands)
    const c00 = v[0], c01 = v[2], c10 = v[4]
    const tall = v[1].y - v[0].y
    const w = c10.distanceTo(c00), d = c01.distanceTo(c00)
    // (not a flat thing lying down (a mat, a rug, a board), nor a whole run of the room's fittings (its box over the aisle and all), nor a
    // speck)
    if (tall < 0.07 || w > 3.2 || d > 3.2 || Math.max(w, d) < 0.05) continue
    shadeQuad(c00, c01, c10, tall, pos, uv, idx)
  }
  if (!idx.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

export function ContactShades() {
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), MAT)
    m.name = 'contact-shades'
    m.renderOrder = -1
    m.raycast = () => {}
    m.frustumCulled = false
    return m
  }, [])
  const editing = useEditSel((s) => s.on)
  useEffect(() => {
    if (editing) return
    // (made once the shop's models are in (and again a little later, for what came in last); again whenever the editor's put away)
    const make = () => {
      const g = build()
      if (!g) return
      mesh.geometry.dispose()
      mesh.geometry = g
    }
    const a = window.setTimeout(make, 2500), b = window.setTimeout(make, 9000)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
  }, [editing, mesh])
  useEffect(() => () => mesh.geometry.dispose(), [mesh])
  return <primitive object={mesh} />
}
