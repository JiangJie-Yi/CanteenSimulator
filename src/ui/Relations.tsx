import { personName } from '@/data/people'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'
import type { Worker } from '@/data/staff'
import { BOND_START, bondOf, moodWord, pairKey } from '@/game/affinity'
import { commuteOf } from '@/game/commute'
import type { Rota } from '@/game/shifts'
import { onShift } from '@/game/shifts'
import { Avatar } from './Avatar'

/**
 * The relations chart beside 人事 (item 323, the owner's, 2026-11-18: 「人事旁放一個關係圖，是老闆與員工，員工與員工之間，以及誰留宿」): the
 * owner in the middle, the staff round them; a line from the owner to each, as thick and as warm a colour as their bond (red cold, grey as
 * it stands, green warm), and between each two of them a finer one the same way; a little house by those who live upstairs (the owner and
 * the cooks); those not on today faded. Over it the shop's atmosphere (工作氣氛), what they all feel together.
 */
const SIZE = 300, MID = SIZE / 2, RING = 112, FACE = 40
const warmth = (b: number) => (b >= 65 ? '#3f9a5a' : b >= 40 ? '#9a8f80' : '#c0503a')
const width = (b: number) => 1 + (bondOf(b) / 100) * 4
/** whether two on these shifts are ever on the same day */
const together = (a: string | undefined, b: string | undefined) => (a ?? 'A') === 'both' || (b ?? 'A') === 'both' || (a ?? 'A') === (b ?? 'A')

export function Relations({ people, hired, pairs, atmos, today, lang }: {
  people: Worker[]; hired: Record<string, Rota>; pairs: Record<string, number>; atmos: number; today: number; lang: Lang
}) {
  const staff = people.filter((w) => hired[w.id])
  const at = (k: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / Math.max(1, staff.length)
    return { x: MID + Math.cos(a) * RING, y: MID + Math.sin(a) * RING }
  }
  const spots = staff.map((w, k) => ({ w, ...at(k), on: onShift(hired[w.id].shift, today), bond: bondOf(hired[w.id].bond) }))
  const words = [tl(lang, '冷淡', 'ぎすぎす', 'Cold'), tl(lang, '生硬', 'ぎこちない', 'Stiff'), tl(lang, '普通', 'ふつう', 'As usual'),
    tl(lang, '融洽', 'なごやか', 'Good'), tl(lang, '熱絡', 'にぎやか', 'Warm')]
  const house = (x: number, y: number) => (
    <g transform={`translate(${x} ${y})`} className="rel-dorm">
      <path d="M-7 1 L0 -6 L7 1 L5 1 L5 7 L-5 7 L-5 1 Z" />
      <rect x="-1.6" y="2.5" width="3.2" height="4.5" />
    </g>
  )
  return (
    <div className="rel">
      <div className="rel-mood">
        <b>{tl(lang, '工作氣氛', '職場の空気', 'Atmosphere')}</b>
        <i><span style={{ width: `${Math.round(atmos)}%`, background: warmth(atmos) }} /></i>
        <em>{Math.round(atmos)}・{words[moodWord(atmos)]}</em>
      </div>
      {staff.length === 0 ? <p className="rel-none">{tl(lang, '還沒有員工', 'スタッフがいません', 'No staff yet')}</p> : (
        <div className="rel-chart" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            {/* (between each two of them, fine) */}
            {/* (only those who can be on the same day: a pair on different shifts never works together) */}
            {spots.flatMap((a, i) => spots.slice(i + 1).filter((b) => together(hired[a.w.id].shift, hired[b.w.id].shift)).map((b) => {
              const v = pairs[pairKey(a.w.id, b.w.id)] ?? BOND_START
              return <line key={`${a.w.id}-${b.w.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={warmth(v)} strokeWidth={width(v) * 0.45}
                strokeDasharray="3 3" opacity={a.on && b.on ? 0.75 : 0.25} />
            }))}
            {/* (the owner to each) */}
            {spots.map((s) => <line key={s.w.id} x1={MID} y1={MID} x2={s.x} y2={s.y} stroke={warmth(s.bond)} strokeWidth={width(s.bond)} opacity={s.on ? 0.95 : 0.35} />)}
            {/* (the owner lives upstairs, and the cooks: a little house by each) */}
            {house(MID + FACE * 0.62, MID - FACE * 0.62)}
            {spots.filter((s) => commuteOf(s.w.role) === 'dorm').map((s) => <g key={s.w.id}>{house(s.x + FACE * 0.62, s.y - FACE * 0.62)}</g>)}
          </svg>
          <span className="rel-face is-owner" style={{ left: MID - FACE / 2, top: MID - FACE / 2 }} title={tl(lang, '老闆（你）', '店主（あなた）', 'Owner (you)')}>
            <Avatar id="owner" look={{ female: false, age: 'middle' }} role="owner" size={FACE} />
          </span>
          {spots.map((s) => (
            <span key={s.w.id} className={`rel-face${s.on ? '' : ' is-off'}`} style={{ left: s.x - FACE / 2, top: s.y - FACE / 2 }}
              title={`${personName(s.w, lang)}${lang === 'en' ? ': ' : '：'}${tl(lang, '好感', '好感度', 'bond')} ${Math.round(s.bond)}`}>
              <Avatar id={s.w.id} look={s.w.look} role={s.w.role} size={FACE} />
              <small style={{ color: warmth(s.bond) }}>{Math.round(s.bond)}</small>
            </span>
          ))}
        </div>
      )}
      <p className="rel-key">
        <span><i style={{ background: '#3f9a5a' }} />{tl(lang, '好', '良い', 'Warm')}</span>
        <span><i style={{ background: '#9a8f80' }} />{tl(lang, '普通', 'ふつう', 'As usual')}</span>
        <span><i style={{ background: '#c0503a' }} />{tl(lang, '差', '悪い', 'Cold')}</span>
        <span><svg width="14" height="14" viewBox="-8 -7 16 15" className="rel-dorm-key"><path d="M-7 1 L0 -6 L7 1 L5 1 L5 7 L-5 7 L-5 1 Z" /></svg>{tl(lang, '住宿', '住み込み', 'Lives in')}</span>
        <span>{tl(lang, '實線老闆、虛線同事', '実線は店主、点線は同僚', 'Solid: you · dashed: each other')}</span>
      </p>
    </div>
  )
}
