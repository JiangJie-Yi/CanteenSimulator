// The shop opens only in its hours, 14:30 to 02:30 (game/hours): the game's clock moved on to them before a script opens it.
// In development the clock's set outright (__clock); a production build has none, so the clock's own sky button moves it on to dusk
// (17:00, in the hours).
const inHours = (min) => min >= 14 * 60 + 30 || min < 2 * 60 + 30
const minuteOf = (text) => { const [h, m] = text.trim().split(':').map(Number); return h * 60 + m }
export async function toOpeningHours(page) {
  if (await page.evaluate(() => !!window.__clock)) {
    await page.evaluate(() => { const c = window.__clock.get(); if (!(c.minute >= 870 || c.minute < 150)) window.__clock.set(14 * 60 + 30, c.day) })
    return
  }
  for (let i = 0; i < 4; i++) {
    const min = minuteOf(await page.locator('.game-clock-time').innerText())
    if (inHours(min)) return
    if (min >= 14 * 60) break
    await page.locator('.game-clock-sky').click()
    await page.waitForTimeout(400)
  }
  await page.waitForFunction(() => { const [h, m] = document.querySelector('.game-clock-time').textContent.trim().split(':').map(Number); const x = h * 60 + m; return x >= 870 || x < 150 }, null, { timeout: 180000 })
}
