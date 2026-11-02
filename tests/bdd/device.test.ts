import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { phoneDevice, showsFlat } from '@/game/device'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

feature('網頁版只用完整的 3D，手機用 2D', () => {
  scenario('電腦的瀏覽器是 3D', ({ given, then }) => {
    given('一般大小的視窗、電腦的瀏覽器', (w) => { w.s = { width: 1920, height: 1080, mobile: phoneDevice(DESKTOP) } })
    then('畫 3D', (w) => { expect(showsFlat(w.s)).toBe(false) })
  })

  scenario('平板也是網頁，是 3D', ({ given, then, and }) => {
    given('Android 平板與 iPad（iPad 自稱是 Mac）', (w) => { w.tablets = [ANDROID_TABLET, IPAD] })
    then('它們都不算手機', (w) => { for (const ua of w.tablets) expect(phoneDevice(ua)).toBe(false) })
    and('直放、橫放都畫 3D', (w) => {
      for (const ua of w.tablets) {
        expect(showsFlat({ width: 1024, height: 768, mobile: phoneDevice(ua) })).toBe(false)
        expect(showsFlat({ width: 768, height: 1024, mobile: phoneDevice(ua) })).toBe(false)
      }
    })
  })

  scenario('手機尺寸是 2D', ({ given, then, and }) => {
    given('手機大小的畫面（不管瀏覽器怎麼說）', () => {})
    then('直拿（窄）是 2D', () => { expect(showsFlat({ width: 390, height: 844, mobile: false })).toBe(true) })
    and('橫拿（矮）也是 2D', () => { expect(showsFlat({ width: 844, height: 390, mobile: false })).toBe(true) })
    and('電腦的視窗拉得跟手機一樣窄，也當成手機尺寸', () => { expect(showsFlat({ width: 500, height: 900, mobile: false })).toBe(true) })
  })

  scenario('手機裝置是 2D，就算它回報的畫面很大', ({ given, then, and }) => {
    given('iPhone、Android 手機（Chrome 與 Firefox）', (w) => { w.phones = [IPHONE, ANDROID_PHONE, ANDROID_FIREFOX] })
    then('它們都是手機', (w) => { for (const ua of w.phones) expect(phoneDevice(ua)).toBe(true) })
    and('畫面再大也是 2D', (w) => { for (const ua of w.phones) expect(showsFlat({ width: 1280, height: 900, mobile: phoneDevice(ua) })).toBe(true) })
  })

  scenario('瀏覽器自己說是不是手機時，聽它的', ({ given, then, and }) => {
    given('有提供「是不是手機」的瀏覽器', () => {})
    then('說是手機就是手機', () => { expect(phoneDevice(DESKTOP, true)).toBe(true) })
    and('說不是就不是', () => { expect(phoneDevice(ANDROID_PHONE, false)).toBe(false) })
  })
})
