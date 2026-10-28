import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { freezeSelected, moveTo, offsetOf, registerMovable, resetAll, rotationOf, select, turnTo, zeroOf } from '@/shops/grill/edit'

feature('開發者模式的座標歸零', () => {
  scenario('歸零後物件不動，但現在的位置與旋轉就是新的 0', ({ given, when, then, and }) => {
    given('一件擺設被移到 (1, 0, 2)、轉了 30 度', (w) => {
      w.off = registerMovable('fz', 'fz', () => {}, () => [0, 0, 0])
      moveTo('fz', [1, 0, 2]); turnTo('fz', [0, 30, 0]); select('fz')
    })
    when('按座標歸零', () => { freezeSelected() })
    then('它還在原地，沒有被移動或轉回去', () => {
      expect(offsetOf('fz')).toEqual([1, 0, 2])
      expect(rotationOf('fz')).toEqual([0, 30, 0])
    })
    and('新的 0 就是它現在的位置與旋轉', () => {
      expect(zeroOf('fz').o).toEqual([1, 0, 2])
      expect(zeroOf('fz').r).toEqual([0, 30, 0])
    })
    then('全部還原會連歸零一起清掉', (w) => {
      resetAll()
      expect(zeroOf('fz').o).toEqual([0, 0, 0])
      w.off()
    })
  })
})
