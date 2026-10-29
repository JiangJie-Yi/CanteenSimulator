import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { setTip } from '@/scene/hoverTip'
import { DEPTS, newRegister, pressKey, REG_MODES, REG_TAG_TEXT, regFigure, setMode, settle, turnDrawerKey, type Receipt, type RegKey } from '@/game/register'
import { keyHelp } from '@/data/registerKeys'
import type { Lang } from '@/data/i18n'
import { deposit } from '@/game/till'
import { POINTER_HINT, TILL_CASH, TILL_STATE } from './bar'
import { getEdit } from './edit'

/**
 * The till's register, live: the model from blender/register.py (its body, its drawer, its keys and its mode lock), the register's own
 * state (game/register.ts) the keys work, the receipt it prints, the beep of its keys.
 */
const REGISTER_URL = import.meta.env.BASE_URL + 'models/register.glb'
/** the parts too small or too flat for an ink line: the lettering, the windows, the slots, and the keys */
const REG_UNINKED = /^(Key(Cap|Face)_|Reg(DrawerKey|BillArm|BillHinge|BillRoller|RollLabel|RollBand|RollRule|RollCoin|RollCrimp|Mode|Maker|PaperMark|DrawerLabelText|DisplayWindow|CustWindow|PaperSlot|MediaSlot|Keyway|CardSlot|Socket|CaseInside))/
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
  /** when the drawer last rattled against its lock (performance.now()) */
  rattleAt: -1e9,
}
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __register?: typeof REGISTER }).__register = REGISTER

/** what the displays read: the customer's bill while one's paying, otherwise the register's own */
export const registerText = () => (TILL_STATE.k >= 0 ? TILL_STATE.text : REGISTER.state.display)
/** the word lit beside the figures (what they are), and the lock's mark when the drawer's locked */
export const registerTag = () => {
  const tag = TILL_STATE.k >= 0 ? (TILL_STATE.k < 0.32 ? '品項' : TILL_STATE.k < 0.44 || TILL_STATE.card ? '合計' : '找零') : REG_TAG_TEXT[REGISTER.state.tag]
  return REGISTER.state.drawerLocked ? `${tag} 鎖`.trim() : tag
}
/** the drawer won't come: it knocks against the lock */
export function rattle() {
  REGISTER.rattleAt = performance.now()
  beep('error')
}

/**
 * The register's materials as they really are, not the room's flat toon: its cream body and drawer a satin plastic, the keys a glossier
 * moulded plastic, the chrome and steel real metal, the screens dark glass.
 */
function realFinish(src: THREE.MeshStandardMaterial): THREE.Material {
  const n = src.name
  if (n === 'RegChrome') return new THREE.MeshPhysicalMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.12 })
  if (n === 'RegSteel') return new THREE.MeshPhysicalMaterial({ color: '#a7adb5', metalness: 0.9, roughness: 0.3 })
  if (n === 'RegScreen') return new THREE.MeshPhysicalMaterial({ color: src.color.clone(), roughness: 0.05, clearcoat: 1 })
  if (n.startsWith('RegKey')) return new THREE.MeshPhysicalMaterial({ color: src.color.clone(), map: src.map, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 })
  return new THREE.MeshPhysicalMaterial({ color: src.color.clone(), map: src.map, roughness: Math.max(0.45, src.roughness), metalness: 0, sheen: 0.2 })
}
let regModel: { body: THREE.Object3D; drawer: THREE.Object3D; keys: THREE.Object3D; modeKey: THREE.Object3D; drawerKey: THREE.Object3D; solid: THREE.Mesh[] } | null = null
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
      t = realFinish(src)
      toon.set(src, t)
    }
    m.material = t
    m.castShadow = !REG_UNINKED.test(m.name)
  })
  inkModel(root, (m) => REG_UNINKED.test(m.name), { width: 0.0022, weld: true })
  const get = (n: string) => root.getObjectByName(n)!
  // (the body's own surfaces, not their ink lines: what stands in front of the drawer, the keys and the keys' locks when seen from the side or behind)
  const solid: THREE.Mesh[] = []
  get('RegBody').traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && (m.material as THREE.Material).side !== THREE.BackSide) solid.push(m)
  })
  regModel = { body: get('RegBody'), drawer: get('RegDrawer'), keys: get('RegKeys'), modeKey: get('RegModeKey'), drawerKey: get('RegDrawerKey'), solid }
  return regModel
}
/** the model once it's loaded (for handlers, outside of rendering), or null before */
useRegisterModel.cached = () => regModel
useGLTF.preload(REGISTER_URL)

/**
 * Is what the pointer's on hidden behind the register's body? (the pointer's events reach everything along its line, the case doesn't stop
 * them: pointed at the case's side or back, the drawer inside it is hit too)
 */
const RAY = new THREE.Raycaster()
export function behindBody(e: { ray: THREE.Ray; distance: number }) {
  if (!regModel) return false
  RAY.ray.copy(e.ray)
  RAY.far = e.distance - 1e-4
  return RAY.intersectObjects(regModel.solid, false).length > 0
}
/** the drawer's parts that can be taken hold of: its front and what's on it (not the tray inside, nor the money) */
export const DRAWER_FRONT = /^Reg(DrawerFront|DrawerLip|MediaSlot|DrawerLabel|Lock|Keyway)/

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

/**
 * the drawer springing open, as a real till does it: the solenoid's clack as the latch lets go, the little bell inside struck once (a bright
 * small bell, its partials inharmonic and beating), and the drawer running out on its steel rails (a rolling rumble of the bearings) to knock
 * against its stop
 */
export function chime() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    const sr = audio.sampleRate
    const noise = (len: number, shape: (x: number) => number) => {
      const b = audio!.createBuffer(1, Math.round(sr * len), sr)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * shape(i / d.length)
      const n = audio!.createBufferSource()
      n.buffer = b
      return n
    }
    const out = audio.createGain()
    out.gain.value = 0.9
    out.connect(audio.destination)
    // (the latch: a sharp mechanical clack, low and high together)
    const clack = noise(0.04, (x) => (1 - x) ** 4)
    const cf = audio.createBiquadFilter(), cg = audio.createGain()
    cf.type = 'bandpass'
    cf.frequency.value = 1800
    cf.Q.value = 0.8
    cg.gain.value = 0.35
    clack.connect(cf).connect(cg).connect(out)
    clack.start(t)
    // (the bell: struck a moment after the latch)
    const tb = t + 0.015
    for (const [f, g, len] of [[1975, 0.05, 1.4], [1981, 0.03, 1.2], [4580, 0.02, 0.6], [7320, 0.008, 0.3]] as [number, number, number][]) {
      const o = audio.createOscillator(), v = audio.createGain()
      o.type = 'sine'
      o.frequency.value = f
      v.gain.setValueAtTime(0.0001, tb)
      v.gain.exponentialRampToValueAtTime(g, tb + 0.003)
      v.gain.exponentialRampToValueAtTime(0.0001, tb + len)
      o.connect(v).connect(out)
      o.start(tb)
      o.stop(tb + len + 0.05)
    }
    // (the run out on its rails: a rolling, ribbed rumble rising and falling as it speeds and slows)
    const run = 0.22
    const rail = noise(run, (x) => Math.sin(Math.PI * x) ** 0.7 * (0.55 + 0.45 * Math.sin(x * 140)))
    const rf = audio.createBiquadFilter(), rg = audio.createGain()
    rf.type = 'lowpass'
    rf.frequency.value = 1200
    rg.gain.value = 0.22
    rail.connect(rf).connect(rg).connect(out)
    rail.start(t + 0.02)
    // (and its knock against the stop at the end)
    const stop = noise(0.05, (x) => (1 - x) ** 3)
    const sf = audio.createBiquadFilter(), sg = audio.createGain()
    sf.type = 'lowpass'
    sf.frequency.value = 500
    sg.gain.value = 0.5
    stop.connect(sf).connect(sg).connect(out)
    stop.start(t + 0.02 + run)
  } catch { /* (no sound to be had) */ }
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
  if (r.effect.locked) rattle()
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
type Ev = { stopPropagation: () => void; object: THREE.Object3D; nativeEvent: Event; ray: THREE.Ray; distance: number }

/**
 * The keys and the mode lock: each key goes down under the finger and comes back up, beeps, and does what it does; the mode lock turns
 * OFF → REG → X → Z. While a customer's paying, the cashier's hands are on it: the keys go down as they ring the bill up, and the sale's
 * receipt is the one printed.
 */
export function RegisterKeys({ lang }: { lang: Lang }) {
  const { keys, modeKey, drawerKey } = useRegisterModel()
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
        // (a card's sale settled as CHARGE: no cash tendered, the drawer left shut)
        const { state, receipt } = settle(base, lines, TILL_STATE.card ? 0 : TILL_STATE.tender, TILL_STATE.card ? 'CHARGE' : 'CASH', new Date())
        REGISTER.state = state
        if (state.receiptOn) { REGISTER.printLen = drawReceipt(receipt); REGISTER.printAt = -1 }
      }
      if (pk < 0.44 && k >= 0.44) {
        REGISTER.pressed.set(TILL_STATE.card ? 'CHARGE' : 'CASH', now)
        beep('ok')
        // (the cashier unlocks the drawer to take the money: the key's turned upright; the bill goes into it)
        if (!TILL_STATE.card && REGISTER.state.drawerLocked) REGISTER.state = turnDrawerKey(REGISTER.state)
        if (!TILL_STATE.card) TILL_CASH.drawer = deposit(TILL_CASH.drawer, TILL_STATE.bill)
      }
    }
    lastK.current = k
    // the keys: down fast, held a moment, back up
    keys.children.forEach((key) => {
      if (!rest.current.has(key)) rest.current.set(key, key.position.y)
      const t = (now - (REGISTER.pressed.get(key.name.slice(4)) ?? -1e9)) / 1000
      const d = t < 0.05 ? t / 0.05 : t < 0.13 ? 1 : Math.max(0, 1 - (t - 0.13) / 0.08)
      key.position.y = rest.current.get(key)! - d * KEY_TRAVEL
    })
    // the mode lock's key, turned toward its mode; the drawer's key, upright open, across locked
    const want = THREE.MathUtils.degToRad(-MODE_ANGLE[REGISTER.state.mode])
    knob.current += (want - knob.current) * Math.min(1, delta * 14)
    modeKey.rotation.y = knob.current
    const lockWant = REGISTER.state.drawerLocked ? -Math.PI / 2 : 0
    drawerKey.rotation.z += (lockWant - drawerKey.rotation.z) * Math.min(1, delta * 14)
  })
  const blocked = () => getEdit().on || TILL_STATE.k >= 0
  const showHelp = (id: string | null) => showKeyTip(id, lang)
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
          // (seen from the side or behind, the body's in front of them: nothing to point at)
          const key = behindBody(e) || getEdit().on ? null : keyOf(e.object)
          if (key === hovered.current) return
          liftOn(hovered.current, false)
          if (!!key !== !!hovered.current) point(e, !!key)
          hovered.current = key
          liftOn(key, true)
          showHelp(key?.name.slice(4) ?? null)
        }}
        onPointerLeave={(e: Ev) => {
          if (hovered.current) point(e, false)
          liftOn(hovered.current, false)
          hovered.current = null
          showHelp(null)
        }}
        onClick={(e: Ev) => {
          e.stopPropagation()
          const key = keyOf(e.object)
          if (!key || blocked() || behindBody(e)) return
          press(key.name.slice(4) as RegKey)
        }}>
        <primitive object={keys} />
      </group>
      <group
        onPointerEnter={(e: Ev) => { if (behindBody(e)) return; liftOn(modeKey, true); point(e, true); showHelp('MODE') }}
        onPointerLeave={(e: Ev) => { if (!WAS_LIFTED(modeKey)) return; liftOn(modeKey, false); point(e, false); showHelp(null) }}
        onClick={(e: Ev) => {
          e.stopPropagation()
          if (blocked() || behindBody(e)) return
          const next = REG_MODES[(REG_MODES.indexOf(REGISTER.state.mode) + 1) % REG_MODES.length]
          REGISTER.state = setMode(REGISTER.state, next)
          beep('ok')
        }}>
        <primitive object={modeKey} />
      </group>
    </>
  )
}

/** whether a part's lit as pointed at just now */
const WAS_LIFTED = (root: THREE.Object3D) => {
  let lit = false
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && WAS.has(o as THREE.Mesh)) lit = true })
  return lit
}


/** the drawer's key's parts (it rides on the drawer, whose handlers take it) */
export const DRAWER_KEY = /^RegDrawerKey/
/** turn the drawer's key a quarter: locked, or unlocked */
export function turnKey() {
  REGISTER.state = turnDrawerKey(REGISTER.state)
  beep('ok')
}

/** the room's name tag (the paper one by the pointer) for a key of the register: its name, and what it does */
export function showKeyTip(id: string | null, lang: Lang) {
  if (!id) { setTip(null); return }
  const text = keyHelp(id, lang, /^D\d$/.test(id) ? DEPTS[Number(id[1]) - 1] : undefined)
  const cut = text.indexOf('：')
  setTip(cut > 0 ? { title: text.slice(0, cut), hint: text.slice(cut + 1) } : { title: text, hint: '' })
}
