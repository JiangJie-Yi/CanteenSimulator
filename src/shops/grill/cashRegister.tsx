import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { DEPTS, newRegister, pressKey, REG_MODES, regFigure, setMode, settle, type Receipt, type RegKey } from '@/game/register'
import { POINTER_HINT, TILL_STATE } from './bar'
import { getEdit } from './edit'

/**
 * The till's register, live: the model from blender/register.py (its body, its drawer, its keys and its mode lock), the register's own
 * state (game/register.ts) the keys work, the receipt it prints, the beep of its keys.
 */
const REGISTER_URL = import.meta.env.BASE_URL + 'models/register.glb'
/** the parts too small or too flat for an ink line: the lettering, the windows, the slots, and the keys */
const REG_UNINKED = /^(Key(Cap|Face)_|Reg(Mode|Maker|PaperMark|DrawerLabelText|DisplayWindow|CustWindow|PaperSlot|MediaSlot|Keyway|CardSlot|Socket|CaseInside))/
/** where the mode lock's key points for each mode (degrees, from straight away from the operator, toward their left) */
const MODE_ANGLE: Record<string, number> = { OFF: -60, REG: -20, X: 20, Z: 60 }
/** how far a key goes down when pressed (the register's own units) */
const KEY_TRAVEL = 0.0028

/** the register's state, shared by the keys, the displays and the customers paying at the till */
export const REGISTER = {
  state: newRegister(),
  /** when the receipt now hanging out of the printer started printing (performance.now(), -1 none) and how long it is (1 = the usual slip) */
  printAt: -1,
  printLen: 1,
  /** each key's last press (performance.now()) */
  pressed: new Map<string, number>(),
}
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __register?: typeof REGISTER }).__register = REGISTER

/** what the displays read: the customer's bill while one's paying, otherwise the register's own */
export const registerText = () => (TILL_STATE.k >= 0 ? TILL_STATE.text : REGISTER.state.display)

let regModel: { body: THREE.Object3D; drawer: THREE.Object3D; keys: THREE.Object3D; modeKey: THREE.Object3D } | null = null
export function useRegisterModel() {
  const gltf = useGLTF(REGISTER_URL) as unknown as { scene: THREE.Group }
  if (regModel) return regModel
  const root = gltf.scene.clone(true)
  const toon = new Map<THREE.Material, THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = toon.get(src)
    if (!t) {
      t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
      toon.set(src, t)
    }
    m.material = t
    m.castShadow = !REG_UNINKED.test(m.name)
  })
  inkModel(root, (m) => REG_UNINKED.test(m.name), { width: 0.0022, weld: true })
  const get = (n: string) => root.getObjectByName(n)!
  regModel = { body: get('RegBody'), drawer: get('RegDrawer'), keys: get('RegKeys'), modeKey: get('RegModeKey') }
  return regModel
}
/** the model once it's loaded (for handlers, outside of rendering), or null before */
useRegisterModel.cached = () => regModel
useGLTF.preload(REGISTER_URL)

export function RegisterBody() {
  return <primitive object={useRegisterModel().body} />
}
export function RegisterDrawer() {
  return <primitive object={useRegisterModel().drawer} />
}

/**
 * Pointed at, a part lifts a little out of the shade (a soft white, not the orange of things to pick up): each mesh under it given a lighter
 * copy of its material while the pointer's there. The ink lines (drawn inside out) are left alone.
 */
const LIFTED = new WeakMap<THREE.Material, THREE.Material>()
const WAS = new WeakMap<THREE.Mesh, THREE.Material>()
export function liftOn(root: THREE.Object3D | null, on: boolean) {
  root?.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material) || m.material.side === THREE.BackSide) return
    if (on && !WAS.has(m)) {
      let l = LIFTED.get(m.material)
      if (!l) {
        l = m.material.clone()
        const t = l as THREE.MeshToonMaterial
        if (t.emissive) { t.emissive = new THREE.Color('#ffffff'); t.emissiveIntensity = 0.12 }
        LIFTED.set(m.material, l)
      }
      WAS.set(m, m.material)
      m.material = l
    } else if (!on && WAS.has(m)) {
      m.material = WAS.get(m)!
      WAS.delete(m)
    }
  })
}

/** the keys' beep: short and high for a key taken, low and long for one refused */
let audio: AudioContext | null = null
export function beep(kind: 'ok' | 'error') {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = 'square'
    o.frequency.value = kind === 'ok' ? 2350 : 520
    const len = kind === 'ok' ? 0.05 : 0.28
    g.gain.setValueAtTime(0.025, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    o.connect(g).connect(audio.destination)
    o.start(t)
    o.stop(t + len + 0.02)
  } catch { /* (no sound to be had: the keys work all the same) */ }
}

/** the receipt's paper: a tall canvas, of which only the part printed on is shown */
const RECEIPT_W = 170, RECEIPT_H = 360
export const RECEIPT_TEX = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = RECEIPT_W
  c.height = RECEIPT_H
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const KIND_TITLE: Record<Receipt['kind'], string> = { CASH: '領収書 RECEIPT', CHECK: '領収書 CHECK', CHARGE: '領収書 CHARGE', NOSALE: 'NO SALE',
  RA: '入金 RA', PO: '出金 PO', X: 'X 点検 REPORT', Z: 'Z 精算 REPORT' }
/** print a receipt on the paper (null: a stretch of blank paper fed out); how long the slip comes out, against the usual one */
export function drawReceipt(r: Receipt | null): number {
  const tex = RECEIPT_TEX
  if (!tex) return 1
  const g = (tex.image as HTMLCanvasElement).getContext('2d')!
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, RECEIPT_W, RECEIPT_H)
  let h = 60
  if (r) {
    g.fillStyle = '#222'
    g.textAlign = 'center'
    g.font = 'bold 15px "Noto Sans JP", "Yu Gothic", sans-serif'
    g.fillText('闊野 日式烤魚', 85, 20)
    g.font = 'bold 10px "Noto Sans JP", "Yu Gothic", sans-serif'
    g.fillText(KIND_TITLE[r.kind], 85, 35)
    g.font = '9px "Courier New", monospace'
    g.fillText(r.at, 85, 48)
    g.textAlign = 'left'
    g.fillText(`No.${String(r.no).padStart(4, '0')}`, 10, 60)
    g.textAlign = 'right'
    g.fillText(`C-${String(r.clerk).padStart(2, '0')}`, 160, 60)
    let y = 66
    const rule = () => { g.fillRect(10, y, 150, 1); y += 12 }
    const row = (a: string, b: string, bold = false) => {
      g.font = `${bold ? 'bold 11px' : '10px'} "Noto Sans JP", "Yu Gothic", sans-serif`
      g.textAlign = 'left'; g.fillText(a, 10, y)
      g.textAlign = 'right'; g.fillText(b, 160, y)
      y += bold ? 15 : 13
    }
    rule()
    for (const l of r.lines) row(l.qty > 1 ? `${l.label} ×${l.qty}` : l.label, `¥${regFigure(l.amount)}`)
    if (r.kind === 'CASH' || r.kind === 'CHECK' || r.kind === 'CHARGE') {
      if (r.lines.length) rule()
      row('合計', `¥${regFigure(r.total)}`, true)
      row('(内消費税 10%', `¥${regFigure(r.tax)})`)
      if (r.kind === 'CASH') {
        row('お預り', `¥${regFigure(r.tender)}`)
        row('お釣り', `¥${regFigure(r.change)}`, true)
      }
    } else if (r.kind === 'RA' || r.kind === 'PO') {
      row(r.kind === 'RA' ? '入金' : '出金', `¥${regFigure(r.total)}`, true)
    } else if (r.kind === 'X' || r.kind === 'Z') {
      row('売上', `¥${regFigure(r.total)}`, true)
      row('(内消費税', `¥${regFigure(r.tax)})`)
    }
    y += 4
    g.textAlign = 'center'
    g.font = '9px "Noto Sans JP", "Yu Gothic", sans-serif'
    if (r.kind === 'CASH' || r.kind === 'CHECK' || r.kind === 'CHARGE') { g.fillText('ありがとうございました', 85, y); y += 12 }
    h = Math.min(RECEIPT_H, y + 6)
  }
  // (only the top of the paper, as far as it's printed, is shown)
  tex.repeat.set(1, h / RECEIPT_H)
  tex.offset.set(0, 1 - h / RECEIPT_H)
  tex.needsUpdate = true
  return h / 200
}

/** do what pressing a key does: the register's state, the beep, the drawer, the receipt */
export function press(key: RegKey, now = new Date()) {
  REGISTER.pressed.set(key, performance.now())
  const r = pressKey(REGISTER.state, key, now)
  REGISTER.state = r.state
  if (r.effect.beep) beep(r.effect.beep)
  if (r.effect.drawer) TILL_STATE.manual = true
  if (r.effect.receipt) {
    REGISTER.printLen = drawReceipt(r.effect.receipt)
    REGISTER.printAt = performance.now()
  } else if (r.effect.feed) {
    REGISTER.printLen = drawReceipt(null)
    REGISTER.printAt = performance.now()
  }
}

const keyOf = (o: THREE.Object3D | null) => {
  for (let x = o; x; x = x.parent) if (x.name.startsWith('Key_')) return x
  return null
}
type Ev = { stopPropagation: () => void; object: THREE.Object3D; nativeEvent: Event }

/**
 * The keys and the mode lock: each key goes down under the finger and comes back up, beeps, and does what it does; the mode lock turns
 * OFF → REG → X → Z. While a customer's paying, the cashier's hands are on it: the keys go down as they ring the bill up, and the sale's
 * receipt is the one printed.
 */
export function RegisterKeys() {
  const { keys, modeKey } = useRegisterModel()
  const rest = useRef(new Map<THREE.Object3D, number>())
  const hovered = useRef<THREE.Object3D | null>(null)
  const lastK = useRef(-1)
  const rung = useRef(0)
  const knob = useRef(THREE.MathUtils.degToRad(-MODE_ANGLE.REG))
  useFrame((_, delta) => {
    const now = performance.now()
    // (the cashier ringing a customer up: a department key for each dish, the drink, the subtotal, the cash key)
    const k = TILL_STATE.k, pk = lastK.current
    if (k >= 0) {
      if (pk < 0) rung.current = 0
      const parts = TILL_STATE.parts
      const n = Math.min(parts.length, Math.floor((k / 0.32) * parts.length) + 1)
      if (k < 0.32 && n > rung.current) {
        rung.current = n
        REGISTER.pressed.set(n > TILL_STATE.items ? 'D2' : 'D1', now)
        beep('ok')
      }
      if (pk < 0.3 && k >= 0.3) {
        // (the sale's settled: its receipt printed, the day's takings counted)
        REGISTER.pressed.set('SUBTOTAL', now)
        const lines = parts.map((amount, i) => ({ label: i < TILL_STATE.items ? DEPTS[0].name : DEPTS[1].name, amount, qty: 1 }))
        const base = REGISTER.state.mode === 'REG' ? REGISTER.state : setMode(REGISTER.state, 'REG')
        const { state, receipt } = settle(base, lines, TILL_STATE.tender, 'CASH', new Date())
        REGISTER.state = state
        if (state.receiptOn) { REGISTER.printLen = drawReceipt(receipt); REGISTER.printAt = -1 }
      }
      if (pk < 0.44 && k >= 0.44) { REGISTER.pressed.set('CASH', now); beep('ok') }
    }
    lastK.current = k
    // the keys: down fast, held a moment, back up
    keys.children.forEach((key) => {
      if (!rest.current.has(key)) rest.current.set(key, key.position.y)
      const t = (now - (REGISTER.pressed.get(key.name.slice(4)) ?? -1e9)) / 1000
      const d = t < 0.05 ? t / 0.05 : t < 0.13 ? 1 : Math.max(0, 1 - (t - 0.13) / 0.08)
      key.position.y = rest.current.get(key)! - d * KEY_TRAVEL
    })
    // the mode lock's key, turned toward its mode
    const want = THREE.MathUtils.degToRad(-MODE_ANGLE[REGISTER.state.mode])
    knob.current += (want - knob.current) * Math.min(1, delta * 14)
    modeKey.rotation.y = knob.current
  })
  const blocked = () => getEdit().on || TILL_STATE.k >= 0
  const point = (e: Ev, on: boolean) => {
    const el = e.nativeEvent.target as HTMLElement | null
    POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand + (on ? 1 : -1))
    if (el?.style) el.style.cursor = on ? 'pointer' : POINTER_HINT.hand ? 'pointer' : ''
  }
  return (
    <>
      {/* (the handlers on a group round each: a primitive's own aren't attached) */}
      <group
        onPointerMove={(e: Ev) => {
          e.stopPropagation()
          const key = keyOf(e.object)
          if (key === hovered.current) return
          liftOn(hovered.current, false)
          hovered.current = key
          liftOn(key, !getEdit().on)
        }}
        onPointerEnter={(e: Ev) => point(e, true)}
        onPointerLeave={(e: Ev) => { liftOn(hovered.current, false); hovered.current = null; point(e, false) }}
        onClick={(e: Ev) => {
          e.stopPropagation()
          const key = keyOf(e.object)
          if (!key || blocked()) return
          press(key.name.slice(4) as RegKey)
        }}>
        <primitive object={keys} />
      </group>
      <group
        onPointerEnter={(e: Ev) => { liftOn(modeKey, true); point(e, true) }}
        onPointerLeave={(e: Ev) => { liftOn(modeKey, false); point(e, false) }}
        onClick={(e: Ev) => {
          e.stopPropagation()
          if (blocked()) return
          const next = REG_MODES[(REG_MODES.indexOf(REGISTER.state.mode) + 1) % REG_MODES.length]
          REGISTER.state = setMode(REGISTER.state, next)
          beep('ok')
        }}>
        <primitive object={modeKey} />
      </group>
    </>
  )
}
