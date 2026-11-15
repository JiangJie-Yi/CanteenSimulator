import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PLATE_SCALE, plateFor } from '@/game/plateSize'

feature('盤子大小的標準配置（店主 2026-11-15：較大的料理用大盤，小的或點心類用小盤）', () => {
  scenario('點了整條魚或魚排，用大盤', ({ then, and }) => {
    then('秋刀魚、鮭魚、紅喉都是大盤', () => { expect(plateFor(['Saury'])).toBe('big'); expect(plateFor(['Salmon'])).toBe('big'); expect(plateFor(['Nodoguro'])).toBe('big') })
    and('套餐（有魚、飯糰、獅子唐、杏鮑菇、馬鈴薯、味噌湯）也是大盤', () => { expect(plateFor(['Saury', 'Onigiri', 'Shishito', 'KingOyster', 'Potato', 'MisoSoup'])).toBe('big') })
  })
  scenario('只點了小東西或點心，用小盤', ({ then, and }) => {
    then('串燒、蔬菜、飯糰是小盤', () => { expect(plateFor(['Yakitori', 'PorkBelly'])).toBe('small'); expect(plateFor(['Eggplant', 'Onigiri'])).toBe('small') })
    and('柳葉魚（小魚）也是小盤', () => { expect(plateFor(['Shishamo'])).toBe('small') })
    and('味噌湯另外裝碗，不算', () => { expect(plateFor(['MisoSoup', 'Onigiri'])).toBe('small') })
  })
  scenario('小盤比大盤小', ({ then }) => {
    then('小盤畫成大盤的 0.8 倍', () => { expect(PLATE_SCALE.small).toBeLessThan(PLATE_SCALE.big); expect(PLATE_SCALE.small).toBe(0.8) })
  })
})
