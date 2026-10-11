// The whole game played through in a browser, shop by shop: open the shop, buy stock on the board, hire the
// second chef, have him try dishes out, put them all on the menu, open for business, and let customers come in.
// Each shop is played from a fresh save (the starting capital opens one shop, not all four). Any page error, or a
// step that doesn't do what it should, fails the run.
//
//   npm run dev          (in another terminal)
//   npm run e2e          (or: node tests/e2e/flow.mjs [url] [shop...])
//
// Uses the installed Chrome (playwright-core), headless, with software WebGL.
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:5173/CanteenSimulator/'
const SHOPS = ['hotpot', 'beefnoodle', 'grilledfish', 'bakery'] // (the order of the dots)
const ONLY = process.argv.slice(3)
const OPEN_FOR = Number(process.env.OPEN_FOR ?? 40000)

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
const failures = []
const check = (shop, what, ok, got) => {
  console.log(`${ok ? '✓' : '✗'} ${shop}: ${what}${got !== undefined ? ` (${got})` : ''}`)
  if (!ok) failures.push(`${shop}: ${what}`)
}

for (const [i, shop] of SHOPS.entries()) {
  if (ONLY.length && !ONLY.includes(shop)) continue
  // (a new context: an empty localStorage, so a new game)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => errors.push(`${shop}: ${e.message}`))
  const cash = async () => Number((await page.locator('.office-toggle b').innerText()).replace(/[^\d-]/g, ''))
  try {
    await page.goto(URL)
    await page.waitForTimeout(5000)
    await page.locator('.welcome-go').click()
    await page.waitForTimeout(800)
    await page.locator('button.dot').nth(i).click()
    await page.waitForTimeout(2500)
    if (await page.locator('.unopened-hint').count()) {
      await page.locator('.unopened-hint').click()
      await page.locator('.welcome-go').click()
      await page.waitForTimeout(1500)
    }
    check(shop, 'shop set up', (await page.locator('.unopened-hint').count()) === 0)
    // buy in stock on the board
    const before = await cash()
    await page.locator('.tally-buyall').click()
    await page.waitForTimeout(200)
    check(shop, 'buying stock costs money', (await cash()) < before, `${before} -> ${await cash()}`)
    // hire the second chef, and have him try dishes out until there are enough for the menu
    await page.locator('.office-toggle').click()
    await page.waitForTimeout(200)
    await page.locator('.ofc-tabs button').nth(1).click()
    await page.waitForTimeout(200)
    const hire = page.locator('.ofc-role').nth(0).locator('.ofc-person:not(.is-hired) button').first()
    if (await hire.count()) await hire.click()
    await page.locator('.ofc-tabs button').nth(0).click()
    await page.waitForTimeout(200)
    for (let k = 0; k < 4; k++) {
      await page.locator('.nb-chef-acts button').nth(1).click()
      await page.waitForTimeout(300)
    }
    const publish = page.locator('.nb-embedded .nb-publish button:not(.nb-off)')
    for (let guard = 0; guard < 60 && (await publish.count()); guard++) {
      await publish.first().click()
      await page.waitForTimeout(50)
    }
    await page.locator('.ofc-close').click()
    // open for business
    await page.locator('.ai-toggle').click()
    await page.waitForTimeout(500)
    check(shop, 'opens for business (enough dishes on the menu)', (await page.locator('.ai-toggle.is-on').count()) === 1)
    const tags = await page.locator('.menu .strip').count()
    check(shop, 'menu board shows the menu', tags >= 8, `${tags} dishes`)
    // (the cash goes up when a customer pays; fuel and wages only take it down)
    const open = await cash()
    let best = open
    for (let t = 0; t < OPEN_FOR; t += 500) {
      await page.waitForTimeout(500)
      best = Math.max(best, await cash())
    }
    check(shop, 'customers come in and pay', best > open, `${open} -> ${best}`)
  } catch (e) {
    failures.push(`${shop} stopped: ${e.message.split('\n')[0]}`)
  }
  await ctx.close()
}
for (const e of errors) failures.push('page error: ' + e)
await browser.close()
console.log(failures.length ? `\n${failures.length} failed:\n- ${failures.join('\n- ')}` : '\nall passed')
process.exit(failures.length ? 1 : 0)
