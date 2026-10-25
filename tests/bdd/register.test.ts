import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DEPTS, newRegister, pressKeys, pressKey, setMode, subtotalOf, type RegKey } from '@/game/register'

const NOW = new Date(2026, 9, 25, 19, 5)
const keys = (s: string) => s.split(' ') as RegKey[]

feature('收銀機', () => {
  scenario('關機時按什麼都沒反應', ({ given, when, then }) => {
    given('模式鎖在 OFF', (w) => { w.s = setMode(newRegister(), 'OFF') })
    when('按了 7 和 部門1', (w) => { w.r = pressKeys(w.s, keys('7 D1'), NOW) })
    then('顯示幕是暗的，也沒有登錄任何品項', (w) => {
      expect(w.r.state.display).toBe('')
      expect(w.r.state.lines).toHaveLength(0)
    })
  })

  scenario('輸入金額按部門鍵就登錄一筆，顯示幕顯示那筆金額', ({ given, when, then, and }) => {
    given('開機在 REG', (w) => { w.s = newRegister() })
    when('輸入 4 2 0 再按部門1', (w) => { w.r = pressKeys(w.s, keys('4 2 0 D1'), NOW) })
    then('登錄了一筆 420 元', (w) => { expect(w.r.state.lines.map((l: { amount: number }) => l.amount)).toEqual([420]) })
    and('顯示幕顯示 420', (w) => { expect(w.r.state.display).toBe('420') })
  })

  scenario('不輸入金額直接按部門鍵，用部門的預設價格', ({ given, when, then }) => {
    given('開機在 REG', (w) => { w.s = newRegister() })
    when('直接按部門2', (w) => { w.r = pressKey(w.s, 'D2', NOW) })
    then('登錄部門2的預設價格', (w) => { expect(w.r.state.lines[0].amount).toBe(DEPTS[1].price) })
  })

  scenario('先輸入數量再按乘號，下一筆乘上數量', ({ given, when, then }) => {
    given('開機在 REG', (w) => { w.s = newRegister() })
    when('輸入 3、按 X/TIME、輸入 380、按部門1', (w) => { w.r = pressKeys(w.s, keys('3 XTIME 3 8 0 D1'), NOW) })
    then('登錄 3 份共 1140 元', (w) => { expect(w.r.state.lines[0]).toMatchObject({ qty: 3, amount: 1140 }) })
  })

  scenario('小計加總所有品項，稅鍵顯示其中的消費稅', ({ given, when, then, and }) => {
    given('登錄了 380 和 320', (w) => { w.s = pressKeys(newRegister(), keys('3 8 0 D1 3 2 0 D2'), NOW).state })
    when('按小計', (w) => { w.r = pressKey(w.s, 'SUBTOTAL', NOW) })
    then('顯示 700', (w) => { expect(w.r.state.display).toBe('700') })
    and('按稅鍵顯示內含 10% 的稅 64 元', (w) => { expect(pressKey(w.r.state, 'TAX', NOW).state.display).toBe('64') })
  })

  scenario('收現金：找零、開抽屜、印發票', ({ given, when, then, and }) => {
    given('登錄了 700 元', (w) => { w.s = pressKeys(newRegister(), keys('3 8 0 D1 3 2 0 D2'), NOW).state })
    when('輸入收到的 1000 元按現金', (w) => { w.r = pressKeys(w.s, keys('1 0 0 0 CASH'), NOW) })
    then('顯示找零 300', (w) => { expect(w.r.state.display).toBe('300') })
    and('抽屜打開', (w) => { expect(w.r.effect.drawer).toBe(true) })
    and('印出發票，列出兩個品項、合計、收款與找零', (w) => {
      expect(w.r.effect.receipt).toMatchObject({ kind: 'CASH', total: 700, tender: 1000, change: 300 })
      expect(w.r.effect.receipt.lines).toHaveLength(2)
    })
    and('今天的營業額加上這筆', (w) => { expect(w.r.state.sales).toBe(700) })
  })

  scenario('收的錢不夠就不能結帳', ({ given, when, then, and }) => {
    given('登錄了 700 元', (w) => { w.s = pressKeys(newRegister(), keys('7 0 0 D1'), NOW).state })
    when('輸入 500 按現金', (w) => { w.r = pressKeys(w.s, keys('5 0 0 CASH'), NOW) })
    then('發出錯誤聲，抽屜不開', (w) => { expect(w.r.effect.beep).toBe('error'); expect(w.r.effect.drawer).toBeFalsy() })
    and('品項還在，等著結帳', (w) => { expect(subtotalOf(w.r.state)).toBe(700) })
  })

  scenario('沒輸入金額按現金，就是剛好付清', ({ given, when, then }) => {
    given('登錄了 380 元', (w) => { w.s = pressKeys(newRegister(), keys('D1'), NOW).state })
    when('直接按現金', (w) => { w.r = pressKey(w.s, 'CASH', NOW) })
    then('找零 0，抽屜打開', (w) => { expect(w.r.state.display).toBe('0'); expect(w.r.effect.drawer).toBe(true) })
  })

  scenario('更正刪掉最後一筆，退貨讓下一筆變負的，取消清掉整筆交易', ({ given, then, and }) => {
    given('登錄了 380、320', (w) => { w.s = pressKeys(newRegister(), keys('3 8 0 D1 3 2 0 D2'), NOW).state })
    then('按更正後只剩 380', (w) => { expect(subtotalOf(pressKey(w.s, 'VOID', NOW).state)).toBe(380) })
    and('按退貨再登錄 380，小計變 320', (w) => { expect(subtotalOf(pressKeys(w.s, keys('RETURN 3 8 0 D1'), NOW).state)).toBe(320) })
    and('按取消，什麼都不剩', (w) => { expect(pressKey(w.s, 'CANCEL', NOW).state.lines).toHaveLength(0) })
  })

  scenario('折扣鍵打折最後一筆，沒輸入就是 10%', ({ given, when, then }) => {
    given('登錄了 500 元', (w) => { w.s = pressKeys(newRegister(), keys('5 0 0 D1'), NOW).state })
    when('按 −%', (w) => { w.r = pressKey(w.s, 'PCTMINUS', NOW) })
    then('小計變 450', (w) => { expect(subtotalOf(w.r.state)).toBe(450) })
  })

  scenario('開抽屜鍵在沒有交易時打開抽屜，交易中不行', ({ given, then, and }) => {
    given('開機在 REG', (w) => { w.s = newRegister() })
    then('沒有交易時按 NO SALE 抽屜打開', (w) => { expect(pressKey(w.s, 'NOSALE', NOW).effect.drawer).toBe(true) })
    and('交易進行中按 NO SALE 是錯誤', (w) => {
      const r = pressKeys(w.s, keys('D1 NOSALE'), NOW)
      expect(r.effect.drawer).toBeFalsy()
      expect(r.effect.beep).toBe('error')
    })
  })

  scenario('發票開關關掉後，結帳不印發票', ({ given, when, then }) => {
    given('按了 RCPT ON/OFF 把發票關掉，登錄 380', (w) => { w.s = pressKeys(newRegister(), keys('RCPT D1'), NOW).state })
    when('按現金結帳', (w) => { w.r = pressKey(w.s, 'CASH', NOW) })
    then('抽屜照開，但沒有發票', (w) => { expect(w.r.effect.drawer).toBe(true); expect(w.r.effect.receipt).toBeUndefined() })
  })

  scenario('計算機模式可以加減乘', ({ given, when, then }) => {
    given('按 CALC 進入計算機', (w) => { w.s = pressKey(newRegister(), 'CALC', NOW).state })
    when('算 12 + 8 × 3 =（由左到右）', (w) => { w.r = pressKeys(w.s, keys('1 2 PCTPLUS 8 XTIME 3 SUBTOTAL'), NOW) })
    then('顯示 60，而且沒有登錄任何品項', (w) => { expect(w.r.state.display).toBe('60'); expect(w.r.state.lines).toHaveLength(0) })
  })

  scenario('X 報表看今天的營業額，Z 報表看完歸零', ({ given, when, then, and }) => {
    given('今天賣了 700 元', (w) => { w.s = pressKeys(newRegister(), keys('7 0 0 D1 CASH'), NOW).state })
    when('轉到 X', (w) => { w.x = setMode(w.s, 'X') })
    then('顯示幕顯示 700', (w) => { expect(w.x.display).toBe('700') })
    and('轉到 Z 按現金印報表後，營業額歸零', (w) => {
      const r = pressKey(setMode(w.s, 'Z'), 'CASH', NOW)
      expect(r.effect.receipt?.kind).toBe('Z')
      expect(r.state.sales).toBe(0)
    })
  })
})
