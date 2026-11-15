import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { STOCKED_KINDS, dotOf, guideStep, type GuideState } from '@/game/firstDay'

const fresh = (): GuideState => ({ introSeen: false, outroSeen: false, kinds: 0, cooks: 0, menu: 0, menuMin: 10, open: false, inHours: false, sold: false })

feature('第一天的引導', () => {
  scenario('新玩家照順序：歡迎、進貨、徵人、菜單、開店、第一位客人、結語', ({ given, then, and }) => {
    given('一間剛開的店，什麼都還沒做', (w) => { w.s = fresh() })
    then('先看到歡迎', (w) => { expect(guideStep(w.s as GuideState)).toBe('intro') })
    and('看過歡迎，下一步是進貨', (w) => { const s = w.s as GuideState; s.introSeen = true; expect(guideStep(s)).toBe('stock') })
    and('冰箱有足夠種類的食材，下一步是徵人', (w) => { const s = w.s as GuideState; s.kinds = STOCKED_KINDS; expect(guideStep(s)).toBe('hire') })
    and('雇了廚師，下一步是菜單', (w) => { const s = w.s as GuideState; s.cooks = 1; expect(guideStep(s)).toBe('menu') })
    and('菜單有 10 道、還沒到營業時間，就等開店', (w) => { const s = w.s as GuideState; s.menu = 10; expect(guideStep(s)).toBe('wait') })
    and('到了營業時間，按開店', (w) => { const s = w.s as GuideState; s.inHours = true; expect(guideStep(s)).toBe('open') })
    and('開店了，等第一位客人付錢', (w) => { const s = w.s as GuideState; s.open = true; expect(guideStep(s)).toBe('firstSale') })
    and('有了第一筆收入，看結語', (w) => { const s = w.s as GuideState; s.sold = true; expect(guideStep(s)).toBe('outro') })
    and('看過結語就結束', (w) => { const s = w.s as GuideState; s.outroSeen = true; expect(guideStep(s)).toBe('done') })
  })
  scenario('玩家自己先做了的步驟會被跳過', ({ given, then }) => {
    given('看過歡迎，自己先雇了人、也進了貨', (w) => { w.s = { ...fresh(), introSeen: true, kinds: 12, cooks: 2 } })
    then('直接到菜單那一步', (w) => { expect(guideStep(w.s as GuideState)).toBe('menu') })
  })
  scenario('店已經開了，就不再要求進貨或菜單', ({ given, then }) => {
    given('看過歡迎，店開著、還沒有收入', (w) => { w.s = { ...fresh(), introSeen: true, open: true } })
    then('等第一位客人', (w) => { expect(guideStep(w.s as GuideState)).toBe('firstSale') })
  })
  scenario('等開店算在開店那一格', ({ then }) => {
    then('進度點的位置一樣', () => { expect(dotOf('wait')).toBe(dotOf('open')) })
  })
})
