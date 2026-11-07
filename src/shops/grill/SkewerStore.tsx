import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { aimTip, setTip } from '@/scene/hoverTip'
import { SKEWER_POOL } from '@/game/skewers'
import { tl, type Lang } from '@/data/i18n'
import { SKEWERS } from './bar'

/** an iron skewer: a thin steel rod, its ring at the end */
const ROD = new THREE.CylinderGeometry(0.0045, 0.0045, 0.36, 5, 1)
const STEEL = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.85, roughness: 0.35 })
const SOOTY = new THREE.MeshStandardMaterial({ color: '#8d8a85', metalness: 0.7, roughness: 0.55 })
const CUP = new THREE.CylinderGeometry(0.06, 0.055, 0.16, 16, 1, true)
const CUP_FOOT = new THREE.CylinderGeometry(0.055, 0.055, 0.008, 16)
const CUP_MAT = new THREE.MeshStandardMaterial({ color: '#7a5634', roughness: 0.8, side: THREE.DoubleSide })
const TRAY = new THREE.BoxGeometry(0.4, 0.016, 0.14)
const TRAY_MAT = new THREE.MeshStandardMaterial({ color: '#3b3d42', metalness: 0.6, roughness: 0.45 })
/** at most this many drawn: the holder's a bundle, the tray a heap */
const SHOWN_CLEAN = 30
const SHOWN_DIRTY = 24
const S1 = new THREE.Vector3(1, 1, 1)

/**
 * The skewers' places (the owner's: fifty iron skewers, game/skewers): the clean ones standing in a wooden holder by the board, the used ones
 * lying in a steel tray by the plating place, each as many as there are (SKEWERS), named as the pointer's over them with their count
 */
export const SkewerStore = memo(function SkewerStore({ holderAt, trayAt, trayYaw, lang }: { holderAt: [number, number, number]; trayAt: [number, number, number]
  trayYaw: number; lang: Lang }) {
  const clean = useRef<THREE.InstancedMesh>(null)
  const dirty = useRef<THREE.InstancedMesh>(null)
  const seen = useRef({ c: -1, d: -1 })
  // (each rod's place, worked out once: standing in a loose bundle, a little splayed; lying side by side and crossed in the tray)
  const standing = useMemo(() => Array.from({ length: SHOWN_CLEAN }, (_, i) => {
    const a = i * 2.399, r = 0.012 + 0.04 * Math.sqrt(i / SHOWN_CLEAN)
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12))
    return new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, 0.17 + (i % 3) * 0.01, Math.sin(a) * r), tilt, S1)
  }), [])
  const lying = useMemo(() => Array.from({ length: SHOWN_DIRTY }, (_, i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i % 2 ? 0.08 : -0.06) * (1 + (i % 5) * 0.2), Math.PI / 2))
    return new THREE.Matrix4().compose(new THREE.Vector3(0, 0.014 + Math.floor(i / 8) * 0.009, -0.05 + (i % 8) * 0.0135), q, S1)
  }), [])
  useFrame(() => {
    const s = SKEWERS.s
    const c = Math.min(SHOWN_CLEAN, s.clean), d = Math.min(SHOWN_DIRTY, s.dirty)
    if (c === seen.current.c && d === seen.current.d) return
    seen.current = { c, d }
    const cm = clean.current, dm = dirty.current
    if (cm) { for (let i = 0; i < c; i++) cm.setMatrixAt(i, standing[i]); cm.count = c; cm.instanceMatrix.needsUpdate = true }
    if (dm) { for (let i = 0; i < d; i++) dm.setMatrixAt(i, lying[i]); dm.count = d; dm.instanceMatrix.needsUpdate = true }
  })
  const tip = (which: 'clean' | 'dirty') => ({
    onPointerOver: (e: { stopPropagation: () => void; eventObject?: THREE.Object3D; camera?: THREE.Camera; nativeEvent?: Event }) => {
      e.stopPropagation()
      aimTip(e)
      const s = SKEWERS.s
      setTip(which === 'clean'
        ? { title: tl(lang, '鐵串筒', '鉄串立て', 'Skewer holder'), hint: tl(lang, `乾淨鐵串 ${s.clean}/${SKEWER_POOL}`, `きれいな鉄串 ${s.clean}/${SKEWER_POOL}`, `Clean skewers ${s.clean}/${SKEWER_POOL}`) }
        : { title: tl(lang, '髒鐵串盤', '使用済み鉄串', 'Used skewers'), hint: tl(lang, `待洗鐵串 ${s.dirty}`, `洗い待ち ${s.dirty} 本`, `${s.dirty} waiting to be washed`) })
    },
    onPointerOut: () => setTip(null),
  })
  return (
    <>
      <group position={holderAt} name="skewer-holder" {...tip('clean')}>
        <mesh geometry={CUP} material={CUP_MAT} position={[0, 0.08, 0]} />
        <mesh geometry={CUP_FOOT} material={CUP_MAT} position={[0, 0.004, 0]} />
        <instancedMesh ref={clean} args={[ROD, STEEL, SHOWN_CLEAN]} frustumCulled={false} />
      </group>
      <group position={trayAt} rotation-y={trayYaw} name="skewer-tray" {...tip('dirty')}>
        <mesh geometry={TRAY} material={TRAY_MAT} position={[0, 0.008, 0]} />
        <instancedMesh ref={dirty} args={[ROD, SOOTY, SHOWN_DIRTY]} frustumCulled={false} />
      </group>
    </>
  )
})
