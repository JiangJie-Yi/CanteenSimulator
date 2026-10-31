// Models running through each other (穿模), checked in a browser: every solid mesh in the shop is measured, and wherever two from different
// pieces overlap in their bounds, a sample of one's vertices is tested for lying inside the other (a ray out from the point crosses the other's
// surface an odd number of times, and it's deeper in than a hair: both ways out are further than TOL). Pairs with more than a few points
// buried are reported, worst first, named by where they sit in the scene. Things merely resting on each other (a cup on a table) touch at
// their surfaces and aren't counted.
//
//   npm run dev          (in another terminal)
//   node tests/e2e/clips.mjs [url]        (TOL=<m> how deep counts, default 0.015; TOP=<n> how many to list; OUT=<file> a JSON of all;
//                                          BY=name each thing by its own name; NEAR=x,y,z,r only what's within r of a point)
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://localhost:5173/JapaneseGrillSimulator/'
const TOL = Number(process.env.TOL ?? 0.015)
const TOP = Number(process.env.TOP ?? 40)
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await page.goto(URL + (URL.includes('?') ? '&' : '?') + 'q=low', { timeout: 60000 })
await page.waitForFunction(() => window.__scene && window.__scene.getObjectByName('FirePit'), null, { timeout: 120000 })
await page.waitForTimeout(12000)

const found = await page.evaluate(({ TOL, BY, NEAR }) => {
  const s = window.__scene
  const V = s.position.constructor
  const { Box3: Box, Raycaster: Ray } = window.__THREE
  const DS = 2
  /** where a mesh sits: the names of its nearest named ancestors */
  const where = (o) => {
    const n = []
    let piece = ''
    for (let p = o; p; p = p.parent) { if (p.name && n.length < 3) n.push(p.name); if (!piece && p.userData?.editId) piece = p.userData.editId }
    return `${n.join(' < ') || o.type}${piece ? ` [${piece}]` : ''}`
  }
  /** the piece it belongs to: its highest ancestor below the scene that has a name, or its Movable's id */
  const pieceOf = (o) => {
    // (BY=name: each thing by its own nearest name, for what isn't a Movable piece of its own (the cook's table's things))
    if (BY === 'name') { for (let p = o; p; p = p.parent) if (p.name && !/^(Scene|root|GLTF)/.test(p.name)) return p.name; return o.uuid }
    let top = o
    for (let p = o; p && p.parent; p = p.parent) { if (p.userData?.editId || p.userData?.movable) return p.userData.editId ?? p.uuid; if (p.parent === s) top = p }
    return top.uuid
  }
  const inBox = (b) => !NEAR || (b.max.x > NEAR[0] - NEAR[3] && b.min.x < NEAR[0] + NEAR[3] && b.max.z > NEAR[2] - NEAR[3] && b.min.z < NEAR[2] + NEAR[3] && b.max.y > NEAR[1] - NEAR[3] && b.min.y < NEAR[1] + NEAR[3])
  const solid = []
  s.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible) return
    for (let p = o.parent; p; p = p.parent) if (!p.visible) return
    const m = o.material
    if (!m || Array.isArray(m) || m.transparent || m.side === 1 || m.isShaderMaterial || m.colorWrite === false) return
    if (/outline|_ink|Hit|look-/i.test(o.name)) return
    const g = o.geometry
    if (!g?.attributes?.position || g.attributes.position.count < 12) return
    o.updateWorldMatrix(true, false)
    const b = new Box().setFromObject(o)
    const sz = b.getSize(new V())
    if (Math.min(sz.x, sz.y, sz.z) < 0.004 || Math.max(sz.x, sz.y, sz.z) > 6) return
    if (!inBox(b)) return
    solid.push({ o, b, piece: pieceOf(o) })
  })
  const ray = new Ray()
  const dirs = [new V(0.577, 0.577, 0.577), new V(-0.6, 0.2, 0.77).normalize(), new V(0.3, -0.9, 0.3).normalize()]
  const inside = (p, mesh) => {
    let odd = 0, near = Infinity
    for (const d of dirs) {
      ray.set(p, d)
      const hits = ray.intersectObject(mesh, false)
      if (hits.length % 2 === 1) odd++
      if (hits[0]) near = Math.min(near, hits[0].distance)
      ray.set(p, d.clone().negate())
      const back = ray.intersectObject(mesh, false)
      if (back[0]) near = Math.min(near, back[0].distance)
    }
    return odd >= 2 && near > TOL
  }
  // (the rays need the mesh's faces both ways round to count crossings)
  for (const x of solid) x.o.material.side = DS
  const out = []
  for (let i = 0; i < solid.length; i++) for (let j = 0; j < solid.length; j++) {
    const A = solid[i], B = solid[j]
    if (i === j || A.piece === B.piece) continue
    const shrunk = B.b.clone().expandByScalar(-TOL)
    if (shrunk.isEmpty() || !A.b.intersectsBox(shrunk)) continue
    const pos = A.o.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 160))
    let n = 0, buried = 0
    for (let k = 0; k < pos.count; k += step) {
      const p = new V().fromBufferAttribute(pos, k).applyMatrix4(A.o.matrixWorld)
      if (!shrunk.containsPoint(p)) continue
      n++
      if (inside(p, B.o)) buried++
    }
    if (buried >= 3) out.push({ a: where(A.o), b: where(B.o), buried, sampled: Math.ceil(pos.count / step), at: A.b.getCenter(new V()).toArray().map((v) => +v.toFixed(2)) })
  }
  return { meshes: solid.length, out: out.sort((x, y) => y.buried - x.buried) }
}, { TOL, BY: process.env.BY ?? '', NEAR: process.env.NEAR ? process.env.NEAR.split(',').map(Number) : null })

console.log(`${found.meshes} solid meshes checked; ${found.out.length} pairs run into each other (deeper than ${TOL} m)`)
for (const r of found.out.slice(0, TOP)) console.log(`  ${r.buried}/${r.sampled}  ${r.a}   ⟶ in ⟶   ${r.b}   @ ${r.at.join(', ')}`)
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(found, null, 1))
await browser.close()
