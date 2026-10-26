import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'

/**
 * The small things on the till's counter, from blender/tilldesk.py: the pen cup, the receipt printer, the card reader, the service bell, the
 * walnut stand with its drawers, the change tray (カルトン) and the cat's stand (a river stone). Each is its own node, shown wherever its group stands it (its own Movable in GuestBar3D); materials made toon, the bell's
 * dome and the steel bits real metal, an ink line round the bigger parts.
 */
const URL = import.meta.env.BASE_URL + 'models/tilldesk.glb'
export type DeskPiece = 'TillPens' | 'TillPrinter' | 'TillCardReader' | 'TillBell' | 'TillMat' | 'TillCatStand' | 'TillTray' | 'TillMoneyTree' | 'TillIngot'
/** how high the cat's stand lifts the cat: the stone's worn-flat top */
export const CAT_STAND_H = 0.166
/** the parts too small or too flat for an ink line: lettering, lights, slots, teeth, keys, cables and holes */
const UNINKED = /(Label|Amount|Prompt|Led|Seam|Slot|Tooth|Vent|Switch|Feed|Lever|Key|Fn|Nfc|Stripe|Screen|Cable|Hole|Clip|Cap|Felt|Band|Floor|Stem|Knob|Slip|Rim|Blades|Ribs|Thanks|Foot|Post|Pull|Box|Sub|Seam|Arrow|Card|Lid|Tear|Catch)/
const METAL = new Set(['DeskChrome', 'DeskSteel', 'BellGold', 'StandBrass', 'TrayGilt', 'IngotGold'])

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
      t = src.name === 'TrayResin'
        // (the change tray's moulded plastic: a smooth, fairly glossy black, the lamps sliding over it)
        ? new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.12, specularIntensity: 0.8, sheen: 0.3, sheenRoughness: 0.4 })
        : METAL.has(src.name)
        ? src.name === 'BellGold' || src.name === 'IngotGold'
          // (polished brass: a warm gold that catches the lamps)
          ? new THREE.MeshPhysicalMaterial({ color: '#d9a441', metalness: 1, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0,
            specularColor: new THREE.Color('#fff1c8'), iridescence: 0.08 })
          : new THREE.MeshPhysicalMaterial({ color: src.color.clone(), metalness: 0.9, roughness: src.name === 'DeskChrome' ? 0.12 : 0.3, envMapIntensity: 0.8 })
        : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
      mats.set(src, t)
    }
    if (METAL.has(src.name)) reflectStudio(t as THREE.MeshPhysicalMaterial)
    m.material = t
    m.castShadow = !UNINKED.test(m.name)
    m.receiveShadow = true
  })
  inkModel(root, (m) => UNINKED.test(m.name), { width: 0.0012, weld: true })
  const get = (n: DeskPiece) => { const o = root.getObjectByName(n)!; o.removeFromParent(); return o }
  pieces = { TillPens: get('TillPens'), TillPrinter: get('TillPrinter'), TillCardReader: get('TillCardReader'), TillBell: get('TillBell'), TillMat: get('TillMat'), TillCatStand: get('TillCatStand'), TillTray: get('TillTray'), TillMoneyTree: get('TillMoneyTree'), TillIngot: get('TillIngot') }
  return pieces
}

export function TillDeskPiece({ name }: { name: DeskPiece }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => piecesOf(gltf.scene)[name], [gltf, name])
  useStudio()
  return <primitive object={obj} />
}
useGLTF.preload(URL)

/**
 * a service bell's ring, as a struck brass dome sounds: the hammer's click, then a bright fundamental with the dome's inharmonic partials
 * (each beating a little against a twin a few hertz off), the high ones dying first, the whole ringing on a second and a half
 */
let audio: AudioContext | null = null
function ding() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const out = audio.createGain()
    out.gain.value = 0.9
    out.connect(audio.destination)
    // (the click of the hammer on the dome)
    const buf = audio.createBuffer(1, Math.round(audio.sampleRate * 0.012), audio.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3
    const n = audio.createBufferSource(), hp = audio.createBiquadFilter(), ng = audio.createGain()
    n.buffer = buf
    hp.type = 'highpass'
    hp.frequency.value = 3000
    ng.gain.value = 0.25
    n.connect(hp).connect(ng).connect(out)
    n.start(t)
    const F = 2480
    for (const [r, g, len] of [[1, 0.06, 1.8], [2.32, 0.03, 1.1], [4.25, 0.018, 0.6], [6.63, 0.01, 0.35], [9.4, 0.005, 0.18]] as [number, number, number][]) {
      for (const det of [0, 3.5]) {
        const o = audio.createOscillator(), v = audio.createGain()
        o.type = 'sine'
        o.frequency.value = F * r + det
        v.gain.setValueAtTime(0.0001, t)
        v.gain.exponentialRampToValueAtTime(g * (det ? 0.6 : 1), t + 0.003)
        v.gain.exponentialRampToValueAtTime(0.0001, t + len)
        o.connect(v).connect(out)
        o.start(t)
        o.stop(t + len + 0.05)
      }
    }
  } catch { /* (no sound to be had) */ }
}

/**
 * The service bell, live: pointed at, its tag; clicked, the plunger goes down and comes back and it rings. Not batched (it moves).
 */
export function TillBellLive({ tip, onRing }: { tip: Record<string, unknown>; onRing?: () => boolean }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const bell = useMemo(() => piecesOf(gltf.scene).TillBell, [gltf])
  useStudio()
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

/** a drawer's runners: a soft wooden rumble as it's pulled or pushed, and the knock as it comes home */
function slide(closing: boolean) {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const len = 0.28
    const buf = audio.createBuffer(1, Math.round(audio.sampleRate * len), audio.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const x = i / d.length
      d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 90))
    }
    const n = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain()
    n.buffer = buf
    f.type = 'lowpass'
    f.frequency.value = 900
    g.gain.value = 0.09
    n.connect(f).connect(g).connect(audio.destination)
    n.start(t)
    if (closing) {
      const o = audio.createOscillator(), v = audio.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(160, t + len)
      o.frequency.exponentialRampToValueAtTime(70, t + len + 0.08)
      v.gain.setValueAtTime(0.12, t + len)
      v.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.12)
      o.connect(v).connect(audio.destination)
      o.start(t + len)
      o.stop(t + len + 0.14)
    }
  } catch { /* (no sound to be had) */ }
}

/**
 * The walnut stand, live: its two drawers each slide out toward the cashier when clicked, and back in with another click (with the runners'
 * sound); named by the pointer. Not batched (the drawers move); nothing works in edit mode.
 */
export function TillMatLive({ tip, editing }: { tip: (open: boolean) => Record<string, unknown>; editing: () => boolean }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const mat = useMemo(() => piecesOf(gltf.scene).TillMat, [gltf])
  const drawers = useMemo(() => [0, 1].map((k) => mat.getObjectByName(`DeskMatDrawer${k}`)!), [mat])
  const open = useRef([false, false])
  const at = useRef([0, 0])
  useFrame((_, dt) => {
    drawers.forEach((d, k) => {
      if (!d) return
      const want = open.current[k] ? 1 : 0
      at.current[k] += (want - at.current[k]) * Math.min(1, dt * 7)
      // (out along the drawer's own +z, toward the cashier, about two thirds of its depth)
      d.position.z = at.current[k] * 0.2
    })
  })
  // (which drawer, if any, the pointer's on: the hit mesh's ancestors)
  const which = (o: THREE.Object3D | undefined) => { for (let p = o ?? null; p; p = p.parent) { const k = drawers.indexOf(p); if (k >= 0) return k } return -1 }
  const [hover, setHover] = useState(-1)
  const tipFor = hover >= 0 ? tip(open.current[hover]) : null
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group
      onPointerMove={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        const k = editing() ? -1 : which(e.object)
        if (k !== hover) {
          if (hover >= 0) (tip(open.current[hover]) as { onPointerOut: (e: unknown) => void }).onPointerOut(e)
          if (k >= 0) { e.stopPropagation(); (tip(open.current[k]) as { onPointerOver: (e: unknown) => void }).onPointerOver(e) }
          setHover(k)
        }
      }}
      onPointerOut={(e: unknown) => { if (hover >= 0) (tipFor as { onPointerOut: (e: unknown) => void }).onPointerOut(e); setHover(-1) }}
      onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        const k = which(e.object)
        if (k < 0 || editing()) return
        e.stopPropagation()
        open.current[k] = !open.current[k]
        slide(!open.current[k])
      }}>
      <primitive object={mat} />
    </group>
  )
}
