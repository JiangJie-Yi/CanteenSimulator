// The checks' shared start (in git, for dayaudit.mjs and the rest): the game booted in headless Chrome on this machine's own graphics card
// (ANGLE on D3D11: software GL is a frame a second at the full quality), past the welcome; and the shop opened the usual way: the stock
// topped up, every job hired, the menu published, the clock put at `at` (minutes after midnight), auto on, and at x2 if asked. And a busy
// evening: the day's flow made a crowd (the shop's rating's pull up, every flow's gap short), kept so every 2 s.
//
//   import { boot, openShop, rush } from './shop.mjs'
//   const { browser, page } = await boot({ width: 1600, height: 900 })
//   await openShop(page, { x2: true, at: 16 * 60 + 35 })
import { chromium } from 'playwright-core'

export async function boot({ width = 1440, height = 860, url = process.env.URL ?? 'http://localhost:5173/JapaneseGrillSimulator/?pace=0' } = {}) {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (e) => console.log('ERR', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 240)) })
  await page.goto(url, { timeout: 60000 })
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(2500)
  if (await page.locator('.welcome-go').count()) await page.locator('.welcome-go').click().catch(() => {})
  await page.waitForTimeout(800)
  if (await page.locator('.unopened-hint').count()) {
    await page.locator('.unopened-hint').click().catch(() => {})
    await page.locator('.welcome-go').click().catch(() => {})
    await page.waitForTimeout(1500)
  }
  return { browser, page }
}

export async function openShop(page, { hire = true, x2 = false, at = 17 * 60 } = {}) {
  await page.keyboard.press('2')
  await page.waitForTimeout(2000)
  await page.locator('.fridge-toggle').click()
  await page.waitForTimeout(500)
  await page.locator('.tally-restock.is-full').click().catch(() => {})
  await page.waitForTimeout(200)
  await page.locator('.fridge-toggle').click()
  await page.waitForTimeout(300)
  await page.locator('.money-chip').click()
  await page.waitForTimeout(200)
  await page.locator('.ofc-tabs button').nth(1).click()
  await page.waitForTimeout(200)
  if (hire && await page.locator('.ofc-hireall').count()) await page.locator('.ofc-hireall').click()
  await page.waitForTimeout(300)
  await page.locator('.ofc-tabs button').nth(2).click()
  await page.waitForTimeout(200)
  await page.locator('.nb-views button').nth(2).click()
  if (await page.locator('.nb-chef-acts button').count()) await page.locator('.nb-chef-acts button').nth(0).click()
  await page.waitForTimeout(900)
  await page.locator('.nb-views button').nth(0).click()
  const publish = page.locator('.nb-embedded .nb-publish button:not(.nb-off)')
  for (let guard = 0; guard < 60 && (await publish.count()); guard++) { await publish.first().click(); await page.waitForTimeout(50) }
  await page.locator('.office .panel-x').click()
  await page.evaluate((at) => window.__clock?.set(at), at)
  await page.locator('.ai-toggle').click()
  if (x2) await page.locator('.speed-toggle, .x2-toggle').first().click().catch(() => {})
  await page.mouse.move(5, 850)
}

/** a busy evening: the rating's pull on the crowd up (`more`), every flow's gap between customers `gap` of what it was; kept so every 2 s */
export async function rush(page, { more = 2.3, gap = 0.6 } = {}) {
  await page.evaluate(async ([more, gap]) => {
    const names = performance.getEntriesByType('resource').map((e) => e.name)
    const sh = await import(names.find((n) => /game\/shopState/.test(n)))
    const fl = await import(names.find((n) => /game\/flow\.ts/.test(n)))
    const on = () => { sh.RATING_FLOW.more = more; for (const k of Object.keys(fl.FLOWS)) fl.FLOWS[k].gap = () => gap }
    on()
    setInterval(on, 2000)
  }, [more, gap])
}
