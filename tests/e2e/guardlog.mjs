// Who the cook table's guard puts somewhere else, and what they were doing (in git; item 54). Roasting's HearthGuard puts every figure out
// of the cook table and its hearth the last thing before each frame's drawn (game/hearthGuard's keepOut): someone whose own way or spot is
// in the table is drawn at its edge, not where they are, and when the nearest edge changes as they go, they're drawn leaping from one edge
// to another (the third cook's walk to the coal sack, four leaps of 0.86-0.98 a trip, item 54). A push now and then at the table's corner is
// no matter; anyone pushed far, or a flip, is someone walking or standing in the table: find their way or their spot.
//
//   node tests/e2e/guardlog.mjs            the shop open at x2 (RUSH=1 a busy evening), WATCH ms (default 120000)
//   COAL=1 node tests/e2e/guardlog.mjs     the third cook sent for coal every COAL_EVERY ms (default 25000): the crate emptied, the fire asking
//   LIST=40                                 the first 40 pushes one a line
//
// Prints, by who and what they were doing (the third cook off their place: their phase; a cook drawn by Roasting: the second cook's fetching
// round), how many pushes, the farthest, and the flips (the drawn place moved more than LEAP between two frames by the guard alone); and the
// third cook's biggest drawn step in a frame (a walk's frame at x2 is up to about 0.3).
import { boot, openShop, rush } from './shop.mjs'
const { browser, page: p } = await boot({ width: 1280, height: 800 })
await openShop(p, { x2: true, at: +(process.env.AT ?? 17 * 60) })
if (process.env.RUSH) await rush(p)
const WATCH = +(process.env.WATCH ?? 120000), COAL_EVERY = +(process.env.COAL_EVERY ?? 25000), LEAP = +(process.env.LEAP ?? 0.45)
await p.evaluate(async () => {
  const T = window.__THREE
  // (the second cook's spot at the store he's fetching from, in the table's frame as the guard's own numbers are)
  const names = performance.getEntriesByType('resource').map((e) => e.name)
  const bar = await import(names.find((n) => /shops\/grill\/bar\.ts/.test(n)))
  const tableAt = (o, v) => {
    const fr = window.__scene.getObjectByName('cook-table-c0')?.parent
    if (!fr || !o?.parent) return null
    const q = fr.worldToLocal(o.parent.localToWorld(v.clone()))
    return [+q.dot(bar.ALONG).toFixed(3), +q.dot(bar.LAY).toFixed(3)]
  }
  const G = window.__guard = { frames: 0, pushes: [], seen: new WeakSet(), step: { max: 0, at: null }, prev: null, coal: 0 }
  const tick = () => {
    G.frames++
    for (const e of window.__hearthPushes ?? []) {
      if (G.seen.has(e)) continue
      G.seen.add(e)
      const r = window.__platerRun?.current, c = window.__chefTrip
      const phase = e.who === 'plater-walker' && r ? `${r.phase} t${(+r.t).toFixed(2)}`
        : e.who.startsWith('crew-') && c ? `trip ${c.phase} ${c.store ?? ''} t${(+c.t).toFixed(2)}` : null
      // (whether they're drawn at all: the guard puts those not shown out too (a cook waiting to come in, one out plating))
      let shown = true
      const fig = window.__scene.getObjectByName(e.who)
      for (let q = fig; q; q = q.parent) if (!q.visible) { shown = false; break }
      G.pushes.push({ f: G.frames, who: e.who, role: e.role, from: e.from.map((n) => +n.toFixed(3)), to: e.to.map((n) => +n.toFixed(3)),
        d: +Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]).toFixed(3), phase: `${shown ? '' : '(unseen) '}${phase ?? ''}` || null,
        spot: e.who.startsWith('crew-') && c?.spot ? tableAt(fig, c.spot) : null })
    }
    const o = window.__scene.getObjectByName('plater-walker')
    if (o) {
      const w = new T.Vector3().setFromMatrixPosition(o.matrixWorld)
      if (G.prev && G.prev.vis && o.visible && G.prev.f === G.frames - 1) {
        const d = Math.hypot(w.x - G.prev.x, w.z - G.prev.z)
        if (d > G.step.max) G.step = { max: d, at: window.__platerRun?.current?.phase }
      }
      G.prev = { x: w.x, z: w.z, vis: o.visible, f: G.frames }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
const t0 = Date.now()
let lastCoal = 0
while (Date.now() - t0 < WATCH) {
  if (process.env.COAL && Date.now() - lastCoal > COAL_EVERY) {
    const sent = await p.evaluate(() => {
      const r = window.__platerRun?.current
      if (!r || r.phase !== 'idle' || window.__fireTend.want) return false
      window.__crate.left = 0
      window.__fireTend.want = 'coal'
      window.__fireTend.done = null
      window.__guard.coal++
      return true
    })
    if (sent) lastCoal = Date.now()
  }
  await p.waitForTimeout(500)
}
const G = await p.evaluate(() => { const G = window.__guard; return { frames: G.frames, pushes: G.pushes, step: G.step, coal: G.coal } })
console.log(`${G.frames} frames${process.env.COAL ? `, ${G.coal} coal trips sent` : ''}; the third cook's biggest drawn step in a frame ${G.step.max.toFixed(2)} (${G.step.at})`)
const by = {}, last = {}
for (const e of G.pushes) {
  const k = `${e.who} (${e.role})${e.phase ? ' ' + e.phase.replace(/ t[-0-9.]+$/, '') : ''}`
  by[k] ??= { n: 0, most: 0, flips: 0 }
  by[k].n++
  by[k].most = Math.max(by[k].most, e.d)
  // (pushed two frames running: where they were put moved more than a leap, the guard's doing)
  const l = last[e.who]
  if (l && l.f === e.f - 1 && Math.hypot(e.to[0] - l.to[0], e.to[1] - l.to[1]) > LEAP) by[k].flips++
  last[e.who] = e
}
console.log(`${G.pushes.length} pushes, by who and what they were doing (how many, the farthest (the table's units, the world's metres), flips over ${LEAP}):`)
for (const [k, v] of Object.entries(by).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k}: ${v.n}, most ${v.most.toFixed(3)}, flips ${v.flips}`)
if (process.env.LIST) for (const e of G.pushes.slice(0, +process.env.LIST)) console.log(`  #${e.f} ${e.who} ${e.role} ${e.from} -> ${e.to} (${e.d}) ${e.phase ?? ''}${e.spot ? ` spot ${e.spot}` : ''}`)
await browser.close()
