import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'
import { TILL_STATE, yen } from './bar'

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
const UNINKED = /(Label|Amount|Prompt|Led|Seam|Slot|Tooth|Vent|Switch|Feed|Lever|Key|Fn|Nfc|Stripe|Screen|Cable|Hole|Clip|Cap|Felt|Band|Floor|Stem|Knob|Slip|Rim|Blades|Ribs|Thanks|Foot|Post|Pull|Box|Sub|Seam|Arrow|Card|Lid|Tear|Catch|Lip|Tassel)/
const METAL = new Set(['DeskChrome', 'DeskSteel', 'BellGold', 'BellNickel', 'StandBrass', 'IngotGold'])

/**
 * The card reader's LCD, drawn as a real one reads: standing by, it says it's ready and asks for a card (and the time); while a customer pays
 * by card it shows the sale and the amount, then asks for the PIN or a tap, and thanks them once it's gone through
 */
const READER = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 320; c.height = 140
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { c, g: c.getContext('2d')!, t, key: '' }
})()
function drawReader() {
  if (!READER) return
  const paying = TILL_STATE.card && TILL_STATE.k >= 0
  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const stage = !paying ? 'idle' : TILL_STATE.k < 0.62 ? 'sale' : 'done'
  const key = `${stage}|${TILL_STATE.bill}|${stage === 'idle' ? hm : ''}`
  if (READER.key === key) return
  READER.key = key
  const { g, c } = READER
  g.fillStyle = '#aab3a6'; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#1c2420'
  g.textBaseline = 'middle'
  const font = (px: number, w = 700) => `${w} ${px}px ui-monospace, Menlo, Consolas, monospace`
  if (stage === 'idle') {
    g.font = font(22, 500); g.textAlign = 'left'; g.fillText('MULTI PAY', 14, 22)
    g.textAlign = 'right'; g.fillText(hm, c.width - 14, 22)
    g.textAlign = 'center'; g.font = font(40); g.fillText('READY', c.width / 2, 70)
    g.font = font(20, 500); g.fillText('INSERT / TAP CARD', c.width / 2, 114)
  } else if (stage === 'sale') {
    g.font = font(22); g.textAlign = 'left'; g.fillText('CREDIT  SALE', 14, 22)
    g.textAlign = 'right'; g.font = font(44); g.fillText(`¥${yen(TILL_STATE.bill)}`, c.width - 14, 72)
    g.textAlign = 'center'; g.font = font(20, 500); g.fillText('ENTER PIN OR TAP', c.width / 2, 118)
  } else {
    g.font = font(22); g.textAlign = 'left'; g.fillText('CREDIT  SALE', 14, 22)
    g.textAlign = 'right'; g.font = font(36); g.fillText(`¥${yen(TILL_STATE.bill)}`, c.width - 14, 64)
    g.textAlign = 'center'; g.font = font(24); g.fillText('APPROVED  THANK YOU', c.width / 2, 112)
  }
  READER.t.needsUpdate = true
}
drawReader()

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
        // (the change tray's moulded plastic: a charcoal grey, a soft satin sheen as injection-moulded ABS has, nothing like metal)
        ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: src.map, metalness: 0, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.45, specularIntensity: 0.5 })
        : METAL.has(src.name)
        ? src.name === 'BellGold' || src.name === 'IngotGold'
          // (the ingot: cast and polished, a deep warm yellow, the gleam broad and soft over its curves, not glinting in spots)
          ? new THREE.MeshPhysicalMaterial({ color: '#e9b43a', metalness: 1, roughness: 0.22, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.0 })
          : src.name === 'BellNickel'
          // (the service bell: nickel plate, a cool grey, satin rather than mirror)
          ? new THREE.MeshPhysicalMaterial({ color: '#cfd4d9', metalness: 1, roughness: 0.26, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.95 })
          : new THREE.MeshPhysicalMaterial({ color: src.color.clone(), metalness: 0.9, roughness: src.name === 'DeskChrome' ? 0.12 : 0.3, envMapIntensity: 0.8 })
        : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
      mats.set(src, t)
    }
    if (METAL.has(src.name)) reflectStudio(t as THREE.MeshPhysicalMaterial)
    m.material = m.name === 'ReaderScreen' && READER ? new THREE.MeshBasicMaterial({ map: READER.t, toneMapped: false }) : t
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
  useFrame(() => { if (name === 'TillCardReader') drawReader() })
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
  // (a ref, not state: one pointer move reaches the group once per mesh it crosses, and each must see the last one's change)
  const hover = useRef(-1)
  type Ev = { stopPropagation: () => void; object: THREE.Object3D; eventObject: THREE.Object3D; nativeEvent: Event; intersections?: { object: THREE.Object3D }[] }
  // (only what's nearest under the pointer counts: a ray through the stand's top or face would still reach a drawer's hidden box inside)
  const nearest = (e: Ev) => which(e.intersections?.[0]?.object ?? e.object)
  type Tip = { onPointerOver: (e: Ev) => void; onPointerOut: (e: Ev) => void }
  // (the glow and the name go to the drawer itself, not the whole stand: the event passed on as if it were the drawer's own)
  const asDrawer = (e: Ev, k: number) => ({ ...e, eventObject: drawers[k], stopPropagation: () => e.stopPropagation() })
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group
      onPointerMove={(e: Ev) => {
        const k = editing() ? -1 : nearest(e)
        if (k >= 0) e.stopPropagation()
        if (k !== hover.current) {
          if (hover.current >= 0) (tip(open.current[hover.current]) as Tip).onPointerOut(asDrawer(e, hover.current))
          if (k >= 0) (tip(open.current[k]) as Tip).onPointerOver(asDrawer(e, k))
          hover.current = k
        }
      }}
      onPointerOut={(e: Ev) => { if (hover.current >= 0) (tip(open.current[hover.current]) as Tip).onPointerOut(asDrawer(e, hover.current)); hover.current = -1 }}
      onClick={(e: Ev) => {
        const k = nearest(e)
        if (k < 0 || editing()) return
        e.stopPropagation()
        open.current[k] = !open.current[k]
        slide(!open.current[k])
      }}>
      <primitive object={mat} />
    </group>
  )
}
