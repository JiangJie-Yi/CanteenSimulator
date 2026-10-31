// The whole game played through in a browser, shop by shop: open the shop, buy stock on the board, hire the
// second chef, have him try dishes out, put them all on the menu, open for business, and let customers come in.
// Each shop is played from a fresh save. Any page error, or a
// step that doesn't do what it should, fails the run.
//
//   npm run dev          (in another terminal)
//   npm run e2e          (or: node tests/e2e/flow.mjs [url] [shop...])
//
// Uses the installed Chrome (playwright-core), headless, with software WebGL.
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:5173/JapaneseGrillSimulator/'
// (only the grill is open in this build; a new game starts in it, already set up)
const SHOPS = ['grilledfish']
const ONLY = process.argv.slice(3)
const OPEN_FOR = Number(process.env.OPEN_FOR ?? 40000)

// (CHROME_PATH: a Chromium to use instead of the installed Chrome, e.g. in a container)
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
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
    // (the game's logic at the low tier: software GL draws the high one at a frame a second, and the customers' clock runs by the frame)
    await page.goto(URL + (URL.includes('?') ? '&' : '?') + (process.env.Q ? `q=${process.env.Q}` : 'q=low'), { timeout: 60000 })
    await page.waitForTimeout(5000)
    if (await page.locator('.welcome-go').count()) await page.locator('.welcome-go').click()
    await page.waitForTimeout(800)
    if (await page.locator('button.dot').count()) await page.locator('button.dot').nth(i).click()
    await page.waitForTimeout(2500)
    if (await page.locator('.unopened-hint').count()) {
      await page.locator('.unopened-hint').click()
      await page.locator('.welcome-go').click()
      await page.waitForTimeout(1500)
    }
    check(shop, 'shop set up', (await page.locator('.unopened-hint').count()) === 0)
    // buy in stock on the board
    const before = await cash()
    // (buying in is done in the ingredients' panel at the grill (research): the fridge button opens it, then 補滿, and it's shut again)
    // (just after a code change the dev server may still be compiling: wait for the button rather than give up at the first try)
    // (the shop opens on the whole room's overview: over to the grill's view (2 火烤灶台) first, where the ingredients are)
    await page.locator('.view-reset').click({ timeout: 45000 })
    await page.locator('.view-menu button', { hasText: '火烤灶台' }).first().click()
    await page.locator('.fridge-toggle').waitFor({ timeout: 45000 })
    // (and the first click given time: the room's shaders may still be compiling on software GL, the page not answering for a while)
    await page.locator('.fridge-toggle').click({ timeout: 60000 })
    await page.waitForTimeout(500)
    await page.locator('.tally-restock.is-full').click()
    await page.waitForTimeout(200)
    await page.locator('.fridge-toggle').click()
    await page.waitForTimeout(300)
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
    // (廚房 shows one view at a time: 料理研製 to talk to the chef, then 試菜 to put the dishes on the menu)
    await page.locator('.nb-views button').nth(2).click()
    // 一鍵生成菜單 (ten dishes worked out and put up at once), then a few more tries to be sure
    await page.locator('.nb-chef-acts button').nth(0).click()
    await page.waitForTimeout(900)
    for (let k = 0; k < 2; k++) {
      await page.locator('.nb-chef-acts button').nth(2).click()
      await page.waitForTimeout(300)
    }
    await page.locator('.nb-views button').nth(0).click()
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
    // (SHOT=<path>: a picture of the shop at work, customers in, for a look at how they're drawn)
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  } catch (e) {
    failures.push(`${shop} stopped: ${e.message.split('\n')[0]}`)
    // (and with SHOT, a picture of where it stopped, and which element it was after)
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT }).catch(() => {})
    console.log(e.message.split('\n').slice(0, 14).join('\n'))
  }
  await ctx.close()
}
for (const e of errors) failures.push('page error: ' + e)
await browser.close()
console.log(failures.length ? `\n${failures.length} failed:\n- ${failures.join('\n- ')}` : '\nall passed')
process.exit(failures.length ? 1 : 0)
