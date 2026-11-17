import { memo, useEffect } from 'react'
import type { Lang } from '@/data/i18n'
import { StarIcon } from './GameIcons'
import { reviewSound } from './uiSound'

const tl = (lang: Lang, zh: string, ja: string, en: string) => (lang === 'ja' ? ja : lang === 'en' ? en : zh)

/**
 * A review just written (item 320, the owner's: 「整體的回饋感需要提升」: 好評 seen and heard as it comes): a little card dropping in under the
 * shop's sign, its stars filling to the review's, 「新評論」 beside them, then rising away; heard by how it went (a bright two-note bell for a
 * good one, a plain tick for a middling one, a low falling pair for a poor one). Each its own key: a new one shown afresh. Clicked, the
 * rating's drawer opens (App's, as the sign does).
 */
export const ReviewPop = memo(function ReviewPop({ pop, lang, onOpen }: { pop: { key: number; stars: number } | null; lang: Lang; onOpen: () => void }) {
  useEffect(() => { if (pop) reviewSound(pop.stars) }, [pop])
  if (!pop) return null
  const tone = pop.stars >= 4 ? 'is-good' : pop.stars >= 2.75 ? 'is-fair' : 'is-poor'
  return (
    <button key={pop.key} type="button" className={`review-pop ${tone}`} onClick={onOpen}
      aria-label={tl(lang, `新評論 ${pop.stars.toFixed(1)} 顆星`, `新しいレビュー ${pop.stars.toFixed(1)}`, `New review, ${pop.stars.toFixed(1)} stars`)}>
      <span className="review-pop-stars" aria-hidden="true">
        <span className="review-pop-base">{[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size="1em" />)}</span>
        <span className="review-pop-fill" style={{ width: `${Math.max(0, Math.min(1, pop.stars / 5)) * 100}%` }}>{[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size="1em" />)}</span>
      </span>
      <b>{pop.stars.toFixed(1)}</b>
      <small>{tl(lang, '新評論', '新しいレビュー', 'New review')}</small>
    </button>
  )
})
