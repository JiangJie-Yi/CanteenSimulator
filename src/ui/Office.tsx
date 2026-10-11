import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useDrag } from './useDrag'
import type { Lang } from '@/data/i18n'
import type { Dish } from '@/data/menu'
import { ROLES, type Worker } from '@/data/staff'
import { CANDIDATES } from '@/game/hiring'
import { Avatar } from './Avatar'

type Props = {
  dish: Dish
  lang: Lang
  cash: number
  hired: Record<string, { fatigue: number }>
  onHire: (w: Worker) => void
  onFire: (w: Worker) => void
  onClose: () => void
  /** which tab is showing, and the research notebook to show in its own */
  tab: 'book' | 'staff'
  onTab: (t: 'book' | 'staff') => void
  book: ReactNode
  /** start the business over (wipes the save) */
  onReset: () => void
  owner: string
}

const money = (n: number) => `NT$${Math.round(n).toLocaleString()}`
/** a 1..100 rating as a short bar, with its number */
const Stat = ({ label, v }: { label: string; v: number }) => (
  <span className="ofc-stat" title={`${label} ${v}`}>
    <span>{label}</span>
    <i><b style={{ width: `${v}%` }} className={v >= 80 ? 'is-high' : v < 60 ? 'is-low' : ''} /></i>
    <em>{v}</em>
  </span>
)

/**
 * The back office of the shop on screen: 人事, the kitchen and the floor as places to fill — the owner as head chef,
 * two cooks, someone on the floor and at the till — each filled with a face, or open, with the people who could
 * fill it. (Buying in is done on the 試做 board itself, tag by tag.)
 */
export function Office({ dish, lang, cash, hired, onHire, onFire, onClose, onReset, owner, tab, onTab, book }: Props) {
  const roles = ROLES[dish.id] ?? []
  const people = CANDIDATES[dish.id] ?? []
  const ja = lang === 'ja'
  const t = (zh: string, jp: string) => (ja ? jp : zh)
  const drag = useDrag('office')
  const wages = people.filter((w) => hired[w.id]).reduce((s, w) => s + w.wage, 0)
  // (put on the page itself, over the menu and everything else)
  return createPortal(
    <section className="office" aria-label={t('經營', '事務所')} style={drag.move}>
      <header {...drag.handle}>
        <div className="ofc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'book'} onClick={() => onTab('book')}>{t('料理研製', '開発ノート')}</button>
          <button type="button" role="tab" aria-selected={tab === 'staff'} onClick={() => onTab('staff')}>{t('人事', '人事')}</button>
        </div>
        <span className={`ofc-cash${cash < 0 ? ' is-low' : ''}`}>{t('現金', '現金')} {money(cash)}</span>
        <button type="button" className="ofc-reset" onClick={onReset}>{t('重新開始', '最初から')}</button>
        <button type="button" className="ofc-close" onClick={onClose} aria-label="close">×</button>
      </header>
      {tab === 'book' ? book : (
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
                  <figcaption><b>{w ? (ja ? w.ja : w.zh) : t('徵人中', '募集中')}</b><small>{ja ? r.ja : r.zh.split('（')[0]}</small></figcaption>
                </figure>
              )
            })}
          </div>
          <p className="ofc-wages">{t(`人事成本 ${money(wages)}/小時（營業時才計薪）`, `人件費 ${money(wages)}/時（営業中のみ）`)}</p>
          {roles.map((r) => {
            const mine = people.filter((w) => w.role === r.role && hired[w.id])
            const open = people.filter((w) => w.role === r.role && !hired[w.id])
            return (
              <div key={r.role} className={`ofc-role is-${r.role}`}>
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
                        <Stat label={t('手藝', '腕')} v={w.skill} />
                        <Stat label={t('速度', '速さ')} v={w.speed} />
                        <Stat label={t('體力', '体力')} v={w.stamina} />
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
