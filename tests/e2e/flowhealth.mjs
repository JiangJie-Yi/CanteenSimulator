// Does anything in the shop's flow get stuck? (the owner's, 2026-11-13: "flows"; item 53) The shop open at x2 (busy, unless CALM=1) for WATCH
// ms; every 2 s: each customer's state and how long they've been in it (by the shop's clock), each plate's phase and how long in it (a dirty
// plate left at a seat: the seat isn't sat at again till it's cleared), the takeaways, and the counts of the sink's dirty plates, the racks,
// the low rack, the plating place's stack, the dryer, the clean skewers. Printed: the longest of each, the counts' lowest and highest, and
// on average at a look how many dirty plates are left at seats, how many plates ready wait for a server, how many wait on the bench, how
// many customers wait for their food: weigh a change to who does what first by these averages, two runs or more each (a run's longest is
// one plate's luck). Item 53, an ordinary evening at x2 for 240 s, two runs each: dirty plates at seats at any moment 3.92 before, 0.92 after.
//
//   npm run dev     (in another terminal)
//   node tests/e2e/flowhealth.mjs     (WATCH=<ms> default 240000; CALM=1 the usual crowd; AT=<min>; STUCK=<shop minutes> listed over)
import { boot, openShop, rush } from './shop.mjs'
const { browser, page: p } = await boot({ width: 1280, height: 800 })
await openShop(p, { x2: true, at: +(process.env.AT ?? 17 * 60) })
if (!process.env.CALM) await rush(p)
await p.evaluate(() => {
  const A = window.__st = { samples: 0, guest: {}, run: {}, takeout: {}, counts: {}, long: [], sum: { dirty: 0, ready: 0, bench: 0, waiting: 0 } }
  const since = new Map()
  const clock = () => window.__clock?.get?.()?.minute ?? 0
  const note = (k, label, now) => { const was = since.get(k); if (!was || was.label !== label) since.set(k, { label, at: now }); return now - (since.get(k).at) }
  const keep = (bag, label, age) => { if (!(label in bag) || age > bag[label]) bag[label] = +age.toFixed(1) }
  const count = (k, v) => { const c = (A.counts[k] ??= { lo: v, hi: v }); c.lo = Math.min(c.lo, v); c.hi = Math.max(c.hi, v) }
  setInterval(() => {
    const now = clock()
    A.samples++
    const live = new Set()
    for (const g of window.__guestStates?.current ?? []) {
      const k = 'g' + g.id; live.add(k)
      const age = note(k, g.state, now)
      keep(A.guest, g.state + (g.takeout ? ' (takeaway)' : ''), age)
    }
    for (const r of window.__runs?.current ?? []) {
      const k = 'r' + r.key; live.add(k)
      keep(A.run, r.phase, note(k, r.phase, now))
    }
    for (const o of window.__takeout?.orders ?? []) {
      const k = 't' + o.id; live.add(k)
      const label = o.gone ? 'gone' : o.handed ? 'handed' : o.taken ? 'taken' : o.ready ? 'ready' : 'cooking'
      keep(A.takeout, label, note(k, label, now))
    }
    for (const k of [...since.keys()]) if (!live.has(k)) since.delete(k)
    const runs = window.__runs?.current ?? []
    A.sum.dirty += runs.filter((r) => r.phase === 'dirty').length
    A.sum.ready += runs.filter((r) => r.phase === 'ready').length
    A.sum.bench += window.__bench?.ids?.length ?? 0
    A.sum.waiting += (window.__guestStates?.current ?? []).filter((g) => g.state === 'waiting').length
    count('sink dirty', window.__dirty?.current ?? 0)
    count('racks', window.__plates?.n ?? 0)
    count('low rack', window.__lowRack?.n ?? 0)
    count('plating stack', window.__plating?.stock ?? 0)
    count('dryer', window.__dryer?.n ?? 0)
    count('clean skewers', window.__skewers?.s?.clean ?? 0)
  }, 2000)
})
const STUCK = +(process.env.STUCK ?? 60)
await p.waitForTimeout(+(process.env.WATCH ?? 240000))
const A = await p.evaluate(() => window.__st)
console.log(`${A.samples} looks (shop minutes in each state, the longest)`)
console.log('  customers:', JSON.stringify(A.guest))
console.log('  plates:   ', JSON.stringify(A.run))
console.log('  takeaways:', JSON.stringify(A.takeout))
console.log('  on average at a look:', Object.entries(A.sum).map(([k, v]) => `${k} ${(v / A.samples).toFixed(2)}`).join(', '))
console.log('  counts (lowest..highest):', Object.entries(A.counts).map(([k, c]) => `${k} ${c.lo}..${c.hi}`).join(', '))
const long = [...Object.entries(A.guest).map(([k, v]) => ['customer ' + k, v]), ...Object.entries(A.run).map(([k, v]) => ['plate ' + k, v]), ...Object.entries(A.takeout).map(([k, v]) => ['takeaway ' + k, v])].filter(([k, v]) => v > STUCK && !/gone|done|angry/.test(k))
console.log(`over ${STUCK} shop minutes: ${long.length ? long.map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`)
await browser.close()
