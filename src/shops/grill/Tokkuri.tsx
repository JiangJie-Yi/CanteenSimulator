import { memo } from 'react'
import * as THREE from 'three'
import { warmLater } from '@/scene/Prewarm'

/**
 * A tokkuri of sake (item 89): white porcelain, round in the body, its neck drawn in and its lip turned out, an indigo band round its
 * shoulder; 16 round, its foot and lip open rings (no fan to a point). Made once, its material compiled as the page loads (it's only set out
 * while the shop's open, or while the stand pours into it). Set at a customer's place (GuestBar3D) and under the stand's bottle as it's
 * poured (Decor)
 */
const TOKKURI_GEO = new THREE.LatheGeometry([[0.021, 0], [0.026, 0.006], [0.033, 0.03], [0.034, 0.048], [0.028, 0.072], [0.016, 0.098],
  [0.0105, 0.112], [0.0105, 0.124], [0.014, 0.131], [0.0105, 0.13]].map(([r, y]) => new THREE.Vector2(r, y)), 16)
const TOKKURI_BAND = new THREE.CylinderGeometry(0.0292, 0.0322, 0.012, 16, 1, true).translate(0, 0.066, 0)
const TOKKURI_MAT = new THREE.MeshToonMaterial({ color: '#f3efe6' })
const TOKKURI_BAND_MAT = new THREE.MeshToonMaterial({ color: '#2b3f73' })
warmLater(new THREE.Mesh(TOKKURI_GEO, TOKKURI_MAT))
warmLater(new THREE.Mesh(TOKKURI_BAND, TOKKURI_BAND_MAT))
/** how tall it stands (its lip) */
export const TOKKURI_H = 0.131
export const Tokkuri = memo(function Tokkuri() {
  return (
    <group>
      <mesh geometry={TOKKURI_GEO} material={TOKKURI_MAT} castShadow />
      <mesh geometry={TOKKURI_BAND} material={TOKKURI_BAND_MAT} />
    </group>
  )
})
