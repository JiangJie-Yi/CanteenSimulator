// Dev only: which pieces of the scene draw the most triangles. In the console, __triTop() (or __triTop(30)) lists the 15 heaviest, each
// the piece it belongs to (the nearest Movable's id, else its nearest named group), its triangles (the model's own, and its ink outline's
// apart), how many meshes and draws; __triTop(15, 'mesh') lists single meshes instead. Only what's drawn counts: hidden ones, ones under a
// hidden parent and the parts a batch has merged away are left out; an instanced mesh counts each copy; a draw range counts what it draws.
import * as THREE from 'three'

type Row = { piece: string; tris: number; ink: number; meshes: number; instances: number }

const shown = (o: THREE.Object3D) => {
  for (let a: THREE.Object3D | null = o; a; a = a.parent) if (!a.visible) return false
  return true
}
const trisOf = (m: THREE.Mesh) => {
  const g = m.geometry
  if (!g) return 0
  const n = g.index ? g.index.count : (g.attributes.position?.count ?? 0)
  const drawn = Math.min(n - g.drawRange.start, g.drawRange.count)
  const copies = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1
  return Math.floor(Math.max(0, drawn) / 3) * copies
}
const pieceOf = (o: THREE.Object3D) => {
  for (let a: THREE.Object3D | null = o; a; a = a.parent) if (a.userData?.editId) return String(a.userData.editId)
  for (let a: THREE.Object3D | null = o.parent; a; a = a.parent) if (a.name && a.type !== 'Scene') return a.name
  return o.name || '(unnamed)'
}
const isInk = (m: THREE.Mesh) => !!m.userData.inked && (m.material as THREE.Material)?.side === THREE.BackSide

export function triTop(scene: THREE.Scene, n = 15, by: 'piece' | 'mesh' = 'piece') {
  const rows = new Map<string, Row>()
  let total = 0, inkTotal = 0, draws = 0
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || m.userData.wireDepth || m.userData.editHandle || !shown(m)) return
    const t = trisOf(m)
    if (!t) return
    const ink = isInk(m)
    const key = by === 'mesh' ? `${pieceOf(m)} › ${m.name || m.geometry.type}${ink ? ' (ink)' : ''}` : pieceOf(m)
    const r = rows.get(key) ?? { piece: key, tris: 0, ink: 0, meshes: 0, instances: 0 }
    if (ink) { r.ink += t; inkTotal += t } else r.tris += t
    r.meshes += 1
    r.instances += (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1
    rows.set(key, r)
    total += t
    draws += Array.isArray(m.material) ? m.material.length : 1
  })
  const top = [...rows.values()].sort((a, b) => b.tris + b.ink - (a.tris + a.ink)).slice(0, n)
  console.table(top.map((r) => ({ piece: r.piece, triangles: r.tris + r.ink, model: r.tris, ink: r.ink, share: ((100 * (r.tris + r.ink)) / total).toFixed(1) + '%', meshes: r.meshes, instances: r.instances })))
  console.log(`the scene: ${total.toLocaleString()} triangles drawn (${inkTotal.toLocaleString()} of them ink outlines) in ${draws} draws, before shadows`)
  return { total, ink: inkTotal, draws, top }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as unknown as { __scene?: THREE.Scene; __triTop?: (n?: number, by?: 'piece' | 'mesh') => unknown }
  w.__triTop = (n = 15, by = 'piece') => (w.__scene ? triTop(w.__scene, n, by) : 'no scene yet')
}
