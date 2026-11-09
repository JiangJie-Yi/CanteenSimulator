import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BACKGROUNDS, INTRO, PAY, TRAITS } from '@/data/people'
import { PEOPLE_TEXT, peopleIn } from '@/data/peopleText'
import { CANDIDATES } from '@/game/hiring'

/** every phrase in data/people's pools */
const phrases = () => {
  const out = new Set<string>()
  const add = (x: unknown) => { if (typeof x === 'string') out.add(x); else if (Array.isArray(x)) x.forEach(add); else if (x && typeof x === 'object') Object.values(x).forEach(add) }
  add(BACKGROUNDS); add(TRAITS); add(PAY); add(INTRO)
  return [...out]
}
const han = /[一-鿿]/

feature('應徵者的背景與自我介紹（日文、英文）', () => {
  scenario('詞庫裡每一句都有日文與英文', ({ then }) => {
    then('沒有一句漏掉', () => {
      const miss = phrases().filter((p) => !PEOPLE_TEXT[p] && !p.split('，').every((q) => PEOPLE_TEXT[q]))
      expect(miss).toEqual([])
    })
  })
  scenario('應徵名單在英文介面沒有中文', ({ given, then }) => {
    given('一份應徵名單', (w) => { w.people = Object.values(CANDIDATES).flat() })
    then('每個人的背景與自我介紹翻成英文後都沒有漢字', (w) => {
      for (const p of w.people as { note: string; intro: string }[]) {
        expect(peopleIn(p.note, 'en')).not.toMatch(han)
        expect(peopleIn(p.intro, 'en', true)).not.toMatch(han)
      }
    })
  })
})
