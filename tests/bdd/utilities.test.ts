import { expect } from 'vitest'
import { drawOf, energyOver, freshMeter, LOADS, meterAdd, nextDay, POWER_TIERS, tierCost, WATER_BASE, WATER_TIERS, BILL_DAYS, type Conditions } from '@/game/utilities'
import { feature, scenario } from './bdd'

const shut: Conditions = { open: false, lights: false, fire: false, music: false, freezerSet: -20, freezerOpen: false, fridgeOpen: false }
const busy: Conditions = { open: true, lights: true, fire: true, music: true, freezerSet: -20, freezerOpen: false, fridgeOpen: false }
const load = (id: string) => LOADS.find((l) => l.id === id)!

feature('水電：營業的消耗開支（沒有瓦斯，全靠炭火）', () => {
  scenario('閉店時只有冷凍、冷藏、飲料櫃、免治座溫與逃生燈在耗電', ({ given, when, then, and }) => {
    given('店關著、燈關著、沒有火、沒有音樂', (w) => { w.c = shut })
    when('看每樣東西的耗電', (w) => { w.on = LOADS.filter((l) => drawOf(l, w.c as Conditions) > 0).map((l) => l.id).sort() })
    then('只有全天候的那幾樣', (w) => { expect(w.on).toEqual(['drinks', 'exit', 'freezer', 'fridges', 'washlet']) })
    and('沒有瓦斯這一項', () => { expect(LOADS.some((l) => /gas/.test(l.id))).toBe(false) })
  })
  scenario('營業、開燈、生火、放音樂時，排煙機、保溫、收銀、燈、音箱都算進去', ({ given, when, then }) => {
    given('店開著、燈亮、火在燒、音樂在播', (w) => { w.c = busy })
    when('算一小時的用電', (w) => { w.kwh = Object.values(energyOver(3600, w.c as Conditions)).reduce((a: number, b: number) => a + b, 0) })
    then('每一樣的瓦數加起來（約 1.64 度）', (w) => { expect(w.kwh).toBeCloseTo(LOADS.reduce((n, l) => n + l.watts, 0) / 1000, 3) })
  })
  scenario('冷凍櫃設得越冷越耗電，蓋子開著加倍', ({ given, then, and }) => {
    given('冷凍櫃設 -20℃', (w) => { w.base = drawOf(load('freezer'), shut) })
    then('設 -25℃ 時多兩成', (w) => { expect(drawOf(load('freezer'), { ...shut, freezerSet: -25 })).toBeCloseTo((w.base as number) * 1.2, 5) })
    and('蓋子打開時是兩倍', (w) => { expect(drawOf(load('freezer'), { ...shut, freezerOpen: true })).toBeCloseTo((w.base as number) * 2, 5) })
  })
  scenario('電費照累進的級距：跨過 330 度的那幾度用下一段的單價', ({ given, when, then }) => {
    given('這個月已經用了 320 度', (w) => { w.from = 320 })
    when('再用 20 度', (w) => { w.cost = tierCost(POWER_TIERS, w.from as number, (w.from as number) + 20) })
    then('10 度算第一段、10 度算第二段', (w) => { expect(w.cost).toBeCloseTo(10 * POWER_TIERS[0].rate + 10 * POWER_TIERS[1].rate, 5) })
  })
  scenario('水費照台水四段：10 度以下 7.35 元、11 到 30 度 9.45 元', ({ when, then }) => {
    when('一個月用了 12 度水', (w) => { w.cost = tierCost(WATER_TIERS, 0, 12) })
    then('10 × 7.35 + 2 × 9.45', (w) => { expect(w.cost).toBeCloseTo(10 * 7.35 + 2 * 9.45, 5) })
  })
  scenario('洗一個盤子用熱水：用水也用電；沖一次馬桶 6 公升', ({ given, when, then, and }) => {
    given('這個月剛開始', (w) => { w.m = freshMeter() })
    when('洗了 10 個盤子、沖了 4 次馬桶', (w) => { w.r = meterAdd(w.m as ReturnType<typeof freshMeter>, {}, { dish: 10, flush: 4 }) })
    then('用了 54 公升水', (w) => { expect((w.r as ReturnType<typeof meterAdd>).meter.m3).toBeCloseTo(0.054, 6) })
    and('熱水器用了 0.25 度電', (w) => { expect((w.r as ReturnType<typeof meterAdd>).meter.power['heat:dish']).toBeCloseTo(0.25, 6) })
  })
  scenario('廁所洗手台的水龍頭開著不關，每分鐘 5 公升；客人洗一次手 1.5 公升', ({ given, when, then, and }) => {
    given('這個月剛開始', (w) => { w.m = freshMeter() })
    when('男廁的水龍頭開了 3 分鐘，又有 4 位客人洗手', (w) => { w.r = meterAdd(w.m as ReturnType<typeof freshMeter>, {}, { wcTap: 3, handwash: 4 }) })
    then('用了 21 公升水', (w) => { expect((w.r as ReturnType<typeof meterAdd>).meter.m3).toBeCloseTo(0.021, 6) })
    and('分開記在兩項', (w) => { const r = w.r as ReturnType<typeof meterAdd>; expect(r.meter.water.wcTap).toBeCloseTo(15, 6); expect(r.meter.water.handwash).toBeCloseTo(6, 6) })
    and('要付水費', (w) => { expect((w.r as ReturnType<typeof meterAdd>).cost).toBeGreaterThan(0) })
  })
  scenario('一個月是 30 個營業日：第 31 天重新起算，再收一次水表基本費', ({ given, when, then, and }) => {
    given(`第 ${BILL_DAYS} 天，已經用了 500 度電`, (w) => { w.m = { ...freshMeter(), day: BILL_DAYS, kwh: 500 } })
    when('隔天開店', (w) => { w.n = nextDay(w.m as ReturnType<typeof freshMeter>) })
    then('新的一個月從第 1 天、0 度開始', (w) => { const n = w.n as ReturnType<typeof nextDay>; expect(n.meter.day).toBe(1); expect(n.meter.kwh).toBe(0) })
    and('收水表基本費', (w) => { expect((w.n as ReturnType<typeof nextDay>).charge).toBe(WATER_BASE) })
  })
  scenario('新開的店第一次開店就是這個月的第 1 天，收水表基本費', ({ given, when, then, and }) => {
    given('還沒開過店的電表', (w) => { w.m = freshMeter() })
    when('第一次開店', (w) => { w.n = nextDay(w.m as ReturnType<typeof freshMeter>) })
    then('第 1 天', (w) => { expect((w.n as ReturnType<typeof nextDay>).meter.day).toBe(1) })
    and('收水表基本費', (w) => { expect((w.n as ReturnType<typeof nextDay>).charge).toBe(WATER_BASE) })
  })
})
