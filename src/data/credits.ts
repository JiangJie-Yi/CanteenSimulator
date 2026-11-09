type Words = { zh: string; ja: string; en: string }
/** what was changed in the downloaded cats to use them here (CC BY asks that changes be said) */
const SHRUNK: Words = { zh: '貼圖縮小', ja: 'テクスチャを縮小', en: 'textures made smaller' }
/**
 * Models and other work used under a licence that asks for the author to be named, and what was changed in each (CC BY asks for that too):
 * shown in the shop's rating panel's 關於 tab, on the welcome card, and in README.md.
 */
export const CREDITS: { what: Words; title: string; author: string; licence: string; from: string; changed: Words }[] = [
  { what: { zh: '招財貓模型', ja: '招き猫のモデル', en: 'Lucky cat model' }, title: 'Lucky cat with animation cute maneki neko', author: 'Noth+ Studio', licence: 'CC BY 4.0', from: 'Sketchfab',
    changed: { zh: '揮手動作烘成幾個固定姿勢、手臂上的肉球貼圖抹掉、貼圖縮小', ja: '手招きを数ポーズに焼き込み、腕の肉球を消し、テクスチャを縮小', en: 'its wave baked into a few poses, the paw pads on its arm painted out, textures made smaller' } },
  { what: { zh: '招財貓模型', ja: '招き猫のモデル', en: 'Lucky cat model' }, title: 'Lucky cat maneki neko', author: 'Rice & Soy Sauce (@rice_soysauce)', licence: 'CC BY 4.0', from: 'Sketchfab', changed: SHRUNK },
  { what: { zh: '招財貓模型', ja: '招き猫のモデル', en: 'Lucky cat model' }, title: 'Maneki neko', author: 'Ramujiro (@Ramzus)', licence: 'CC BY 4.0', from: 'Sketchfab', changed: SHRUNK },
]
/** the licence's own page */
export const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/'
/** who makes the game, its source on GitHub and where it's played (GitHub Pages: the repository's name is its path) */
export const DEVELOPER = 'JiangJie-Yi'
export const DEVELOPER_URL = 'https://github.com/JiangJie-Yi'
export const REPO_URL = 'https://github.com/JiangJie-Yi/CanteenSimulator'
export const SITE_URL = 'https://jiangjie-yi.github.io/CanteenSimulator/'
/** the game's version (the owner's: up 0.01 with every push), and the AI model it's developed with */
/** the game's version: <gameVersion's whole part>.<commit count> (<short hash>), worked out by vite.config.ts as it builds or serves */
declare const __GAME_VERSION__: string | undefined
export const VERSION: string = typeof __GAME_VERSION__ === 'string' ? __GAME_VERSION__ : '0.01'
/** the version as shown: the site's v and its number; a build on the developer's own machine ('dev', or 'dev (commit)': vite.config's
 * gameVersion) as `dev` says it (開發版) and its commit, no v before it (it read vdev) */
export const versionText = (v: string, dev: string) => (v.startsWith('dev') ? v.replace(/^dev/, dev) : `v${v}`)
export const DEV_MODEL = 'Claude Opus 5.5'
