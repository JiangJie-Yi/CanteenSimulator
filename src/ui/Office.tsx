import { canDismiss } from '@/game/hiring'
import { createPortal } from 'react-dom'
import { useEffect, type ReactNode } from 'react'
import { useDrag } from './useDrag'
import type { Lang } from '@/data/i18n'
import { peopleIn } from '@/data/peopleText'
import type { Dish } from '@/data/menu'
import { isTired, ROLES, SKILLS, TIERS, type Worker } from '@/data/staff'
import { CANDIDATES, pickHires, replaceOf, ROLLS_PER_DAY } from '@/game/hiring'
import { DiceIcon, Glyph, SkillIcon } from './GameIcons'
import { setTip } from '@/scene/hoverTip'
import { crewOf, onShift as worksOn, type Rota, type Shift } from '@/game/shifts'
import { Avatar } from './Avatar'

/** the office's tabs: the kitchen's notebook, the staff, the books */
export type OfficeTab = 'book' | 'staff' | 'ledger'

type Props = {
  dish: Dish
  lang: Lang
  cash: number
  hired: Record<string, Rota>
  /** the business day whose shift is on (game/shifts' dutyDay), and putting someone on a shift (the owner's: A, B or both) */
  today: number
  onShift: (w: Worker, k: Shift) => void
  onHire: (w: Worker) => void
  /** the dice: how many draws of the applicants again by hand are left today, and drawing one (the owner's) */
  rollsLeft: number
  onRoll: () => void
  onFire: (w: Worker) => void
  /** the shop's open: no one can be let go until it's shut */
  shopOpen?: boolean
  onClose: () => void
  /** which tab is showing, and the research notebook and the books to show in their own */
  tab: OfficeTab
  onTab: (t: OfficeTab) => void
  book: ReactNode
  ledger: ReactNode
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
export function Office({ dish, lang, hired, onHire, onFire, onClose, onReset, owner, tab, onTab, book, ledger, shopOpen = false, rollsLeft, onRoll, today, onShift }: Props) {
  const roles = ROLES[dish.id] ?? []
  const people = CANDIDATES[dish.id] ?? []
  const ja = lang === 'ja'
  // (English for what has it; the rest falls back to the Chinese)
  const EN: Record<string, string> = { 一鍵徵人: 'Hire all', 人事: 'Staff', '大廚（你）': 'Head chef (you)', 女: 'F', 廚房: 'Kitchen', 手藝: 'Skill', 歲: 'yrs',
    每個空缺各雇一位最划算的人: 'Fill every opening with the best-value hire', '營業中不能解雇，請先閉店': 'Can’t dismiss while open: close first', 現金: 'Cash',
    男: 'M', 精神: 'Spirit', 經營: 'Office', 帳簿: 'Ledger', 老闆: 'Owner', 解雇: 'Dismiss', 速度: 'Speed', 重新開始遊戲: 'Start over', 雇用: 'Hire', 全: 'All', 班別: 'Shift', 疲勞: 'Tired', 空缺: 'Open', '能力減半・動作變慢': 'Half as able, slower', 替換: 'Swap in', '營業中不能替換，請先閉店': 'Not while open: close the shop first', 體力: 'Stamina', 點我徵人: 'Hiring',
    關閉: 'Close', 大廚: 'Head chef' }
  // (each job's name in English: the roster's, the cards' headings)
  const ROLE_EN: Record<string, string> = { chef: 'Sous chef', sous: 'Prep cook', server: 'Floor', cashier: 'Cashier', stock: 'Stockroom' }
  const roleOf = (r: { role: string; zh: string; ja: string }, short = false) =>
    ja ? r.ja : lang === 'en' ? ROLE_EN[r.role] ?? r.zh : short ? r.zh.split('（')[0] : r.zh
  const t = (zh: string, jp: string) => (ja ? jp : lang === 'en' ? EN[zh] ?? zh : zh)
  /** the same with its English given (what's put together, a number in it, isn't in EN's table) */
  const t3 = (zh: string, jp: string, en: string) => (ja ? jp : lang === 'en' ? en : zh)
  const drag = useDrag('office')
  // (a skill's label taken away with the office, if it was up when it shut)
  useEffect(() => () => setTip(null), [])
  // (two shifts' worth of every job (game/shifts, the owner's); the wages are the shift on duty's)
  const shiftRoles = roles.map((r) => ({ ...r, max: r.max * 2 }))
  const onToday = (w: Worker) => !!hired[w.id] && worksOn(hired[w.id].shift, today)
  const wages = people.filter(onToday).reduce((s, w) => s + w.wage, 0)
  const shiftLabel = (k: Shift) => (k === 'both' ? t3('全勤', '通し', 'Both') : t3(`${k} 班`, `${k} 番`, `Shift ${k}`))
  // (put on the page itself, over the menu and everything else)
  return createPortal(
    <>
    <h2 className="dock-title" aria-hidden="true">{lang === 'en' ? 'Office' : t('經營', '経営')}<small lang="en">OFFICE</small></h2>
    <section className="office" aria-label={t('經營', '事務所')} style={drag.move}>
      <header {...drag.handle}>
        <div className="ofc-tabs" role="tablist">
          {/* (the books first: the cash button top right opens them; the cash itself shows there, not again here) */}
          <button type="button" role="tab" aria-selected={tab === 'ledger'} onClick={() => onTab('ledger')}>{t('帳簿', '帳簿')}</button>
          <button type="button" role="tab" aria-selected={tab === 'staff'} onClick={() => onTab('staff')}>{t('人事', '人事')}</button>
          <button type="button" role="tab" aria-selected={tab === 'book'} onClick={() => onTab('book')}>{t('廚房', '厨房')}</button>
        </div>
        <button type="button" className="panel-x" onClick={onClose} aria-label={t('關閉', '閉じる')}>×</button>
      </header>
      {tab === 'book' ? book : tab === 'ledger' ? <div className="ofc-ledger ledger">{ledger}</div> : (
        <div className="ofc-staff">
          {/* the team as it stands, a strip of seats by job (the owner's: the big cards took over half the panel): the owner, then each job's
              places, a small round face with its shift on it, or a dashed ring where one's open; a face takes you down to that person's card,
              an open ring hires the best value for the job */}
          <div className="ofc-roster">
            <div className="ofc-roster-group">
              <span className="ofc-roster-role">{t('大廚', '大将')}</span>
              <span className="ofc-roster-seats">
                <span className="ofc-seat is-owner" title={`${owner || t('老闆', '店主')}・${t('大廚（你）', '大将（あなた）')}`}>
                  <Avatar id="owner" look={{ female: false, age: 'middle' }} role="owner" size={38} />
                </span>
              </span>
            </div>
            {roles.map((r) => {
              const mine = people.filter((x) => x.role === r.role && hired[x.id])
              const best = pickHires(people.filter((x) => x.role === r.role && !hired[x.id]), [{ role: r.role, max: 1 }], {})[0]
              return (
                <div key={r.role} className={`ofc-roster-group is-${r.role}`}>
                  <span className="ofc-roster-role">{roleOf(r, true)}</span>
                  <span className="ofc-roster-seats">
                    {Array.from({ length: r.max * 2 }, (_, i) => {
                      const w = mine[i]
                      if (w) {
                        const k = hired[w.id].shift ?? 'A'
                        return (
                          <button key={i} type="button" className={`ofc-seat${onToday(w) ? '' : ' is-off'}`} title={ja ? w.ja : w.zh}
                            onClick={() => document.getElementById(`ofc-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                            <Avatar id={w.id} look={w.look} role={w.role} size={38} />
                            <span className={`ofc-shift-tag is-${k}`}>{k === 'both' ? t('全', '通') : k}</span>
                          </button>
                        )
                      }
                      return (
                        <button key={i} type="button" className="ofc-seat is-open" disabled={!best} onClick={() => { if (best) onHire(best) }}
                          title={best ? t(`點一下雇用 ${best.zh}（最划算）`, `クリックで${best.ja}を採用`) : ''}>
                          <span className="ofc-seat-ring"><Glyph id="plus" size={14} /></span>
                          <small>{t('空缺', '空き')}</small>
                        </button>
                      )
                    })}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="ofc-today">{t3(`第 ${today} 營業日上班：${shiftLabel(crewOf(today))}（與全勤的人）`, `${today} 日目の出勤：${shiftLabel(crewOf(today))}（通しの人も）`, `Day ${today} on duty: ${shiftLabel(crewOf(today))} (and those on both)`)}</p>
          <div className="ofc-wages">
            <span>{t3(`今天這班的人事成本 ${money(wages)}/小時（營業時才計薪）`, `本日の人件費 ${money(wages)}/時（営業中）`, `This shift: ${money(wages)}/h while open`)}</span>
            {/* every open job filled at once, by who's the best value for their pay */}
            <button type="button" className="ofc-hireall" disabled={!pickHires(people, shiftRoles, hired).length}
              onClick={() => { for (const w of pickHires(people, shiftRoles, hired)) onHire(w) }}
              title={t('每個空缺各雇一位最划算的人', '空いている枠に一番お得な人を雇う')}>{t('一鍵徵人', 'おまかせ採用')}</button>
            {/* (the dice: the applicants drawn again, twice a day; a new lot comes each day by itself as well) */}
            <button type="button" className="ofc-roll" disabled={rollsLeft <= 0} onClick={onRoll}
              title={t(`重新刷新應徵名單（每天 ${ROLLS_PER_DAY} 次，隔天重置；每天也會自動換一批）`, `応募者を引き直す（1 日 ${ROLLS_PER_DAY} 回、翌日リセット。毎日自動でも入れ替わる）`)}>
              <DiceIcon />{t3('刷新', '引き直し', 'Reroll')} {rollsLeft}/{ROLLS_PER_DAY}</button>
          </div>
          {roles.map((r) => {
            const mine = people.filter((w) => w.role === r.role && hired[w.id])
            const open = people.filter((w) => w.role === r.role && !hired[w.id])
            return (
              <div key={r.role} className={`ofc-role is-${r.role}`}>
                <h4>{roleOf(r)} <small>{mine.length}/{r.max * 2}</small></h4>
                {mine.map((w) => (
                  <div key={w.id} id={`ofc-${w.id}`} className="ofc-person is-hired">
                    <Avatar id={w.id} look={w.look} role={w.role} />
                    <div className="ofc-who">
                      <b>{ja ? w.ja : w.zh}<Traits w={w} lang={lang} /></b>
                      <span className="ofc-energy" title={t('精神', '元気')}>
                        <i style={{ width: `${100 - hired[w.id].fatigue}%` }} />
                      </span>
                      <small>{t('精神', '元気')} {Math.round(100 - hired[w.id].fatigue)}{isTired(hired[w.id].fatigue) && <em className="ofc-tired" title={t('能力減半・動作變慢', '能力半減・動きが遅い')}>{t('疲勞', '疲労')}</em>}・{money(w.wage)}/h</small>
                    </div>
                    {/* (their shift: A, B, or both (the owner's); not while the shop's open: they'd vanish from their place) */}
                    <span className="ofc-shift" role="group" aria-label={t('班別', '班')}>
                      {(['A', 'B', 'both'] as Shift[]).map((k) => (
                        <button key={k} type="button" aria-pressed={(hired[w.id].shift ?? 'A') === k} disabled={shopOpen} onClick={() => onShift(w, k)}
                          title={shopOpen ? t3('營業中不能換班', '営業中は変更できません', 'Not while open') : k === 'both' ? t3('兩班都上（連續上班，休息恢復會打折）', '両方出勤（連勤は回復が減る）', 'On both shifts (days back to back rest you less)') : undefined}>{shiftLabel(k)}</button>
                      ))}
                    </span>
                    <button type="button" className="ofc-fire" disabled={!canDismiss(shopOpen)} onClick={() => { if (canDismiss(shopOpen)) onFire(w) }}
                      title={canDismiss(shopOpen) ? undefined : t('營業中不能解雇，請先閉店', '営業中は解雇できません。先に閉店してください')}>{t('解雇', '解雇')}</button>
                  </div>
                ))}
                {/* (who could fill it, shown when the job's full too (the owner's: they went missing): only not hireable till a place opens) */}
                {open.map((w) => (
                  <div key={w.id} className="ofc-person">
                    <Avatar id={w.id} look={w.look} role={w.role} />
                    <div className="ofc-who">
                      <b>{ja ? w.ja : w.zh}<span className={`ofc-tag-who${w.look.female ? ' is-f' : ''}`}>
                        {w.look.female ? t('女', '女性') : t('男', '男性')}・{w.years}{t('歲', '歳')}</span><Traits w={w} lang={lang} /></b>
                      <span className="ofc-stars">
                        <Stat label={t('手藝', '腕')} v={w.skill} />
                        <Stat label={t('速度', '速さ')} v={w.speed} />
                        <Stat label={t('體力', '体力')} v={w.stamina} />
                      </span>
                      <small className="ofc-note">{peopleIn(w.note, lang)}</small>
                      <small className="ofc-intro">{lang === 'en' ? `“${peopleIn(w.intro, lang, true)}”` : `「${peopleIn(w.intro, lang, true)}」`}</small>
                    </div>
                    <div className="ofc-hire">
                      <b className="money">{money(w.wage)}<small>/h</small></b>
                      {mine.length < r.max * 2
                        ? <button type="button" onClick={() => onHire(w)}>{t('雇用', '雇う')}</button>
                        // (the job full: taken on in place of the weakest there (the owner's: 雇用並替換); not while the shop's open, as firing isn't)
                        : (() => {
                            const out = replaceOf(mine), can = !!out && canDismiss(shopOpen)
                            return <button type="button" className="is-swap" disabled={!can} onClick={() => { if (out && can) { onFire(out); onHire(w) } }}
                              title={!can ? t('營業中不能替換，請先閉店', '営業中は入れ替えできません') : (lang === 'en' ? `Hire in place of ${out!.zh}, the weakest here` : t(`雇用並替換 ${out!.zh}（同職位能力最弱）`, `${out!.ja} と入れ替えて雇う`))}>{t('替換', '入替')}</button>
                          })()}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          {/* (starting the whole business over, out of the way at the foot) */}
          <p className="ofc-foot"><button type="button" className="ofc-restart" onClick={onReset}>{t('重新開始遊戲', '最初からやり直す')}</button></p>
        </div>
      )}
    </section>
    </>,
    document.body,
  )
}

/** someone's special skills (data/staff's SKILLS; the owner's), a chip after their name: its icon and name, in its quality's colour (特殊
 * green, 菁英 blue, 稀有 purple, 極品 dark gold); pointed at, the quality and what it does, in the shop's paper label */
function Traits({ w, lang }: { w: Worker; lang: Lang }) {
  if (!w.skills?.length) return null
  const ja = lang === 'ja'
  return <>{w.skills.map((k) => {
    const sk = SKILLS[k], tier = TIERS[sk.tier]
    // (pointed at: the quality and what it does in the shop's own paper label, as everything pointed at in the room says itself (the owner's))
    const title = `${ja ? tier.ja : lang === 'en' ? tier.en : tier.zh}・${ja ? sk.ja : lang === 'en' ? sk.en : sk.zh}`, hint = ja ? sk.jaSays : lang === 'en' ? sk.enSays : sk.zhSays
    return <em key={k} className={`ofc-trait is-${sk.tier}`} aria-label={`${title}：${hint}`}
      onPointerEnter={() => setTip({ title, hint })} onPointerLeave={() => setTip(null)}><SkillIcon id={k} />{ja ? sk.ja : lang === 'en' ? sk.en : sk.zh}</em>
  })}</>
}
