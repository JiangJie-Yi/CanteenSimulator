// The shop's rating (the owner's: every customer's satisfaction made into the shop's stars, as a review site shows them; the shop's sign
// clicked opens it): its stars and how many have rated it, the food, the service and the place each on its own, and what the latest
// customers said as they went (game/reputation).
import { useEffect } from 'react'
import { guestLabel } from '@/data/guests'
import { tl, type Lang } from '@/data/i18n'
import { remarkOf, satisfaction, starsOf, type Rating, type Remark, type Visit } from '@/game/reputation'

const REMARK: Record<Remark, [string, string, string]> = {
  great: ['烤得剛剛好，太好吃了！', '焼き加減が最高、うまい！', 'Grilled just right. Delicious!'],
  good: ['好吃，會再來', 'おいしかった、また来たい', 'Good. I’ll be back'],
  fine: ['還可以', 'まあまあ', 'It was all right'],
  poor: ['不太好吃…', 'いまいち…', 'Not great…'],
  walkedOut: ['等不到餐點，走了', '料理が来なくて帰った', 'Gave up waiting and left'],
  wait: ['等太久了', '待たされた', 'Waited too long'],
  tissue: ['抽屜裡沒有衛生紙', 'ティッシュがなかった', 'No tissues at my place'],
  toilet: ['廁所不乾淨', 'トイレが汚かった', 'The toilet wasn’t clean'],
  dark: ['店裡太暗了', '店が暗すぎた', 'It was too dark to eat'],
  sick: ['吃完肚子痛', '食べたらお腹が痛くなった', 'Got a stomach ache after'],
  nothing: ['沒有想吃的', '食べたいものがなかった', 'Nothing I wanted'],
}

/** five stars, filled as far as `v` (1..5) goes */
function Stars({ v, big = false }: { v: number; big?: boolean }) {
  return (
    <span className={`rep-stars${big ? ' is-big' : ''}`} aria-hidden="true">
      <span className="rep-stars-base">★★★★★</span>
      <span className="rep-stars-fill" style={{ width: `${Math.max(0, Math.min(1, v / 5)) * 100}%` }}>★★★★★</span>
    </span>
  )
}

export function Reputation({ lang, rating, visits, onClose }: { lang: Lang; rating: Rating; visits: Visit[]; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const parts: [string, number | null][] = [
    [tl(lang, '料理', '料理', 'Food'), rating.food],
    [tl(lang, '服務', 'サービス', 'Service'), rating.service],
    [tl(lang, '環境', '店内', 'The place'), rating.place],
  ]
  const latest = visits.slice(-6).reverse()
  return (
    <section className="rep-card" role="dialog" aria-label={tl(lang, '店家評價', 'お店の評価', 'The shop’s rating')}>
      <header className="rep-head">
        <b>{tl(lang, '店家評價', 'お店の評価', 'The shop’s rating')}</b>
        <button type="button" className="panel-x" onClick={onClose} aria-label={tl(lang, '關閉', '閉じる', 'Close')}>×</button>
      </header>
      {rating.stars === null ? (
        <p className="rep-empty">{tl(lang, '還沒有客人評價：開店迎客吧。', 'まだ評価がない。お店を開けよう。', 'No one’s rated it yet: open up and let them in.')}</p>
      ) : (
        <>
          <div className="rep-score">
            <strong>{rating.stars.toFixed(2)}</strong>
            <Stars v={rating.stars} big />
            <small>{tl(lang, `${rating.n} 則評價`, `${rating.n} 件の評価`, `${rating.n} ratings`)}</small>
          </div>
          <ul className="rep-parts">
            {parts.map(([name, v]) => (
              <li key={name}><span>{name}</span><Stars v={v ?? 0} /><b>{v === null ? '—' : v.toFixed(2)}</b></li>
            ))}
          </ul>
          <h4 className="rep-recent-head">{tl(lang, '最近的客人說', '最近のお客さんの声', 'What the latest said')}</h4>
          <ul className="rep-recent">
            {latest.map((v, i) => {
              const s = starsOf(satisfaction(v))
              const [zh, ja, en] = REMARK[remarkOf(v)]
              return (
                <li key={`${v.id}-${i}`}>
                  <span className="rep-who">{guestLabel(v.id, lang)}<Stars v={s} /></span>
                  <span className="rep-said">「{tl(lang, zh, ja, en)}」</span>
                </li>
              )
            })}
          </ul>
          <p className="rep-note">{tl(lang, '最近 60 位客人的滿意度（越近的越重）：美味、等候時間、衛生紙、廁所、燈光、身體狀況都算。',
            '最近 60 人の満足度（新しいほど重い）：味・待ち時間・ティッシュ・トイレ・照明・体調。',
            'The latest 60 customers’ satisfaction, newer counting more: the food, the wait, the tissues, the toilet, the light, how they felt after.')}</p>
        </>
      )}
    </section>
  )
}
