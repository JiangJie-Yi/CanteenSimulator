import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { KITCHEN_DISHES, SECTIONS, bySection, sectionOf } from '@/data/kitchenDishes'
import { batchSeconds, canCook, cookSeconds, extrasOf, kitchenBatch, sideAllowed, stationOf, stepOf } from '@/game/station'
import { costOf } from '@/game/economy'
import { EGG, FRYOIL, GARNISH_GOODS, GARNISH_PAR, NORI, startingSupplies } from '@/game/supplies'
import { dishOf, oneOfEach, partEn, partName } from '@/data/recipes'

feature('爐子、油炸台與手卷的菜', () => {
  scenario('新菜照日式烤魚店的分類排進菜單', ({ given, then, and }) => {
    given('烤物、飯糰、新菜、湯與酒混在一起', (w) => { w.ids = ['Sake', 'Fries', 'Saury', 'MisoSoup', 'Tamagoyaki', 'Onigiri', 'HandRoll', 'EggDropSoup', 'Omurice', 'Tempura', 'Mackerel'] })
    then('照烤物、炸物、玉子・蛋料理、飯物、湯、飲料的順序排', (w) => {
      expect(bySection(w.ids)).toEqual(['Saury', 'Mackerel', 'Fries', 'Tempura', 'Tamagoyaki', 'Onigiri', 'HandRoll', 'Omurice', 'MisoSoup', 'EggDropSoup', 'Sake'])
    })
    and('每道新菜都屬於自己那一類', () => {
      expect(sectionOf('Tamagoyaki')).toBe('egg')
      expect(sectionOf('Omurice')).toBe('rice')
      expect(sectionOf('HandRoll')).toBe('rice')
      expect(sectionOf('EggDropSoup')).toBe('soup')
      expect(sectionOf('Fries')).toBe('fried')
      expect(sectionOf('Tempura')).toBe('fried')
      expect(SECTIONS.map((s) => s.id)).toEqual(['grill', 'fried', 'egg', 'rice', 'soup', 'drink'])
    })
  })

  scenario('煎的在瓦斯爐、炸的在油炸台、手卷在砧板', ({ then }) => {
    then('每道菜有自己的站', () => {
      expect(stationOf('Tamagoyaki')).toBe('stove')
      expect(stationOf('Omurice')).toBe('stove')
      expect(stationOf('EggDropSoup')).toBe('stove')
      expect(stationOf('Fries')).toBe('fryer')
      expect(stationOf('Tempura')).toBe('fryer')
      expect(stationOf('HandRoll')).toBe('board')
      expect(stationOf('Saury')).toBeNull()
    })
  })

  scenario('熟練的廚師做得比較快，但每道都要花時間', ({ then }) => {
    then('時間是正的、熟練的比新手快、差不到兩成五', () => {
      for (const d of KITCHEN_DISHES) {
        const slow = cookSeconds(d.id, 0), fast = cookSeconds(d.id, 100)
        expect(fast).toBeGreaterThan(0)
        expect(fast).toBeLessThan(slow)
        expect(fast / slow).toBeGreaterThan(0.75)
      }
    })
  })

  scenario('蛋料理用蛋、炸物用油、手卷用海苔', ({ then }) => {
    then('各自用多少', () => {
      expect(extrasOf('Tamagoyaki')).toEqual({ [EGG]: 3 })
      expect(extrasOf('Omurice')).toEqual({ [EGG]: 2 })
      expect(extrasOf('EggDropSoup')).toEqual({ [EGG]: 1 })
      expect(extrasOf('HandRoll')).toEqual({ [EGG]: 1, [NORI]: 1 })
      expect(extrasOf('Fries')).toEqual({ [FRYOIL]: 1 })
      expect(extrasOf('Tempura')).toEqual({ [FRYOIL]: 1 })
    })
  })

  scenario('沒有蛋就做不了玉子燒', ({ given, when, then, but }) => {
    given('玉子燒的料還有，蛋只剩兩顆', (w) => { w.stock = { Tamagoyaki: 5, [EGG]: 2 } })
    when('看能不能做', (w) => { w.can = canCook('Tamagoyaki', w.stock) })
    then('做不了（要三顆）', (w) => { expect(w.can).toBe(false) })
    but('補到三顆就能做', (w) => { expect(canCook('Tamagoyaki', { ...w.stock, [EGG]: 3 })).toBe(true) })
  })

  scenario('新菜的成本低於售價（連蛋、油、海苔算進去）', ({ then }) => {
    then('每一道都賺得到', () => {
      const unit = new Map(GARNISH_GOODS.map((g) => [g.id, costOf(g)]))
      for (const d of KITCHEN_DISHES) {
        const extra = Object.entries(extrasOf(d.id)).reduce((n, [k, q]) => n + (unit.get(k) ?? 0) * q, 0)
        expect(costOf(d) + extra).toBeLessThan(d.price * 0.6)
        expect(costOf(d)).toBeGreaterThan(0)
      }
    })
  })

  scenario('新開的店倉儲裡就有蛋和炸油，補貨補到常備量', ({ then }) => {
    then('一開始就有，常備量是正的', () => {
      const s = startingSupplies()
      expect(s[EGG]).toBe(GARNISH_PAR[EGG])
      expect(s[FRYOIL]).toBe(GARNISH_PAR[FRYOIL])
      expect(GARNISH_PAR[EGG]).toBeGreaterThan(0)
    })
  })

  scenario('做一道菜分成下料、煮、起鍋三段', ({ then }) => {
    then('照時間走完', () => {
      expect(stepOf(0, 40)).toBe('start')
      expect(stepOf(20, 40)).toBe('cook')
      expect(stepOf(38, 40)).toBe('plate')
      expect(stepOf(40, 40)).toBe('done')
    })
  })

  scenario('同一道菜一次做幾份：炸籃三份、手卷與湯兩份、平底鍋一份', ({ then, and }) => {
    then('每個站一次能做的份數', () => {
      expect(kitchenBatch('Fries')).toBe(3)
      expect(kitchenBatch('Tempura')).toBe(3)
      expect(kitchenBatch('HandRoll')).toBe(2)
      expect(kitchenBatch('EggDropSoup')).toBe(2)
      expect(kitchenBatch('Tamagoyaki')).toBe(1)
      expect(kitchenBatch('Omurice')).toBe(1)
      expect(kitchenBatch('Saury')).toBe(1)
    })
    and('多做一份只多花一點時間，比分開做快得多', () => {
      const one = batchSeconds('Fries', 1), three = batchSeconds('Fries', 3)
      expect(one).toBeCloseTo(cookSeconds('Fries'))
      expect(three).toBeGreaterThan(one)
      expect(three).toBeLessThan(one * 1.5)
    })
  })

  scenario('客人點新菜：外帶不賣、內用每人最多一道', ({ then, and }) => {
    then('外帶不能點爐子、油炸台、砧板的菜', () => {
      expect(sideAllowed([], ['Fries'], false)).toBe(false)
      expect(sideAllowed([], ['Saury'], false)).toBe(true)
    })
    and('內用點了一道新菜，第二道新菜就不點', () => {
      expect(sideAllowed([], ['Omurice'], true)).toBe(true)
      expect(sideAllowed(['Omurice'], ['Fries'], true)).toBe(false)
      expect(sideAllowed(['Omurice'], ['Saury'], true)).toBe(true)
    })
  })

  scenario('新菜在烤魚店的菜單上照原名，不加「烤」', ({ given, then, and }) => {
    given('烤魚店的菜單', (w) => { w.items = KITCHEN_DISHES })
    then('中文、日文都是菜的本名', (w) => {
      for (const it of w.items as typeof KITCHEN_DISHES) {
        expect(partName(it, it.name, it.id, [], 'zh', 'grill')).toBe(it.name)
        expect(partName(it, it.name, it.id, [], 'ja', 'grill')).toBe(it.ja)
      }
    })
    and('英文也不會變成 Grilled Fries', (w) => {
      for (const it of w.items as typeof KITCHEN_DISHES) {
        expect(partName(it, it.name, it.id, [], 'en', 'grill')).toBe(it.en)
        expect(partEn(it.en, [], 'grill', it.id)).toBe(it.en)
      }
      expect(partEn('Fries', [], 'grill', 'Fries')).toBe('Fries')
    })
    and('同一道菜調味的順序不同，在菜單上還是只有一份', () => {
      const e = (id: string, dabs: ('soy' | 'miso' | 'salt')[]) => ({ key: dabs.length ? `${id}|${dabs.join('+')}` : id, parts: [{ id, dabs }] })
      const menu = [e('Gindara', ['miso', 'soy']), e('Saury', ['salt']), e('Gindara', ['soy', 'miso']), e('Fries', [])]
      expect(oneOfEach(menu).map((x) => x.key)).toEqual(['Gindara|miso+soy', 'Saury|salt', 'Fries'])
      expect(dishOf(menu[0])).toBe(dishOf(menu[2]))
    })
    and('烤的照舊加「烤」', () => {
      expect(partName({ name: '秋刀魚', en: 'Saury' }, '秋刀魚', 'Saury', [], 'zh', 'grill')).toBe('烤秋刀魚')
      expect(partEn('Saury', [], 'grill', 'Saury')).toBe('Grilled Saury')
    })
  })
})
