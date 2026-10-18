import { CREDITS } from '@/data/credits'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useDrag } from './useDrag'
import type { Lang } from '@/data/i18n'
import type { Dish } from '@/data/menu'
import { ROLES, type Worker } from '@/data/staff'
import { CANDIDATES, pickHires } from '@/game/hiring'
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
  tab: 'book' | 'staff' | 'fridge'
  onTab: (t: 'book' | 'staff' | 'fridge') => void
  book: ReactNode
  /** the 冷藏櫃: what's in stock, and buying in */
  fridge: ReactNode
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
export function Office({ dish, lang, cash, hired, onHire, onFire, onClose, onReset, owner, tab, onTab, book, fridge }: Props) {
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
          <button type="button" role="tab" aria-selected={tab === 'book'} onClick={() => onTab('book')}>{t('廚房', '厨房')}</button>
          <button type="button" role="tab" aria-selected={tab === 'staff'} onClick={() => onTab('staff')}>{t('人事', '人事')}</button>
          <button type="button" role="tab" aria-selected={tab === 'fridge'} onClick={() => onTab('fridge')}>{t('冷藏櫃', '冷蔵庫')}</button>
        </div>
        <span className={`ofc-cash${cash < 0 ? ' is-low' : ''}`}>{t('現金', '現金')} <b className="money">{money(cash)}</b></span>
        {/* every open job filled at once, by who's the best value for their pay */}
        <button type="button" className="ofc-reset ofc-autohire" disabled={!pickHires(people, roles, hired).length}
          onClick={() => { onTab('staff'); for (const w of pickHires(people, roles, hired)) onHire(w) }}
          title={t('每個空缺各雇一位最划算的人', '空いている枠に一番お得な人を雇う')}>{t('一鍵徵人', 'おまかせ採用')}</button>
        <button type="button" className="ofc-close" onClick={onClose} aria-label="close">×</button>
      </header>
      {tab === 'book' ? book : tab === 'fridge' ? fridge : (
        <div className="ofc-staff">
          {/* the team as it stands: the owner, then each place to fill */}
          <div className="ofc-team">
            <figure className="ofc-slot is-owner">
              <Avatar id="owner" look={{ female: false, age: 'middle' }} role="owner" size={48} />
              <figcaption><b>{owner || t('老闆', '店主')}</b><small>{t('大廚（你）', '大将（あなた）')}</small></figcaption>
            </figure>
            {roles.flatMap((r) => {
              const mine = people.filter((x) => x.role === r.role && hired[x.id])
              // one place for each person the job takes (two on the floor); an open one is filled with a click, by the
              // applicant who's the best value for their pay; a filled one shows that person below
              return Array.from({ length: r.max }, (_, i) => {
                const w = mine[i]
                const best = w ? null : pickHires(people.filter((x) => x.role === r.role && !hired[x.id]), [{ role: r.role, max: 1 }], {})[0]
                return (
                  <figure key={`${r.role}-${i}`} className={`ofc-slot${w ? '' : ' is-open'}`}>
                    <button type="button" className="ofc-slot-btn" disabled={!w && !best}
                      title={w ? (ja ? w.ja : w.zh) : best ? t(`點一下雇用 ${best.zh}（最划算）`, `クリックで${best.ja}を採用`) : ''}
                      onClick={() => {
                        if (w) document.getElementById(`ofc-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        else if (best) onHire(best)
                      }}>
                      {w ? <Avatar id={w.id} look={w.look} role={w.role} size={48} /> : <span className="ofc-slot-empty">＋</span>}
                    </button>
                    <figcaption><b>{w ? (ja ? w.ja : w.zh) : t('點我徵人', '募集中')}</b><small>{ja ? r.ja : r.zh.split('（')[0]}</small></figcaption>
                  </figure>
                )
              })
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
                  <div key={w.id} id={`ofc-${w.id}`} className="ofc-person is-hired">
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
                      <b>{ja ? w.ja : w.zh}<span className={`ofc-tag-who${w.look.female ? ' is-f' : ''}`}>
                        {w.look.female ? t('女', '女性') : t('男', '男性')}・{w.years}{t('歲', '歳')}</span></b>
                      <span className="ofc-stars">
                        <Stat label={t('手藝', '腕')} v={w.skill} />
                        <Stat label={t('速度', '速さ')} v={w.speed} />
                        <Stat label={t('體力', '体力')} v={w.stamina} />
                      </span>
                      <small className="ofc-note">{w.note}</small>
                      {!ja && <small className="ofc-intro">「{w.intro}」</small>}
                    </div>
                    <div className="ofc-hire">
                      <b className="money">{money(w.wage)}<small>/h</small></b>
                      <button type="button" onClick={() => onHire(w)}>{t('雇用', '雇う')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          {/* (starting the whole business over, out of the way at the foot) */}
          <p className="ofc-foot"><button type="button" className="ofc-restart" onClick={onReset}>{t('重新開始遊戲', '最初からやり直す')}</button></p>
          {/* (the work used under a licence that asks for its author to be named) */}
          <p className="ofc-credits">
            {CREDITS.map((c) => `${t(c.what.zh, c.what.ja)}：「${c.title}」 by ${c.author}（${c.licence}、${c.from}）`).join(' ／ ')}
          </p>
        </div>
      )}
    </section>,
    document.body,
  )
}
