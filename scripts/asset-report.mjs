// What the models weigh (item 367, step 1, the owner's perf brief): every public/models/*.glb by its size, with its meshes' triangles, its
// materials and its pictures (each one's size in pixels and bytes); and the pictures' sizes counted (how many at 4096, 2048, 1024...).
//   node scripts/asset-report.mjs [TOP=30] [JSON=out.json]
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('public/models')
const TOP = +(process.env.TOP ?? 30)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const rows = []
const sizes = new Map()
const MIMES = new Map()
/** an image's width and height from its PNG or JPEG header */
function dims(buf, mime) {
  if (!buf || buf.length < 30) return [0, 0]
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
  // (WebP: its VP8, VP8L or VP8X chunk)
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16)
    if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff]
    if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1] }
    if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
  }
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return [0, 0]
  // (JPEG: the first start-of-frame marker)
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) { i++; continue }
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]
    i += 2 + len
  }
  return [0, 0]
}
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.glb'))) {
  const file = path.join(DIR, f)
  const doc = await io.read(file)
  const root = doc.getRoot()
  let tris = 0
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices(), pos = p.getAttribute('POSITION')
    tris += idx ? idx.getCount() / 3 : (pos?.getCount() ?? 0) / 3
  }
  const tex = root.listTextures().map((t) => {
    const img = t.getImage()
    const [w, h] = dims(img ? Buffer.from(img) : null, t.getMimeType())
    const k = `${Math.max(w, h)}`
    sizes.set(k, (sizes.get(k) ?? 0) + 1)
    MIMES.set(t.getMimeType(), (MIMES.get(t.getMimeType()) ?? 0) + 1)
    return { name: t.getName() || t.getURI(), w, h, kb: Math.round((img?.byteLength ?? 0) / 1024), mime: t.getMimeType() }
  })
  rows.push({ file: f, kb: Math.round(fs.statSync(file).size / 1024), meshes: root.listMeshes().length, tris: Math.round(tris), materials: root.listMaterials().length, tex })
}
rows.sort((a, b) => b.kb - a.kb)
const total = rows.reduce((a, r) => a + r.kb, 0)
console.log(`models: ${rows.length}, ${(total / 1024).toFixed(1)} MB in all; pictures inside them: ${rows.reduce((a, r) => a + r.tex.length, 0)}`)
console.log('\n| model | KB | meshes | triangles | materials | pictures (largest side) |\n|---|---:|---:|---:|---:|---|')
for (const r of rows.slice(0, TOP)) {
  const big = r.tex.slice().sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4).map((t) => `${t.w}×${t.h} ${t.kb}KB`).join(', ')
  console.log(`| ${r.file} | ${r.kb.toLocaleString()} | ${r.meshes} | ${r.tris.toLocaleString()} | ${r.materials} | ${r.tex.length}${big ? `: ${big}` : ''} |`)
}
console.log('\npictures by their largest side:', JSON.stringify(Object.fromEntries([...sizes].sort((a, b) => +b[0] - +a[0]))))
console.log('\nmost triangles:', rows.slice().sort((a, b) => b.tris - a.tris).slice(0, 10).map((r) => `${r.file} ${r.tris.toLocaleString()}`).join(' · '))
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1))
