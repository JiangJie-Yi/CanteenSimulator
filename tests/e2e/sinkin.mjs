// Who sinks into what (item 387, the owner's 「有個致命的問題動作都會深陷進模型去」): the shop opened and busy (x2, a crowd), and every
// STEP ms for WATCH ms each figure of the staff (its skinned points, every few, as posed) tested against the furniture standing in the room
// (the kitchen's counters, its cooker and pots, the racks, the sink, the fridges, the stools and tables…: every piece in edit mode with a body).
// A point inside a solid mesh's own box (in its own frame, so a turned piece is measured as it stands) is only a candidate: a box holds the
// air over a counter's top and between a stool's legs, so a hand over the counter or a seat taken would count. It's in only if rays from it
// along the six axes cross the mesh's faces an odd number of times (most of the six: the meshes aren't all closed), and how deep is how far
// the nearest of those crossings is. Prints, for each figure and piece, how often, the deepest, and what that figure was doing then (a
// server's phase, the plater's, the flags their walk sets); BOX=1 the boxes alone, as it was. TOL (m, default 0.03): how deep counts.
// ONLY=<id,id> only those pieces; WHO=<role|id> only those figures.
//   node tests/e2e/sinkin.mjs        WATCH=90000 STEP=300 TOL=0.03
import { boot, openShop, rush } from './shop.mjs'
const WATCH = +(process.env.WATCH ?? 90000), STEP = +(process.env.STEP ?? 300), TOL = +(process.env.TOL ?? 0.03)
const { browser, page } = await boot({ width: 1440, height: 860 })
await openShop(page, { x2: true, at: Number(process.env.AT ?? 18 * 60) })
if (!process.env.CALM) await rush(page)
await page.waitForTimeout(Number(process.env.WARM ?? 15000))
const res = await page.evaluate(async ({ WATCH, STEP, TOL, only, who, BOX }) => {
  const T = window.__THREE, s = window.__scene
  const onlySet = only ? new Set(only.split(',')) : null
  // (the furniture: every edit piece's solid meshes, their boxes in their own frames; not what's carried or eaten, not see-through, not
  // the floor and the walls)
  const solids = []
  s.traverse((m) => {
    if (!m.isMesh || m.isSkinnedMesh) return
    const mat = [].concat(m.material)[0]
    if (!mat || mat.transparent || mat.visible === false || mat.side === T.BackSide) return
    let id = null
    for (let q = m; q && !id; q = q.parent) id = q.userData?.editId ?? null
    if (!id || /floor|wall|room|bar-top|noren|facade|lantern|light|switch|sign|art-|chochin/.test(id)) return
    if (onlySet && !onlySet.has(id)) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    const bb = m.geometry.boundingBox
    const sz = bb.getSize(new T.Vector3())
    // (thin sheets and tiny bits don't count: a mat, a label, a coin)
    if (Math.min(sz.x, sz.y, sz.z) * Math.min(...m.getWorldScale(new T.Vector3()).toArray()) < 0.02) return
    solids.push({ m, id, bb })
  })
  const figs = []
  s.traverse((o) => {
    // (the plater's figure has no id of its own on it: GuestBar3D's plater-walker)
    const sid = o.userData?.staffId ?? (o.name === 'plater-walker' ? 'plater' : undefined), role = o.userData?.role
    if (!sid && !role) return
    if (who && who !== sid && who !== role) return
    if (figs.some((f) => f.o === o || f.sid === sid)) return
    let skinned = false
    o.traverse((q) => { if (q.isSkinnedMesh) skinned = true })
    if (skinned) figs.push({ o, sid: sid ?? role, role: role ?? '' })
  })
  const hits = new Map()
  const v = new T.Vector3(), inv = new T.Matrix4(), l = new T.Vector3(), sc = new T.Vector3()
  const proxy = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ side: T.DoubleSide }))
  proxy.matrixAutoUpdate = false
  const ray = new T.Raycaster(), crossings = []
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((a) => new T.Vector3(...a))
  const t0 = performance.now()
  let samples = 0
  while (performance.now() - t0 < WATCH) {
    await new Promise((r) => setTimeout(r, STEP))
    samples++
    for (const f of figs) {
      let shown = true
      for (let q = f.o; q; q = q.parent) if (!q.visible) shown = false
      if (!shown) continue
      const pts = []
      f.o.traverse((q) => {
        if (!q.isSkinnedMesh || !q.visible) return
        q.updateWorldMatrix(true, false)
        const n = q.geometry.attributes.position.count
        // (each point with the part it moves with: its bone's name, or its index)
        const si = q.geometry.attributes.skinIndex, bones = q.skeleton?.bones ?? []
        for (let i = 0; i < n; i += 5) {
          const v = q.getVertexPosition(i, new T.Vector3()).applyMatrix4(q.matrixWorld)
          const b = si ? bones[si.getX(i)] : null
          v.part = b ? (b.name || `bone${si.getX(i)}`) : ''
          pts.push(v)
        }
      })
      if (!pts.length) continue
      const body = new T.Box3().setFromPoints(pts).expandByScalar(0.05)
      for (const so of solids) {
        let vis = true
        for (let q = so.m; q; q = q.parent) if (!q.visible) { vis = false; break }
        if (!vis) continue
        // (the figure's own carried things are no furniture)
        let mine = false
        for (let q = so.m; q; q = q.parent) if (q === f.o) { mine = true; break }
        if (mine) continue
        const wb = so.bb.clone().applyMatrix4(so.m.matrixWorld)
        if (!wb.intersectsBox(body)) continue
        inv.copy(so.m.matrixWorld).invert()
        so.m.getWorldScale(sc)
        const k = Math.min(sc.x, sc.y, sc.z)
        let count = 0, deep = 0, at = null, part = ''
        for (const p of pts) {
          l.copy(p).applyMatrix4(inv)
          let d = Math.min(l.x - so.bb.min.x, so.bb.max.x - l.x, l.y - so.bb.min.y, so.bb.max.y - l.y, l.z - so.bb.min.z, so.bb.max.z - l.z) * k
          if (d <= TOL) continue
          if (!BOX) {
            // (really in: the crossings of rays from it along the six axes, both faces of every triangle (the proxy's material), within what's
            // drawn of it; odd on most of them; how deep, the nearest crossing)
            proxy.geometry = so.m.geometry
            proxy.matrixWorld.copy(so.m.matrixWorld)
            let odd = 0, near = Infinity
            for (const dir of DIRS) {
              ray.set(p, dir)
              crossings.length = 0
              proxy.raycast(ray, crossings)
              const ds = [...new Set(crossings.map((h) => h.distance.toFixed(4)))]
              if (ds.length % 2) odd++
              if (ds.length) near = Math.min(near, +ds.sort((a, b) => a - b)[0])
            }
            if (odd < 4) continue
            d = near
            if (d <= TOL) continue
          }
          count++
          if (d > deep) { deep = d; at = p.toArray().map((x) => +x.toFixed(3)); part = p.part }
        }
        if (!count) continue
        const key = `${f.sid} in ${so.id} (${so.m.name || so.m.parent?.name || '?'})`
        // (what they're at: a server's phase (GuestBar3D's __waiters, the one whose place is theirs), the plater's (__platerRun), and the
        // flags their walk sets for the figure (lean, carry, prep, scrub…))
        let job = ''
        const ws = window.__waiters?.current ?? []
        for (const w of ws) if (w?.pos && w.pos.distanceTo(f.o.position) < 0.02) job = `phase ${w.phase}`
        if (f.o.name === 'plater-walker' || f.o.parent?.name === 'plater-walker') job = `plater ${window.__platerRun?.current?.phase ?? '?'}`
        const ud = f.o.userData ?? {}
        const flags = Object.entries(ud).filter(([k, x]) => k !== 'staffId' && k !== 'role' && (typeof x === 'number' ? Math.abs(x) > 0.01 : x === true))
          .map(([k, x]) => typeof x === 'number' ? `${k} ${x.toFixed(2)}` : k).join(', ')
        if (flags) job = job ? `${job} (${flags})` : flags
        const h = hits.get(key) ?? { n: 0, deep: 0, pts: 0, at: null, job: '', when: 0, part: '' }
        h.n++
        h.pts = Math.max(h.pts, count)
        if (deep > h.deep) { h.deep = deep; h.at = at; h.job = String(job); h.part = part; h.when = Math.round(performance.now() - t0) }
        hits.set(key, h)
      }
    }
  }
  return { samples, figs: figs.map((f) => `${f.sid}${f.role ? '/' + f.role : ''}`), solids: solids.length,
    hits: [...hits.entries()].sort((a, b) => b[1].deep - a[1].deep).map(([k, h]) => ({ k, ...h, deep: +h.deep.toFixed(3) })) }
}, { WATCH, STEP, TOL, only: process.env.ONLY ?? '', who: process.env.WHO ?? '', BOX: !!process.env.BOX })
console.log(`samples ${res.samples}, figures ${res.figs.length} (${res.figs.join(' ')}), solid meshes ${res.solids}`)
for (const h of res.hits.slice(0, Number(process.env.TOP ?? 25))) console.log(`  ${h.k}: ${h.n} looks, deepest ${h.deep} m (${h.pts} points, its ${h.part || '?'}) at ${JSON.stringify(h.at)}${h.job ? ' doing ' + h.job : ''}`)
await browser.close()
