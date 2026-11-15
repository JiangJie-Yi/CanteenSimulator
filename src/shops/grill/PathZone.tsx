import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditSel } from './edit'
import { Movable } from './Movable'

/**
 * A keep-clear patch of the kitchen's floor (item 168, the owner's: the paths' map "to see, edit and manage"): a piece of edit mode's own, a
 * flat square the staff's ways go round as they go round what stands there (GuestBar3D's kitchenBlocks counts it), moved and sized with the
 * edit mode's arrows and boxes, added from the paths' map's ＋ and taken away with Delete. Seen only with the map shown (a red patch, its edge
 * brighter); in the game, nothing, but still in the way. Its own frame: the bar's units, its middle at its origin on the floor, ZONE across.
 */
export const ZONE = 0.5
const GEO = new THREE.BoxGeometry(ZONE, 0.02, ZONE).translate(0, 0.01, 0)
const EDGE_GEO = new THREE.EdgesGeometry(GEO)
const FILL = new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0.32, depthWrite: false })
const EDGE = new THREE.LineBasicMaterial({ color: '#ff5c7a', transparent: true, opacity: 0.95 })

export function PathZone() {
  const on = useEditSel((s) => s.on), paths = useEditSel((s) => s.paths)
  const parts = useMemo(() => {
    const fill = new THREE.Mesh(GEO, FILL)
    const edge = new THREE.LineSegments(EDGE_GEO, EDGE)
    edge.raycast = () => {}
    fill.renderOrder = edge.renderOrder = 1000
    return { fill, edge }
  }, [])
  // (shown with the map; else not drawn, nor picked, but measured still as what's in the way)
  useFrame(() => { const v = on && paths; parts.fill.visible = v; parts.edge.visible = v })
  return (
    <group>
      <primitive object={parts.fill} />
      <primitive object={parts.edge} />
    </group>
  )
}

/** the keep-clear patches put down in edit mode, each a piece of its own: listened to here, not in GuestBar3D (it'd draw it all again at
 * every change of edit mode's) */
export function PathZones({ home }: { home: THREE.Vector3 }) {
  const zones = useEditSel((s) => s.zones)
  return (
    <>
      {zones.map((id) => (
        <Movable key={id} id={id} label={`禁區 ${id.split('-')[1]}`} ground={0}>
          <group position={home.toArray()}><PathZone /></group>
        </Movable>
      ))}
    </>
  )
}
