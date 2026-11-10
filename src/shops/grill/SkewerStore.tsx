import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { aimTip, setTip } from '@/scene/hoverTip'
import { SKEWER_POOL } from '@/game/skewers'
import { tl, type Lang } from '@/data/i18n'
import { PULLED, SKEWERS } from './bar'
import { ironSkewer } from './skewerShape'

/** an iron skewer (skewerShape: the same one as on the food, a flat bar to a point, a loop at its top for a handle), as long as shows standing
 * in a holder (they stand point down in it, their upper part and loop out of it); its middle at its origin */
const ROD = (() => {
  const g = ironSkewer(0.176, 0.0045, 0.002, 0.02, 0.012)
  g.translate(0, -0.1, 0)
  return g
})()
const STEEL = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.85, roughness: 0.35 })
const SOOTY = new THREE.MeshStandardMaterial({ color: '#7d7a75', metalness: 0.7, roughness: 0.6 })

/** a little wooden bucket's skin, drawn once a kind (`used`: the used skewers' bucket, darker and sooted from the rim down where the hot ones
 * went in; the owner's, 2026-11-11: both holders wooden buckets): sawara staves side by side round it, a dark seam between each, the grain
 * running up each stave, a little paler or darker one from the next, darker toward its foot */
function bucketSkin(used: boolean) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  let seed = used ? 7 : 3
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const STAVES = 12, w = 256 / STAVES
  for (let k = 0; k < STAVES; k++) {
    const x = k * w, shade = 0.9 + rnd() * 0.2
    const grad = g.createLinearGradient(0, 0, 0, 128)
    const top = used ? [150, 112, 72] : [196, 156, 104], foot = used ? [96, 68, 42] : [140, 104, 64]
    grad.addColorStop(0, `rgb(${top.map((v) => Math.round(v * shade)).join(',')})`)
    grad.addColorStop(1, `rgb(${foot.map((v) => Math.round(v * shade)).join(',')})`)
    g.fillStyle = grad
    g.fillRect(x, 0, w, 128)
    // (its grain: fine streaks up the stave, wavering a little)
    for (let n = 0; n < 6; n++) {
      const gx = x + 2 + rnd() * (w - 4)
      g.strokeStyle = rnd() < 0.5 ? `rgba(255,236,200,${0.08 + rnd() * 0.1})` : `rgba(40,22,10,${0.12 + rnd() * 0.15})`
      g.lineWidth = 0.6 + rnd()
      g.beginPath()
      g.moveTo(gx, 0)
      for (let y = 0; y <= 128; y += 16) g.lineTo(gx + Math.sin(y / 30 + n + k) * 0.8, y)
      g.stroke()
    }
    // (the seam to the next stave)
    g.fillStyle = 'rgba(30,16,6,0.7)'
    g.fillRect(x, 0, 1.4, 128)
  }
  // (used: soot down from the rim, where the hot rods are dropped in)
  if (used) {
    const soot = g.createLinearGradient(0, 0, 0, 60)
    soot.addColorStop(0, 'rgba(24,18,14,0.55)'); soot.addColorStop(1, 'rgba(24,18,14,0)')
    g.fillStyle = soot
    g.fillRect(0, 0, 256, 60)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}
const SKIN = typeof document === 'undefined' ? { clean: null, used: null } : { clean: bucketSkin(false), used: bucketSkin(true) }

/** the holders (the owner's: about half as tall as a skewer is long, hung on the cook table's front either side of the notch; little wooden
 * buckets now, 2026-11-11, they were bamboo tubes): staves a little wider at the top than the foot, open at its top with a lip round its rim and
 * its dark inside showing, two copper hoops, a copper plate screwed to the table's face behind it */
// (short: the space on the table's face between the top's edge and the bucket and bin on the floor below is half a metre (the owner's: no
// clipping; the taller one stood down into the bin))
const CUP_R = 0.055, CUP_H = 0.13
const CUP = new THREE.CylinderGeometry(CUP_R, CUP_R * 0.88, CUP_H, 20, 1, true)
const CUP_IN = new THREE.CylinderGeometry(CUP_R * 0.88, CUP_R * 0.78, CUP_H * 0.98, 20, 1, true)
const CUP_FOOT = new THREE.CylinderGeometry(CUP_R * 0.88, CUP_R * 0.88, 0.01, 20)
const LIP = new THREE.TorusGeometry(CUP_R * 0.93, CUP_R * 0.09, 6, 20)
// (each hoop as wide as the bucket where it's bound, a little proud of the staves)
const HOOP_LO = new THREE.CylinderGeometry(CUP_R * 0.93, CUP_R * 0.92, 0.012, 20, 1, true)
const HOOP_HI = new THREE.CylinderGeometry(CUP_R * 1.035, CUP_R * 1.03, 0.012, 20, 1, true)
const BACKPLATE = new THREE.BoxGeometry(0.07, 0.1, 0.008)
const SCREW = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8)
const INSIDE = new THREE.MeshStandardMaterial({ color: '#1c120a', roughness: 0.9, side: THREE.BackSide })
const HOOP_MAT = new THREE.MeshStandardMaterial({ color: '#b87333', metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide })
const SCREW_MAT = new THREE.MeshStandardMaterial({ color: '#6b4a24', metalness: 0.7, roughness: 0.4 })
const SKIN_MAT = { clean: new THREE.MeshStandardMaterial({ map: SKIN.clean, roughness: 0.6 }), used: new THREE.MeshStandardMaterial({ map: SKIN.used, roughness: 0.7 }) }
const RIM_MAT = { clean: new THREE.MeshStandardMaterial({ color: '#b08350', roughness: 0.55 }), used: new THREE.MeshStandardMaterial({ color: '#6e4f30', roughness: 0.65 }) }
/** at most this many drawn: a bundle in each */
const SHOWN_CLEAN = 30
const SHOWN_DIRTY = 30
const S1 = new THREE.Vector3(1, 1, 1)
/** a pulled skewer's flight into the used bucket (ms), where it ends (just in its mouth, the bucket's own frame), and what each frame reuses */
const FLY_MS = 520
const FLY_INTO = new THREE.Vector3(0, 0.11, 0.006)
const FLY_FROM = new THREE.Vector3(), FLY_AT = new THREE.Vector3(), FLY_Q = new THREE.Quaternion(), FLY_E = new THREE.Euler(), FLY_M = new THREE.Matrix4()

/** a bundle of rods standing in a tube, each a little splayed: only outward (+z, away from the table's face) and to the sides, never back over
 * the table's top (they ran into what's on it: the owner's red box); `seed` turns one bundle from the other */
function bundle(n: number, seed: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.399 + seed, r = 0.008 + 0.034 * Math.sqrt(i / n)
    const out = 0.03 + 0.1 * ((Math.sin(a) + 1) / 2)
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(out, 0, Math.cos(a) * 0.09))
    return new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, 0.11 + (i % 3) * 0.004, Math.sin(a) * r * 0.8 + 0.006), tilt, S1)
  })
}

/** one holder: its tube, lip, node, hoops, plate and screws, and its rods (as many as SKEWERS says) */
function Holder({ kind, rods }: { kind: 'clean' | 'used'; rods: React.RefObject<THREE.InstancedMesh | null> }) {
  return (
    <>
      <mesh geometry={CUP} material={SKIN_MAT[kind]} position={[0, CUP_H / 2, 0]} />
      <mesh geometry={CUP_IN} material={INSIDE} position={[0, CUP_H / 2 + 0.002, 0]} />
      <mesh geometry={CUP_FOOT} material={RIM_MAT[kind]} position={[0, 0.005, 0]} />
      <mesh geometry={LIP} material={RIM_MAT[kind]} position={[0, CUP_H, 0]} rotation-x={Math.PI / 2} />
      <mesh geometry={HOOP_LO} material={HOOP_MAT} position={[0, 0.025, 0]} />
      <mesh geometry={HOOP_HI} material={HOOP_MAT} position={[0, CUP_H - 0.025, 0]} />
      {/* (screwed to the table's face behind it) */}
      <mesh geometry={BACKPLATE} material={HOOP_MAT} position={[0, CUP_H * 0.6, -CUP_R - 0.004]} />
      {[0.025, -0.025].map((y) => <mesh key={y} geometry={SCREW} material={SCREW_MAT} position={[0, CUP_H * 0.6 + y, -CUP_R + 0.001]} rotation-x={Math.PI / 2} />)}
      <instancedMesh ref={rods} args={[ROD, kind === 'clean' ? STEEL : SOOTY, kind === 'clean' ? SHOWN_CLEAN : SHOWN_DIRTY]} frustumCulled={false} />
    </>
  )
}

/**
 * The skewers' places (the owner's: fifty iron skewers, game/skewers): two copper-bound little wooden buckets hung on the cook table's front either
 * side of the notch, the clean ones in the one on the left by the cutting board (where they're pushed through what's prepared), the used ones in
 * the one on the right by the plating (pulled out there, dropped straight in), each as many as there are (SKEWERS), named as the pointer's over
 * them with their count. While researching (`byHand`) the clean ones can be taken one at a time and pushed through what's on the board by hand
 * (Roasting: its group's `decor`, 'skewer')
 */
export const SkewerStore = memo(function SkewerStore({ holderAt, usedAt, yaw, lang, byHand }: { holderAt: [number, number, number]
  usedAt: [number, number, number]; yaw: number; lang: Lang; byHand: boolean }) {
  const clean = useRef<THREE.InstancedMesh>(null)
  const dirty = useRef<THREE.InstancedMesh>(null)
  const seen = useRef({ c: -1, d: -1 })
  const standing = useMemo(() => bundle(SHOWN_CLEAN, 0), [])
  const used = useMemo(() => bundle(SHOWN_DIRTY, 1.3), [])
  // (the skewers pulled out of the food, each flown in an arc from where it was into the used bucket, turning point down as it goes)
  const flying = useRef<THREE.InstancedMesh>(null)
  const usedGroup = useRef<THREE.Group>(null)
  useFrame(() => {
    const fm = flying.current, ug = usedGroup.current
    if (!fm || !ug) return
    const now = performance.now()
    while (PULLED.length && now - PULLED[0].at > FLY_MS) PULLED.shift()
    let n = 0
    ug.updateWorldMatrix(true, false)
    for (const f of PULLED) {
      const k = Math.min(1, (now - f.at) / FLY_MS), e = k * k * (3 - 2 * k)
      ug.worldToLocal(FLY_FROM.copy(f.from))
      FLY_AT.lerpVectors(FLY_FROM, FLY_INTO, e)
      FLY_AT.y += Math.sin(Math.PI * k) * 0.12
      FLY_Q.setFromEuler(FLY_E.set(0, 0, (1 - e) * Math.PI / 2))
      fm.setMatrixAt(n++, FLY_M.compose(FLY_AT, FLY_Q, S1))
    }
    fm.count = n
    fm.instanceMatrix.needsUpdate = true
  })
  useFrame(() => {
    const s = SKEWERS.s
    const c = Math.min(SHOWN_CLEAN, s.clean), d = Math.min(SHOWN_DIRTY, s.dirty)
    if (c === seen.current.c && d === seen.current.d) return
    seen.current = { c, d }
    const cm = clean.current, dm = dirty.current
    if (cm) { for (let i = 0; i < c; i++) cm.setMatrixAt(i, standing[i]); cm.count = c; cm.instanceMatrix.needsUpdate = true }
    if (dm) { for (let i = 0; i < d; i++) dm.setMatrixAt(i, used[i]); dm.count = d; dm.instanceMatrix.needsUpdate = true }
  })
  const tip = (which: 'clean' | 'dirty') => ({
    onPointerOver: (e: { stopPropagation: () => void; eventObject?: THREE.Object3D; camera?: THREE.Camera; nativeEvent?: Event }) => {
      e.stopPropagation()
      aimTip(e)
      const s = SKEWERS.s
      setTip(which === 'clean'
        ? { title: tl(lang, '鐵串木桶', '鉄串の木桶', 'Skewer bucket'), hint: tl(lang, `乾淨鐵串 ${s.clean}/${SKEWER_POOL}`, `きれいな鉄串 ${s.clean}/${SKEWER_POOL}`, `Clean skewers ${s.clean}/${SKEWER_POOL}`)
          + (byHand ? tl(lang, '｜拖一支到砧板上的食材穿串', '｜まな板の食材へドラッグして串を打つ', '｜Drag one onto what’s on the board to skewer it') : '') }
        : { title: tl(lang, '回收鐵串木桶', '使用済み鉄串の木桶', 'Used skewer bucket'), hint: tl(lang, `待洗鐵串 ${s.dirty}`, `洗い待ち ${s.dirty} 本`, `${s.dirty} waiting to be washed`) })
    },
    onPointerOut: () => setTip(null),
  })
  return (
    <>
      <group position={holderAt} rotation-y={yaw} name="skewer-holder" userData={{ decor: 'skewer' }} {...tip('clean')}>
        <Holder kind="clean" rods={clean} />
      </group>
      <group ref={usedGroup} position={usedAt} rotation-y={yaw} name="skewer-tray" {...tip('dirty')}>
        <Holder kind="used" rods={dirty} />
        <instancedMesh ref={flying} args={[ROD, STEEL, 8]} count={0} frustumCulled={false} raycast={() => null} />
      </group>
    </>
  )
})
