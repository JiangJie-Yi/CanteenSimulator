import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PLATE_DIMS, PLATE_SPREAD, plateFor, plateSide } from '@/game/plateSize'

feature('盤子照份量配（店主 2026-11-16：「盤子種類自己設計吧，這麼大一個盤子就裝那點東西」）', () => {
  scenario('整條魚、魷魚、串物放長角皿', ({ then, and }) => {
    then('秋刀魚、竹筴魚、柳葉魚、紅喉是長角皿', () => {
      for (const id of ['Saury', 'Aji', 'Shishamo', 'Nodoguro']) expect(plateFor([id])).toBe('long')
    })
    and('魷魚、雞肉蔥串、蝦串、茄子也是長角皿', () => {
      for (const id of ['Squid', 'Yakitori', 'ShrimpSkewer', 'Eggplant']) expect(plateFor([id])).toBe('long')
    })
    and('套餐有魚，配著飯糰、味噌湯、白飯也是長角皿', () => { expect(plateFor(['Saury', 'Onigiri', 'MisoSoup', 'Rice'])).toBe('long') })
  })
  scenario('魚片或幾樣小件放丸皿', ({ then, and }) => {
    then('一片鮭魚、兩片鰤魚是丸皿', () => { expect(plateFor(['Salmon'])).toBe('round'); expect(plateFor(['Buri', 'Buri'])).toBe('round') })
    and('兩個年糕、年糕配飯糰是丸皿', () => { expect(plateFor(['NetMochi', 'NetMochi'])).toBe('round'); expect(plateFor(['NetMochi', 'Onigiri'])).toBe('round') })
  })
  scenario('單一小件放豆皿', ({ then, and }) => {
    then('一個年糕、一個飯糰、一顆馬鈴薯是豆皿', () => {
      for (const id of ['NetMochi', 'Onigiri', 'Potato']) expect(plateFor([id])).toBe('mame')
    })
    and('另外裝碗的味噌湯、白飯、清酒不算', () => { expect(plateFor(['NetMochi', 'MisoSoup', 'Rice', 'Sake'])).toBe('mame') })
  })
  scenario('盤子比裝的東西大一點，不會大很多', ({ then, and }) => {
    then('長角皿放得下一條秋刀魚（0.27），兩端各留不到 2 公分', () => { expect(PLATE_DIMS.long.l).toBeGreaterThan(0.27); expect(PLATE_DIMS.long.l).toBeLessThan(0.32) })
    and('丸皿放得下三片魚片並排（各寬約 0.045）', () => { expect(2 * PLATE_SPREAD.round + 0.045).toBeLessThan(PLATE_DIMS.round.w) })
    and('豆皿比丸皿小、丸皿比長角皿短', () => { expect(PLATE_DIMS.mame.l).toBeLessThan(PLATE_DIMS.round.l); expect(PLATE_DIMS.round.l).toBeLessThan(PLATE_DIMS.long.l) })
  })
  scenario('盤上的東西並排：第一個在中間，接著兩邊，第四個疊上去', ({ then }) => {
    then('順序是中、左、右，第四個在第二層中間', () => {
      expect([0, 1, 2, 3].map(plateSide)).toEqual([{ across: 0, layer: 0 }, { across: -1, layer: 0 }, { across: 1, layer: 0 }, { across: 0, layer: 1 }])
    })
  })
})
