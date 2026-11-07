import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { isMac, wheelIntent } from '@/game/navInput'

feature('開發者模式在 Mac 上的觸控板與滑鼠', () => {
  scenario('捏合是縮放，雙指滑動是平移，滑鼠滾輪是推拉', ({ then, and }) => {
    then('捏合（瀏覽器送來帶 Ctrl 的滾輪）', () => { expect(wheelIntent({ ctrlKey: true, deltaX: 0, deltaY: 3, deltaMode: 0 })).toBe('pinch') })
    and('觸控板左右滑', () => { expect(wheelIntent({ ctrlKey: false, deltaX: 12, deltaY: 0, deltaMode: 0 })).toBe('pan') })
    and('觸控板上下滑（不是 120 的整數倍）', () => { expect(wheelIntent({ ctrlKey: false, deltaX: 0, deltaY: 4, deltaMode: 0, wheelDeltaY: -12 })).toBe('pan') })
    and('滑鼠滾輪一格（120）', () => { expect(wheelIntent({ ctrlKey: false, deltaX: 0, deltaY: 100, deltaMode: 0, wheelDeltaY: -120 })).toBe('zoom') })
    and('以行為單位的滾輪', () => { expect(wheelIntent({ ctrlKey: false, deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe('zoom') })
  })
  scenario('認得 Mac', ({ then }) => {
    then('MacIntel 是、Win32 不是', () => {
      expect(isMac('MacIntel')).toBe(true)
      expect(isMac('Win32')).toBe(false)
      expect(isMac('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(true)
    })
  })
})
