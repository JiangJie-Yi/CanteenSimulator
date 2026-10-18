import * as THREE from 'three'

/** a soft round shadow, black in the middle and fading out: one texture for all */
const BLOB = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.5)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()
const GEO = new THREE.PlaneGeometry(1, 1)
const MAT = new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })

/**
 * A cheap round shadow on the floor under someone (their feet at the origin): a single see-through quad, no
 * shadow map. `r` is its radius; it is black but see-through, so the feet read as standing on the floor.
 */
export function BlobShadow({ r = 0.2 }: { r?: number }) {
  return <mesh geometry={GEO} material={MAT} rotation-x={-Math.PI / 2} position-y={0.008} scale={[r * 2, r * 2, 1]} renderOrder={-1} />
}
