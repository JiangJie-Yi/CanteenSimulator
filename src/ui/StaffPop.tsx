import { memo, useEffect } from 'react'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'
import { URGE_PACE, URGE_S } from '@/game/urge'
import { usePanelSound } from './uiSound'

/**
 * One of the staff clicked in the room (item 348, the owner's 「要有設計思維，一些交互跟互動要有」): a little card by the pointer, their name, and
 * the owner's two ways with them: a word of praise (game/affinity's canPraise: after four hours on, once a day) and a push to hurry (game/urge:
 * quicker a while, a little less fond, not again for a while). Shut with Esc, a click elsewhere, or once one's done.
 */
export type StaffPopAt = { id: string; x: number; y: number }
export const StaffPop = memo(function StaffPop({ lang, at, name, praiseOk, praiseWhy, urgeWait, onPraise, onUrge, onClose }: {
  lang: Lang; at: StaffPopAt | null; name: string
  praiseOk: boolean; praiseWhy: string
  /** seconds till they can be urged again (0: now) */
  urgeWait: number
  onPraise: () => void; onUrge: () => void; onClose: () => void
}) {
  usePanelSound(!!at)
  useEffect(() => {
    if (!at) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); e.preventDefault() } }
    // (a click anywhere off the card shuts it; not the click that opened it: from the next one)
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement | null)?.closest('.staff-pop')) onClose() }
    const t = window.setTimeout(() => window.addEventListener('pointerdown', down), 0)
    window.addEventListener('keydown', key)
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key) }
  }, [at, onClose])
  if (!at) return null
  const t3 = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  // (by the pointer, kept on the screen)
  const left = Math.max(12, Math.min(window.innerWidth - 232, at.x + 14)), top = Math.max(12, Math.min(window.innerHeight - 130, at.y - 20))
  const fast = Math.round((URGE_PACE - 1) * 100)
  return (
    <div className="staff-pop" role="dialog" aria-label={name} style={{ left, top }}>
      <b className="staff-pop-name">{name}</b>
      <div className="staff-pop-acts">
        <button type="button" disabled={!praiseOk} onClick={onPraise} title={praiseWhy}>{t3('稱讚', '褒める', 'Praise')}</button>
        <button type="button" disabled={urgeWait > 0} onClick={onUrge}
          title={urgeWait > 0 ? t3(`剛催過了：${urgeWait} 秒後才能再催`, `さっき急かした：あと ${urgeWait} 秒`, `Just hurried: again in ${urgeWait} s`)
            : t3(`催促：${URGE_S} 秒內快 ${fast}%，好感 -1`, `急かす：${URGE_S} 秒間 ${fast}% 速い、好感度 -1`, `Hurry them: ${fast}% quicker for ${URGE_S} s, bond -1`)}>
          {urgeWait > 0 ? t3(`催促（${urgeWait}）`, `急かす（${urgeWait}）`, `Hurry (${urgeWait})`) : t3('催促', '急かす', 'Hurry')}</button>
      </div>
    </div>
  )
})
