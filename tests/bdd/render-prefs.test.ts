import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { clearPref, prefOf, readPrefs, setPref, sigOf, writePrefs, type RenderPrefs } from '@/game/renderPrefs'

feature('開發者模式裡逐件設定渲染方式', () => {
  scenario('一件擺設改成平面光影，其他擺設不受影響', ({ given, when, then, and }) => {
    given('兩件擺設都是原本的渲染', (w) => { w.prefs = {} as RenderPrefs })
    when('把收銀機的光影改成平面', (w) => { w.prefs = setPref(w.prefs, 'till-register', { shade: 'flat' }) })
    then('收銀機是平面光影', (w) => { expect(prefOf(w.prefs, 'till-register').shade).toBe('flat') })
    and('飯桶還是原本的樣子', (w) => {
      expect(prefOf(w.prefs, 'ricetub')).toEqual({})
      expect(sigOf(prefOf(w.prefs, 'ricetub'))).toBe('')
    })
  })

  scenario('分開調的幾項會疊在一起，設回原本的值就等於沒調', ({ given, when, then, and }) => {
    given('收銀機已改成寫實材質', (w) => { w.prefs = setPref({}, 'till-register', { look: 'real' }) })
    when('再把它的描線關掉、不投影', (w) => { w.prefs = setPref(w.prefs, 'till-register', { ink: false, cast: false }) })
    then('三項都在', (w) => { expect(prefOf(w.prefs, 'till-register')).toEqual({ look: 'real', ink: false, cast: false }) })
    and('把材質、描線、投影都設回原本，它就不再有任何設定', (w) => {
      w.prefs = setPref(w.prefs, 'till-register', { look: 'keep', ink: true, cast: true })
      expect(prefOf(w.prefs, 'till-register')).toEqual({})
      expect('till-register' in w.prefs).toBe(false)
    })
  })

  scenario('還原一件只清掉它自己的設定', ({ given, when, then }) => {
    given('收銀機與飯桶都調過', (w) => { w.prefs = setPref(setPref({}, 'till-register', { shade: 'flat' }), 'ricetub', { look: 'unlit' }) })
    when('還原收銀機', (w) => { w.prefs = clearPref(w.prefs, 'till-register') })
    then('收銀機回到原本，飯桶的設定還在', (w) => {
      expect(prefOf(w.prefs, 'till-register')).toEqual({})
      expect(prefOf(w.prefs, 'ricetub')).toEqual({ look: 'unlit' })
    })
  })

  scenario('設定存進瀏覽器再讀出來一樣；壞掉的資料不會讓它出錯', ({ given, when, then, and }) => {
    given('收銀機改成平面、無光', (w) => { w.prefs = setPref({}, 'till-register', { shade: 'flat', look: 'unlit' }) })
    when('存起來再讀回', (w) => { w.back = readPrefs(writePrefs(w.prefs)) })
    then('讀回的設定一樣', (w) => { expect(w.back).toEqual(w.prefs) })
    and('看不懂的值會被略過', () => {
      expect(readPrefs('{"a":{"shade":"wobbly","look":"real","ink":"yes"}}')).toEqual({ a: { look: 'real' } })
      expect(readPrefs('not json')).toEqual({})
      expect(readPrefs(null)).toEqual({})
    })
  })
})
