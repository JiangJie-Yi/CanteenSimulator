// A whole day watched (the owner's, 2026-11-13: "flows and animations"): the shop opened at x2 and left to run itself from AT through closing
// till the staff have gone home (END, the next morning), and meanwhile, every frame:
//   - every figure's place (customers, those waiting on the benches, takeaway customers and riders, staff, the owner): one that moves
//     further in a frame than a walk could (JUMP, the world's units) or
//     up or down in one (a step's more than half of it) noted with what it was doing: a customer's phase (GuestBar3D's shown), a staff
//     member's role, every server's phase, how many frames the scene ran in it;
//   - every notice put up (the bar along the bottom), and every line of the day's log, with the shop's clock;
//   - everyone the cook table's guard put out of the table (Roasting's HearthGuard; tests/e2e/guardlog.mjs for what they were doing): how
//     often, how far, and how often the place it put them at changed sides in a frame (a flip: a leap on the screen; item 54's third cook).
// The figures are gathered afresh every frame (gathered once a second, React handing a customer's group on to the next customer read as a
// leap from one to the other: item 32's first day of "teleports" was that). An overview shot every SHOT ms (0: none).
//
//   npm run dev     (in another terminal)
//   node tests/e2e/dayaudit.mjs        (AT=<min> opening, 995 = 16:35; END=<min after midnight> 325 = 05:25; LIMIT=<ms>; JUMP; SHOT=<ms>;
//                                        OUT=<shot prefix>; JSON=<file>, default dayaudit.json; RUSH=1 busy)
// About 7 minutes for a whole day. Each jump's printed; what it means: a server's way back given the wrong way round (item 36), a seat sat
// on in a frame (37), a step's height twice (42).
import fs from 'node:fs'
import { boot, openShop, rush } from './shop.mjs'
const { browser, page: p } = await boot({ width: 1600, height: 900 })
await openShop(p, { x2: true, at: +(process.env.AT ?? 16 * 60 + 35) })
// (RUSH=1: a busy evening, the benches filled and takeaways coming (shop.mjs's rush))
if (process.env.RUSH) await rush(p)
await p.evaluate((JUMP) => {
  const T = window.__THREE
  const GUARD_LEAP = 0.45
  // (a member of the staff pushed, named by their id alone (a server, the stock keeper): their job, from their figure's staffRole)
  const jobs = {}
  const jobOf = (who) => {
    if (jobs[who] !== undefined) return jobs[who]
    let o = window.__scene.getObjectByName(who), r = null
    if (!o) window.__scene.traverse((q) => { if (!o && q.userData?.staffId === who) o = q })
    o?.traverse((m) => { if (!r && m.userData?.staffRole) r = m.userData.staffRole })
    return (jobs[who] = r ?? '')
  }
  const A = window.__audit = { jumps: [], notices: [], chat: [], seen: new Map(), maxStep: {}, frames: 0, guard: {}, pushSeen: new WeakSet(), lastPush: {} }
  const figures = () => {
    const out = []
    window.__scene.traverse((o) => {
      const u = o.userData
      if (!u) return
      // (a customer's group: theirs alone has `guest` (not `shown` as well: React hands the group a new userData each time the bar's drawn
      // again, `shown` back only at the next frame, and a customer missed in that look was put against where they'd been two looks back,
      // a leap of two or three frames' walk: the second day's audit's 0.6-0.94 at x2)
      if (u.guest !== undefined) out.push(['guest' + u.guest, o])
      else if (u.staffId !== undefined) out.push(['staff:' + u.staffId, o])
      else if (o.name === 'BossFollow' || o.name === 'plater-walker' || o.name === 'stocker-walker') out.push([o.name, o])
      // (those waiting on the benches by the genkan)
      else if (o.name.startsWith('bench-sitter-')) out.push(['bench' + o.name.slice(13), o])
    })
    // (and the takeaway customers and riders: their groups have no name, only GuestBar3D's own list)
    for (const [id, o] of window.__visitorObjs?.current ?? []) out.push(['takeout' + id, o])
    return out
  }
  const v = new T.Vector3()
  let prevT = performance.now()
  // (the scene's own frames between two of ours: how many, the biggest step it was handed)
  const R = { calls: 0, maxDelta: 0 }
  window.__r3f().internal.subscribe({ current: (_st, delta) => { R.calls++; R.maxDelta = Math.max(R.maxDelta, delta) } }, 0, { getState: window.__r3f })
  const clock = () => { const c = window.__clock?.get?.(); return c ? `${String(Math.floor(c.minute / 60) % 24).padStart(2, '0')}:${String(Math.floor(c.minute % 60)).padStart(2, '0')}` : '' }
  const plain = (u) => Object.fromEntries(Object.entries(u).filter(([, b]) => b === null || ['string', 'number', 'boolean'].includes(typeof b)).slice(0, 10))
  const phaseOf = (o, k) => {
    // (the plater off their place: what they're about, how far along, the way they're on (GuestBar3D's platerRun))
    if (k === 'plater-walker') { const r = window.__platerRun?.current; return r ? `${r.phase} t${(+r.t).toFixed(2)} len${(+r.len).toFixed(2)} path${r.path.length}:${r.path.map((q) => q.x.toFixed(2) + ',' + q.z.toFixed(2)).join(' ')}` : null }
    if (k?.startsWith('takeout')) { const v = window.__visitors?.current?.get(+k.slice(7)); return v ? `${v.rider ? 'rider' : 'takeout'} ${v.phase} t${(+v.t).toFixed(2)}` : null }
    const id = o.userData.guest
    const s = id !== undefined ? (window.__shown?.current ?? []).find((x) => x.id === id) : null
    return s ? `${s.phase} t${typeof s.t === 'number' ? s.t.toFixed(2) : s.t} seat${s.seat}` : null
  }
  const tick = () => {
    const now = performance.now(), dt = now - prevT
    prevT = now
    A.frames++
    for (const [k, o] of figures()) {
      // (one just put in the scene and not yet stood anywhere (its group at its parent's origin till the next frame places it): not looked
      // at, else it leapt from there to the door the frame after)
      if (o.position.x === 0 && o.position.y === 0 && o.position.z === 0) { A.seen.delete(k); continue }
      let vis = true
      for (let q = o; q; q = q.parent) if (!q.visible) { vis = false; break }
      // (where it was drawn: its world matrix as the last render left it, nothing updated from here)
      v.setFromMatrixPosition(o.matrixWorld)
      const prev = A.seen.get(k)
      // (and only against the look before this one: one missed in it isn't put against an older place)
      if (prev && prev.vis && vis && dt < 250 && prev.o === o && prev.n === A.frames - 1) {
        const d = Math.hypot(v.x - prev.x, v.z - prev.z), dy = Math.abs(v.y - prev.y)
        const kind = k.replace(/[0-9]+$/, '').replace(/:.*/, '')
        A.maxStep[kind] = Math.max(A.maxStep[kind] ?? 0, d)
        if (d > JUMP || dy > JUMP * 0.5) {
          let role = null
          o.traverse((m) => { if (m.userData?.staffRole && !role) role = m.userData.staffRole })
          A.jumps.push({ k, at: clock(), d: +d.toFixed(2), dy: +dy.toFixed(2), dt: Math.round(dt), role,
            from: [prev.x, prev.y, prev.z].map((n) => +n.toFixed(2)), to: [v.x, v.y, v.z].map((n) => +n.toFixed(2)),
            phase: phaseOf(o, k), prevPhase: prev.phase, waiters: (window.__waiters?.current ?? []).map((w) => `${w.phase} t${(+w.t).toFixed(2)}`).join(', '),
            frames: `${R.calls}x${R.maxDelta.toFixed(3)}`, ud: plain(o.userData) })
        }
      }
      A.seen.set(k, { x: v.x, y: v.y, z: v.z, vis, o, phase: phaseOf(o, k), n: A.frames })
    }
    // (the cook table's guard: each push it's logged since the last look, by who; a flip when where it put them moved more than GUARD_LEAP
    // from where it had put them the frame before)
    for (const e of window.__hearthPushes ?? []) {
      if (A.pushSeen.has(e)) continue
      A.pushSeen.add(e)
      const job = jobOf(e.who)
      const g = A.guard[`${e.who} (${e.role}${job ? `, ${job}` : ''})`] ??= { n: 0, most: 0, flips: 0, first: clock(), last: '' }
      g.n++
      g.most = Math.max(g.most, Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]))
      g.last = clock()
      const l = A.lastPush[e.who]
      if (l && l.f === A.frames - 1 && Math.hypot(e.to[0] - l.to[0], e.to[1] - l.to[1]) > GUARD_LEAP) g.flips++
      A.lastPush[e.who] = { f: A.frames, to: e.to }
    }
    R.calls = 0; R.maxDelta = 0
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  const noticeEl = document.querySelector('.notice')
  if (noticeEl) new MutationObserver(() => { const t = noticeEl.textContent?.trim(); if (t && noticeEl.classList.contains('is-shown') && A.notices.at(-1)?.t !== t) A.notices.push({ at: clock(), t }) })
    .observe(noticeEl, { childList: true, characterData: true, subtree: true, attributes: true })
  const seenLines = new WeakSet()
  setInterval(() => {
    for (const li of document.querySelectorAll('.ai-chat .ai-line')) if (!seenLines.has(li)) { seenLines.add(li); A.chat.push({ at: clock(), t: li.textContent }) }
  }, 500)
}, +(process.env.JUMP ?? 0.6))
// (a walk's frame at x2 is up to about 0.3: the guard's place for someone moving more than this in a frame is a leap)
const GUARD_LEAP = 0.45
// (the overview: view 1)
await p.keyboard.press('1')
const END = +(process.env.END ?? 5 * 60 + 25), LIMIT = +(process.env.LIMIT ?? 12 * 60000), SHOT = +(process.env.SHOT ?? 60000)
const t0 = Date.now()
let n = 0, lastShot = 0
for (;;) {
  await p.waitForTimeout(2000)
  const c = await p.evaluate(() => window.__clock?.get?.())
  const m = c ? c.minute : 0
  if (SHOT > 0 && Date.now() - lastShot > SHOT) {
    lastShot = Date.now()
    await p.mouse.move(5, 880)
    await p.screenshot({ path: `${process.env.OUT ?? 'dayaudit'}-${String(n++).padStart(2, '0')}.png` })
  }
  // (past midnight the clock runs on from 1440, or starts again at 0: stopped either way once it's past END in the morning)
  const after = m >= 24 * 60 ? m - 24 * 60 : m < 12 * 60 ? m : -1
  if (after >= END || Date.now() - t0 > LIMIT) break
}
const A = await p.evaluate(() => { const a = window.__audit; return { jumps: a.jumps, notices: a.notices, chat: a.chat, maxStep: a.maxStep, frames: a.frames, guard: a.guard } })
fs.writeFileSync(process.env.JSON ?? 'dayaudit.json', JSON.stringify(A, null, 1))
console.log(`${A.frames} frames; the most a figure moved in one, by kind: ${JSON.stringify(Object.fromEntries(Object.entries(A.maxStep).map(([k, d]) => [k, +d.toFixed(2)])))}`)
console.log(`${A.jumps.length} jumps (over ${process.env.JUMP ?? 0.6} across, or half that up or down, in a frame)`)
for (const j of A.jumps) console.log(`  ${j.at} ${j.k}${j.role ? ` (${j.role})` : ''} ${j.d} across ${j.dy} up/down: ${j.from.join(',')} -> ${j.to.join(',')} | ${j.prevPhase ?? ''} => ${j.phase ?? ''} | servers ${j.waiters} | scene ${j.frames}`)
const guard = Object.entries(A.guard).sort((a, b) => b[1].n - a[1].n)
console.log(`${guard.reduce((t, [, g]) => t + g.n, 0)} pushes out of the cook table (who, how many, the farthest, flips over ${GUARD_LEAP}, first and last seen):`)
for (const [k, g] of guard) console.log(`  ${k}: ${g.n}, most ${g.most.toFixed(2)}, flips ${g.flips}, ${g.first}-${g.last}`)
console.log(`${A.notices.length} notices`)
for (const x of A.notices) console.log(`  ${x.at} ${x.t}`)
console.log(`${A.chat.length} lines in the day's log (all in ${process.env.JSON ?? 'dayaudit.json'})`)
await browser.close()
