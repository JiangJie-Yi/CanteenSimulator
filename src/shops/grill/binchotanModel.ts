// The binchotan model from Blender (blender/binchotan.py): six sticks and six broken pieces, sharing one material (the charcoal's face, its
// relief, and the glow map of the crazing a burning stick shows). The crate's sticks, the one in the hand, those on the fire and the pieces they
// break into all come from it, so a stick looks the same before it's thrown and after, until the fire lights its cracks.

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const URL = import.meta.env.BASE_URL + 'models/binchotan.glb'
useGLTF.preload(URL)

/** a stick as modelled: its length and radius (each one used is scaled from these) */
const MODEL_LEN = 0.3, MODEL_R = 0.032

export type BinchotanKit = {
  /** a stick `len` long and about `r` round, the `k`th of the six (geometry shared between calls with the same sizes) */
  stick: (len: number, r: number, k: number) => THREE.BufferGeometry
  /** the `k`th broken piece, drawn `len` long */
  chunk: (k: number, len?: number) => THREE.BufferGeometry
  /** the charcoal's face, its relief, and the cracks' glow */
  face: THREE.Texture | null
  normal: THREE.Texture | null
  glow: THREE.Texture | null
}

let kit: BinchotanKit | null = null
function kitOf(scene: THREE.Group): BinchotanKit {
  if (kit) return kit
  const sticks: THREE.BufferGeometry[] = [], chunks: { g: THREE.BufferGeometry; len: number }[] = []
  let src: THREE.MeshStandardMaterial | null = null
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    src ??= m.material as THREE.MeshStandardMaterial
    const g = m.geometry
    g.computeBoundingBox()
    if (m.name.startsWith('BinStick')) sticks[Number(m.name.slice(8))] = g
    else if (m.name.startsWith('BinChunk')) chunks[Number(m.name.slice(8))] = { g, len: g.boundingBox!.max.y - g.boundingBox!.min.y }
  })
  const cache = new Map<string, THREE.BufferGeometry>()
  const scaled = (key: string, g: THREE.BufferGeometry, sx: number, sy: number) => {
    let out = cache.get(key)
    if (!out) { out = g.clone().scale(sx, sy, sx); out.computeBoundingSphere(); cache.set(key, out) }
    return out
  }
  const s = src as THREE.MeshStandardMaterial | null
  kit = {
    stick: (len, r, k) => {
      // (sizes in steps, so the many sticks share a few shapes)
      const L = Math.round(len / 0.02) * 0.02, R = Math.round(r / 0.002) * 0.002, i = ((k % 6) + 6) % 6
      return scaled(`s${i}|${L}|${R}`, sticks[i], R / MODEL_R, L / MODEL_LEN)
    },
    chunk: (k, len) => {
      const c = chunks[((k % 6) + 6) % 6]
      const L = len === undefined ? c.len : Math.round(len / 0.01) * 0.01
      return scaled(`c${k % 6}|${L}`, c.g, 1, L / c.len)
    },
    face: s?.map ?? null,
    normal: s?.normalMap ?? null,
    glow: s?.emissiveMap ?? null,
  }
  return kit
}

export function useBinchotan(): BinchotanKit {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  return useMemo(() => kitOf(gltf.scene), [gltf])
}

/** a material of the charcoal for one stick or piece of its own (its glow and ash set by the fire): the face, its relief, a dull silver sheen;
 * dark (no glow) until it's lit */
export function charcoalMaterial(k: BinchotanKit) {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff', map: k.face, normalMap: k.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.5, metalness: 0.3,
    emissiveMap: k.glow, emissive: new THREE.Color('#000000'), emissiveIntensity: 0,
  })
}
