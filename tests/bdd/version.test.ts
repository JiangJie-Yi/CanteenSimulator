import { expect } from 'vitest'
import { versionText } from '@/data/credits'
import { feature, scenario } from './bdd'

feature('關於頁的版本', () => {
  scenario('網站上：v 加版本號', ({ then }) => {
    then('0.42 寫成 v0.42', () => { expect(versionText('0.42', '開發版')).toBe('v0.42') })
  })
  scenario('本機開發：寫開發版與提交編號，前面不加 v（以前寫成 vdev）', ({ then, and }) => {
    then('有提交編號', () => { expect(versionText('dev (f63aafe)', '開發版')).toBe('開發版 (f63aafe)') })
    and('拿不到提交編號', () => { expect(versionText('dev', 'Dev build')).toBe('Dev build') })
  })
})
