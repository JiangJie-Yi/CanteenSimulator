import { useState } from 'react'
import { createPortal } from 'react-dom'
import { nameIn, type Lang } from '../i18n'
import type { Dish } from '../menu'
import { CANDIDATES, ROLES, type Worker } from '../staff'

type Props = {
  dish: Dish
  lang: Lang
  cash: number
  stock: Record<string, number>
  unitCost: (id: string) => number
  onBuy: (id: string, n: number) => void
  hired: Record<string, { fatigue: number }>
  onHire: (w: Worker) => void
  onFire: (w: Worker) => void
  onClose: () => void
  tab: 'stock' | 'staff'
  onTab: (t: 'stock' | 'staff') => void
  /** start the business over (wipes the save) */
  onReset: () => void
}

const money = (n: number) => `NT$${Math.round(n).toLocaleString()}`

function Bar({ v, label }: { v: number; label: string }) {
  return (
    <span className="ofc-bar" title={`${label} ${Math.round(v)}`}>
      <i>{label}</i>
      <b style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
    </span>
  )
}

/**
 * The back office of the shop on screen: 採買 (buy ingredients into stock, paid from the cash in hand) and 人事
 * (hire and let go of the staff that kind of shop needs, see who's tired).
 */
export function Office({ dish, lang, cash, stock, unitCost, onBuy, hired, onHire, onFire, onClose, tab, onTab, onReset }: Props) {
  const [packs] = useState([10, 50])
  const goods = [...dish.bases.filter((b) => !b.includes), ...dish.items]
  const roles = ROLES[dish.id] ?? []
  const people = CANDIDATES[dish.id] ?? []
  const ja = lang === 'ja'
  // (put on the page itself, over the menu and everything else)
  return createPortal(
    <section className="office" aria-label={ja ? '事務所' : '經營'}>
      <header>
        <div className="ofc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'stock'} onClick={() => onTab('stock')}>{ja ? '仕入れ' : '採買'}</button>
          <button type="button" role="tab" aria-selected={tab === 'staff'} onClick={() => onTab('staff')}>{ja ? '人事' : '人事'}</button>
        </div>
        <span className={`ofc-cash${cash < 0 ? ' is-low' : ''}`}>{ja ? '現金' : '現金'} {money(cash)}</span>
        <button type="button" className="ofc-reset" onClick={onReset}>{ja ? '最初から' : '重新開始'}</button>
        <button type="button" className="ofc-close" onClick={onClose} aria-label="close">×</button>
      </header>
      {tab === 'stock' ? (
        <ul className="ofc-list">
          {goods.map((g) => {
            const n = stock[g.id] ?? 0
            return (
              <li key={g.id} className={n === 0 ? 'is-out' : n < 5 ? 'is-low' : ''}>
                <span className="ofc-name">{nameIn(lang, g)}</span>
                <span className="ofc-stock">{n === 0 ? (ja ? '在庫なし' : '缺貨') : `${ja ? '在庫' : '庫存'} ${n}`}</span>
                <span className="ofc-cost">{money(unitCost(g.id))}/{ja ? '人前' : '份'}</span>
                {packs.map((p) => (
                  <button key={p} type="button" onClick={() => onBuy(g.id, p)} disabled={cash < unitCost(g.id) * p}>
                    +{p}
                  </button>
                ))}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="ofc-staff">
          {roles.map((r) => {
            const mine = people.filter((w) => w.role === r.role && hired[w.id])
            const open = people.filter((w) => w.role === r.role && !hired[w.id])
            return (
              <div key={r.role} className="ofc-role">
                <h4>{ja ? r.ja : r.zh} <small>{mine.length}/{r.max}</small></h4>
                {mine.map((w) => (
                  <div key={w.id} className="ofc-person is-hired">
                    <b>{ja ? w.ja : w.zh}</b>
                    <Bar v={w.skill} label={ja ? '腕' : '手藝'} />
                    <Bar v={100 - hired[w.id].fatigue} label={ja ? '元気' : '精神'} />
                    <span className="ofc-wage">{money(w.wage)}/h</span>
                    <button type="button" onClick={() => onFire(w)}>{ja ? '解雇' : '解雇'}</button>
                  </div>
                ))}
                {mine.length < r.max && open.map((w) => (
                  <div key={w.id} className="ofc-person">
                    <b>{ja ? w.ja : w.zh}</b>
                    <Bar v={w.skill} label={ja ? '腕' : '手藝'} />
                    <Bar v={w.speed} label={ja ? '速さ' : '速度'} />
                    <Bar v={w.stamina} label={ja ? '体力' : '體力'} />
                    <span className="ofc-wage">{money(w.wage)}/h</span>
                    <button type="button" onClick={() => onHire(w)}>{ja ? '雇う' : '雇用'}</button>
                    <small className="ofc-note">{w.note}</small>
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
