import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { FUTON_AT, FUTON_REST, LAY_TOTAL, RISE_TOTAL, WAKE_AT, bossRest, bossTire, bossWorn, layBeat, riseBeat, sleepsDown, wakesUp } from '@/game/bossStamina'
import { restPerHour } from '@/data/staff'

feature('老闆的體力：營業時會累、休息會回來，累了在一樓打地舖睡', () => {
  scenario('營業時在火爐前忙，會累；沒事站著時累得慢', ({ given, then, and }) => {
    given('一早精神飽滿', (w) => { w.f = 0 })
    then('忙了 6 小時，累了一半左右', (w) => { const f = bossTire(w.f, 6, true, false); expect(f).toBeGreaterThan(40); expect(f).toBeLessThan(60) })
    and('站著沒事 6 小時，只累一點點', (w) => { expect(bossTire(w.f, 6, false, false)).toBeLessThan(12) })
  })

  scenario('過了午夜累得快', ({ then }) => {
    then('同樣忙一小時，深夜比晚上累', () => { expect(bossTire(0, 1, true, true)).toBeGreaterThan(bossTire(0, 1, true, false)) })
  })

  scenario('累不會超過 100、休息不會低於 0', ({ then, and }) => {
    then('忙到很晚也停在 100', () => { expect(bossTire(95, 10, true, true)).toBe(100) })
    and('休息很久也停在 0', () => { expect(bossRest(10, 10, false)).toBe(0) })
  })

  scenario('收店時太累就不上樓，在一樓打地舖；還好就照常', ({ then, and }) => {
    then(`累到 ${FUTON_AT} 以上打地舖`, () => { expect(sleepsDown(FUTON_AT)).toBe(true); expect(sleepsDown(90)).toBe(true) })
    and('還好就不用', () => { expect(sleepsDown(FUTON_AT - 1)).toBe(false); expect(sleepsDown(30)).toBe(false) })
  })

  scenario('在地舖上睡著比醒著休息回得快，睡飽了自己起來', ({ given, then, and }) => {
    given('收店時累到 85', (w) => { w.f = 85 })
    then('睡一小時回的比醒著休息一小時多', (w) => { expect(bossRest(w.f, 1, true)).toBeLessThan(bossRest(w.f, 1, false)); expect(w.f - bossRest(w.f, 1, true)).toBe(FUTON_REST) })
    and('睡到夠了就醒', (w) => {
      const hours = (w.f - WAKE_AT) / FUTON_REST
      expect(wakesUp(bossRest(w.f, hours - 0.1, true), false)).toBe(false)
      expect(wakesUp(bossRest(w.f, hours + 0.01, true), false)).toBe(true)
    })
    and('還沒睡夠，店要開了或有人要用火爐，也會起來', (w) => { expect(wakesUp(w.f, true)).toBe(true) })
  })

  scenario('打地舖的順序：攤開墊被、放枕頭、躺下、蓋被，然後睡著', ({ then, and }) => {
    then('一開始在攤墊被', () => { expect(layBeat(0.2).phase).toBe('unroll') })
    and('依序放枕頭、躺下、蓋被', () => {
      expect(layBeat(1.6).phase).toBe('pillow')
      expect(layBeat(2.2).phase).toBe('lie')
      expect(layBeat(3.2).phase).toBe('cover')
    })
    and('都做完就睡著', () => { expect(layBeat(LAY_TOTAL + 0.01)).toEqual({ phase: 'asleep', k: 1 }) })
  })

  scenario('起床的順序：坐起來、站起來、把被子折好收走', ({ then, and }) => {
    then('先坐起來', () => { expect(riseBeat(0.3).phase).toBe('sit') })
    and('再站起來、折被子', () => { expect(riseBeat(1.2).phase).toBe('stand'); expect(riseBeat(2.0).phase).toBe('fold') })
    and('收完就好了', () => { expect(riseBeat(RISE_TOTAL + 0.01).phase).toBe('done') })
  })

  scenario('累到跟員工一樣的程度就算累壞了', ({ then }) => {
    then('85 以上', () => { expect(bossWorn(85)).toBe(true); expect(bossWorn(84)).toBe(false) })
  })

  scenario('醒著休息的速度跟員工一樣', ({ then }) => {
    then('一小時回 restPerHour', () => { expect(50 - bossRest(50, 1, false)).toBe(restPerHour) })
  })
})
