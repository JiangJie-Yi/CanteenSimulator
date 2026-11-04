// How heavy the game is to draw, on this machine's own GPU (headless Chrome through ANGLE's Direct3D 11, not the software GL the other
// tests use): frames a second, the slow frames, draw calls and triangles a frame, and the renderer's own time a frame.
//
//   npm run dev          (in another terminal)
//   node tests/e2e/perf.mjs [free|grill]     the overview (default) or the grill's view
//     OPEN=<ms>   set up and open the shop first (every job hired) and let the customers come in that long
//     BY=1        the draw calls a frame, piece by piece (Movable id, staff, customers, else the top named group)
//     SUBS=1      each frame callback's own time
//     PROF=1      a CPU profile: the functions that take the most time, and the game's own code with all it calls
//     WHO=1       who calls the renderer (a pass into a render target shows up here)
//     DSF=<n>     the screen's pixel ratio (default 1); Q=<tier> a quality tier
// The page is opened with ?pace=0, so the frame pacer doesn't step the drawing down while it's measured.
import { chromium } from 'playwright-core'
const URL = 'http://localhost:5173/JapaneseGrillSimulator/?pace=0' + (process.env.Q ? `&q=${process.env.Q}` : '')
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx0 = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: +(process.env.DSF ?? 1) })
const p = await ctx0.newPage()
const logs = []
p.on('console', (m) => { const t = m.text(); if (/pacer/.test(t)) logs.push(t) })
p.on('pageerror', (e) => logs.push('ERR ' + e.message))
await p.goto(URL, { timeout: 60000 })
await p.waitForTimeout(5000)
if (await p.locator('.welcome-go').count()) await p.locator('.welcome-go').click()
await p.waitForTimeout(15000)
if (process.env.OPEN) {
  // (set up and open the shop as the e2e does, every job hired, and let the customers come in a while)
  await p.locator('.view-reset').click({ timeout: 45000 })
  await p.locator('.view-menu button', { hasText: '火烤灶台' }).first().click()
  await p.locator('.fridge-toggle').waitFor({ timeout: 45000 })
  await p.locator('.fridge-toggle').click({ timeout: 60000 })
  await p.waitForTimeout(500)
  await p.locator('.tally-restock.is-full').click()
  await p.locator('.fridge-toggle').click()
  await p.locator('.money-chip').click()
  await p.waitForTimeout(200)
  await p.locator('.ofc-tabs button').nth(1).click()
  await p.waitForTimeout(200)
  for (let r = 0; r < 6; r++) { const hire = p.locator('.ofc-role').nth(r).locator('.ofc-person:not(.is-hired) button').first(); if (await hire.count()) await hire.click().catch(() => {}); await p.waitForTimeout(100) }
  await p.locator('.ofc-tabs button').nth(2).click()
  await p.waitForTimeout(200)
  await p.locator('.nb-views button').nth(2).click()
  await p.locator('.nb-chef-acts button').nth(0).click()
  await p.waitForTimeout(900)
  await p.locator('.nb-views button').nth(0).click()
  const publish = p.locator('.nb-embedded .nb-publish button:not(.nb-off)')
  for (let guard = 0; guard < 60 && (await publish.count()); guard++) { await publish.first().click(); await p.waitForTimeout(50) }
  await p.locator('.office .panel-x').click()
  await p.locator('.ai-toggle').click()
  await p.waitForTimeout(+process.env.OPEN)
  // (SHOTS=<prefix>: views 3 and 4 (the till and the doorway) and the overview shot while open, to see the customers' things)
  // (BITS=<prefix>: the customers' shoes and soy dishes (SeatBits' instanced meshes): how many, and a close shot over the shoes and over a soy dish)
  if (process.env.BITS) {
    const info = await p.evaluate(() => {
      const out = []
      window.__scene.traverse((o) => { if (o.isInstancedMesh && o.count > 0 && o.count <= 24 && !o.userData?.batchPart) { const v = new o.position.constructor(), M = new o.matrix.constructor(); o.getMatrixAt(0, M); v.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld); out.push({ geo: o.geometry.type, r: o.geometry.parameters?.radius, count: o.count, first: v.toArray().map((x) => +x.toFixed(2)) }) } })
      return out
    })
    console.log(JSON.stringify(info))
    console.log('SOY', JSON.stringify(await p.evaluate(() => { let o = null; window.__scene.traverse((x) => { if (x.isInstancedMesh && x.geometry.type === 'CircleGeometry' && x.geometry.parameters.radius === 0.03) o = x }); if (!o) return null; let v = true; for (let a = o; a; a = a.parent) if (!a.visible) v = false; const M = new o.matrix.constructor(); o.getMatrixAt(0, M); return { vis: v, count: o.count, mat: o.material.type, col: o.material.color.getHexString(), side: o.material.side, m: M.elements.map((x) => +x.toFixed(3)), parent: o.parent?.name, layers: o.layers.mask } })))
    for (const [i, q] of info.filter((x) => x.geo === 'SphereGeometry' || x.geo === 'CircleGeometry').entries()) {
      await p.evaluate((f) => { window.__freeCam = true; window.__ctl.target.set(...f); window.__cam.position.set(f[0] + 0.01, f[1] + 0.9, f[2]); window.__ctl.update() }, q.first)
      await p.waitForTimeout(1200)
      await p.screenshot({ path: `${process.env.BITS}-${i}.png`, clip: { x: 300, y: 300, width: 640, height: 480 } })
    }
  }
  if (process.env.SHOTS) {
    for (const k of ['4', '3', '1']) { await p.keyboard.press(k); await p.waitForTimeout(2500); await p.screenshot({ path: `${process.env.SHOTS}-${k}.png` }) }
  }
  await p.locator('.view-reset').click()
  await p.locator('.view-menu button', { hasText: '自由' }).first().click()
  await p.waitForTimeout(3000)
}
const view = process.argv[2] ?? 'free'
if (view !== 'free') {
  await p.locator('.view-reset').click()
  await p.locator('.view-menu button', { hasText: view === 'grill' ? '火烤灶台' : view }).first().click()
  await p.waitForTimeout(4000)
}
let cdp = null
if (process.env.PROF) { cdp = await ctx0.newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start') }
const r = await p.evaluate(async (subs) => {
  const people = window.__guestGroups?.current?.size ?? 0
  const gl = window.__gl, sc = window.__scene
  const st = window.__r3f()
  // (each frame callback timed, by its source's first line)
  const times = new Map()
  const undo = []
  if (subs) for (const s of st.internal.subscribers) {
    const f = s.ref.current, key = f.toString().slice(0, 90).replace(/\s+/g, ' ')
    s.ref.current = (...a) => { const t = performance.now(); const r = f(...a); times.set(key, (times.get(key) ?? 0) + performance.now() - t); return r }
    undo.push(() => { s.ref.current = f })
  }
  let calls = 0, tris = 0, renders = 0, renderMs = 0
  const orig = gl.render.bind(gl)
  gl.info.autoReset = false
  gl.render = (s, c) => { gl.info.reset(); const t = performance.now(); orig(s, c); renderMs += performance.now() - t; calls += gl.info.render.calls; tris += gl.info.render.triangles; renders++ }
  const frames = []
  let last = performance.now()
  await new Promise((res) => {
    const end = last + 6000
    const tick = (t) => { frames.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else res() }
    requestAnimationFrame(tick)
  })
  gl.render = orig
  for (const u of undo) u()
  const n = Math.max(1, renders)
  frames.sort((a, b) => a - b)
  return { people, rendersPerSec: +(renders / 6).toFixed(1), rafPerSec: +(frames.length / 6).toFixed(1), median: +frames[frames.length >> 1].toFixed(1), p95: +frames[Math.floor(frames.length * 0.95)].toFixed(1), worst: +frames[frames.length - 1].toFixed(1),
    callsPerFrame: Math.round(calls / n), trisPerFrame: Math.round(tris / n), renderCpuMsPerFrame: +(renderMs / n).toFixed(2),
    dpr: gl.getPixelRatio(), size: [gl.domElement.width, gl.domElement.height],
    subs: [...times.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${(v / n).toFixed(2)}ms ${k}`) }
}, !!process.env.SUBS)
console.log(JSON.stringify(r, null, 1))
if (cdp) {
  const { profile } = await cdp.send('Profiler.stop')
  const byId = new Map(); for (const n of profile.nodes) byId.set(n.id, n)
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const self = new Map(), incl = new Map()
  let total = 0
  for (let i = 0; i < profile.samples.length; i++) {
    const d = profile.timeDeltas[i] ?? 0; total += d
    const f = byId.get(profile.samples[i]).callFrame
    const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber}`
    self.set(k, (self.get(k) ?? 0) + d)
    const seen = new Set()
    for (let id = profile.samples[i]; id; id = parent.get(id)) {
      const g = byId.get(id).callFrame
      if (!g.url.includes('/src/')) continue
      const kk = `${g.functionName || '(anon)'} ${g.url.split('/src/').pop().split('?')[0]}:${g.lineNumber}`
      if (seen.has(kk)) continue
      seen.add(kk); incl.set(kk, (incl.get(kk) ?? 0) + d)
    }
  }
  console.log('-- self'); for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(((v / total) * 100).toFixed(1) + '%', k)
  console.log('-- game code'); for (const [k, v] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(((v / total) * 100).toFixed(1) + '%', k)
}
if (process.env.BY) console.log(await p.evaluate(async () => {
  const gl = window.__gl, sc = window.__scene, by = {}
  const pieceOf = (o) => { for (let q = o; q; q = q.parent) { if (q.userData?.editId) return q.userData.editId; if (q.userData?.staffRole) return 'staff:' + q.userData.staffRole } ; const g = window.__guestGroups?.current; if (g) for (const [id, grp] of g) { for (let q = o; q; q = q.parent) if (q === grp) return 'guest' } ; let q = o, path = []; while (q && q !== sc) { if (q.name) path.unshift(q.name); q = q.parent } return path.slice(0, 2).join('/') || '(' + (o.geometry?.type ?? o.type) + ')' }
  const orig = gl.renderBufferDirect.bind(gl); let n = 0
  gl.renderBufferDirect = (camera, scene, geometry, material, object, group) => { if (scene) { const k = pieceOf(object); by[k] = (by[k] ?? 0) + 1 } return orig(camera, scene, geometry, material, object, group) }
  await new Promise((res) => { const tick = () => { if (++n > 10) res(); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
  gl.renderBufferDirect = orig
  return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => (v / 10).toFixed(0) + ' ' + k).join(String.fromCharCode(10))
}))
if (process.env.WHO) console.log(await p.evaluate(async () => {
  const gl = window.__gl, seen = new Map(), orig = gl.render.bind(gl)
  gl.render = (s, c) => {
    const st = new Error().stack.split('\n').slice(2, 7).map((l) => l.trim().split('/').pop()).join(' < ')
    const k = (gl.getRenderTarget() ? 'RT ' : 'screen ') + (s === window.__scene ? 'main' : s.type) + ' ' + c.type + ' | ' + st
    seen.set(k, (seen.get(k) ?? 0) + 1)
    return orig(s, c)
  }
  await new Promise((r) => setTimeout(r, 1500)); gl.render = orig
  return [...seen.entries()].map(([k, v]) => v + 'x ' + k).join('\n')
}))
console.log(logs.join('\n'))
await b.close()
