// A long soak: does anything pile up the longer the shop stays open? Opened with every job filled at x2 (as alloc.mjs), the overview, then
// every SAMPLE ms the page's live heap after a collection, its array buffers, and the frame meter's line (FPS, frame time, worst frame,
// draw calls, triangles, GPU geometries, textures, programs), one JSON line each: every figure should hold level.
//   node tests/e2e/soak.mjs        (MINUTES=<n> default 20, SAMPLE=<ms> default 60000, BASE=<origin> default the dev server)
//   BASE=http://localhost:4173 node tests/e2e/soak.mjs    (the production build, `npm run build && npx vite preview`, as players get it)
import { chromium } from 'playwright-core'
import { toOpeningHours } from './hours.mjs'

const MINUTES = +(process.env.MINUTES ?? 20), SAMPLE = +(process.env.SAMPLE ?? 60000)
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`${process.env.BASE ?? 'http://localhost:5173'}/JapaneseGrillSimulator/?pace=0${process.env.Q ? '&' + process.env.Q : ''}`, { timeout: 60000 })
await p.waitForTimeout(5000)
if (await p.locator('.welcome-go').count()) await p.locator('.welcome-go').click()
await p.waitForTimeout(2500)
await p.locator('.view-reset').click({ timeout: 45000 })
await p.locator('.view-menu button', { hasText: '火烤灶台' }).first().click()
await p.locator('.fridge-toggle').waitFor({ timeout: 45000 })
await p.locator('.fridge-toggle').click({ timeout: 60000 })
await p.waitForTimeout(500)
await p.locator('.tally-restock.is-full').click()
await p.locator('.fridge-toggle').click()
await p.locator('.money-chip').click()
await p.waitForTimeout(300)
await p.locator('.ofc-tabs button').nth(1).click()
await p.waitForTimeout(200)
await p.locator('.ofc-hireall').click()
await p.waitForTimeout(300)
await p.locator('.ofc-tabs button').nth(2).click()
await p.waitForTimeout(200)
await p.locator('.nb-views button').nth(2).click()
await p.locator('.nb-chef-acts button').nth(0).click()
await p.waitForTimeout(900)
await p.locator('.nb-views button').nth(0).click()
const publish = p.locator('.nb-embedded .nb-publish button:not(.nb-off)')
for (let guard = 0; guard < 60 && (await publish.count()); guard++) { await publish.first().click(); await p.waitForTimeout(50) }
await p.locator('.office .panel-x').click()
// (only in the shop's hours, 16:30 to 04:30: the clock moved on to them)
await toOpeningHours(p)
await p.locator('.ai-toggle').click()
await p.locator('.speed-toggle').click()
await p.locator('.view-reset').click()
await p.locator('.view-menu button', { hasText: '自由' }).first().click()
const cdp = await ctx.newCDPSession(p)
const t0 = Date.now()
while (Date.now() - t0 < MINUTES * 60000) {
  await p.waitForTimeout(SAMPLE)
  const meter = await p.evaluate(() => [...document.body.children].map((d) => d.textContent ?? '').find((t) => t.startsWith('FPS')) ?? '')
  await cdp.send('HeapProfiler.collectGarbage')
  const u = await cdp.send('Runtime.getHeapUsage')
  const num = (re) => { const m = meter.match(re); return m ? +m[1].replace(/,/g, '') : null }
  console.log(JSON.stringify({ t: Math.round((Date.now() - t0) / 1000), heap: Math.round(u.usedSize / 1e6), buffers: Math.round((u.backingStorageSize ?? 0) / 1e6),
    fps: num(/FPS (\d+)/), frame: num(/Frame ([\d.]+)/), worst: num(/worst ([\d.]+)/), calls: num(/Draw calls ([\d,]+)/), tris: num(/Tris ([\d,]+)/),
    geo: num(/Geo (\d+)/), tex: num(/Tex (\d+)/), prog: num(/Prog (\d+)/), dom: await p.evaluate(() => document.getElementsByTagName('*').length) }))
}
await b.close()
