import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BLINK_GAP, faceNow, newFaceLife, type FaceMoment } from '@/game/faceLife'

/** a figure's face, a frame at a time (60 to the second) from `t0` to `t1`, wanting what `want(t)` says */
function run(seed: number, t1: number, want: (t: number) => string = () => 'idle', o: (t: number) => { free?: boolean; turn?: number; talk?: boolean } = () => ({ free: true })) {
  const s = newFaceLife(seed)
  const out: (FaceMoment & { t: number })[] = []
  for (let f = 0; f <= t1 * 60; f++) { const t = f / 60; out.push({ t, ...faceNow(s, t, want(t), o(t)) }) }
  return out
}
const blinkStarts = (m: (FaceMoment & { t: number })[]) => m.filter((x, i) => x.blink !== 'open' && (i === 0 || m[i - 1].blink === 'open')).map((x) => x.t)

feature('表情是活的（第 368 項：「人物表情實在很僵硬」）', () => {
  scenario('眨眼是閉上再張開，不是一格就換', ({ given, then }) => {
    given('一個人的臉，看 10 秒', (w) => { w.m = run(3, 10) })
    then('第一次眨眼依序是：半閉、全閉、半閉、張開', (w) => {
      const i = w.m.findIndex((x: FaceMoment) => x.blink !== 'open')
      const seq = w.m.slice(i, i + 16).map((x: FaceMoment) => x.blink).filter((b: string, k: number, a: string[]) => k === 0 || b !== a[k - 1])
      expect(seq.slice(0, 4)).toEqual(['half', 'shut', 'half', 'open'])
    })
  })

  scenario('眨眼的間隔不固定，偶爾連眨兩下', ({ given, then, and }) => {
    given('五個人各看兩分鐘', (w) => { w.gaps = [1, 2, 3, 4, 5].flatMap((seed) => { const b = blinkStarts(run(seed, 120)); return b.slice(1).map((t, i) => t - b[i]) }) })
    then('一般的間隔在 2～6 秒之間，而且長短不一', (w) => {
      const long = w.gaps.filter((g: number) => g > 1)
      for (const g of long) { expect(g).toBeGreaterThanOrEqual(BLINK_GAP[0]); expect(g).toBeLessThanOrEqual(BLINK_GAP[1] + 0.3) }
      expect(new Set(long.map((g: number) => g.toFixed(1))).size).toBeGreaterThan(10)
    })
    and('有連眨兩下的（間隔不到半秒）', (w) => { expect(w.gaps.some((g: number) => g < 0.5)).toBe(true) })
  })

  scenario('換表情時先閉眼，閉上的那一刻才換成新的臉', ({ given, then, and }) => {
    given('第 1 秒從平常的臉換成開心的臉', (w) => { w.m = run(7, 2, (t) => (t < 1 ? 'idle' : 'happy')) })
    then('換的那一刻開始眨眼', (w) => { const at = w.m.find((x: FaceMoment & { t: number }) => x.t >= 1); expect(at.blink).not.toBe('open') })
    and('眼睛還張著、或剛半閉時，還是原本的臉', (w) => {
      for (const x of w.m.filter((x: FaceMoment & { t: number }) => x.t >= 1 && x.t < 1.04)) expect(x.face).toBe('idle')
    })
    and('閉上之後就是開心的臉，之後一直是', (w) => {
      const shut = w.m.findIndex((x: FaceMoment & { t: number }) => x.t >= 1 && x.blink === 'shut')
      for (const x of w.m.slice(shut)) expect(x.face).toBe('happy')
    })
  })

  scenario('說話時嘴巴照音節開合', ({ given, then, and }) => {
    given('說話說 2 秒', (w) => { w.m = run(11, 2, () => 'idle', () => ({ talk: true })) })
    then('閉著、微開、張大三種都有', (w) => { expect(new Set(w.m.map((x: FaceMoment) => x.mouth))).toEqual(new Set([0, 1, 2])) })
    and('一秒開合好幾次（不是一直張著）', (w) => {
      const flips = w.m.filter((x: FaceMoment, i: number) => i > 0 && (x.mouth > 0) !== (w.m[i - 1].mouth > 0)).length
      expect(flips).toBeGreaterThanOrEqual(12)
    })
    and('不說話時嘴巴是閉的', () => { expect(run(11, 2).every((x) => x.mouth === 0)).toBe(true) })
  })

  scenario('閒著時偶爾看旁邊；頭在轉時眼睛先看過去；說話時看著前面', ({ then, and }) => {
    then('閒著 30 秒，兩邊都看過', () => { const m = run(13, 30); expect(m.some((x) => x.look === -1)).toBe(true); expect(m.some((x) => x.look === 1)).toBe(true) })
    and('頭往一邊轉，眼睛看那一邊', () => {
      expect(run(13, 1, () => 'idle', () => ({ free: true, turn: 0.5 })).at(-1)!.look).toBe(1)
      expect(run(13, 1, () => 'idle', () => ({ free: true, turn: -0.5 })).at(-1)!.look).toBe(-1)
    })
    and('說話時、忙著時都看前面', () => {
      expect(run(13, 30, () => 'idle', () => ({ free: true, talk: true })).every((x) => x.look === 0)).toBe(true)
      expect(run(13, 30, () => 'idle', () => ({ free: false })).every((x) => x.look === 0)).toBe(true)
    })
  })
})
