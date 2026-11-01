// The shop's water and electricity (the owner's: what keeping it open costs, worked out in as much detail as it can be; no gas, everything's
// cooked over charcoal). What draws power, how much and when, piece by piece; what uses water, use by use; and the bills on Taiwan's tariffs,
// counted against the month so far (a month being thirty opening days), so the tiers bite as they do on a real bill.
//
// The tariffs: 台電 表燈非時間電價 營業用 (commercial lighting, not time-of-use), the non-summer rates, four tiers a month: the first tier's rate
// as published (2.18 a kWh; 2.61 in summer); the higher tiers approximate (the shape of the published table, not its figures checked).
// 台灣自來水: four tiers a month (7.35, 9.45, 11.55, 12.075 a 度, 1 度 = 1 m³), and a 20 mm meter's basic charge, 35.7 a month.

/** when something draws power: all day and night (the fridges), while the shop's open, while the room's lights are on, while the fire's
 * lit (the extractor over it), while the music's playing */
export type When = 'always' | 'open' | 'lights' | 'fire' | 'music'
export type Load = { id: string; zh: string; ja: string; en: string; watts: number; when: When }
/** what draws power, its average draw (a compressor's cycling averaged in) */
export const LOADS: Load[] = [
  { id: 'freezer', zh: '食材冷凍櫃', ja: '食材冷凍庫', en: 'Ingredient freezer', watts: 160, when: 'always' },
  { id: 'fridges', zh: '灶台冷藏櫃 ×2', ja: '台下冷蔵庫 ×2', en: 'Cook-table fridges ×2', watts: 180, when: 'always' },
  { id: 'drinks', zh: '飲料櫃 ×2', ja: 'ドリンク冷蔵庫 ×2', en: 'Drinks fridges ×2', watts: 280, when: 'always' },
  { id: 'washlet', zh: '免治馬桶 ×2（座溫）', ja: '温水便座 ×2（保温）', en: 'Washlets ×2 (seat warmers)', watts: 50, when: 'always' },
  { id: 'exit', zh: '逃生出口燈', ja: '非常口灯', en: 'Exit sign', watts: 4, when: 'always' },
  { id: 'lights', zh: '吊燈・燈串・槽燈', ja: '照明', en: 'Room lights', watts: 210, when: 'lights' },
  { id: 'hood', zh: '排煙機', ja: '排煙機', en: 'Smoke extractor', watts: 420, when: 'fire' },
  { id: 'warmer', zh: '味噌湯與飯的保溫', ja: '味噌汁・ご飯の保温', en: 'Soup and rice warmers', watts: 260, when: 'open' },
  { id: 'pos', zh: '收銀機・平板・刷卡機・印表機', ja: 'レジ・タブレット・端末・プリンター', en: 'Till, tablet, card reader, printer', watts: 55, when: 'open' },
  { id: 'music', zh: '音箱', ja: 'スピーカー', en: 'Speaker', watts: 20, when: 'music' },
]
/** what's going on that changes the draw: the shop open, the lights, the fire, the music; the freezer's setting and its lid; the cook
 * table's fridges' doors */
export type Conditions = { open: boolean; lights: boolean; fire: boolean; music: boolean; freezerSet: number; freezerOpen: boolean; fridgeOpen: boolean }
/** a load's draw right now (W): nothing when it's not its time; the freezer harder the colder it's set (4% a degree under -20℃) and twice as
 * hard with its lid up; the fridges half as hard again with their doors open */
export function drawOf(l: Load, c: Conditions) {
  const on = l.when === 'always' || (l.when === 'open' && c.open) || (l.when === 'lights' && c.lights) || (l.when === 'fire' && c.fire) || (l.when === 'music' && c.music)
  if (!on) return 0
  if (l.id === 'freezer') return l.watts * Math.max(0.5, 1 + 0.04 * (-20 - c.freezerSet)) * (c.freezerOpen ? 2 : 1)
  if (l.id === 'fridges') return l.watts * (c.fridgeOpen ? 1.5 : 1)
  return l.watts
}
/** kWh drawn over `seconds` by each load, as they are */
export function energyOver(seconds: number, c: Conditions): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of LOADS) {
    const w = drawOf(l, c)
    if (w > 0) out[l.id] = (w * seconds) / 3600 / 1000
  }
  return out
}

/** what uses water (litres each time) and, heated, power (kWh each time) */
export type Use = 'dish' | 'flush' | 'washlet' | 'handwash' | 'cooking' | 'mop' | 'dipper' | 'tap'
export const USES: Record<Use, { zh: string; ja: string; en: string; litres: number; kwh: number }> = {
  // (a plate washed in hot water: a litre or so warmed 20℃ by the instant heater, two more cold to rinse)
  dish: { zh: '洗碗（熱水）', ja: '皿洗い（湯）', en: 'Washing up (hot)', litres: 3, kwh: 0.025 },
  flush: { zh: '沖馬桶', ja: 'トイレの水', en: 'Toilet flush', litres: 6, kwh: 0 },
  washlet: { zh: '免治溫水', ja: '温水洗浄', en: 'Washlet', litres: 0.5, kwh: 0.008 },
  handwash: { zh: '洗手', ja: '手洗い', en: 'Hand washing', litres: 1.5, kwh: 0 },
  // (rice washed and cooked, the soup, a vegetable rinsed: for each thing ordered)
  cooking: { zh: '備料與煮飯煮湯', ja: '仕込み・炊飯・汁', en: 'Prep, rice and soup', litres: 0.25, kwh: 0 },
  // (the floors and the toilets mopped before opening)
  mop: { zh: '開店前清潔', ja: '開店前の掃除', en: 'Cleaning before opening', litres: 15, kwh: 0 },
  dipper: { zh: '水瓢澆水', ja: '柄杓の水', en: 'The dipper', litres: 0.3, kwh: 0 },
  // (the sink's tap left running: a minute's worth)
  tap: { zh: '流理台水龍頭（每分鐘）', ja: '流しの蛇口（毎分）', en: "The sink's tap (a minute)", litres: 6, kwh: 0 },
}

/** a tier of a tariff: the rate for what's used up to `upTo` this month */
export type Tier = { upTo: number; rate: number }
/** 台電 表燈營業用, non-summer (NT$ a kWh) */
export const POWER_TIERS: Tier[] = [{ upTo: 330, rate: 2.18 }, { upTo: 700, rate: 2.95 }, { upTo: 1500, rate: 3.45 }, { upTo: Infinity, rate: 5.55 }]
/** 台灣自來水 (NT$ a m³) */
export const WATER_TIERS: Tier[] = [{ upTo: 10, rate: 7.35 }, { upTo: 30, rate: 9.45 }, { upTo: 50, rate: 11.55 }, { upTo: Infinity, rate: 12.075 }]
/** the water meter's basic charge a month (20 mm) */
export const WATER_BASE = 35.7
/** a month of the shop's bills: thirty opening days */
export const BILL_DAYS = 30

/** what the units from `from` to `to` (this month's running total) cost, each at the rate of the tier it falls in */
export function tierCost(tiers: Tier[], from: number, to: number) {
  let cost = 0, lo = 0
  for (const t of tiers) {
    const a = Math.max(from, lo), b = Math.min(to, t.upTo)
    if (b > a) cost += (b - a) * t.rate
    lo = t.upTo
    if (lo >= to) break
  }
  return cost
}

/** the month so far: its day (0 before the shop's first opening), the kWh and m³ used, by what, and what it's cost */
export type Meter = { day: number; kwh: number; m3: number; power: Record<string, number>; water: Record<string, number>; cost: number }
export const freshMeter = (): Meter => ({ day: 0, kwh: 0, m3: 0, power: {}, water: {}, cost: 0 })
/** a new opening day: the next day of the month, or the first of a new one (the totals back to nothing); and what that day's start costs
 * (the water meter's basic charge, on a month's first day) */
export function nextDay(m: Meter): { meter: Meter; charge: number } {
  if (m.day >= BILL_DAYS) return { meter: { ...freshMeter(), day: 1, cost: WATER_BASE }, charge: WATER_BASE }
  if (m.day === 0) return { meter: { ...m, day: 1, cost: m.cost + WATER_BASE }, charge: WATER_BASE }
  return { meter: { ...m, day: m.day + 1 }, charge: 0 }
}
/** power drawn (kWh by load) and water used (litres by use, with the power heating it) added to the month: the new meter, and what it cost
 * (at the tiers the month's totals have reached) */
export function meterAdd(m: Meter, kwhBy: Record<string, number>, uses: Partial<Record<Use, number>> = {}): { meter: Meter; cost: number } {
  const power = { ...m.power }, water = { ...m.water }
  let kwh = 0, litres = 0
  for (const [id, k] of Object.entries(kwhBy)) { power[id] = (power[id] ?? 0) + k; kwh += k }
  for (const [u, n] of Object.entries(uses) as [Use, number][]) {
    const spec = USES[u]
    water[u] = (water[u] ?? 0) + n * spec.litres
    litres += n * spec.litres
    if (spec.kwh) { power[`heat:${u}`] = (power[`heat:${u}`] ?? 0) + n * spec.kwh; kwh += n * spec.kwh }
  }
  const m3 = litres / 1000
  const cost = tierCost(POWER_TIERS, m.kwh, m.kwh + kwh) + tierCost(WATER_TIERS, m.m3, m.m3 + m3)
  return { meter: { ...m, kwh: m.kwh + kwh, m3: m.m3 + m3, power, water, cost: m.cost + cost }, cost }
}
