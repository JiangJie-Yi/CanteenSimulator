import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { OUTFIT_COLOURS } from '@/data/bossOutfit'
import { OUTFIT_DEFAULT, colourOf, readOutfit, recolour, recolourPixels } from '@/game/bossOutfit'

feature('老闆可以換衣服（第 376 項：「老闆可客製化服裝」）', () => {
  scenario('沒選過、或存的東西不對：照原本的樣子', ({ then, and }) => {
    then('什麼都沒存：每一件都是原本的', () => { expect(readOutfit(null)).toEqual(OUTFIT_DEFAULT) })
    and('存了不認得的顏色或部位：那一件照原本的，其他照存的', () => {
      expect(readOutfit({ coat: 'indigo', apron: 'rainbow', hat: 'red' })).toEqual({ ...OUTFIT_DEFAULT, coat: 'indigo' })
    })
    and('原本的顏色沒有色碼（就是模型本來的圖），選了的有', () => {
      expect(colourOf(OUTFIT_DEFAULT, 'coat')).toBeNull()
      expect(colourOf({ ...OUTFIT_DEFAULT, apron: 'vermilion' }, 'apron')).not.toBeNull()
    })
    and('每一件都有三種以上可以選', () => { for (const list of Object.values(OUTFIT_COLOURS)) expect(list.length).toBeGreaterThanOrEqual(3) })
  })

  scenario('換色保留布紋和皺褶的深淺，字還是白的', ({ given, then, and }) => {
    given('紺色的前掛（底色）換成朱色', (w) => { w.base = [0.12, 0.16, 0.28]; w.to = [0.71, 0.27, 0.18] })
    then('底色的地方變成朱色', (w) => { const c = recolour(w.base, w.base, w.to); for (let i = 0; i < 3; i++) expect(c[i]).toBeCloseTo(w.to[i], 2) })
    and('暗一點的皺褶，換色後也暗一點', (w) => {
      const crease = recolour(w.base.map((x: number) => x * 0.75), w.base, w.to), flat = recolour(w.base, w.base, w.to)
      expect(crease[0]).toBeLessThan(flat[0])
    })
    and('前掛上白色的字（比布亮很多），換色後還是白的', (w) => {
      const c = recolour([0.94, 0.92, 0.86], w.base, w.to)
      for (const x of c) expect(x).toBeGreaterThan(0.85)
    })
    and('染成淺色（白頭巾）時，白色的印花改用布原本的深色印，不會白底白花看不見', (w) => {
      const c = recolour([0.94, 0.92, 0.86], w.base, [0.94, 0.92, 0.89])
      for (let i = 0; i < 3; i++) expect(c[i]).toBeCloseTo(w.base[i], 2)
    })
  })

  scenario('整張圖一次換色（點一下就換）：每一點跟一點一點換的一樣，不是這件衣服的地方不動', ({ given, when, then, and }) => {
    given('一張四個點的圖：前掛的底色、前掛的皺褶、上衣的白、一點不是衣服的膚色', (w) => {
      w.src = new Uint8ClampedArray([31, 41, 71, 255, 23, 31, 54, 255, 245, 240, 230, 255, 220, 170, 140, 200])
      w.partOf = new Uint8Array([2, 2, 1, 0])
      w.dyes = [null, { base: [0.12, 0.16, 0.28], target: [0.71, 0.27, 0.18] }]
    })
    when('只換前掛的顏色', (w) => { w.out = new Uint8ClampedArray(16); recolourPixels(w.src, w.out, w.partOf, w.dyes) })
    then('前掛的兩點跟一點一點換的一樣', (w) => {
      for (const p of [0, 1]) {
        const one = recolour([w.src[p * 4] / 255, w.src[p * 4 + 1] / 255, w.src[p * 4 + 2] / 255], w.dyes[1].base, w.dyes[1].target)
        for (let i = 0; i < 3; i++) expect(Math.abs(w.out[p * 4 + i] - one[i] * 255)).toBeLessThanOrEqual(1)
      }
    })
    and('上衣（沒換）和膚色的點原封不動，透明度也不變', (w) => {
      for (let i = 8; i < 16; i++) expect(w.out[i]).toBe(w.src[i])
    })
  })
})
