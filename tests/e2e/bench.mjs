// Performance benchmark (`npm run bench`, the dev server running): a fresh page on this machine's own GPU (headless Chrome, ANGLE D3D11).
// 1. Still: the overview once it has settled: draw calls, triangles, geometries, textures, shader programs, the JS heap after a collection.
// 2. A sweep: views 1 to 9 and 0 (the owner) in turn, HOLD ms on each (default 1000, after the 0.9 s flight), the room's lights off and on
//    again, developer mode in and out (the character viewer with it); every frame's time recorded: average fps, the 1% low, the worst frame,
//    and the heap before and after (it shouldn't keep growing).
// Writes a Markdown table (OUT=<file>, default bench.md) and the numbers as JSON beside it; BEFORE=<an earlier run's .json> puts that run in a
// column of its own, with the change. BASE=<url> (default the dev server; `npx vite preview` at http://localhost:4173/JapaneseGrillSimulator/
// measures the build, without the dev-only hooks: the lights and the counts the page gives (__gl) are then skipped where they're missing).
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5173/JapaneseGrillSimulator/'
const HOLD = Number(process.env.HOLD ?? 1000)
const OUT = process.env.OUT ?? 'bench.md'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
const cdp = await page.context().newCDPSession(page)
await page.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'pace=0', { timeout: 120000 })
await page.waitForFunction(() => window.__scene && !document.querySelector('.loading-screen'), null, { timeout: 180000 }).catch(() => {})
await page.waitForTimeout(6000)

const heap = async () => {
  await cdp.send('HeapProfiler.collectGarbage')
  return page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576))
}
// (the renderer's counts over one whole frame: three resets them each frame, so they're read in the next one's callback)
// (over six frames: the shadow map is redrawn only every third (ShadowPacer), so a frame's counts are with or without it; the least is the
// picture alone, the most with the shadows)
const still = async () => {
  const s = await page.evaluate(() => new Promise((done) => {
    const gl = window.__gl
    if (!gl) return done(null)
    const seen = []
    const read = () => {
      seen.push({ draws: gl.info.render.calls, tris: gl.info.render.triangles })
      if (seen.length < 7) requestAnimationFrame(read)
      else {
        const f = seen.slice(1)
        done({ draws: Math.min(...f.map((x) => x.draws)), drawsShadow: Math.max(...f.map((x) => x.draws)), tris: Math.min(...f.map((x) => x.tris)),
          trisShadow: Math.max(...f.map((x) => x.tris)), geo: gl.info.memory.geometries, tex: gl.info.memory.textures, prog: gl.info.programs?.length ?? 0 })
      }
    }
    requestAnimationFrame(read)
  }))
  return { ...(s ?? {}), heap: await heap() }
}

const settled = await still()

// ---- the sweep: every frame's time from the page's own clock while it runs
await page.evaluate(() => {
  window.__benchFrames = []
  let last = performance.now()
  window.__benchStep = 'start'
  window.__benchSteps = []
  const tick = (t) => { window.__benchFrames.push(t - last); window.__benchSteps.push(window.__benchStep); last = t; if (window.__benchOn) requestAnimationFrame(tick) }
  window.__benchOn = true
  requestAnimationFrame(tick)
})
const heapBefore = await heap()
const pause = (ms) => page.waitForTimeout(ms)
const step = (name) => page.evaluate((n) => { window.__benchStep = n }, name)
await page.mouse.click(960, 1060)
for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
  await step('view ' + k)
  await page.keyboard.press(k)
  await pause(900 + HOLD)
}
await page.keyboard.press('1')
await pause(900)
const lights = await page.evaluate(() => !!window.__lights?.press)
if (lights) {
  await step('lights')
  await page.evaluate(() => window.__lights.press()); await pause(HOLD)
  await page.evaluate(() => window.__lights.press()); await pause(HOLD)
}
await step('dev mode'); await page.keyboard.press('g'); await pause(2500)
await page.keyboard.press('g'); await pause(1000)
const [frames, steps] = await page.evaluate(() => { window.__benchOn = false; return [window.__benchFrames.slice(1), window.__benchSteps.slice(1)] })
// (the slowest frames, and where in the sweep each came)
const slow = frames.map((ms, i) => ({ ms: +ms.toFixed(1), step: steps[i] })).sort((a, b) => b.ms - a.ms).slice(0, 8)
const heapAfter = await heap()
await browser.close()

const sorted = [...frames].sort((a, b) => b - a)
const worst = sorted[0] ?? 0
const slowest1 = sorted.slice(0, Math.max(1, Math.round(sorted.length / 100)))
const avgMs = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length)
// (the same, the developer mode left out: what a player meets)
const play = frames.filter((_, i) => steps[i] !== 'dev mode')
const playSorted = [...play].sort((a, b) => b - a)
const play1 = playSorted.slice(0, Math.max(1, Math.round(playSorted.length / 100)))
const sweep = {
  playLow1Fps: +(1000 / (play1.reduce((a, b) => a + b, 0) / play1.length)).toFixed(1),
  playWorstMs: +(playSorted[0] ?? 0).toFixed(1),
  frames: frames.length,
  avgFps: +(1000 / avgMs).toFixed(1),
  low1Fps: +(1000 / (slowest1.reduce((a, b) => a + b, 0) / slowest1.length)).toFixed(1),
  worstMs: +worst.toFixed(1),
  heapBefore, heapAfter, heapDelta: heapAfter - heapBefore,
  lights,
  slowest: slow,
}
const run = { at: new Date().toISOString(), base: BASE, still: settled, sweep }
fs.writeFileSync(OUT.replace(/\.md$/, '') + '.json', JSON.stringify(run, null, 1))

// ---- the table
const before = process.env.BEFORE ? JSON.parse(fs.readFileSync(process.env.BEFORE, 'utf8')) : null
const rows = [
  ['Draw calls（總覽，畫面）', (r) => r.still.draws],
  ['Draw calls（含陰影那一格）', (r) => r.still.drawsShadow],
  ['Triangles（總覽，畫面）', (r) => r.still.tris],
  ['Triangles（含陰影那一格）', (r) => r.still.trisShadow],
  ['Geometries', (r) => r.still.geo],
  ['Textures', (r) => r.still.tex],
  ['Shader programs', (r) => r.still.prog],
  ['JS heap（回收後，MB）', (r) => r.still.heap],
  ['巡航平均 FPS', (r) => r.sweep.avgFps],
  ['巡航 1% Low FPS', (r) => r.sweep.low1Fps],
  ['巡航最差一格（ms）', (r) => r.sweep.worstMs],
  ['1% Low FPS（不含開發者模式）', (r) => r.sweep.playLow1Fps],
  ['最差一格（不含開發者模式，ms）', (r) => r.sweep.playWorstMs],
  ['巡航前後 heap 差（MB）', (r) => r.sweep.heapDelta],
]
const fmt = (v) => (v === undefined || v === null ? '—' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v))
const lines = before
  ? ['| 指標 | 之前 | 現在 | 變化 |', '|---|---:|---:|---:|', ...rows.map(([n, f]) => {
    const a = f(before), b = f(run)
    const d = typeof a === 'number' && typeof b === 'number' ? (b - a > 0 ? '+' : '') + (+(b - a).toFixed(1)).toLocaleString('en-US') : ''
    return `| ${n} | ${fmt(a)} | ${fmt(b)} | ${d} |`
  })]
  : ['| 指標 | 數值 |', '|---|---:|', ...rows.map(([n, f]) => `| ${n} | ${fmt(f(run))} |`)]
const md = [`性能測試 ${run.at}（${BASE}，1920×1080，${sweep.frames} 格${lights ? '' : '，沒有開關燈：正式版沒有 __lights'}）`, '', ...lines, ''].join('\n')
fs.writeFileSync(OUT, md)
console.log(md)
console.log('slowest frames:', slow.map((x) => `${x.ms} ms (${x.step})`).join(', '))
