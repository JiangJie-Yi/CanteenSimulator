import { memo, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { inkModel } from '@/scene/inkHull'
import { setTip } from '@/scene/hoverTip'
import { tipOver } from './bar'
import { getEdit } from './edit'
import { slideDoorSound } from './restroomSound'

/**
 * The kitchen's serving counter (配膳台, blender/servecounter.py; item 167, the owner's, 2026-11-15): on the kitchen's floor between the cook
 * table and the freezer, where the owner drew the red box; the takeaways' boxes packed and waiting on it (they stood in a plate at the cook
 * table's plating place, its second slot). In the bar's units, its foot's middle at its origin, its front toward +z; toon-shaded and inked as the
 * room's things are; its marks (ServeCounterTop, ServeCounterFront) kept for GuestBar3D to find where its top and its front are.
 * All bamboo, its two doors sliding (item 438, the owner's, 2026-11-21: 「這個我要全竹子的，拉門可拉」): each its own, pointed at it lights and
 * says what's in there, clicked it slides open across the other (a little pull back first, a soft knock as it stops), again and it slides shut.
 */
const URL = import.meta.env.BASE_URL + 'models/servecounter.glb'
useGLTF.preload(URL)
/** how far each door slides open (blender/servecounter.py's SERVE_DOOR: to the far leg's face, 2 mm short), and how long it takes */
const DOOR_SLIDE = 0.426
const DOOR_S = 0.55
/** each door's place along its track (0 shut .. DOOR_SLIDE open) as its slide goes: a little pull back the other way first, out past where
 * it stops a few millimetres, back to it (`p` 0..1 of the slide's time, `from` and `to` its ends) */
export function doorAlong(p: number, from: number, to: number) {
  const dir = Math.sign(to - from) || 1
  if (p <= 0) return from
  if (p < 0.15) return from - dir * 0.005 * Math.sin((p / 0.15) * Math.PI * 0.5)
  if (p < 0.85) {
    const q = (p - 0.15) / 0.7, e = 1 - (1 - q) ** 3
    return from - dir * 0.005 + (to + dir * 0.006 - (from - dir * 0.005)) * e
  }
  if (p < 1) return to + dir * 0.006 * (1 - (p - 0.85) / 0.15)
  return to
}
const DOOR_SAYS = (open: boolean) => `外帶盒與免洗筷收在裡面｜${open ? '點一下拉上' : '點一下拉開'}`
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const ServeCounter = memo(ServeCounterImpl)
function ServeCounterImpl() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { obj, doors } = useMemo(() => {
    const r = gltf.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      // (with its relief (item 499, the owner's 「貼圖部份，不夠立體，再美化」): the split bamboo's strips rounded, its nodes and the culms' raised,
      // in normal maps of their own; every lit material has one already (a flat one: scene/materialNormalize), so no new program)
      if (!t) {
        const tt = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, normalMap: src.normalMap ?? null })
        if (src.normalMap) tt.normalScale.copy(src.normalScale)
        tt.name = src.name; made.set(src, tt); t = tt
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    // (the kitchen's counters' line (0.0016 in the room's units), in the bar's, which are twice the size)
    inkModel(r, () => false, { width: 0.0008, weld: true })
    // (the doors left whole, each to slide; the rest folded together by material)
    mergeByMaterial(r, (o) => /^ServeDoor\d$/.test(o.name))
    const ds = [0, 1].map((k) => r.getObjectByName(`ServeDoor${k}`)).filter((o): o is THREE.Object3D => !!o)
    return { obj: r, doors: ds.map((o) => ({ o, x0: o.position.x })) }
  }, [gltf])
  // (each door: shut or open, when its slide began and from where)
  const st = useRef([0, 1].map(() => ({ open: false, t0: -1, from: 0, to: 0 })))
  useFrame(() => {
    const now = performance.now() / 1000
    doors.forEach(({ o, x0 }, k) => {
      const s = st.current[k]
      if (s.t0 < 0) return
      const p = Math.min(1, (now - s.t0) / DOOR_S)
      // (the left door slides right, over the right one; the right one left)
      o.position.x = x0 + (k ? -1 : 1) * doorAlong(p, s.from, s.to)
      if (p >= 1) s.t0 = -1
    })
  })
  const toggle = (k: number) => {
    const s = st.current[k], d = doors[k]
    if (!d) return
    // (from wherever it is along its track now, if it was still sliding)
    const along = Math.abs(d.o.position.x - d.x0)
    s.open = !s.open
    s.from = along
    s.to = s.open ? DOOR_SLIDE : 0
    s.t0 = performance.now() / 1000
    slideDoorSound(s.open, 0.5, DOOR_S)
  }
  return (
    <>
      <primitive object={obj} />
      {doors.map(({ o }, k) => (
        <group key={k}
          // (what it says read as it's pointed at: open or shut by then)
          onPointerOver={(e) => tipOver('配膳台的拉門', DOOR_SAYS(st.current[k].open)).onPointerOver(e)}
          onPointerOut={(e) => tipOver('配膳台的拉門', '').onPointerOut(e)}
          onClick={(e) => {
            e.stopPropagation()
            if (getEdit().on) return
            toggle(k)
            window.setTimeout(() => setTip({ title: '配膳台的拉門', hint: DOOR_SAYS(st.current[k].open) }), 60)
          }}>
          <primitive object={o} />
        </group>
      ))}
    </>
  )
}
