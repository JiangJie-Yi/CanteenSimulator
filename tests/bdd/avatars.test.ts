import { expect } from 'vitest'
import { AVATAR_SHARES, avatarOf, COATS, initialOf, PETS, SCENES, type AvatarKind, type AvatarSpec } from '@/game/avatars'
import { feature, scenario } from './bdd'

const many = (n: number) => Array.from({ length: n }, (_, i) => avatarOf(i + 1))

feature('評價的頭貼：像地圖 App 的評論一樣，每位客人自己的一張', () => {
  scenario('同一位客人每次看到的都是同一張頭貼', ({ given, when, then }) => {
    given('客人 42', (w) => { w.id = 42 })
    when('看兩次他的頭貼', (w) => { w.a = avatarOf(w.id as number); w.b = avatarOf(w.id as number) })
    then('兩次一模一樣', (w) => { expect(w.a).toEqual(w.b) })
  })
  scenario('頭貼有各種樣式：沒放照片的（名字的字或灰色人形）、寵物、風景、自拍', ({ given, when, then, and }) => {
    given('一千位客人', (w) => { w.all = many(1000) })
    when('數每一種有幾張', (w) => {
      const n: Record<string, number> = {}
      for (const a of w.all as AvatarSpec[]) n[a.kind] = (n[a.kind] ?? 0) + 1
      w.n = n
    })
    then('每一種都有', (w) => { for (const k of Object.keys(AVATAR_SHARES)) expect((w.n as Record<string, number>)[k] ?? 0).toBeGreaterThan(0) })
    and('各種的多寡大約照設定的比例', (w) => {
      for (const [k, share] of Object.entries(AVATAR_SHARES) as [AvatarKind, number][]) expect(Math.abs(((w.n as Record<string, number>)[k] ?? 0) / 1000 - share)).toBeLessThan(0.05)
    })
  })
  scenario('寵物與風景的每一種都會出現', ({ given, then, and }) => {
    given('兩千位客人', (w) => { w.all = many(2000) })
    then('每一種寵物都有人放', (w) => {
      const pets = new Set((w.all as AvatarSpec[]).flatMap((a) => (a.kind === 'pet' ? [a.pet] : [])))
      for (const p of PETS) expect(pets.has(p)).toBe(true)
    })
    and('每一種風景都有人放', (w) => {
      const scenes = new Set((w.all as AvatarSpec[]).flatMap((a) => (a.kind === 'scene' ? [a.scene] : [])))
      for (const s of SCENES) expect(scenes.has(s)).toBe(true)
    })
    and('寵物的毛色都在那種寵物有的範圍裡', (w) => {
      for (const a of w.all as AvatarSpec[]) if (a.kind === 'pet') { expect(a.coat).toBeGreaterThanOrEqual(0); expect(a.coat).toBeLessThan(COATS[a.pet]) }
    })
  })
  scenario('沒放照片的頭貼上是名字的第一個字', ({ then, and }) => {
    then('中文名字取第一個字', () => { expect(initialOf('上班族')).toBe('上') })
    and('英文取第一個字母、大寫', () => { expect(initialOf('salaryman')).toBe('S') })
    and('前面的空白不算', () => { expect(initialOf('  浴衣姐姐')).toBe('浴') })
  })
})
