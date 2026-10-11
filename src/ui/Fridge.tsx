import { FOOD_KINDS } from '@/data/foodKinds'
import type { Lang } from '@/data/i18n'
import type { Dish } from '@/data/menu'
import { PAR } from '@/game/economy'
import { hasIcon, Icon } from './Icon'

type Props = {
  dish: Dish
  lang: Lang
  cash: number
  stock: Record<string, number>
  /** what one portion of a food costs to buy in */
  unitCost: (id: string) => number
  onBuy: (id: string, n: number) => void
  onBuyAll: (n: number) => void
  /** 一鍵補貨: everything topped up to PAR, and what that costs (0: nothing's short) */
  onTopUp: () => void
  topUpCost: number
}

const t = (lang: Lang, zh: string, ja: string) => (lang === 'ja' ? ja : zh)

/** (for sorting the shelves: fish, other seafood, meat, vegetables and mushrooms, the rest) */
const SHELVES: { zh: string; ja: string; ids: Set<string> }[] = [
  { zh: '魚', ja: '魚', ids: new Set(FOOD_KINDS.find((k) => k.zh === '魚')!.ids) },
  { zh: '海鮮', ja: '海鮮', ids: new Set(FOOD_KINDS.find((k) => k.zh === '海鮮')!.ids) },
  { zh: '肉類', ja: '肉', ids: new Set(FOOD_KINDS.find((k) => k.zh === '肉')!.ids) },
  { zh: '蔬菜・菇類', ja: '野菜・きのこ', ids: new Set([...FOOD_KINDS.find((k) => k.zh === '蔬菜')!.ids, ...FOOD_KINDS.find((k) => k.zh === '菇類')!.ids]) },
]

/**
 * 冷藏櫃 (a tab of the office): everything the shop buys in, shelf by shelf — what a portion costs, how many are in,
 * a bar against the PAR level, whether it's out or running low — with +10 on each, and at the top what's in stock
 * altogether, how much is short, 一鍵補貨 (top everything up to PAR) and 全部各 +10.
 */
/** its own drawing, or one of its kind (a fish for a fish), or the shop's */
const iconFor = (g: { id: string; icon?: string }) => {
  const own = g.icon ?? g.id
  if (hasIcon(own)) return own
  const shelf = SHELVES.findIndex((sh) => sh.ids.has(g.id))
  return (['ExtraFish', 'ShrimpSkewer', 'Yakitori', 'GrilledShiitake'][shelf] ?? 'grilledfish')
}

export function Fridge({ dish, lang, cash, stock, unitCost, onBuy, onBuyAll, onTopUp, topUpCost }: Props) {
  const goods = [...dish.bases.filter((b) => !b.includes), ...dish.items]
  const shelves: { name: string; list: typeof goods }[] = []
  const left = new Set(goods.map((g) => g.id))
  for (const sh of SHELVES) {
    const list = goods.filter((g) => sh.ids.has(g.id) && left.has(g.id))
    list.forEach((g) => left.delete(g.id))
    if (list.length) shelves.push({ name: t(lang, sh.zh, sh.ja), list })
  }
  const rest = goods.filter((g) => left.has(g.id))
  if (rest.length) shelves.push({ name: shelves.length ? t(lang, '其他', 'その他') : t(lang, '食材', '食材'), list: rest })
  const worth = goods.reduce((n, g) => n + (stock[g.id] ?? 0) * unitCost(g.id), 0)
  const out = goods.filter((g) => !(stock[g.id] ?? 0)).length
  const low = goods.filter((g) => (stock[g.id] ?? 0) > 0 && (stock[g.id] ?? 0) < 3).length
  const all = goods.reduce((n, g) => n + unitCost(g.id) * 10, 0)
  const name = (g: (typeof goods)[number]) => (lang === 'ja' ? g.ja ?? g.name : g.name)
  return (
    <div className="fridge">
      <div className="fr-summary">
        <div className="fr-stats">
          <span><small>{t(lang, '庫存價值', '在庫額')}</small><b className="money">NT${Math.round(worth).toLocaleString()}</b></span>
          <span className={out ? 'is-out' : ''}><small>{t(lang, '缺貨', '欠品')}</small><b>{out}</b></span>
          <span className={low ? 'is-low' : ''}><small>{t(lang, '快沒了', '残りわずか')}</small><b>{low}</b></span>
        </div>
        <div className="fr-actions">
          <button type="button" className="fr-topup" disabled={!topUpCost || cash < topUpCost} onClick={onTopUp}>
            {topUpCost ? t(lang, `一鍵補貨（各補到 ${PAR} 份）`, `一括補充（各${PAR}まで）`) : t(lang, '庫存都滿了', '在庫十分')}
            {topUpCost > 0 && <small className="money">NT${topUpCost.toLocaleString()}</small>}
          </button>
          <button type="button" className="fr-all" disabled={cash < all} onClick={() => onBuyAll(10)}>
            {t(lang, '全部各 +10', '全部 +10')}<small className="money">NT${all.toLocaleString()}</small>
          </button>
        </div>
      </div>
      {shelves.map((sh) => (
        <section key={sh.name} className="fr-shelf">
          <h4>{sh.name}<small>{sh.list.length}</small></h4>
          <ul>
            {sh.list.map((g) => {
              const n = stock[g.id] ?? 0
              const cost = unitCost(g.id)
              const state = n === 0 ? 'is-out' : n < 3 ? 'is-low' : ''
              return (
                <li key={g.id} className={state}>
                  <span className="fr-icon"><Icon name={iconFor(g)} size={22} /></span>
                  <span className="fr-name"><b>{name(g)}</b>{(g as { en?: string }).en && <small lang="en">{(g as { en?: string }).en}</small>}</span>
                  <span className="fr-cost">{t(lang, '每份', '1人前')}<b className="money">NT${cost}</b></span>
                  <span className="fr-level" title={`${n}/${PAR}`}>
                    <i><b style={{ width: `${Math.min(100, (n / PAR) * 100)}%` }} /></i>
                    <em>{n}</em>
                    <small>{n === 0 ? t(lang, '缺貨', '欠品') : n < 3 ? t(lang, '快沒了', '残少') : t(lang, '充足', '十分')}</small>
                  </span>
                  <button type="button" className="fr-buy" disabled={cash < cost * 10} onClick={() => onBuy(g.id, 10)}>+10</button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
