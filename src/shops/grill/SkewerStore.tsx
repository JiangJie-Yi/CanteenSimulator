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
/** the holder (the owner's: a thick, dark bamboo tube bound in copper, about half as tall as a skewer is long, hung on the cook table's front
 * right of the knives): open at its top, two copper hoops round it, a plate behind it on the table's face */
const CUP_H = 0.2
const CUP = new THREE.CylinderGeometry(0.055, 0.052, CUP_H, 16, 1, true)
const CUP_FOOT = new THREE.CylinderGeometry(0.052, 0.052, 0.01, 16)
const CUP_MAT = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7, side: THREE.DoubleSide })
const HOOP = new THREE.CylinderGeometry(0.058, 0.058, 0.012, 16, 1, true)
const HOOP_MAT = new THREE.MeshStandardMaterial({ color: '#b87333', metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide })
const BACKPLATE = new THREE.BoxGeometry(0.07, 0.14, 0.008)
/** the used ones' tray (the owner's: a long shallow steel channel let into the hearth's frame on the cook's side, where the hot skewers pulled
 * out are dropped to cool): a base and two low lips along it */
const TRAY_L = 0.26
const TRAY = new THREE.BoxGeometry(TRAY_L, 0.004, 0.05)
const TRAY_LIP = new THREE.BoxGeometry(TRAY_L, 0.012, 0.004)
const TRAY_MAT = new THREE.MeshStandardMaterial({ color: '#8f9399', metalness: 0.75, roughness: 0.4 })
/** the used skewers lie in it shorter than they stand (their full length would reach past the frame's corner into the fire) */
const LYING = 0.7
/** at most this many drawn: the holder's a bundle, the tray a heap */
const SHOWN_CLEAN = 30
const SHOWN_DIRTY = 24
const S1 = new THREE.Vector3(1, 1, 1)

/**
 * The skewers' places (the owner's: fifty iron skewers, game/skewers): the clean ones standing in a copper-bound bamboo holder on the cook
 * table's front, right of the knives; the used ones lying in a steel channel on the hearth's frame on the cook's side, each as many as there are (SKEWERS), named as the pointer's over them with their count
 */
export const SkewerStore = memo(function SkewerStore({ holderAt, holderYaw, trayAt, trayYaw, lang }: { holderAt: [number, number, number]
  holderYaw: number; trayAt: [number, number, number]; trayYaw: number; lang: Lang }) {
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
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i % 2 ? 0.03 : -0.025) * (1 + (i % 5) * 0.2), Math.PI / 2))
    return new THREE.Matrix4().compose(new THREE.Vector3(0, 0.008 + Math.floor(i / 6) * 0.006, -0.018 + (i % 6) * 0.0072), q, new THREE.Vector3(1, LYING, 1))
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
      <group position={holderAt} rotation-y={holderYaw} name="skewer-holder" {...tip('clean')}>
        <mesh geometry={CUP} material={CUP_MAT} position={[0, CUP_H / 2, 0]} />
        <mesh geometry={CUP_FOOT} material={CUP_MAT} position={[0, 0.005, 0]} />
        {[0.035, CUP_H - 0.03].map((y) => <mesh key={y} geometry={HOOP} material={HOOP_MAT} position={[0, y, 0]} />)}
        {/* (screwed to the table's face behind it) */}
        <mesh geometry={BACKPLATE} material={HOOP_MAT} position={[0, CUP_H * 0.6, -0.058]} />
        <instancedMesh ref={clean} args={[ROD, STEEL, SHOWN_CLEAN]} frustumCulled={false} />
      </group>
      <group position={trayAt} rotation-y={trayYaw} name="skewer-tray" {...tip('dirty')}>
        <mesh geometry={TRAY} material={TRAY_MAT} position={[0, 0.002, 0]} />
        {[-0.025, 0.025].map((z) => <mesh key={z} geometry={TRAY_LIP} material={TRAY_MAT} position={[0, 0.006, z]} />)}
        <instancedMesh ref={dirty} args={[ROD, SOOTY, SHOWN_DIRTY]} frustumCulled={false} />
      </group>
    </>
  )
})
