import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The small things on the till's counter, from blender/tilldesk.py: the pen cup, the receipt printer, the card reader, the service bell, the
 * wooden desk mat and the cat's stand (a river stone). Each is its own node, shown wherever its group stands it (its own Movable in GuestBar3D); materials made toon, the bell's
 * dome and the steel bits real metal, an ink line round the bigger parts.
 */
const URL = import.meta.env.BASE_URL + 'models/tilldesk.glb'
export type DeskPiece = 'TillPens' | 'TillPrinter' | 'TillCardReader' | 'TillBell' | 'TillMat' | 'TillCatStand'
/** how high the cat's stand lifts the cat: the stone's worn-flat top */
export const CAT_STAND_H = 0.108
/** the parts too small or too flat for an ink line: lettering, lights, slots, teeth, keys, cables and holes */
const UNINKED = /(Label|Amount|Prompt|Led|Seam|Slot|Tooth|Vent|Switch|Feed|Lever|Key|Fn|Nfc|Stripe|Screen|Cable|Hole|Clip|Cap|Felt|Band|Floor|Stem|Knob|Slip|Rim|Blades)/
const METAL = new Set(['DeskChrome', 'DeskSteel', 'BellGold'])

let pieces: Record<DeskPiece, THREE.Object3D> | null = null
function piecesOf(scene: THREE.Group) {
  if (pieces) return pieces
  const root = scene.clone(true)
  const mats = new Map<THREE.Material, THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = mats.get(src)
    if (!t) {
      t = METAL.has(src.name)
        ? src.name === 'BellGold'
          // (polished brass: a warm gold that catches the lamps)
          ? new THREE.MeshPhysicalMaterial({ color: '#e2b94a', metalness: 1, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.2 })
          : new THREE.MeshPhysicalMaterial({ color: src.color.clone(), metalness: 0.9, roughness: src.name === 'DeskChrome' ? 0.12 : 0.3, envMapIntensity: 0.8 })
        : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
      mats.set(src, t)
    }
    m.material = t
    m.castShadow = !UNINKED.test(m.name)
    m.receiveShadow = true
  })
  inkModel(root, (m) => UNINKED.test(m.name), { width: 0.0012, weld: true })
  const get = (n: DeskPiece) => { const o = root.getObjectByName(n)!; o.removeFromParent(); return o }
  pieces = { TillPens: get('TillPens'), TillPrinter: get('TillPrinter'), TillCardReader: get('TillCardReader'), TillBell: get('TillBell'), TillMat: get('TillMat'), TillCatStand: get('TillCatStand') }
  return pieces
}

export function TillDeskPiece({ name }: { name: DeskPiece }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => piecesOf(gltf.scene)[name], [gltf, name])
  return <primitive object={obj} />
}
useGLTF.preload(URL)

/** a bell's ring: a bright strike and its long, shimmering die-away (two partials a little out of tune with each other) */
let audio: AudioContext | null = null
function ding() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    for (const [f, g, len] of [[2093, 0.05, 1.6], [2101, 0.03, 1.4], [5240, 0.015, 0.5]] as [number, number, number][]) {
      const o = audio.createOscillator(), v = audio.createGain()
      o.type = 'sine'
      o.frequency.value = f
      v.gain.setValueAtTime(g, t)
      v.gain.exponentialRampToValueAtTime(0.0001, t + len)
      o.connect(v).connect(audio.destination)
      o.start(t)
      o.stop(t + len + 0.05)
    }
  } catch { /* (no sound to be had) */ }
}

/**
 * The service bell, live: pointed at, its tag; clicked, the plunger goes down and comes back and it rings. Not batched (it moves).
 */
export function TillBellLive({ tip, onRing }: { tip: Record<string, unknown>; onRing?: () => boolean }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const bell = useMemo(() => piecesOf(gltf.scene).TillBell, [gltf])
  const plunger = useMemo(() => bell.getObjectByName('TillBellPlunger')!, [bell])
  const rest = useRef<number | null>(null)
  const struck = useRef(-1e9)
  useFrame(() => {
    rest.current ??= plunger.position.y
    const t = (performance.now() - struck.current) / 1000
    const d = t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.12)
    plunger.position.y = rest.current - d * 0.005
  })
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group {...tip} onClick={(e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      if (onRing && !onRing()) return
      struck.current = performance.now()
      ding()
    }}>
      <primitive object={bell} />
    </group>
  )
}
