// The views the eye button (bottom left) offers, and the numbered spots edit mode marks them with (as Sketchfab's annotations): each a part of
// the shop, what it's called, a line on what's there, and what in the room it looks at (a named group, `look-…`; the grill's own view and
// the whole shop's have their own framing).
import type { Lang } from './i18n'

export type ViewId = 'grill' | 'free' | 'genkan' | 'till' | 'altar' | 'freezer' | 'toilet' | 'back'
export type ViewSpot = {
  id: ViewId
  zh: string
  ja: string
  /** what the view's on, a line for the numbered spot's tag */
  about: Record<Lang, string>
  /** the named group in the room it looks at (none: the grill's own view, or the whole shop) */
  anchor?: string
  /** how far back the camera stands from it, and how high above it */
  back?: number
  up?: number
}

export const VIEW_SPOTS: ViewSpot[] = [
  { id: 'grill', zh: '灶台區', ja: '炉端', about: { zh: '圍爐燒烤的灶台：炭火、烤魚、調味', ja: '囲炉裏の炉端：炭火、焼き魚、味付け' } },
  { id: 'free', zh: '自由視角', ja: '全体', about: { zh: '從高處斜看整間店', ja: '店全体を高いところから' } },
  { id: 'genkan', zh: '玄關區', ja: '玄関', anchor: 'look-door', back: 4.2, up: 2.1,
    about: { zh: '入口：門簾、紅燈籠、鞋櫃、招財貓台', ja: '入口：暖簾、赤提灯、下駄箱、招き猫の台' } },
  { id: 'till', zh: '櫃檯區', ja: 'レジ', anchor: 'TillMarble', back: 3.0, up: 2.0,
    about: { zh: '收銀櫃檯：收銀機、平板、刷卡機、服務鈴', ja: 'レジカウンター：レジ、タブレット、カード端末、呼び鈴' } },
  { id: 'altar', zh: '神龕區', ja: '神棚', anchor: 'look-altar', back: 2.6, up: 0.2,
    about: { zh: '神棚與供桌：供清酒可招來更多客人', ja: '神棚と供え台：御神酒を供えると客が増える' } },
  { id: 'freezer', zh: '冷藏櫃區', ja: '冷蔵庫', anchor: 'look-freezer', back: 3.2, up: 1.8,
    about: { zh: '食材冷藏櫃：研製時從這裡拿食材', ja: '食材の冷蔵庫：試作の材料はここから' } },
  { id: 'toilet', zh: '廁所區', ja: 'お手洗い', anchor: 'look-wc-m', back: 3.8, up: 2.1,
    about: { zh: '男女廁所的拉門與洗手台', ja: '男女のお手洗いの引き戸と手洗い' } },
  { id: 'back', zh: '後台區', ja: '裏方', anchor: 'look-back', back: 3.5, up: 2.0,
    about: { zh: '後場：碗盤櫃架、飯桶與作業台', ja: '裏方：食器棚、飯びつと作業台' } },
]

export const viewName = (v: ViewSpot, lang: Lang) => (lang === 'ja' ? v.ja : v.zh)
