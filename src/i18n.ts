// UI language for the menu and the stage. Both modes show English small under the main name.
export type Lang = 'zh' | 'ja'

type Named = { name: string; ja?: string }
/** The main (Chinese or Japanese) name of a dish, base or menu item. */
export const nameIn = (lang: Lang, x: Named) => (lang === 'ja' ? x.ja ?? x.name : x.name)

export const UI = {
  zh: {
    menuTitle: '點菜',
    tally: (base: string, count: number, total: number) => [`${base}，加點 `, count, ` 份，合計 `, total, ' 元'] as const,
    clear: '全部取消',
    hint: '點一下加一份，右鍵減一份',
    included: '含',
    ordered: (n: number) => `已點 ${n} 份`,
    fireFull: (n: number) => `火堆已滿（最多 ${n} 樣），請先把烤好的取下，再點下一份`,
    heat: '火候',
    heatWords: ['關火', '小火', '中火', '大火'],
    fire: '火力',
    fireWords: ['快熄了', '小火', '中火', '旺火'],
    addCharcoal: '添炭',
    lang: '日',
    langLabel: '切換成日文',
  },
  ja: {
    menuTitle: '品書',
    tally: (base: string, count: number, total: number) => [`${base}・追加 `, count, ` 品・合計 `, total, ' 円'] as const,
    clear: '全て取消',
    hint: 'クリックで追加、右クリックで減らす',
    included: '込',
    ordered: (n: number) => `${n} 個注文済み`,
    fireFull: (n: number) => `炭火がいっぱいです（最大 ${n} 品）。焼けたものを取ってから注文してください`,
    heat: '火加減',
    heatWords: ['消火', '弱火', '中火', '強火'],
    fire: '火力',
    fireWords: ['消えそう', '弱火', '中火', '強火'],
    addCharcoal: '炭を足す',
    lang: '中',
    langLabel: '中国語に切り替え',
  },
} as const
