// Who allocates while the shop is open (what the garbage collector has to clear: a page that makes a lot stutters as it's collected): the
// shop opened with every job filled, its dishes on the menu, at x2, the overview; left to run WARM ms, then the heap's allocation sampler run
// for SPAN ms. Prints the rate (MB a second) and the functions that allocated most (their own allocations), with who called them.
//   node tests/e2e/alloc.mjs        (WARM=<ms> default 60000, SPAN=<ms> default 30000, TOP=<n> default 30)
//   BASE=http://localhost:4173 node tests/e2e/alloc.mjs   (the production build, `npx vite preview`: dev mode's JSX alone makes several times
//                                                           more; names there are minified)
import { chromium } from 'playwright-core'
import { toOpeningHours } from './hours.mjs'

const WARM = +(process.env.WARM ?? 60000), SPAN = +(process.env.SPAN ?? 30000)
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`${process.env.BASE ?? 'http://localhost:5173'}/JapaneseGrillSimulator/?pace=0`, { timeout: 60000 })
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
// (only in the shop's hours, 17:30 to 02:30: the clock moved on to them)
await toOpeningHours(p)
await p.locator('.ai-toggle').click()
await p.locator('.speed-toggle').click()
await p.locator('.view-reset').click()
await p.locator('.view-menu button', { hasText: '自由' }).first().click()
await p.waitForTimeout(WARM)

const cdp = await ctx.newCDPSession(p)
await cdp.send('HeapProfiler.enable')
const heap = () => p.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1e6))
console.log('heap before', await heap(), 'MB')
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
await p.waitForTimeout(SPAN)
const { profile } = await cdp.send('HeapProfiler.stopSampling')
console.log('heap after', await heap(), 'MB')
const by = new Map()
let total = 0
const walk = (n, stack) => {
  const f = n.callFrame
  const key = `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/src\//, 'src/').replace(/^.*node_modules\/\.vite\/deps\//, 'deps/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`
  const self = n.selfSize
  total += self
  if (self) {
    const e = by.get(key) ?? { self: 0, parents: new Map() }
    e.self += self
    const parent = stack.slice(-3).join(' < ')
    e.parents.set(parent, (e.parents.get(parent) ?? 0) + self)
    by.set(key, e)
  }
  for (const c of n.children) walk(c, [...stack, key.split(' ')[0] + '@' + key.split(':').slice(-1)[0]])
}
walk(profile.head, [])
const rows = [...by.entries()].sort((a, b) => b[1].self - a[1].self).slice(0, +(process.env.TOP ?? 30))
console.log(`allocated ${(total / 1e6).toFixed(0)} MB in ${SPAN / 1000}s (${(total / 1e6 / (SPAN / 1000)).toFixed(1)} MB/s)`)
for (const [k, e] of rows) {
  const top = [...e.parents.entries()].sort((a, b) => b[1] - a[1])[0]
  console.log(`${(e.self / 1e6).toFixed(1).padStart(7)} MB  ${k}\n            from ${top ? top[0] : ''}`)
}
await b.close()
