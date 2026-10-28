import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { dissolveGroup, getEdit, groupable, groupOf, makeGroup, moveTo, offsetOf, pickToggle, registerMovable, resetAll, scaleOf, scaleTo, select, toRoom, type V3 } from '@/shops/grill/edit'

const centers: Record<string, V3> = { a: [0, 0, 0], b: [2, 0, 0], c: [0, 0, 4], noCenter: [9, 9, 9] }
const setup = () => {
  // (the groups the shop comes with are set aside: each scenario starts with none)
  Object.keys(getEdit().groups).forEach((g) => dissolveGroup(g))
  const offs = Object.entries(centers).map(([id, c]) => registerMovable(id, id, () => {}, id === 'noCenter' ? undefined : () => c))
  return () => offs.forEach((f) => f())
}

feature('編輯模式的群組', () => {
  scenario('門口的招財貓台和四隻招財貓，一開始就是一組', ({ then }) => {
    then('有一個群組，成員是貓台和四隻貓', () => {
      const g = getEdit().groups['grp-doorcats']
      expect(g).toBeDefined()
      expect([...g.members].sort()).toEqual(['doorcat0', 'doorcat1', 'doorcat2', 'doorcat3', 'doorcats'])
      expect([g.t, g.yaw, g.s]).toEqual([[0, 0, 0], 0, 1])
    })
  })

  scenario('小神龕的供桌和桌上的東西，一開始就是一組', ({ then }) => {
    then('有一個群組，成員是供桌和供桌上的供品', () => {
      expect([...getEdit().groups['grp-altar'].members].sort()).toEqual(['altar', 'altarfittings'])
    })
  })

  scenario('點選兩件以上的擺設可以成組，群組的中心在它們中間', ({ given, when, then, and }) => {
    given('清單裡有 a、b、c 三件可成組的擺設', (w) => { w.off = setup(); select(null) })
    when('Ctrl 點選 a 和 b，再按成組', () => { pickToggle('a'); pickToggle('b'); makeGroup() })
    then('產生一個群組，成員是 a、b', () => {
      const groups = Object.values(getEdit().groups)
      expect(groups).toHaveLength(1)
      expect(groups[0].members.sort()).toEqual(['a', 'b'])
    })
    and('群組的轉動中心在 a、b 的正中間，一開始沒有移動、轉向或放大', () => {
      const g = Object.values(getEdit().groups)[0]
      expect(g.pivot).toEqual([1, 0, 0])
      expect([g.t, g.yaw, g.s]).toEqual([[0, 0, 0], 0, 1])
    })
    and('a 已經屬於群組，不能再被選去成組', () => { expect(groupOf('a')).not.toBeNull(); expect(groupable()).not.toContain('a') })
    then('清理', (w) => { Object.keys(getEdit().groups).forEach((g) => dissolveGroup(g)); w.off() })
  })

  scenario('只選一件不能成組', ({ given, when, then }) => {
    given('清單裡有 a、b', (w) => { w.off = setup(); select(null) })
    when('只點選 a 就按成組', () => { pickToggle('a'); makeGroup() })
    then('沒有任何群組產生', (w) => { expect(Object.keys(getEdit().groups)).toHaveLength(0); w.off() })
  })

  scenario('沒有中心點的東西（例如閘門）不能成組', ({ given, when, then }) => {
    given('清單裡有 a 和一件沒有中心點的東西', (w) => { w.off = setup(); select(null) })
    when('兩件都選了', () => { pickToggle('a'); pickToggle('noCenter') })
    then('可成組的只剩 a', (w) => { expect(groupable()).toEqual(['a']); w.off() })
  })

  scenario('移動群組是整組一起動，成員自己的位置不變', ({ given, when, then, and }) => {
    given('a、b 已成一組', (w) => { w.off = setup(); select(null); pickToggle('a'); pickToggle('b'); makeGroup(); w.gid = getEdit().selected })
    when('把群組往 X 方向移 0.5', (w) => { moveTo(w.gid, [0.5, 0, 0]) })
    then('群組的位移是 0.5', (w) => { expect(offsetOf(w.gid)).toEqual([0.5, 0, 0]); expect(toRoom(w.gid, offsetOf(w.gid))).toEqual([0.5, 0, 0]) })
    and('成員 a、b 自己的偏移還是 0', () => { expect(offsetOf('a')).toEqual([0, 0, 0]); expect(offsetOf('b')).toEqual([0, 0, 0]) })
    then('清理', (w) => { dissolveGroup(w.gid); w.off() })
  })

  scenario('群組只有一個大小，改任一軸就是整組一起放大', ({ given, when, then }) => {
    given('a、b 已成一組', (w) => { w.off = setup(); select(null); pickToggle('a'); pickToggle('b'); makeGroup(); w.gid = getEdit().selected })
    when('把縮放的 Y 欄改成 2', (w) => { scaleTo(w.gid, [1, 2, 1]) })
    then('三軸都是 2', (w) => { expect(scaleOf(w.gid)).toEqual([2, 2, 2]); dissolveGroup(w.gid); w.off() })
  })

  scenario('解散群組後，成員各回自己的位置，還原全部也會讓群組回到原狀', ({ given, when, then, and }) => {
    given('a、b 已成一組並且移過', (w) => { w.off = setup(); select(null); pickToggle('a'); pickToggle('b'); makeGroup(); w.gid = getEdit().selected; moveTo(w.gid, [1, 0, 0]) })
    when('按還原全部', () => { resetAll() })
    then('群組還在，但回到沒有移動的樣子', (w) => { expect(getEdit().groups[w.gid]).toBeDefined(); expect(offsetOf(w.gid)).toEqual([0, 0, 0]) })
    when('再解散它', (w) => { dissolveGroup(w.gid) })
    then('群組消失，a、b 又都能成組', (w) => { expect(getEdit().groups[w.gid]).toBeUndefined(); expect(groupOf('a')).toBeNull(); w.off() })
  })
})
