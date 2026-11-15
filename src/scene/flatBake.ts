// A small thing that lies flat on a table drawn as one sheet with its picture on it (the owner's, 2026-11-15, of the bar's soy dishes,
// chopsticks and their rests: "make them one sheet each, with a picture"): the piece is drawn once from straight above into a picture (its
// colours only, unlit, its ink lines with it, the rest of the picture clear), and that picture laid on a flat rectangle the size of its
// outline, a hair over its foot. Lit as anything in the room is (toon), so it darkens with the lights; cut out where the picture is clear.
import * as THREE from 'three'

export type Flat = { geo: THREE.BufferGeometry; mat: THREE.MeshToonMaterial }
const made = new Map<string, Flat>()

/**
 * The sheet for `src` (in its own frame: its foot at its lowest point), made once under `key` and shared: its geometry (a rectangle facing up,
 * over the piece's outline from above, `lift` over its foot) and its material. `px`: the picture's longer side.
 */
export function flatOf(gl: THREE.WebGLRenderer, key: string, src: THREE.Object3D, px = 256, lift = 0.0012): Flat {
  const hit = made.get(key)
  if (hit) return hit
  const copy = src.clone(true)
  copy.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(copy)
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3())
  const pad = 0.001, w = size.x + 2 * pad, d = size.z + 2 * pad
  const W = Math.max(8, Math.round(w >= d ? px : (px * w) / d)), H = Math.max(8, Math.round(d >= w ? px : (px * d) / w))
  // (its colours alone: each material swapped for an unlit one of the same colour and picture while it's drawn)
  const temp: THREE.Material[] = []
  copy.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const unlit = (x: THREE.Material) => {
      const s = x as THREE.MeshStandardMaterial
      const b = new THREE.MeshBasicMaterial({ color: s.color?.clone() ?? new THREE.Color('#ffffff'), map: s.map ?? null, side: x.side,
        transparent: x.transparent, opacity: x.opacity })
      temp.push(b)
      return b
    }
    m.material = Array.isArray(m.material) ? m.material.map(unlit) : unlit(m.material)
  })
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0.001, size.y + 1)
  cam.position.set(c.x, box.max.y + 0.5, c.z)
  cam.up.set(0, 0, -1)
  cam.lookAt(c.x, box.min.y, c.z)
  cam.updateMatrixWorld()
  const scene = new THREE.Scene()
  scene.add(copy)
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter })
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const was = gl.getRenderTarget(), clear = gl.getClearColor(new THREE.Color()), alpha = gl.getClearAlpha(), shadows = gl.shadowMap.autoUpdate
  gl.shadowMap.autoUpdate = false
  gl.setRenderTarget(rt)
  gl.setClearColor(0x000000, 0)
  gl.clear()
  gl.render(scene, cam)
  gl.setRenderTarget(was)
  gl.setClearColor(clear, alpha)
  gl.shadowMap.autoUpdate = shadows
  for (const t of temp) t.dispose()
  // (the picture's x is the piece's +x, its top its -z: a rectangle turned to face up maps them so)
  const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(c.x, box.min.y + lift, c.z)
  const mat = new THREE.MeshToonMaterial({ map: rt.texture, alphaTest: 0.5 })
  const out = { geo, mat }
  made.set(key, out)
  return out
}
