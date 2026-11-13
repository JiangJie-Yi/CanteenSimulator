// How the customers walk among each other (the owner's item 45, 2026-11-13): the shop opened and busy (a rush, unless CALM=1) at x2, and
// every scene frame (a frame callback of our own after the shop's, so after the stepping aside) each customer's place in the bar's frame.
// Counted, every 20 s and at the end:
//   - frames a customer moved quicker than FAST (bar units a second, default 2.6: the quickest walk is 1.32 x 1.35 = 1.8), and the quickest;
//   - frames one moved more than JUMP (default 0.2) in a frame (LIST=1 prints each with everyone near it, the frame before and this one);
//   - frames two stood in each other (nearer than IN, default 0.22; one of them a customer on their feet, the other a customer, a server
//     or the stock keeper), and who with whom; two customers in each other by what each was doing and where (the bar's frame);
//   - a customer's time in a phase going back (their entry swapped for an older copy).
// Before item 45, 200 s of it: 225 frames too quick (7.55 a second at most), 15 over 0.2, 942 in each other, 18 times back; after it: 40
// (3.28), 3, 253, 0.
//
//   npm run dev     (in another terminal)
//   node tests/e2e/crowd.mjs          (WATCH=<ms>, default 180000; AT=<min> the shop's clock, default 17:00; CALM=1 no rush)
import { boot, openShop, rush } from './shop.mjs'
const { browser, page: p } = await boot({ width: 1280, height: 800 })
await openShop(p, { x2: true, at: +(process.env.AT ?? 17 * 60) })
if (!process.env.CALM) await rush(p)
await p.evaluate(([JUMP, FAST, IN]) => {
  const A = window.__pj = { jumps: [], frames: 0, max: 0, top: 0, fast: 0, steps: 0, inside: 0, insideBy: {}, guestPairs: {}, back: [] }
  let prev = new Map()
  // (a customer's time in a phase going back: their entry swapped for a copy made a few frames before)
  const lastT = new Map()
  const near = (m, at, r) => [...m.entries()].filter(([, v]) => Math.hypot(v.x - at.x, v.z - at.z) < r)
  window.__r3f().internal.subscribe({ current: (_st, delta) => {
    A.frames++
    const step = Math.min(delta, 0.1)
    const now = new Map()
    const shown = window.__shown?.current ?? []
    for (const s of shown) {
      const was = lastT.get(s.id)
      if (was && was.phase === s.phase && s.t < was.t - 1e-6 && A.back.length < 20) A.back.push(`g${s.id} ${s.phase} t${was.t.toFixed(2)} -> t${s.t.toFixed(2)}`)
      lastT.set(s.id, { phase: s.phase, t: s.t })
    }
    const waiters = window.__waiters?.current ?? []
    let floor = null
    window.__scene.traverse((o) => {
      const u = o.userData
      // (a customer's group by its `guest` alone: React hands it a new userData whenever the bar's drawn again, `shown` back only with the
      // next frame (dayaudit.mjs missed customers by it))
      if (u?.guest !== undefined) {
        const s = shown.find((x) => x.id === u.guest)
        floor = o.parent
        now.set('g' + u.guest, { x: o.position.x, z: o.position.z, o, up: !!s && s.phase !== 'sit' && o.visible, ph: s ? `${s.phase} t${s.t.toFixed(2)}${s.wc ? ' ' + s.wc.who : ''}` : '?' })
      }
    })
    if (floor) for (const o of floor.children) {
      const u = o.userData
      if (u?.staffId === undefined || !o.visible) continue
      const w = waiters.find((x) => Math.hypot(x.pos.x - o.position.x, x.pos.z - o.position.z) < 1e-3)
      now.set('s:' + u.staffId, { x: o.position.x, z: o.position.z, o, up: false, ph: w ? `${w.phase} t${(+w.t).toFixed(2)}` : u.role ?? 'staff' })
    }
    const list = [...now.entries()]
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [ka, a] = list[i], [kb, b] = list[j]
      if (!a.up && !b.up) continue
      if (Math.hypot(a.x - b.x, a.z - b.z) < IN) {
        A.inside++
        const kind = `${ka[0] === 'g' ? 'guest' : a.ph}-${kb[0] === 'g' ? 'guest' : b.ph}`.replace(/ t[0-9.]+/g, '')
        A.insideBy[kind] = (A.insideBy[kind] ?? 0) + 1
        // (two customers: what each was doing, and where (the bar's frame, to a tenth))
        if (ka[0] === 'g' && kb[0] === 'g') { const w = [a.ph, b.ph].map((x) => x.replace(/ t[0-9.]+/g, '')).sort().join(' + ') + ` @${((a.x + b.x) / 2).toFixed(1)},${((a.z + b.z) / 2).toFixed(1)}`; A.guestPairs[w] = (A.guestPairs[w] ?? 0) + 1 }
      }
    }
    for (const [k, v] of now) {
      if (!k.startsWith('g')) continue
      const b = prev.get(k)
      if (!b || b.o !== v.o) continue
      const d = Math.hypot(v.x - b.x, v.z - b.z)
      A.max = Math.max(A.max, d)
      if (step > 0) { A.steps++; const sp = d / step; A.top = Math.max(A.top, sp); if (sp > FAST) A.fast++ }
      if (d > JUMP && A.jumps.length < 40) {
        const pick = (m, at) => near(m, at, 0.7).filter(([kk]) => kk !== k).map(([kk, x]) => `${kk} ${x.ph} @${x.x.toFixed(2)},${x.z.toFixed(2)} d${Math.hypot(x.x - at.x, x.z - at.z).toFixed(2)}`)
        A.jumps.push({ k, d: +d.toFixed(3), from: `${b.x.toFixed(2)},${b.z.toFixed(2)} ${b.ph}`, to: `${v.x.toFixed(2)},${v.z.toFixed(2)} ${v.ph}`,
          before: pick(prev, b), after: pick(now, v), clock: window.__clock?.get?.()?.minute })
      }
    }
    prev = now
  } }, 0, { getState: window.__r3f })
}, [+(process.env.JUMP ?? 0.2), +(process.env.FAST ?? 2.6), +(process.env.IN ?? 0.22)])
const until = Date.now() + +(process.env.WATCH ?? 180000)
const sum = () => p.evaluate(() => { const a = window.__pj; return { n: a.jumps.length, f: a.frames, m: a.max, top: a.top, fast: a.fast, steps: a.steps, inside: a.inside, by: a.insideBy, b: a.back.length } })
while (Date.now() < until) {
  await p.waitForTimeout(20000)
  const r = await sum()
  console.log(`frames ${r.f} | over ${process.env.JUMP ?? 0.2} in a frame ${r.n}, most ${r.m.toFixed(3)} | quicker than ${process.env.FAST ?? 2.6}/s ${r.fast} of ${r.steps}, quickest ${r.top.toFixed(2)}/s | in each other ${r.inside} | times back ${r.b}`)
}
const r = await sum()
console.log('in each other, by who:', JSON.stringify(r.by))
const gp = await p.evaluate(() => window.__pj.guestPairs)
for (const [k, n] of Object.entries(gp).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${n}x ${k}`)
for (const x of await p.evaluate(() => window.__pj.back)) console.log('  back:', x)
if (process.env.LIST) for (const j of await p.evaluate(() => window.__pj.jumps)) {
  console.log(`\n${j.k} ${j.d}: ${j.from}  ->  ${j.to}`)
  for (const x of j.before) console.log(`   before: ${x}`)
  for (const x of j.after) console.log(`   after:  ${x}`)
}
await browser.close()
