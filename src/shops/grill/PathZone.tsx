import { memo, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditSel } from './edit'
import { Movable } from './Movable'
import { whoColor } from './PathMap'

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
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const PathZones = memo(PathZonesImpl)
function PathZonesImpl({ home }: { home: THREE.Vector3 }) {
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

/** a waypoint's marker (item 189): a ring on the floor in the colour of the person whose way it's on, a dot at its middle, the disc between
 * faint (what's picked, the size of a step); drawn over what's on the floor, seen only with the map. Rings, not fans from a middle point */
const VIA_DISC = new THREE.RingGeometry(0.015, 0.1, 24, 1).rotateX(-Math.PI / 2).translate(0, 0.03, 0)
const VIA_RING = new THREE.RingGeometry(0.075, 0.1, 24, 1).rotateX(-Math.PI / 2).translate(0, 0.031, 0)
const VIA_DOT = new THREE.RingGeometry(0.008, 0.03, 12, 1).rotateX(-Math.PI / 2).translate(0, 0.031, 0)
function PathVia({ who }: { who: string }) {
  const on = useEditSel((s) => s.on), paths = useEditSel((s) => s.paths)
  const parts = useMemo(() => {
    const col = whoColor(who)
    return ([[VIA_DISC, 0.3], [VIA_RING, 0.95], [VIA_DOT, 0.95]] as const).map(([g, opacity]) => {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide }))
      m.renderOrder = 1002
      return m
    })
  }, [who])
  useEffect(() => () => { for (const m of parts) (m.material as THREE.Material).dispose() }, [parts])
  useFrame(() => { const v = on && paths; for (const m of parts) m.visible = v })
  return <group>{parts.map((m, i) => <primitive key={i} object={m} />)}</group>
}

/** the waypoints set by hand on the staff's usual ways (item 189), each a piece of its own, moved with edit mode's arrows: the way goes through
 * them (GuestBar3D's kitchenRoute); added from the paths' list, taken away with Delete */
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const PathVias = memo(PathViasImpl)
function PathViasImpl({ home }: { home: THREE.Vector3 }) {
  const vias = useEditSel((s) => s.vias)
  return (
    <>
      {Object.entries(vias).flatMap(([key, ids]) => ids.map((id) => (
        <Movable key={id} id={id} label={`中途點 ${id.split('-')[1]}`} ground={0}>
          <group position={home.toArray()}><PathVia who={key.split('>')[0]} /></group>
        </Movable>
      )))}
    </>
  )
}
