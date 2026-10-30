// A look at the people in the shop at work: set up and opened as in paths.mjs, let customers come in, then pictures close up of those at
// the bar and of the staff (OUT=<dir>, WAIT=<ms> before the pictures). For judging how they look.
//
// (setup below shared with paths.mjs) The customers' ways through the shop, checked in a browser: the shop is set up and opened as in flow.mjs, then every few tenths of a
// second each customer who's walking (in, out, to the toilet or the fridge, back) is tested where they are: nothing solid round them at
// knee and at chest height (rays out to their body's reach), and nothing under their feet but the floor. Each clash is reported once per
// customer and place, with what they walked into.
//
//   npm run dev          (in another terminal)
//   node tests/e2e/paths.mjs [url]        (WATCH=<ms> how long to watch, default 120000; SHOT=<dir> pictures of each clash)
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:5173/JapaneseGrillSimulator/'
const WATCH = Number(process.env.WATCH ?? 120000)
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
const page = await ctx.newPage()
page.setDefaultTimeout(8000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// (the game's logic at the low tier: software GL draws the high one at a frame a second, and the customers' clock runs by the frame)
await page.goto(URL + (URL.includes('?') ? '&' : '?') + (process.env.Q ? `q=${process.env.Q}` : 'q=low'), { timeout: 60000 })
await page.waitForTimeout(5000)
if (await page.locator('.welcome-go').count()) await page.locator('.welcome-go').click()
await page.waitForTimeout(2500)
await page.locator('.fridge-toggle').waitFor({ timeout: 45000 })
await page.locator('.fridge-toggle').click({ timeout: 60000 })
await page.waitForTimeout(500)
await page.locator('.tally-restock.is-full').click()
await page.locator('.fridge-toggle').click()
await page.locator('.office-toggle').click()
await page.waitForTimeout(200)
await page.locator('.ofc-tabs button').nth(1).click()
await page.waitForTimeout(200)
const hire = page.locator('.ofc-role').nth(0).locator('.ofc-person:not(.is-hired) button').first()
if (await hire.count()) await hire.click()
await page.locator('.ofc-tabs button').nth(0).click()
await page.waitForTimeout(200)
await page.locator('.nb-views button').nth(2).click()
await page.locator('.nb-chef-acts button').nth(0).click()
await page.waitForTimeout(900)
await page.locator('.nb-views button').nth(0).click()
const publish = page.locator('.nb-embedded .nb-publish button:not(.nb-off)')
for (let guard = 0; guard < 60 && (await publish.count()); guard++) { await publish.first().click(); await page.waitForTimeout(50) }
await page.locator('.ofc-close').click()
await page.locator('.ai-toggle').click()
// (thirstier and readier for the toilet than usual, so the side trips are walked while we watch)
await page.evaluate(() => { window.__drinkRate = 0.08 })


const OUT = process.env.OUT ?? '.'
// (until someone's sat down, or WAIT runs out)
for (let t = 0; t < Number(process.env.WAIT ?? 240000); t += 2000) {
  await page.waitForTimeout(2000)
  const sat = await page.evaluate(() => (window.__shown?.current ?? []).filter((s) => s.phase === 'sit').length)
  if (sat >= 3) break
}
const people = await page.evaluate(() => {
  const groups = window.__guestGroups?.current, shown = window.__shown?.current
  return (shown ?? []).filter((s) => s.phase === 'sit').map((s) => { const p = groups.get(s.id).getWorldPosition(groups.get(s.id).position.clone()); return [s.id, p.x, p.y, p.z] })
})
let n = 0
for (const [id, x, y, z] of people.slice(0, 4)) {
  for (const [ang, tag] of [[0, 'front'], [1.2, 'side']]) {
    await page.evaluate(([x, y, z, ang]) => {
      window.__freeCam = true
      const V = window.__cam.position.constructor
      const at = new V(x, y + 0.9, z)
      const toMid = new V(-x, 0, -z).normalize()
      const d = toMid.clone().applyAxisAngle(new V(0, 1, 0), ang)
      // (from the kitchen's side of the bar, looking at their face)
      window.__ctl.target.copy(at)
      window.__cam.position.copy(at).addScaledVector(d, -1.6).add(new V(0, 0.35, 0))
      window.__ctl.update()
    }, [x, y, z, ang])
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/person_${n++}_${tag}.png` })
  }
}
await browser.close()
console.log('shots', n, 'people', people.length)
