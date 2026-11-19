// Is the GPU's geometry count (the frame meter's Geo, renderer.info.memory.geometries) growing because something's left behind? (item 391,
// the owner's 「記得Geo非常高 該怎處理?」) The shop opened and busy (x2, a crowd); after WARM ms, for WATCH ms: every geometry.dispose() noted
// (and, CHURN=1, where in the game's code each one and each clone came from), and every frame (EVERY=<ms> to look less often) every geometry
// drawn in the scene (shown, everything over it shown, on the camera's layers) noted with whose it is (the nearest edit piece, else the
// nearest named group) and what it is (its mesh, material, vertex count). At the end:
//   - the GPU's count then and now, and how many were let go meanwhile;
//   - LEFT: drawn, not in the scene now, never let go, by whose: what's taken out and forgotten (a leak), or a shared shape kept for the next
//     one (a template's, a cache's: the same few, not one for each customer or dish);
//   - how many of the scene's geometries (shown or not) came and went.
// A GPU count growing while the scene's stays level, with nothing much LEFT, is caches filling (each drink's, dish's, customer's look's
// shapes drawn the first time): it levels off (soak.mjs over 20 minutes). LEFT growing with the customers or the dishes is a leak.
//   node tests/e2e/geoleak.mjs        WARM=20000 WATCH=120000 EVERY=0 CHURN=1 CALM=1 TOP=20
import { boot, openShop, rush } from './shop.mjs'
const { browser, page } = await boot({ width: 1280, height: 860 })
await openShop(page, { x2: true, at: 18 * 60 })
if (!process.env.CALM) await rush(page)
await page.waitForTimeout(Number(process.env.WARM ?? 20000))
const r = await page.evaluate(async ({ watch, every, churn, top }) => {
  const T = window.__THREE, s = window.__scene, cam = window.__cam, gl = window.__gl
  // (where in the game's code: the first frames of the stack in src/, not three's)
  const where = () => new Error().stack.split('\n').slice(2).filter((l) => /\/src\//.test(l)).slice(0, 2)
    .map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '').replace(/\)$/, '')).join(' <- ') || '(three)'
  const disposed = new Set(), byDispose = new Map(), byClone = new Map()
  const od = T.BufferGeometry.prototype.dispose, oc = T.BufferGeometry.prototype.clone
  T.BufferGeometry.prototype.dispose = function () {
    disposed.add(this.uuid)
    if (churn) { const k = where(); byDispose.set(k, (byDispose.get(k) ?? 0) + 1) }
    return od.call(this)
  }
  if (churn) T.BufferGeometry.prototype.clone = function () { const k = where(); byClone.set(k, (byClone.get(k) ?? 0) + 1); return oc.call(this) }
  const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true }
  const whose = (o) => {
    for (let q = o; q; q = q.parent) if (q.userData?.editId) return q.userData.editId
    for (let q = o; q; q = q.parent) if (q.name) return `(${q.name})`
    return '?'
  }
  const seen = new Map(), all0 = new Set()
  const look = (first) => {
    const now = new Set()
    s.traverse((o) => {
      const g = o.geometry
      if (!g) return
      now.add(g.uuid)
      if (first) all0.add(g.uuid)
      if (seen.has(g.uuid) || !shown(o) || (cam && !o.layers.test(cam.layers))) return
      const mat = [].concat(o.material)[0]
      seen.set(g.uuid, { who: whose(o), what: `${o.name || '-'} ${g.attributes?.position?.count ?? 0}v ${mat?.type ?? ''}${o.isSkinnedMesh ? ' skinned' : ''}` })
    })
    return now
  }
  const gpu0 = gl.info.memory.geometries
  let now = look(true)
  const t0 = performance.now()
  while (performance.now() - t0 < watch) {
    await new Promise((res) => (every > 0 ? setTimeout(res, every) : requestAnimationFrame(res)))
    now = look(false)
  }
  T.BufferGeometry.prototype.dispose = od
  T.BufferGeometry.prototype.clone = oc
  const left = [...seen.entries()].filter(([u]) => !now.has(u) && !disposed.has(u))
  const tally = (list, key) => {
    const m = new Map()
    for (const x of list) { const k = key(x); m.set(k, (m.get(k) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => `${n} x ${k}`)
  }
  return { gpu0, gpu1: gl.info.memory.geometries, disposed: disposed.size, seen: seen.size, left: left.length,
    leftBy: tally(left, ([, v]) => `${v.who}: ${v.what}`),
    came: [...now].filter((u) => !all0.has(u)).length, went: [...all0].filter((u) => !now.has(u)).length,
    byDispose: churn ? tally([...byDispose.entries()].flatMap(([k, n]) => Array(n).fill(k)), (k) => k) : [],
    byClone: churn ? tally([...byClone.entries()].flatMap(([k, n]) => Array(n).fill(k)), (k) => k) : [] }
}, { watch: Number(process.env.WATCH ?? 120000), every: Number(process.env.EVERY ?? 0), churn: !!process.env.CHURN, top: Number(process.env.TOP ?? 20) })
console.log(`GPU geometries ${r.gpu0} -> ${r.gpu1}; let go meanwhile ${r.disposed}; seen drawn ${r.seen}; the scene's own came ${r.came}, went ${r.went}`)
console.log(`LEFT (drawn, out of the scene, never let go): ${r.left}`)
for (const l of r.leftBy) console.log(`  ${l}`)
if (r.byDispose.length) { console.log('let go by:'); for (const l of r.byDispose) console.log(`  ${l}`) }
if (r.byClone.length) { console.log('cloned by:'); for (const l of r.byClone) console.log(`  ${l}`) }
await browser.close()
