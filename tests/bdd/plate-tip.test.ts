import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PLATE_NAME, leftOn, plateSays } from '@/game/plateTip'
import { tipIn } from '@/data/tipText'

feature('盤子的滑鼠提示（店主要的，第 279 項）', () => {
  scenario('客人吃完的盤子說是幾號座的、剩什麼、等誰收', ({ given, then, and }) => {
    let says = ''
    given('3 號座（座位 2）吃完，留下魚骨一副、竹籤兩根、紙巾', () => {
      says = plateSays({ phase: 'dirty', seat: 2, bones: 1, sticks: 2, tissue: true })
    })
    then('先說幾號座吃完了', () => { expect(says.split('｜')[0]).toBe('3 號座吃完了') })
    and('再說盤上剩什麼', () => { expect(says.split('｜')[1]).toBe('魚骨 1 副・竹籤 2 根・用過的紙巾') })
    and('最後說等外場來收', () => { expect(says.split('｜')[2]).toBe('等外場來收') })
  })
  scenario('一路上每個狀態都有話說', ({ then, and }) => {
    then('裝好盤在等人端', () => { expect(plateSays({ phase: 'ready', seat: 0 })).toBe('裝好盤了｜等外場端到 1 號座') })
    and('端去座位的路上', () => { expect(plateSays({ phase: 'carry', seat: 4 })).toBe('端去 5 號座') })
    and('客人在吃', () => { expect(plateSays({ phase: 'set', seat: 7 })).toBe('8 號座的客人在吃') })
    and('洗好放回去', () => { expect(plateSays({ phase: 'home', seat: 1 })).toBe('洗好了，放回碗盤架') })
    and('沒有剩東西就不說剩什麼', () => { expect(plateSays({ phase: 'clear', seat: 1 })).toBe('2 號座的，收去洗') })
  })
  scenario('日文、英文畫面也看得懂', ({ given, then, and }) => {
    let says = ''
    given('5 號座吃完，留下魚骨兩副、竹籤一根', () => { says = plateSays({ phase: 'dirty', seat: 4, bones: 2, sticks: 1 }) })
    then('日文', () => { expect(tipIn(says, 'ja')).toBe('5 番席は食べ終えた｜魚の骨 2 尾分・竹串 1 本｜ホールが下げに来るのを待つ') })
    and('英文', () => { expect(tipIn(says, 'en')).toBe('Seat 5 has finished｜2 fish’s bones · 1 skewer｜Waiting for a server to clear it') })
    and('盤名也翻', () => { expect(tipIn(PLATE_NAME.long, 'en')).toBe('Long plate') })
  })
  scenario('三種盤子各有名字', ({ then }) => {
    then('長角皿、丸皿、豆皿', () => {
      expect(PLATE_NAME).toEqual({ long: '長角皿', round: '丸皿', mame: '豆皿' })
      expect(leftOn({})).toBe('')
    })
  })
})
