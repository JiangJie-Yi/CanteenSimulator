import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { tipIn } from '@/data/tipText'

feature('滑鼠指著東西時的標籤（日文、英文）', () => {
  scenario('寫成中文的名稱與說明照網頁語言顯示', ({ then, and }) => {
    then('名稱翻過去', () => {
      expect(tipIn('飯桶', 'en')).toBe('Rice tub')
      expect(tipIn('飯桶', 'ja')).toBe('おひつ')
    })
    and('說明裡帶數字的照樣翻', () => {
      expect(tipIn('剩 120/200・點一下抽一張', 'en')).toBe('120/200 left · Click to take one')
      expect(tipIn('煮飯中⋯⋯還要 12 秒', 'ja')).toBe('炊飯中……あと 12 秒')
    })
    and('｜ 後面的操作提示各自翻', () => {
      expect(tipIn('使用中：裡面有人｜點一下開關（有人時會敲門）', 'en')).toBe('Occupied｜Click to open or shut (knocks if occupied)')
    })
  })
  scenario('中文介面原樣顯示，對照表沒有的也原樣', ({ then }) => {
    then('不變', () => {
      expect(tipIn('飯桶', 'zh')).toBe('飯桶')
      expect(tipIn('某個沒列到的東西', 'en')).toBe('某個沒列到的東西')
    })
  })
})
