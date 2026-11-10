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
    and('庫存的說明（幾樣東西各幾份）也翻', () => {
      expect(tipIn('馬鈴薯 3・地瓜 0｜點一下看常溫區的庫存', 'en')).toBe('Potato 3 · Sweet potato 0｜Click for the larder')
      expect(tipIn('剩 8 份・做飯糰的主食・點一下開常溫區補貨', 'ja')).toBe('残り 8 人前・おにぎりのご飯・クリックで常温を補充')
    })
    and('｜ 後面的操作提示各自翻', () => {
      expect(tipIn('使用中：裡面有人｜點一下開關（有人時會敲門）', 'en')).toBe('Occupied｜Click to open or shut (knocks if occupied)')
    })
  })
  scenario('洗手間的擦手紙、洗手乳、衛生紙還剩多少，也照語言顯示', ({ then, and }) => {
    then('擦手紙與洗手乳', () => {
      expect(tipIn('點一下抽一張擦手紙・還有 120 張', 'en')).toBe('Click to take a paper towel · 120 left')
      expect(tipIn('按一下擠一下・還有 248 下', 'ja')).toBe('押すと1回分出る・残り 248 回')
    })
    and('用完了、換備品', () => {
      expect(tipIn('空了！點一下換上補充包（備品 2 包）', 'en')).toBe('Empty! Click to put a refill in (2 spare)')
      expect(tipIn('抽取衛生紙 / 轉動紙捲・還夠 12 位客人用', 'en')).toBe('Pull a sheet / turn the roll · Enough for 12 more')
    })
  })
  scenario('中文介面原樣顯示，對照表沒有的也原樣', ({ then }) => {
    then('不變', () => {
      expect(tipIn('飯桶', 'zh')).toBe('飯桶')
      expect(tipIn('某個沒列到的東西', 'en')).toBe('某個沒列到的東西')
    })
  })
})
