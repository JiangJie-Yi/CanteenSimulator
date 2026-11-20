import { feature, scenario } from './bdd'
import { expect } from 'vitest'
import { DOOR_HOLD_S, DOOR_OPEN_S, DOOR_SEEN_S, DOOR_SHUT_S, doorClicked, doorShown, doorShut, doorStep, doorWantOpen, doorWanted, type DoorState, type DoorWalker } from '@/game/slideDoor'

// (item 410, the owner's 「玄關試著做和式拉門」「客人進來的時候會先開拉門再脫鞋」; item 415's 「拉門我要兩節，和式得那種，且我也可以互動」)
feature('玄關的拉門', () => {
  scenario('客人在門外的石階上出現，先站定一下，拉門才打開（看得出是客人自己拉開的）', ({ given, when, then, and }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('一位客人剛在門外的石階上出現、站著', () => { w.ws = [{ x: 0.149, z: 0.72, dz: 0, age: 0.1 }] })
    when('看有沒有人要開門', () => { w.want = doorWanted(w.ws) })
    then('還不開', () => expect(w.want).toBe(false))
    and(`站了 ${DOOR_SEEN_S} 秒以後，要開`, () => expect(doorWanted([{ x: 0.149, z: 0.72, dz: 0, age: DOOR_SEEN_S }])).toBe(true))
  })
  scenario('員工從外面一路走進來，不停下來，門馬上開', ({ given, when, then }) => {
    const w: { ws: DoorWalker[]; want: boolean } = { ws: [], want: false }
    given('一位員工來上班，剛在門外出現，正往門走', () => { w.ws = [{ x: 0.149, z: 0.9, dz: -1.3, age: 0.05 }] })
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

  // (item 415: the player's hand on it)
  const run = (st: DoorState, ws: DoorWalker[], held: boolean, s: number) => { for (let t = 0; t < s; t += 0.02) st = doorStep(st, doorWantOpen(ws, held), 0.02); return st }
  scenario('店主點一下關著的拉門：門拉開，沒人經過也一直開著', ({ given, when, then }) => {
    const w: { st: DoorState; held: boolean } = { st: doorShut(), held: false }
    given('門關著，門口沒有人', () => { w.st = doorShut() })
    when('點一下門，過了 5 秒', () => { w.held = doorClicked(w.st); w.st = run(w.st, [], w.held, 5) })
    then('門還是全開', () => expect(doorShown(w.st.k, w.st.opening)).toBeCloseTo(1, 5))
  })
  scenario('再點一下：門關上；之後有客人來，門照樣自己開', ({ given, when, then, and }) => {
    const w: { st: DoorState; held: boolean } = { st: doorShut(), held: true }
    given('店主點開的門開著', () => { w.held = true; w.st = run(doorShut(), [], true, 1) })
    when(`再點一下，過了 ${DOOR_HOLD_S + DOOR_SHUT_S} 秒`, () => { w.held = doorClicked(w.st); w.st = run(w.st, [], w.held, DOOR_HOLD_S + DOOR_SHUT_S + 0.1) })
    then('門關好了', () => expect(doorShown(w.st.k, w.st.opening)).toBe(0))
    and('一位客人在門外站了一下，門自己拉開', () => {
      w.st = run(w.st, [{ x: 0.149, z: 0.72, dz: 0, age: DOOR_SEEN_S }], w.held, DOOR_OPEN_S + 0.1)
      expect(doorShown(w.st.k, w.st.opening)).toBeCloseTo(1, 5)
    })
  })
  scenario('客人正走過門口時店主把門點關：門等客人過了才關，不會夾到人', ({ given, when, then, and }) => {
    const w: { st: DoorState; held: boolean; ws: DoorWalker[] } = { st: doorShut(), held: true, ws: [] }
    given('店主點開的門開著，一位員工正往門口走出去', () => { w.st = run(doorShut(), [], true, 1); w.ws = [{ x: 0.149, z: 0.1, dz: 1.3, age: 20 }] })
    when('店主點一下門', () => { w.held = doorClicked(w.st); w.st = run(w.st, w.ws, w.held, 1) })
    then('門還開著', () => expect(doorShown(w.st.k, w.st.opening)).toBeCloseTo(1, 5))
    and('他走出去以後，門才關上', () => { w.st = run(w.st, [], w.held, DOOR_HOLD_S + DOOR_SHUT_S + 0.1); expect(doorShown(w.st.k, w.st.opening)).toBe(0) })
  })
})
