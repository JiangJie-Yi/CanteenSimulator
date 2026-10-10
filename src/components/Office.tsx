import { createPortal } from 'react-dom'
import { useDrag } from '../useDrag'
import { nameIn, type Lang } from '../i18n'
import type { Dish } from '../menu'
import { CANDIDATES, ROLES, type Worker } from '../staff'
import { Avatar } from './Avatar'
import { hasIcon, Icon } from './Icon'

type Props = {
  dish: Dish
  lang: Lang
  cash: number
  stock: Record<string, number>
  unitCost: (id: string) => number
  onBuy: (id: string, n: number) => void
  /** buy n of each of these (all this shop sells if none are given) */
  onBuyAll: (n: number, ids?: string[]) => void
  /** the foods the dishes on the menu are made from: what the shop actually needs in */
  menuUses: Set<string>
  hired: Record<string, { fatigue: number }>
  onHire: (w: Worker) => void
  onFire: (w: Worker) => void
  onClose: () => void
  tab: 'stock' | 'staff'
  onTab: (t: 'stock' | 'staff') => void
  /** start the business over (wipes the save) */
  onReset: () => void
  owner: string
}

const money = (n: number) => `NT$${Math.round(n).toLocaleString()}`
/** a 1..100 rating as five stars */
const stars = (v: number) => {
  const n = Math.max(1, Math.min(5, Math.round(v / 20)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
/** a little more than a day's trade of something: what's worth having in */
const ENOUGH = 20

/**
 * The back office of the shop on screen. 採買: everything this shop can buy in, with how much is left (a bar
 * against a comfortable amount), what it costs, and whether the menu needs it; one press stocks the menu's foods
 * (or everything) ten each. 人事: the kitchen and the floor as places to fill — the owner as head chef, two cooks,
 * someone on the floor and at the till — each filled with a face, or open, with the people who could fill it.
 */
export function Office({ dish, lang, cash, stock, unitCost, onBuy, onBuyAll, menuUses, hired, onHire, onFire, onClose, tab, onTab,
  onReset, owner }: Props) {
  const goods = [...dish.bases.filter((b) => !b.includes), ...dish.items]
  const roles = ROLES[dish.id] ?? []
  const people = CANDIDATES[dish.id] ?? []
  const ja = lang === 'ja'
  const t = (zh: string, jp: string) => (ja ? jp : zh)
  const drag = useDrag('office')
  const empty = goods.every((g) => !(stock[g.id] ?? 0))
  const needed = goods.filter((g) => menuUses.has(g.id))
  const costOf = (list: typeof goods, n: number) => list.reduce((s, g) => s + unitCost(g.id) * n, 0)
  // what the menu needs first, then what's running low, then the rest
  const sorted = [...goods].sort((a, b) => Number(menuUses.has(b.id)) - Number(menuUses.has(a.id)) ||
    (stock[a.id] ?? 0) - (stock[b.id] ?? 0))
  const wages = people.filter((w) => hired[w.id]).reduce((s, w) => s + w.wage, 0)
  // (put on the page itself, over the menu and everything else)
  return createPortal(
    <section className="office" aria-label={t('經營', '事務所')} style={drag.move}>
      <header {...drag.handle}>
        <div className="ofc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'stock'} onClick={() => onTab('stock')}>{t('採買', '仕入れ')}</button>
          <button type="button" role="tab" aria-selected={tab === 'staff'} onClick={() => onTab('staff')}>{t('人事', '人事')}</button>
        </div>
        <span className={`ofc-cash${cash < 0 ? ' is-low' : ''}`}>{t('現金', '現金')} {money(cash)}</span>
        <button type="button" className="ofc-reset" onClick={onReset}>{t('重新開始', '最初から')}</button>
        <button type="button" className="ofc-close" onClick={onClose} aria-label="close">×</button>
      </header>
      {tab === 'stock' ? (
        <>
          <div className={`ofc-all${empty ? ' is-empty' : ''}`}>
            <p>{empty ? t('先進貨：有庫存的東西才能試做，上架後客人才點得到。', 'まずは仕入れ。在庫があるものだけ試作・販売できます。')
              : needed.length ? t(`菜單用到 ${needed.length} 樣食材（標「菜單」的）`, `メニューで使う食材 ${needed.length} 品`)
                : t('還沒有菜單：先試做，再到研發筆記上架。', 'メニューはまだありません。')}</p>
            {needed.length > 0 && (
              <button type="button" onClick={() => onBuyAll(10, needed.map((g) => g.id))} disabled={cash < costOf(needed, 10)}>
                {t('菜單用料各 +10', 'メニュー分 +10')} <small>{money(costOf(needed, 10))}</small>
              </button>
            )}
            <button type="button" className="ofc-all-every" onClick={() => onBuyAll(10)} disabled={cash < costOf(goods, 10)}>
              {t('全部各 +10', '全部 +10')} <small>{money(costOf(goods, 10))}</small>
            </button>
          </div>
          <ul className="ofc-list">
            {sorted.map((g) => {
              const n = stock[g.id] ?? 0
              const uses = menuUses.has(g.id)
              return (
                <li key={g.id} className={`${n === 0 ? 'is-out' : n < 5 ? 'is-low' : ''}${uses ? ' is-used' : ''}`}>
                  <span className="ofc-icon">{hasIcon(g.id) ? <Icon name={g.id} size={20} /> : null}</span>
                  <span className="ofc-name">
                    {nameIn(lang, g)}
                    {uses && <em className="ofc-tag">{t('菜單', 'メニュー')}</em>}
                  </span>
                  <span className="ofc-stock" title={`${n}`}>
                    <i style={{ width: `${Math.min(100, (n / ENOUGH) * 100)}%` }} />
                    <b>{n === 0 ? t('缺貨', '在庫なし') : n}</b>
                  </span>
                  <span className="ofc-cost">{money(unitCost(g.id))}</span>
                  {[10, 50].map((p) => (
                    <button key={p} type="button" onClick={() => onBuy(g.id, p)} disabled={cash < unitCost(g.id) * p}
                      title={money(unitCost(g.id) * p)}>+{p}</button>
                  ))}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="ofc-staff">
          {/* the team as it stands: the owner, then each place to fill */}
          <div className="ofc-team">
            <figure className="ofc-slot is-owner">
              <Avatar id="owner" look={{ female: false, age: 'middle' }} role="owner" size={48} />
              <figcaption><b>{owner || t('老闆', '店主')}</b><small>{t('大廚（你）', '大将（あなた）')}</small></figcaption>
            </figure>
            {roles.map((r) => {
              const w = people.find((x) => x.role === r.role && hired[x.id])
              return (
                <figure key={r.role} className={`ofc-slot${w ? '' : ' is-open'}`}>
                  {w ? <Avatar id={w.id} look={w.look} role={w.role} size={48} /> : <span className="ofc-slot-empty">？</span>}
                  <figcaption><b>{w ? (ja ? w.ja : w.zh) : t('徵人中', '募集中')}</b><small>{ja ? r.ja : r.zh}</small></figcaption>
                </figure>
              )
            })}
          </div>
          <p className="ofc-wages">{t(`人事成本 ${money(wages)}/小時（營業時才計薪）`, `人件費 ${money(wages)}/時（営業中のみ）`)}</p>
          {roles.map((r) => {
            const mine = people.filter((w) => w.role === r.role && hired[w.id])
            const open = people.filter((w) => w.role === r.role && !hired[w.id])
            return (
              <div key={r.role} className="ofc-role">
                <h4>{ja ? r.ja : r.zh} <small>{mine.length}/{r.max}</small></h4>
                {mine.map((w) => (
                  <div key={w.id} className="ofc-person is-hired">
                    <Avatar id={w.id} look={w.look} role={w.role} />
                    <div className="ofc-who">
                      <b>{ja ? w.ja : w.zh}</b>
                      <span className="ofc-energy" title={t('精神', '元気')}>
                        <i style={{ width: `${100 - hired[w.id].fatigue}%` }} />
                      </span>
                      <small>{t('精神', '元気')} {Math.round(100 - hired[w.id].fatigue)}・{money(w.wage)}/h</small>
                    </div>
                    <button type="button" className="ofc-fire" onClick={() => onFire(w)}>{t('解雇', '解雇')}</button>
                  </div>
                ))}
                {mine.length < r.max && open.map((w) => (
                  <div key={w.id} className="ofc-person">
                    <Avatar id={w.id} look={w.look} role={w.role} />
                    <div className="ofc-who">
                      <b>{ja ? w.ja : w.zh}</b>
                      <span className="ofc-stars">
                        <span>{t('手藝', '腕')} <em>{stars(w.skill)}</em></span>
                        <span>{t('速度', '速さ')} <em>{stars(w.speed)}</em></span>
                        <span>{t('體力', '体力')} <em>{stars(w.stamina)}</em></span>
                      </span>
                      <small className="ofc-note">{w.note}</small>
                    </div>
                    <div className="ofc-hire">
                      <b>{money(w.wage)}<small>/h</small></b>
                      <button type="button" onClick={() => onHire(w)}>{t('雇用', '雇う')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>,
    document.body,
  )
}
