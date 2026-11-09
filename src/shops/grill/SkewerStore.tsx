import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { aimTip, setTip } from '@/scene/hoverTip'
import { SKEWER_POOL } from '@/game/skewers'
import { tl, type Lang } from '@/data/i18n'
import { SKEWERS } from './bar'

/** an iron skewer: a thin steel rod, its ring at the end */
/** (as much of one as shows standing in a holder: they stand down in it, only their upper part out of it) */
const ROD = new THREE.CylinderGeometry(0.0045, 0.0045, 0.2, 5, 1)
const STEEL = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.85, roughness: 0.35 })
const SOOTY = new THREE.MeshStandardMaterial({ color: '#7d7a75', metalness: 0.7, roughness: 0.6 })

/** a bamboo tube's skin, drawn once a kind (`used`: the used skewers' tube, paler and sooted where the hot ones went in): smoked bamboo, its
 * fibres running down it in fine light and dark streaks, a node's ring across it, darker toward its foot */
function bambooSkin(used: boolean) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const top = used ? '#8a6a44' : '#5a3a20', foot = used ? '#5e4630' : '#2e1c10'
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, top); grad.addColorStop(0.7, used ? '#76583a' : '#46301c'); grad.addColorStop(1, foot)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 256)
  // (the fibres: long fine streaks, some paler, some darker, wavering a little)
  let seed = used ? 7 : 3
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let k = 0; k < 90; k++) {
    const x = rnd() * 128, w = 0.4 + rnd() * 1.2
    g.strokeStyle = rnd() < 0.5 ? `rgba(255,226,170,${0.06 + rnd() * 0.1})` : `rgba(20,10,4,${0.12 + rnd() * 0.18})`
    g.lineWidth = w
    g.beginPath()
    g.moveTo(x, 0)
    for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y / 40 + k) * 1.2, y)
    g.stroke()
  }
  // (the node: a raised ring, its upper edge catching the light, its lower in shade)
  const ny = 120
  g.fillStyle = used ? 'rgba(60,40,24,0.55)' : 'rgba(18,10,4,0.6)'
  g.fillRect(0, ny, 128, 6)
  g.fillStyle = 'rgba(255,230,180,0.28)'
  g.fillRect(0, ny - 2, 128, 2)
  // (used: soot down from the rim, where the hot rods are dropped in)
  if (used) {
    const soot = g.createLinearGradient(0, 0, 0, 90)
    soot.addColorStop(0, 'rgba(24,18,14,0.55)'); soot.addColorStop(1, 'rgba(24,18,14,0)')
    g.fillStyle = soot
    g.fillRect(0, 0, 128, 90)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}
const SKIN = typeof document === 'undefined' ? { clean: null, used: null } : { clean: bambooSkin(false), used: bambooSkin(true) }

/** the holders (the owner's: a thick bamboo tube bound in copper, about half as tall as a skewer is long, hung on the cook table's front either
 * side of the notch): open at its top with a lip round its rim and its dark inside showing, a node half way up, two copper hoops, a copper plate
 * screwed to the table's face behind it */
// (short: the space on the table's face between the top's edge and the bucket and bin on the floor below is half a metre (the owner's: no
// clipping; the taller one stood down into the bin))
const CUP_R = 0.055, CUP_H = 0.13
const CUP = new THREE.CylinderGeometry(CUP_R, CUP_R * 0.95, CUP_H, 20, 1, true)
const CUP_IN = new THREE.CylinderGeometry(CUP_R * 0.86, CUP_R * 0.82, CUP_H * 0.98, 20, 1, true)
const CUP_FOOT = new THREE.CylinderGeometry(CUP_R * 0.95, CUP_R * 0.95, 0.01, 20)
const LIP = new THREE.TorusGeometry(CUP_R * 0.93, CUP_R * 0.09, 6, 20)
const NODE = new THREE.TorusGeometry(CUP_R * 1.0, CUP_R * 0.05, 5, 20)
const HOOP = new THREE.CylinderGeometry(CUP_R * 1.05, CUP_R * 1.05, 0.012, 20, 1, true)
const BACKPLATE = new THREE.BoxGeometry(0.07, 0.1, 0.008)
const SCREW = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8)
const INSIDE = new THREE.MeshStandardMaterial({ color: '#1c120a', roughness: 0.9, side: THREE.BackSide })
const HOOP_MAT = new THREE.MeshStandardMaterial({ color: '#b87333', metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide })
const SCREW_MAT = new THREE.MeshStandardMaterial({ color: '#6b4a24', metalness: 0.7, roughness: 0.4 })
const SKIN_MAT = { clean: new THREE.MeshStandardMaterial({ map: SKIN.clean, roughness: 0.6 }), used: new THREE.MeshStandardMaterial({ map: SKIN.used, roughness: 0.7 }) }
const RIM_MAT = { clean: new THREE.MeshStandardMaterial({ color: '#6a4628', roughness: 0.55 }), used: new THREE.MeshStandardMaterial({ color: '#8d6c46', roughness: 0.65 }) }
/** at most this many drawn: a bundle in each */
const SHOWN_CLEAN = 30
const SHOWN_DIRTY = 30
const S1 = new THREE.Vector3(1, 1, 1)

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
      <mesh geometry={NODE} material={RIM_MAT[kind]} position={[0, CUP_H * (1 - 120 / 256), 0]} rotation-x={Math.PI / 2} />
      {[0.025, CUP_H - 0.025].map((y) => <mesh key={y} geometry={HOOP} material={HOOP_MAT} position={[0, y, 0]} />)}
      {/* (screwed to the table's face behind it) */}
      <mesh geometry={BACKPLATE} material={HOOP_MAT} position={[0, CUP_H * 0.6, -CUP_R - 0.004]} />
      {[0.025, -0.025].map((y) => <mesh key={y} geometry={SCREW} material={SCREW_MAT} position={[0, CUP_H * 0.6 + y, -CUP_R + 0.001]} rotation-x={Math.PI / 2} />)}
      <instancedMesh ref={rods} args={[ROD, kind === 'clean' ? STEEL : SOOTY, kind === 'clean' ? SHOWN_CLEAN : SHOWN_DIRTY]} frustumCulled={false} />
    </>
  )
}

/**
 * The skewers' places (the owner's: fifty iron skewers, game/skewers): two copper-bound bamboo holders hung on the cook table's front either
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
        ? { title: tl(lang, '鐵串筒', '鉄串立て', 'Skewer holder'), hint: tl(lang, `乾淨鐵串 ${s.clean}/${SKEWER_POOL}`, `きれいな鉄串 ${s.clean}/${SKEWER_POOL}`, `Clean skewers ${s.clean}/${SKEWER_POOL}`)
          + (byHand ? tl(lang, '｜拖一支到砧板上的食材穿串', '｜まな板の食材へドラッグして串を打つ', '｜Drag one onto what’s on the board to skewer it') : '') }
        : { title: tl(lang, '回收鐵串筒', '使用済み鉄串立て', 'Used skewers'), hint: tl(lang, `待洗鐵串 ${s.dirty}`, `洗い待ち ${s.dirty} 本`, `${s.dirty} waiting to be washed`) })
    },
    onPointerOut: () => setTip(null),
  })
  return (
    <>
      <group position={holderAt} rotation-y={yaw} name="skewer-holder" userData={{ decor: 'skewer' }} {...tip('clean')}>
        <Holder kind="clean" rods={clean} />
      </group>
      <group position={usedAt} rotation-y={yaw} name="skewer-tray" {...tip('dirty')}>
        <Holder kind="used" rods={dirty} />
      </group>
    </>
  )
})
