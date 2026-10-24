import { expect } from 'vitest'
import * as THREE from 'three'
import { feature, scenario } from './bdd'
import { cameraOneOf } from '@/scene/camera1'

const home = new THREE.Vector3(3, 2, 4), target = new THREE.Vector3(0, 0.5, 0)

feature('研製料理的固定視角（攝影機 1）', () => {
  scenario('沒調整時，就是原本的 home 視角', ({ when, then }) => {
    when('位移和旋轉都是 0', (w) => { w.p = cameraOneOf(home, target, [0, 0, 0], [0, 0, 0]) })
    then('位置和看的點都不變', (w) => { expect(w.p.position.distanceTo(home)).toBeLessThan(1e-9); expect(w.p.target.distanceTo(target)).toBeLessThan(1e-9) })
  })

  scenario('移動攝影機，位置跟著動，看的方向不變', ({ when, then }) => {
    when('往 X 移 1', (w) => { w.p = cameraOneOf(home, target, [1, 0, 0], [0, 0, 0]) })
    then('位置多 1，視線方向與原來平行', (w) => {
      expect(w.p.position.x).toBeCloseTo(4, 9)
      const a = w.p.target.clone().sub(w.p.position).normalize(), b = target.clone().sub(home).normalize()
      expect(a.distanceTo(b)).toBeLessThan(1e-9)
    })
  })

  scenario('轉向（yaw）繞著垂直軸，不改變看的距離與高度變化', ({ when, then }) => {
    when('向左轉 90 度', (w) => { w.p = cameraOneOf(home, target, [0, 0, 0], [0, 90, 0]) })
    then('位置沒動，距離一樣，視線和原來垂直（水平投影）', (w) => {
      expect(w.p.position.distanceTo(home)).toBeLessThan(1e-9)
      expect(w.p.target.distanceTo(home)).toBeCloseTo(target.distanceTo(home), 9)
      const a = w.p.target.clone().sub(home).setY(0).normalize(), b = target.clone().sub(home).setY(0).normalize()
      expect(Math.abs(a.dot(b))).toBeLessThan(1e-9)
    })
  })

  scenario('抬頭（pitch）為正時，看的點升高', ({ when, then }) => {
    when('抬頭 10 度', (w) => { w.p = cameraOneOf(home, target, [0, 0, 0], [10, 0, 0]) })
    then('看的點比原來高', (w) => { expect(w.p.target.y).toBeGreaterThan(target.y) })
  })
})
