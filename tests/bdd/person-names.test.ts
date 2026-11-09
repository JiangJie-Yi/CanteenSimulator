import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { JP_GIVEN, JP_ROMAJI, JP_SURNAMES, personName, TW_GIVEN, TW_ROMAN, TW_SURNAMES } from '@/data/people'

feature('員工的名字在英文介面拼成英文', () => {
  scenario('每個姓、每個名都拼得出來', ({ then, and }) => {
    then('日本的姓與名都有羅馬字', () => {
      const all = [...JP_SURNAMES, ...Object.values(JP_GIVEN).flatMap((a) => Object.values(a).flat())]
      expect(all.filter((n) => !JP_ROMAJI[n])).toEqual([])
    })
    and('台灣的姓與名的每個字都有拼音', () => {
      const chars = [...TW_SURNAMES, ...Object.values(TW_GIVEN).flatMap((a) => Object.values(a).flat(2))].join('')
      expect([...new Set(chars)].filter((c) => !TW_ROMAN[c])).toEqual([])
    })
  })
  scenario('名在前、姓在後', ({ then, and }) => {
    then('太田 健二 → Kenji Ota', () => { expect(personName({ zh: '太田 健二', ja: '太田 健二' }, 'en')).toBe('Kenji Ota') })
    and('林冠鈞 → Kuan-chun Lin（護照的拼法）', () => { expect(personName({ zh: '林冠鈞', ja: '林 冠鈞' }, 'en')).toBe('Kuan-chun Lin') })
    and('中文、日文照原本', () => {
      expect(personName({ zh: '林冠鈞', ja: '林 冠鈞' }, 'zh')).toBe('林冠鈞')
      expect(personName({ zh: '林冠鈞', ja: '林 冠鈞' }, 'ja')).toBe('林 冠鈞')
    })
  })
})
