// Every view from the eye button, pictured from a fresh browser (nothing placed by hand): for checking each frames its part of the shop.
//   node tests/e2e/views.mjs [url]      OUT=<dir>  Q=<tier, default medium>
import { chromium } from 'playwright-core'
const URL = process.argv[2] ?? 'http://localhost:5173/JapaneseGrillSimulator/'
const OUT = process.env.OUT ?? '.'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage()
await page.goto(URL + `?q=${process.env.Q ?? 'medium'}`, { timeout: 60000 })
await page.waitForTimeout(6000)
if (await page.locator('.welcome-go').count()) await page.locator('.welcome-go').click()
await page.waitForFunction(() => window.__scene && window.__scene.getObjectByName('BossFollow'), null, { timeout: 120000 })
await page.waitForTimeout(6000)
for (let i = 0; i < 9; i++) {
  if (!(await page.locator('.view-menu').count())) await page.click('.view-reset', { timeout: 30000 })
  await page.locator('.view-menu li button').nth(i).click({ timeout: 30000 })
  await page.waitForTimeout(9000)
  await page.mouse.move(5, 850)
  await page.screenshot({ path: `${OUT}/fview${i}.png` })
}
await browser.close()
console.log('views done')
