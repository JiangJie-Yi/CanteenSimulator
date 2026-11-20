import { feature, scenario } from './bdd'
import { expect } from 'vitest'
import { DOOR_HOLD_S, DOOR_OPEN_S, DOOR_SEEN_S, DOOR_SHUT_S, doorShown, doorShut, doorStep, doorWanted, type DoorState, type DoorWalker } from '@/game/slideDoor'

// (item 410, the owner's 「玄關試著做和式拉門」「客人進來的時候會先開拉門再脫鞋」)
feature('玄關的拉門', () => {
  scenario('客人在門外的石階上出現，先站定一下，拉門才打開（看得出是客人自己拉開的）', ({ given, when, then, and }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('一位客人剛在門外的石階上出現、站著', () => { w.ws = [{ x: 0.085, z: 0.72, dz: 0, age: 0.1 }] })
    when('看有沒有人要開門', () => { w.want = doorWanted(w.ws) })
    then('還不開', () => expect(w.want).toBe(false))
    and(`站了 ${DOOR_SEEN_S} 秒以後，要開`, () => expect(doorWanted([{ x: 0.085, z: 0.72, dz: 0, age: DOOR_SEEN_S }])).toBe(true))
  })
  scenario('員工從外面一路走進來，不停下來，門馬上開', ({ given, when, then }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('一位員工來上班，剛在門外出現，正往門走', () => { w.ws = [{ x: 0.085, z: 0.9, dz: -1.3, age: 0.05 }] })
    when('看有沒有人要開門', () => { w.want = doorWanted(w.ws) })
    then('要開', () => expect(w.want).toBe(true))
  })
  scenario('有人往門口走出去，門提早打開，不會撞上關著的門', ({ given, when, then }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('一位員工下班，在屋內往門口走（離門還有一公尺多）', () => { w.ws = [{ x: -0.05, z: -0.7, dz: 1.3, age: 20 }] })
    when('看有沒有人要開門', () => { w.want = doorWanted(w.ws) })
    then('要開', () => expect(w.want).toBe(true))
  })
  scenario('在門內等外帶的人站著不動，門不會一直開著', ({ given, when, then }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('兩位外帶客人在玄關裡、收銀台那一側等餐，站著不動', () => {
      w.ws = [{ x: -0.43, z: 0.06, dz: 0, age: 30 }, { x: -0.65, z: -0.05, dz: 0, age: 12 }]
    })
    when('看有沒有人要開門', () => { w.want = doorWanted(w.ws) })
    then('不用開', () => expect(w.want).toBe(false))
  })
  scenario('剛從門口進來、在門內出現的人，門會開一下', ({ given, when, then }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('一位外帶客人剛在門內出現', () => { w.ws = [{ x: -0.08, z: 0.0, dz: -0.5, age: 0.2 }] })
    when('看有沒有人要開門', () => { w.want = doorWanted(w.ws) })
    then('要開', () => expect(w.want).toBe(true))
  })
  scenario('有人要開，門在一下子之內完全打開', ({ given, when, then }) => {
    const w: { st: DoorState } = { st: doorShut() }
    given('門是關著的', () => { w.st = doorShut() })
    when(`有人要開，過了 ${DOOR_OPEN_S} 秒`, () => { for (let t = 0; t < DOOR_OPEN_S + 0.02; t += 0.02) w.st = doorStep(w.st, true, 0.02) })
    then('門完全打開', () => expect(doorShown(w.st.k, w.st.opening)).toBeCloseTo(1, 5))
  })
  scenario('沒人要了，門先停一下，再自己關上', ({ given, when, then, and }) => {
    const w: { st: DoorState; mid: number } = { st: { k: 1, opening: true, idle: 0 }, mid: 0 }
    given('門是開著的', () => { w.st = { k: 1, opening: true, idle: 0 } })
    when(`沒人要開，過了 ${DOOR_HOLD_S / 2} 秒`, () => { for (let t = 0; t < DOOR_HOLD_S / 2; t += 0.02) w.st = doorStep(w.st, false, 0.02); w.mid = doorShown(w.st.k, w.st.opening) })
    then('門還開著', () => expect(w.mid).toBeCloseTo(1, 5))
    and(`再過 ${DOOR_HOLD_S + DOOR_SHUT_S} 秒，門關好了`, () => {
      for (let t = 0; t < DOOR_HOLD_S + DOOR_SHUT_S + 0.04; t += 0.02) w.st = doorStep(w.st, false, 0.02)
      expect(doorShown(w.st.k, w.st.opening)).toBe(0)
    })
  })
  scenario('關門時碰到門框會輕輕彈一下，但不會關過頭、撞進門框', ({ when, then }) => {
    const shown: number[] = []
    when('從全開關到全關，每一刻門開了多少', () => { for (let k = 1; k >= 0; k -= 0.01) shown.push(doorShown(k, false)) })
    then('沒有一刻小於全關', () => expect(Math.min(...shown)).toBeGreaterThanOrEqual(0))
  })
})
