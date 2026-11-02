// The game's day and time, under the round buttons top right (the owner's: the day's count moved there; a second of ours a minute of the
// game's, day and night coming round with it): a sun or a moon, 第 3 天, 14:25. Only it redraws as the minutes go by.
import { memo } from 'react'
import { hhmm, isNight } from '@/game/clock'
import { tl, type Lang } from '@/data/i18n'
import { useClock } from './clockStore'

function GameClockImpl({ lang }: { lang: Lang }) {
  const day = useClock((c) => c.day)
  const minute = useClock((c) => Math.floor(c.minute))
  const night = isNight(minute)
  return (
    <div className={`game-clock${night ? ' is-night' : ''}`} role="timer"
      aria-label={tl(lang, `第 ${day} 天 ${hhmm(minute)}`, `${day} 日目 ${hhmm(minute)}`, `Day ${day}, ${hhmm(minute)}`)}>
      <svg className="game-clock-sky" viewBox="0 0 16 16" aria-hidden="true">
        {night
          ? <path d="M10.6 2.2a6 6 0 1 0 3.2 9.9A5 5 0 0 1 10.6 2.2Z" />
          : <>
            <circle cx="8" cy="8" r="3.2" />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a)
              return <line key={i} x1={8 + c * 5} y1={8 + s * 5} x2={8 + c * 6.8} y2={8 + s * 6.8} />
            })}
          </>}
      </svg>
      <span className="game-clock-day">{tl(lang, `第 ${day} 天`, `${day} 日目`, `Day ${day}`)}</span>
      <span className="game-clock-time">{hhmm(minute)}</span>
    </div>
  )
}
export const GameClock = memo(GameClockImpl)
