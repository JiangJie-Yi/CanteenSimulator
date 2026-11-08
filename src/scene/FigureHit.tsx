import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { whoOver } from './hoverTip'
import { glowOff, glowOn } from './hoverGlow'

const BOX = new THREE.BoxGeometry(1, 1, 1)
const INV = new THREE.Matrix4()
const M = new THREE.Matrix4()
const B = new THREE.Box3()
const ALL = new THREE.Box3()

/**
 * The pointer's way onto a person (the owner's: anyone in the shop named as the pointer's over them): an unseen box round the figure it's
 * put beside (its parent's meshes, measured a few times as they load), so the pointer never has to test the figure's skinned mesh itself
 * (every vertex through its bones: dear); its tag their name in the speakers' yellow. `onPointerDown`: what grabbing them does (customers
 * only: the owner and the staff can't be dragged, they keep to their work).
 */
/** someone being carried just now (GuestBar3D's drag): their glow and the closed hand kept on while the pointer slips off them */
export const GRABBING = { on: false }
export function FigureHit({ title, hint, onPointerDown, grabbable }: { title: () => string; hint?: () => string
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  /** whether they can be picked up just now: the open hand over them, and they glow (the owner's), as the things in the room that can */
  grabbable?: () => boolean }) {
  const box = useRef<THREE.Mesh>(null)
  const fits = useRef(0)
  const over = useMemo(() => {
    const w = whoOver(title, hint)
    if (!grabbable) return w
    return {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        w.onPointerOver(e)
        if (!grabbable()) return
        const el = e.nativeEvent?.target as HTMLElement | null
        if (el?.style) el.style.cursor = 'grab'
        glowOn(e.eventObject.parent)
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        w.onPointerOut(e)
        if (GRABBING.on) return
        const el = e.nativeEvent?.target as HTMLElement | null
        if (el?.style && el.style.cursor === 'grab') el.style.cursor = ''
        glowOff(e.eventObject.parent)
      },
    }
  }, [title, hint, grabbable])
  useFrame(() => {
    const me = box.current, p = me?.parent
    if (!me || !p || fits.current > 3) return
    // (its parent's meshes in the parent's own frame, the box itself and the ink apart)
    p.updateWorldMatrix(true, true)
    INV.copy(p.matrixWorld).invert()
    ALL.makeEmpty()
    p.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m === me || !m.visible || (m.material as THREE.Material)?.side === THREE.BackSide) return
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      ALL.union(B.copy(m.geometry.boundingBox!).applyMatrix4(M.multiplyMatrices(INV, m.matrixWorld)))
    })
    if (ALL.isEmpty()) return
    fits.current++
    // (a little narrower than the figure: its neighbour at the bar is theirs to point at)
    ALL.getCenter(me.position)
    ALL.getSize(me.scale)
    me.scale.x *= 0.8
    me.scale.z *= 0.8
  })
  return <mesh ref={box} geometry={BOX} visible={false} {...over} onPointerDown={onPointerDown} />
}
