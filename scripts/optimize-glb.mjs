// Batch-optimises the game's models with glTF-Transform, into a folder of its own (public/models-opt by default): the game's own files are
// never written over, so each can be compared, in the game, before it's taken (copy it over its original by hand once it's been looked at
// close up: the owner's rule for every reduction).
//
//   node scripts/optimize-glb.mjs [files…] [--out <dir>] [--simplify <ratio>] [--error <e>] [--join] [--palette]
//
// What it does to every model, by default (nothing here changes how it looks, or any name the game finds things by):
//   dedup   the same accessor, mesh or texture stored twice kept once (not materials: the game finds them by name, and two alike under
//           different names (a pot's inside, its glaze) would become one)
//   prune   whatever nothing uses dropped, but not the empty nodes (the game's marks: WashSpoutTip, SinkBinTop, the cashier's seat…) nor
//           the vertex attributes no material of the file uses (the game paints its own pictures over UVs a material there doesn't use)
//   weld    vertices at the same place, with the same attributes, made one (and the geometry indexed)
// With --simplify <ratio> (0..1, e.g. 0.5), meshoptimizer reduces each mesh to about that share of its triangles, never moving its outline
// more than --error (0.005, a share of the mesh's size, by default). The owner's way with models is clean low-poly meshes with the detail
// baked into pictures, not decimated triangles (blender/optimize_glb.py and blender/*.py are where the models are made): use it to see what
// it would save, and look before taking any of it.
// With --join (static models only) meshes sharing a material are joined into one, and with --palette plain-coloured materials are packed
// into one palette texture: both rename and remove what the game looks things up by (node names like RegDrawer or FreezerLid, material
// names like BambooSkewer), and the game already merges what doesn't move by material as it loads (StaticBatch, mergeByMaterial), so
// they're off unless asked for, and a model they're used on must be checked in the game.
// A model with a skin is never joined or paletted: it's deduplicated, pruned and welded only, its skeleton untouched.
// Each model's size, meshes, primitives (draws), materials, textures, vertices and triangles are printed before and after.
import { readdir, mkdir, stat } from 'node:fs/promises'
import { basename, join as joinPath, resolve } from 'node:path'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, join, palette, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d }
const OUT = resolve(value('--out', 'public/models-opt'))
const SIMPLIFY = value('--simplify', null)
const ERROR = +value('--error', '0.005')
const taken = new Set(['--out', '--simplify', '--error'].flatMap((n) => { const i = args.indexOf(n); return i >= 0 ? [i, i + 1] : [] }))
let files = args.filter((a, i) => !a.startsWith('--') && !taken.has(i))
if (!files.length) files = (await readdir('public/models')).filter((f) => f.endsWith('.glb')).map((f) => joinPath('public/models', f))

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
await MeshoptSimplifier.ready

/** what a model holds: meshes, primitives (each a draw), materials, textures, vertices and triangles */
function tally(doc) {
  const root = doc.getRoot()
  let prims = 0, verts = 0, tris = 0
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      prims++
      const pos = p.getAttribute('POSITION')
      verts += pos ? pos.getCount() : 0
      const idx = p.getIndices()
      tris += Math.round((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3)
    }
  }
  return { meshes: root.listMeshes().length, prims, mats: root.listMaterials().length, tex: root.listTextures().length, verts, tris, skins: root.listSkins().length }
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

await mkdir(OUT, { recursive: true })
for (const file of files) {
  const doc = await io.read(file)
  const before = tally(doc)
  const steps = [dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
    prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }), weld()]
  if (SIMPLIFY !== null) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: +SIMPLIFY, error: ERROR }))
  // (a skinned model's meshes stay as they are: joining them, or flattening its nodes, would cut them loose of their skeleton)
  if (!before.skins) {
    if (flag('--join')) steps.push(flatten(), join())
    if (flag('--palette')) steps.push(palette())
  }
  await doc.transform(...steps)
  const after = tally(doc)
  const out = joinPath(OUT, basename(file))
  await io.write(out, doc)
  const [s0, s1] = [(await stat(file)).size, (await stat(out)).size]
  const row = (k) => `${before[k]}→${after[k]}`
  console.log(`${basename(file).padEnd(24)} ${kb(s0)}→${kb(s1)}  meshes ${row('meshes')}  draws ${row('prims')}  materials ${row('mats')}  textures ${row('tex')}  verts ${row('verts')}  tris ${row('tris')}${before.skins ? '  (skinned: welded only)' : ''}`)
}
