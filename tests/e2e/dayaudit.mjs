// A whole day watched (the owner's, 2026-11-13: "flows and animations"): the shop opened at x2 and left to run itself from AT through closing
// till the staff have gone home (END, the next morning), and meanwhile, every frame:
//   - every figure's place (customers, staff, the owner): one that moves further in a frame than a walk could (JUMP, the world's units) or
//     up or down in one (a step's more than half of it) noted with what it was doing: a customer's phase (GuestBar3D's shown), a staff
//     member's role, every server's phase, how many frames the scene ran in it;
//   - every notice put up (the bar along the bottom), and every line of the day's log, with the shop's clock.
// The figures are gathered afresh every frame (gathered once a second, React handing a customer's group on to the next customer read as a
// leap from one to the other: item 32's first day of "teleports" was that). An overview shot every SHOT ms (0: none).
//
//   npm run dev     (in another terminal)
//   node tests/e2e/dayaudit.mjs        (AT=<min> opening, 995 = 16:35; END=<min after midnight> 325 = 05:25; LIMIT=<ms>; JUMP; SHOT=<ms>;
//                                        OUT=<shot prefix>; JSON=<file>, default dayaudit.json)
// About 7 minutes for a whole day. Each jump's printed; what it means: a server's way back given the wrong way round (item 36), a seat sat
// on in a frame (37), a step's height twice (42).
import fs from 'node:fs'
import { boot, openShop } from './shop.mjs'
const { browser, page: p } = await boot({ width: 1600, height: 900 })
await openShop(p, { x2: true, at: +(process.env.AT ?? 16 * 60 + 35) })
await p.evaluate((JUMP) => {
  const T = window.__THREE
  const A = window.__audit = { jumps: [], notices: [], chat: [], seen: new Map(), maxStep: {}, frames: 0 }
  const figures = () => {
    const out = []
    window.__scene.traverse((o) => {
      const u = o.userData
      if (!u) return
      if (u.guest !== undefined && u.shown !== undefined) out.push(['guest' + u.guest, o])
      else if (u.staffId !== undefined) out.push(['staff:' + u.staffId, o])
      else if (o.name === 'BossFollow' || o.name === 'plater-walker' || o.name === 'stocker-walker') out.push([o.name, o])
    })
    return out
  }
  const v = new T.Vector3()
  let prevT = performance.now()
  // (the scene's own frames between two of ours: how many, the biggest step it was handed)
  const R = { calls: 0, maxDelta: 0 }
  window.__r3f().internal.subscribe({ current: (_st, delta) => { R.calls++; R.maxDelta = Math.max(R.maxDelta, delta) } }, 0, { getState: window.__r3f })
  const clock = () => { const c = window.__clock?.get?.(); return c ? `${String(Math.floor(c.minute / 60) % 24).padStart(2, '0')}:${String(Math.floor(c.minute % 60)).padStart(2, '0')}` : '' }
  const plain = (u) => Object.fromEntries(Object.entries(u).filter(([, b]) => b === null || ['string', 'number', 'boolean'].includes(typeof b)).slice(0, 10))
  const phaseOf = (o) => {
    const id = o.userData.guest
    const s = id !== undefined ? (window.__shown?.current ?? []).find((x) => x.id === id) : null
    return s ? `${s.phase} t${typeof s.t === 'number' ? s.t.toFixed(2) : s.t} seat${s.seat}` : null
  }
  const tick = () => {
    const now = performance.now(), dt = now - prevT
    prevT = now
    A.frames++
    for (const [k, o] of figures()) {
      let vis = true
      for (let q = o; q; q = q.parent) if (!q.visible) { vis = false; break }
      // (where it was drawn: its world matrix as the last render left it, nothing updated from here)
      v.setFromMatrixPosition(o.matrixWorld)
      const prev = A.seen.get(k)
      if (prev && prev.vis && vis && dt < 250 && prev.o === o) {
        const d = Math.hypot(v.x - prev.x, v.z - prev.z), dy = Math.abs(v.y - prev.y)
        const kind = k.replace(/[0-9]+$/, '').replace(/:.*/, '')
        A.maxStep[kind] = Math.max(A.maxStep[kind] ?? 0, d)
        if (d > JUMP || dy > JUMP * 0.5) {
          let role = null
          o.traverse((m) => { if (m.userData?.staffRole && !role) role = m.userData.staffRole })
          A.jumps.push({ k, at: clock(), d: +d.toFixed(2), dy: +dy.toFixed(2), dt: Math.round(dt), role,
            from: [prev.x, prev.y, prev.z].map((n) => +n.toFixed(2)), to: [v.x, v.y, v.z].map((n) => +n.toFixed(2)),
            phase: phaseOf(o), prevPhase: prev.phase, waiters: (window.__waiters?.current ?? []).map((w) => `${w.phase} t${(+w.t).toFixed(2)}`).join(', '),
            frames: `${R.calls}x${R.maxDelta.toFixed(3)}`, ud: plain(o.userData) })
        }
      }
      A.seen.set(k, { x: v.x, y: v.y, z: v.z, vis, o, phase: phaseOf(o) })
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
const A = await p.evaluate(() => { const a = window.__audit; return { jumps: a.jumps, notices: a.notices, chat: a.chat, maxStep: a.maxStep, frames: a.frames } })
fs.writeFileSync(process.env.JSON ?? 'dayaudit.json', JSON.stringify(A, null, 1))
console.log(`${A.frames} frames; the most a figure moved in one, by kind: ${JSON.stringify(Object.fromEntries(Object.entries(A.maxStep).map(([k, d]) => [k, +d.toFixed(2)])))}`)
console.log(`${A.jumps.length} jumps (over ${process.env.JUMP ?? 0.6} across, or half that up or down, in a frame)`)
for (const j of A.jumps) console.log(`  ${j.at} ${j.k}${j.role ? ` (${j.role})` : ''} ${j.d} across ${j.dy} up/down: ${j.from.join(',')} -> ${j.to.join(',')} | ${j.prevPhase ?? ''} => ${j.phase ?? ''} | servers ${j.waiters} | scene ${j.frames}`)
console.log(`${A.notices.length} notices`)
for (const x of A.notices) console.log(`  ${x.at} ${x.t}`)
console.log(`${A.chat.length} lines in the day's log (all in ${process.env.JSON ?? 'dayaudit.json'})`)
await browser.close()
