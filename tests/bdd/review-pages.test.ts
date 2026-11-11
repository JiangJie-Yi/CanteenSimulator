import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { REVIEWS_PER_PAGE, keepVisits, pageButtons, pageOf, pagesOf } from '@/game/reputation'

feature('評論沒有上限，像 Google 一樣一頁一頁看', () => {
  scenario('評論全部留著', ({ then }) => {
    then('一千則也全部保留', () => {
      const vs = Array.from({ length: 1000 }, (_, i) => ({ id: i }) as never)
      expect(keepVisits(vs)).toHaveLength(1000)
    })
  })
  scenario(`每頁 ${REVIEWS_PER_PAGE} 則`, ({ then, and }) => {
    const list = Array.from({ length: 23 }, (_, i) => i)
    then('23 則分成 3 頁', () => { expect(pagesOf(23)).toBe(3) })
    and('第 1 頁是前 10 則，第 3 頁是最後 3 則', () => {
      expect(pageOf(list, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(pageOf(list, 2)).toEqual([20, 21, 22])
    })
    and('超過最後一頁就停在最後一頁', () => { expect(pageOf(list, 9)).toEqual([20, 21, 22]) })
    and('沒有評論也算一頁', () => { expect(pagesOf(0)).toBe(1) })
  })
  scenario('頁碼：頭、尾、目前這頁前後兩頁，中間跳過的用 …', ({ then, and }) => {
    then('20 頁、在第 10 頁：1 … 8 9 10 11 12 … 20', () => {
      expect(pageButtons(9, 20)).toEqual([0, null, 7, 8, 9, 10, 11, null, 19])
    })
    and('頁數少就全部列出', () => { expect(pageButtons(0, 4)).toEqual([0, 1, 2, 3]) })
  })
})
