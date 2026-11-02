import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { applyGroup, areasOf, chainOf, leavesOf, undoGroup, viewOf, within, type ViewCam } from '@/game/editGroups'
import { clickPick, dissolveGroup, getEdit, groupByViews, isPicked, makeGroup, pickToggle, registerMovable, select, setViewCams } from '@/shops/grill/edit'

// (two cameras eight back from what they look at, a lens as the game's: 40° high, 16:9)
const cam = (id: string, eye: [number, number, number], target: [number, number, number]): ViewCam => ({ id, eye, target, fov: 40, aspect: 16 / 9 })
const GRILL = cam('grill', [0, 2, 8], [0, 0, 0])
const TILL = cam('till', [6, 2, 8], [6, 0, 0])

feature('開發者模式依視角攝影機自動分組', () => {
  scenario('看得到它的視角裡，歸到看的地方離它最近的那個', ({ given, when, then, and }) => {
    given('灶台的攝影機看 (0, 0, 0)，櫃檯的看 (6, 0, 0)，兩台都看得到兩件擺設', (w) => { w.cams = [GRILL, TILL] })
    when('分區', (w) => { w.areas = areasOf([{ id: 'fan', at: [2, 0.5, 0] }, { id: 'bell', at: [5, 0.5, 0] }], w.cams) })
    then('靠灶台的那件歸灶台', (w) => { expect(w.areas.grill).toEqual(['fan']) })
    and('靠櫃檯的那件歸櫃檯', (w) => { expect(w.areas.till).toEqual(['bell']) })
  })

  scenario('視角為了構圖往旁邊偏時，用它要拍的東西來比遠近', ({ given, when, then }) => {
    given('灶台的攝影機看 (0, 0, 0)；玄關的攝影機看 (8, 0, 0)，但它拍的是 (5, 0, 0) 的門，畫面往旁邊偏開', (w) => {
      w.cams = [GRILL, { ...cam('genkan', [8, 2, 8], [8, 0, 0]), subject: [5, 0, 0] as [number, number, number] }]
    })
    when('一件擺設在 (3, 0, 0)：離灶台看的地方 3，離門 2', (w) => { w.v = viewOf([3, 0, 0], w.cams) })
    then('它歸玄關', (w) => { expect(w.v).toBe('genkan') })
  })

  scenario('視角自己說了拍的是什麼，就照它說的分', ({ given, when, then, and }) => {
    given('同樣兩台攝影機，櫃檯的說門口的紅燈籠是它的', (w) => { w.cams = [GRILL, TILL]; w.fixed = { chochin: 'till' } })
    when('紅燈籠掛在灶台附近，另一件擺設也在那裡', (w) => { w.areas = areasOf([{ id: 'chochin', at: [1, 2.5, 0] }, { id: 'fan', at: [1, 0.5, 0] }], w.cams, 5, w.fixed) })
    then('紅燈籠歸櫃檯', (w) => { expect(w.areas.till).toEqual(['chochin']) })
    and('另一件照攝影機歸灶台', (w) => { expect(w.areas.grill).toEqual(['fan']) })
  })

  scenario('掛在高處的東西照它下面的地方分', ({ given, when, then }) => {
    given('同樣兩台攝影機', (w) => { w.cams = [GRILL, TILL] })
    when('一盞燈掛在櫃檯上方，比攝影機還高', (w) => { w.v = viewOf([5, 3.2, 0], w.cams) })
    then('它歸櫃檯，和放在地上一樣', (w) => { expect(w.v).toBe('till'); expect(viewOf([5, 0, 0], w.cams)).toBe('till') })
  })

  scenario('在攝影機背後的，不算那台看得到', ({ given, when, then }) => {
    given('灶台的攝影機往 -z 看；冰箱的攝影機站在 (5, 2, 0) 往 -x 看 (2, 0, 0)', (w) => { w.cams = [GRILL, cam('fridge', [5, 2, 0], [2, 0, 0])] })
    when('一件擺設在 (6, 0, 0)：在冰箱攝影機的背後，離它看的地方反而比較近', (w) => { w.v = viewOf([6, 0, 0], w.cams) })
    then('它歸看得到它的灶台', (w) => { expect(w.v).toBe('grill') })
  })

  scenario('哪台攝影機都看不到時，歸到看的地方最近的那個；太遠就不歸', ({ given, then, and }) => {
    given('灶台的攝影機站在 (0, 2, 3) 看 (0, 0, 0)', (w) => { w.cams = [cam('grill', [0, 2, 3], [0, 0, 0])] })
    then('攝影機背後 4 遠的東西還是歸灶台', (w) => { expect(viewOf([0, 0, 4], w.cams)).toBe('grill') })
    and('背後 7 遠的不歸任何一區', (w) => { expect(viewOf([0, 0, 7], w.cams)).toBeNull() })
  })

  scenario('移動過的群組裡，一個點放進去再拿回來還是同一個點', ({ given, then }) => {
    given('一個群組繞 (1, 0, 2) 轉了 30°、10°、-20°，放大 1.5 倍，移了 (2, 0.5, -1)', (w) => {
      w.g = { pivot: [1, 0, 2], t: [2, 0.5, -1], yaw: 10, s: 1.5, r: [30, 10, -20] }
    })
    then('照它的變換搬過去、再照反過來的搬回來，回到原點', (w) => {
      const back = undoGroup(w.g, applyGroup(w.g, [0.3, 1.2, -0.7]))
      back.forEach((v, k) => expect(v).toBeCloseTo([0.3, 1.2, -0.7][k], 9))
    })
    then('中心點只會被移動，不會被轉或縮放', (w) => {
      expect(applyGroup(w.g, [1, 0, 2])).toEqual([3, 0.5, 1])
    })
  })

  scenario('群組裡可以再放群組', ({ given, then, and }) => {
    given('櫃檯區裡有收銀櫃組與飯桶，收銀櫃組裡有收銀機與錢箱', (w) => {
      w.g = { 'grp-view-till': { members: ['grp-till', 'ricetub'] }, 'grp-till': { members: ['register', 'cashbox'] } }
    })
    then('收銀機在收銀櫃組裡，收銀櫃組在櫃檯區裡', (w) => { expect(chainOf(w.g, 'register')).toEqual(['grp-till', 'grp-view-till']) })
    and('櫃檯區底下的擺設是收銀機、錢箱、飯桶', (w) => { expect(leavesOf(w.g, 'grp-view-till')).toEqual(['register', 'cashbox', 'ricetub']) })
    and('飯桶在櫃檯區裡，但不在收銀櫃組裡', (w) => {
      expect(within(w.g, 'ricetub', 'grp-view-till')).toBe(true)
      expect(within(w.g, 'ricetub', 'grp-till')).toBe(false)
    })
  })

  scenario('進開發者模式時，每台攝影機看的區域各成一組，原本的群組整組放進去', ({ given, when, then, and }) => {
    given('灶台旁有團扇與行燈，櫃檯上有收銀櫃組的收銀機與筆筒，兩台視角攝影機', (w) => {
      const at = (v: [number, number, number]) => () => v
      w.off = [
        registerMovable('fan', '團扇', () => {}, at([1, 0.5, 0])),
        registerMovable('lantern', '行燈', () => {}, at([-1, 0.5, 0.5])),
        registerMovable('till-register', '收銀機', () => {}, at([6, 0.5, 0])),
        registerMovable('till-pens', '筆筒', () => {}, at([6.3, 0.5, 0.2])),
      ]
      setViewCams(() => [GRILL, TILL])
    })
    when('分組', () => { groupByViews() })
    then('灶台區有團扇與行燈', () => { expect(getEdit().groups['grp-view-grill'].members).toEqual(['fan', 'lantern']) })
    and('櫃檯區裡是整個收銀櫃組', () => { expect(getEdit().groups['grp-view-till'].members).toEqual(['grp-till']) })
    and('區的名字是視角的名字', () => {
      expect(getEdit().groups['grp-view-grill'].name).toBe('火烤灶台區')
      expect(getEdit().groups['grp-view-till'].name).toBe('櫃檯區')
    })
    then('在場景裡點收銀機選到的是收銀櫃組，點團扇選到的是團扇自己（區要從清單選）', () => {
      expect(clickPick('till-register')).toBe('grp-till')
      expect(clickPick('fan')).toBe('fan')
    })
    and('選到櫃檯區時，收銀機也算被選到', () => {
      select('grp-view-till')
      expect(isPicked('till-register')).toBe(true)
      expect(isPicked('fan')).toBe(false)
      select(null)
    })
    when('在灶台區裡把團扇和行燈組成一組', (w) => { pickToggle('fan'); pickToggle('lantern'); makeGroup(); w.mine = getEdit().selected })
    then('新的群組在灶台區裡面', (w) => {
      expect(getEdit().groups['grp-view-grill'].members).toEqual([w.mine])
      expect(getEdit().groups[w.mine].members).toEqual(['fan', 'lantern'])
    })
    when('解散櫃檯區', () => { dissolveGroup('grp-view-till') })
    then('收銀櫃組還在，不在任何區裡', () => {
      expect(getEdit().groups['grp-till']).toBeTruthy()
      expect(getEdit().groups['grp-view-till']).toBeUndefined()
    })
    and('再分一次也不會再做出櫃檯區', () => {
      groupByViews()
      expect(getEdit().groups['grp-view-till']).toBeUndefined()
    })
    then('解散灶台區裡的小群組，團扇與行燈回到灶台區', (w) => {
      dissolveGroup(w.mine)
      expect(getEdit().groups['grp-view-grill'].members).toEqual(['fan', 'lantern'])
      for (const off of w.off) off()
      setViewCams(null)
    })
  })
})
