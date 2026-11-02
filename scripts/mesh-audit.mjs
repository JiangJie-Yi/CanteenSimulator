// Every model's meshes looked over for what makes a small thing heavy or badly shaded (the owner's: small decorations should be a clean
// low mesh, their detail in normal maps): each mesh's triangles, its size, and its worst pole (the most triangles sharing one vertex: a fan
// of them gathered into a middle shades in a dark blotch). Lists the meshes that are small (under SMALL across, in the model's units) and
// either have more than TRIS triangles or a pole of POLE or more, worst first.
//
//   node scripts/mesh-audit.mjs [files…]        (SMALL=0.25 TRIS=100 POLE=12; ALL=1 every mesh, not just the small)
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const SMALL = +(process.env.SMALL ?? 0.25), TRIS = +(process.env.TRIS ?? 100), POLE = +(process.env.POLE ?? 12)
let files = process.argv.slice(2)
if (!files.length) files = (await readdir('public/models')).filter((f) => f.endsWith('.glb') && !f.endsWith('-lite.glb')).map((f) => join('public/models', f))
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const rows = []
for (const file of files) {
  const doc = await io.read(file)
  // (each mesh by the node that holds it, its size as placed there: the nodes' scales taken in)
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    const sc = Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]))
    let tris = 0, pole = 0
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION')
      if (!pos) continue
      const n = pos.getCount()
      const v = [0, 0, 0]
      // (vertices at the same place counted as one: a seam's split copies are still one pole)
      const key = new Map()
      const id = new Int32Array(n)
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v)
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]) }
        const kq = v.map((x) => Math.round(x * 1e5)).join(',')
        if (!key.has(kq)) key.set(kq, key.size)
        id[i] = key.get(kq)
      }
      const idx = p.getIndices()
      const count = idx ? idx.getCount() : n
      const use = new Int32Array(key.size)
      for (let i = 0; i < count; i++) use[id[idx ? idx.getScalar(i) : i]]++
      tris += count / 3
      for (const u of use) pole = Math.max(pole, u)
    }
    const size = Math.max(...hi.map((h, k) => h - lo[k])) * sc
    rows.push({ file: basename(file), name: node.getName() || mesh.getName(), tris: Math.round(tris), size, pole })
  }
}
const bad = rows.filter((r) => process.env.ALL || (r.size < SMALL && (r.tris > TRIS || r.pole >= POLE)))
bad.sort((a, b) => (b.tris + b.pole * 20) - (a.tris + a.pole * 20))
for (const r of bad) console.log(`${r.file.padEnd(20)} ${r.name.padEnd(30)} ${String(r.tris).padStart(6)} tris  ${r.size.toFixed(3)} across  pole ${r.pole}`)
console.log(`${bad.length} of ${rows.length} meshes`)
