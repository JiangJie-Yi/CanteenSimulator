// What the GPU's geometries are (item 472, the owner's: the frame meter's Geo is renderer.info.memory.geometries, the BufferGeometry
// instances on the GPU, not triangles): every BufferGeometry the page makes is noted as it's made, with where in the game's code (three's
// module rewritten as it's served: its constructor notes the instance and the stack); those on the GPU now (the renderer's own dispose
// listener on them) are told:
//   - by FILE and by MAKER (the first frames of the stack in src/: the function that made it, cloned it or merged it); one made by a JSX
//     <*Geometry> (React Three Fiber, no frame of the game's in its stack) or by the GLTF loader is told as (jsx <type>) or (gltf);
//   - by OWNER: the nearest edit piece (Movable's editId), else the nearest named group, of the meshes using it (or (not in scene));
//   - by SHAPE: the same parameters (three's own shapes) or the same vertices (any other), made more than once: what could be shared.
// Measured with the shop shut (after SETTLE ms), then (OPEN=1) open and busy (x2, a crowd) after WARM ms.
//   node tests/e2e/geocount.mjs          TOP=12 SETTLE=30000 OPEN=1 WARM=60000 JSON=<file>
import { boot, openShop, rush } from './shop.mjs'
import { writeFileSync } from 'node:fs'
const TOP = Number(process.env.TOP ?? 12)
const before = async (page) => {
  await page.addInitScript(() => { Error.stackTraceLimit = 60 })
  await page.route(/\/node_modules\/\.vite\/deps\/.*\.js/, async (route) => {
    const res = await route.fetch()
    let body = await res.text()
    if (body.includes('this.isBufferGeometry = true;')) {
      body = body.replace('this.isBufferGeometry = true;', 'this.isBufferGeometry = true; (globalThis.__geoMade ||= new Set()).add(this); this.__made = new Error().stack;')
    }
    await route.fulfill({ response: res, body })
  })
}
const { browser, page } = await boot({ width: 1280, height: 860, before })
await page.waitForFunction(() => !!window.__scene && !!window.__gl, null, { timeout: 120000 })
await page.waitForTimeout(Number(process.env.SETTLE ?? 30000))
const count = (label) => page.evaluate(({ label, top }) => {
  const s = window.__scene, gl = window.__gl
  const made = globalThis.__geoMade ?? new Set()
  const onGpu = (g) => (g._listeners?.dispose ?? []).some((f) => f.name === 'onGeometryDispose')
  const gpu = [...made].filter(onGpu)
  // (who uses each: the meshes in the scene)
  const users = new Map()
  s.traverse((o) => { if (o.geometry) { const u = users.get(o.geometry); if (u) u.push(o); else users.set(o.geometry, [o]) } })
  const whose = (o) => {
    for (let q = o; q; q = q.parent) if (q.userData?.editId) return q.userData.editId
    for (let q = o; q; q = q.parent) if (q.name && !/^(Scene|)$/.test(q.name)) return `(${q.name})`
    return '(scene)'
  }
  const frames = (g) => (g.__made ?? '').split('\n').slice(2).map((l) => l.trim())
  const src = (g) => frames(g).filter((l) => /\/src\//.test(l)).map((l) => {
    const fn = (l.match(/^at (?:new )?([^ (]+) \(/) ?? [])[1] ?? '?'
    const file = (l.match(/\/src\/([^?:)]+)/) ?? [])[1] ?? '?'
    return { fn, file }
  })
  const via = (g) => {
    const f = frames(g)
    if (f.some((l) => /GLTFLoader|GLTFParser/.test(l))) return '(gltf)'
    if (f.some((l) => /react-three|react-reconciler|@react-three/.test(l))) return `(jsx ${g.type})`
    return `(three ${g.type})`
  }
  const sig = (g) => {
    if (g.parameters) return `${g.type} ${JSON.stringify(g.parameters)}`
    const p = g.attributes?.position
    if (!p) return `${g.type} (no position)`
    const a = p.array, n = a.length, pick = [0, 1, 2, n >> 1, (n >> 1) + 1, n - 3, n - 2, n - 1].map((i) => (a[i] ?? 0).toFixed(4)).join(',')
    return `${g.type} ${p.count}v ${g.index?.count ?? 0}i ${pick}`
  }
  const tally = (key) => {
    const m = new Map()
    for (const g of gpu) { const k = key(g); m.set(k, (m.get(k) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const byFile = tally((g) => src(g)[0]?.file ?? via(g))
  const byMaker = tally((g) => { const f = src(g); return f.length ? f.slice(0, 2).map((x) => `${x.fn} (${x.file.replace(/^shops\/grill\//, '')})`).join(' <- ') : via(g) })
  const byOwner = tally((g) => { const u = users.get(g); return u ? whose(u[0]) : '(not in scene)' })
  const byShape = tally(sig).filter(([, n]) => n > 1)
  // (per owner, what makes its geometries: the top owners' makers)
  const ownerMakers = new Map()
  for (const g of gpu) {
    const u = users.get(g), o = u ? whose(u[0]) : '(not in scene)', f = src(g), k = f.length ? `${f[0].fn} (${f[0].file.replace(/^shops\/grill\//, '')})` : via(g)
    const m = ownerMakers.get(o) ?? new Map(); m.set(k, (m.get(k) ?? 0) + 1); ownerMakers.set(o, m)
  }
  // (drawn now: a mesh using it shown, everything over it shown, on the camera's layers; else on the GPU but not drawn: uploaded once and
  // hidden since (a merge's originals), or out of the scene)
  const cam = window.__cam
  const shownAll = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true }
  const drawn = (g) => (users.get(g) ?? []).some((o) => shownAll(o) && (!cam || o.layers.test(cam.layers)))
  const idle = gpu.filter((g) => !drawn(g))
  const idleTally = (key) => { const m = new Map(); for (const g of idle) { const k = key(g); m.set(k, (m.get(k) ?? 0) + 1) } return [...m.entries()].sort((a, b) => b[1] - a[1]) }
  const idleByMaker = idleTally((g) => { const f = src(g); return f.length ? f.slice(0, 2).map((x) => `${x.fn} (${x.file.replace(/^shops\/grill\//, '')})`).join(' <- ') : via(g) })
  const idleByOwner = idleTally((g) => { const u = users.get(g); return u ? whose(u[0]) : '(not in scene)' })
  const shared = gpu.filter((g) => (users.get(g)?.length ?? 0) > 1).length
  const inScene = gpu.filter((g) => users.has(g)).length
  return {
    label, idle: idle.length, idleByMaker: idleByMaker.slice(0, top), idleByOwner: idleByOwner.slice(0, top), info: gl.info.memory.geometries, calls: gl.info.render.calls, made: made.size, gpu: gpu.length, inScene, shared,
    byFile: byFile.slice(0, top), byMaker: byMaker.slice(0, top * 2), byOwner: byOwner.slice(0, top * 2),
    byShape: byShape.slice(0, top * 2).map(([k, n]) => [k.slice(0, 160), n]), dupTotal: byShape.reduce((t, [, n]) => t + n - 1, 0),
    ownerMakers: byOwner.slice(0, top).map(([o]) => [o, [...(ownerMakers.get(o) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)]),
  }
}, { label, top: TOP })
const show = (r) => {
  console.log(`\n=== ${r.label}: renderer.info.memory.geometries ${r.info} (draw calls last frame ${r.calls}); BufferGeometry made ${r.made}, on the GPU ${r.gpu} (in the scene ${r.inScene}, shared by 2+ meshes ${r.shared}); the same shape made again ${r.dupTotal}`)
  console.log(`-- on the GPU but not drawn now: ${r.idle}`); for (const [k, n] of r.idleByMaker) console.log(`  ${String(n).padStart(5)}  ${k}`)
  console.log('-- not drawn, by owner:'); for (const [k, n] of r.idleByOwner) console.log(`  ${String(n).padStart(5)}  ${k}`)
  console.log('-- by file (where made):'); for (const [k, n] of r.byFile) console.log(`  ${String(n).padStart(5)}  ${k}`)
  console.log('-- by maker (function <- its caller):'); for (const [k, n] of r.byMaker) console.log(`  ${String(n).padStart(5)}  ${k}`)
  console.log('-- by owner (piece or group):'); for (const [k, n] of r.byOwner) console.log(`  ${String(n).padStart(5)}  ${k}`)
  console.log('-- top owners, made by:'); for (const [o, ms] of r.ownerMakers) console.log(`  ${o}: ${ms.map(([k, n]) => `${n} ${k}`).join(' | ')}`)
  console.log('-- the same shape more than once:'); for (const [k, n] of r.byShape) console.log(`  ${String(n).padStart(5)}  ${k}`)
}
const out = [await count('shut')]
show(out[0])
if (process.env.OPEN) {
  await openShop(page, { x2: true, at: 18 * 60 })
  await rush(page)
  await page.waitForTimeout(Number(process.env.WARM ?? 60000))
  out.push(await count('open, busy'))
  show(out[1])
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(out, null, 1))
await browser.close()
