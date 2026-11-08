// The game's day and time, under the round buttons top right (the owner's: the day's count moved there; a second of ours a minute of the
// game's, the day's light coming round with it): the part of the day (the sun coming up, the sun, the sun going down, the moon), 第 3 天,
// 14:25. Only it redraws as the minutes go by. The part of the day is a button (the owner's: to look at the shop's lights in each without
// waiting): it moves the clock on to where the next part starts, and the room dissolves into that light.
import { memo, useEffect, useRef } from 'react'
import { hhmm, nextSky, skyAt, type Sky } from '@/game/clock'
import { tl, type Lang } from '@/data/i18n'
import { setTip } from '@/scene/hoverTip'
import { setSfxMuted, useSfxMuted } from '@/scene/sfx'
import { getClock, setClock, useClock } from './clockStore'

const NAMES: Record<Sky, [string, string, string]> = {
  dawn: ['清晨', '明け方', 'Dawn'], day: ['白天', '昼', 'Day'], dusk: ['黃昏', '夕暮れ', 'Dusk'], night: ['黑夜', '夜', 'Night'],
}
const AFTER: Record<Sky, Sky> = { dawn: 'day', day: 'dusk', dusk: 'night', night: 'dawn' }
const nameOf = (lang: Lang, s: Sky) => tl(lang, ...NAMES[s])

/** rays round (x, y) from r0 out to r1, n of them over the turn from a0 to a1 */
const rays = (x: number, y: number, r0: number, r1: number, n: number, a0: number, a1: number) => Array.from({ length: n }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / Math.max(1, n - (a1 - a0 >= Math.PI * 2 ? 0 : 1)), c = Math.cos(a), s = Math.sin(a)
  return <line key={i} x1={x + c * r0} y1={y + s * r0} x2={x + c * r1} y2={y + s * r1} />
})

/** the part of the day, small: the moon; the sun; at dawn and dusk half a sun on the horizon, its rays over it, a little arrow up or down */
function SkyIcon({ sky }: { sky: Sky }) {
  if (sky === 'night') return <path d="M10.6 2.2a6 6 0 1 0 3.2 9.9A5 5 0 0 1 10.6 2.2Z" />
  if (sky === 'day') return <><circle cx="8" cy="8" r="3.2" />{rays(8, 8, 5, 6.8, 8, 0, Math.PI * 2)}</>
  return (
    <>
      <path d="M4.7 10.6a3.3 3.3 0 0 1 6.6 0Z" />
      {rays(8, 10.6, 4.7, 6.3, 5, Math.PI, Math.PI * 2)}
      <line x1="1.6" y1="10.6" x2="14.4" y2="10.6" />
      <path className="game-clock-arrow" d={sky === 'dawn' ? 'M6.4 14.6 8 13 9.6 14.6' : 'M6.4 13 8 14.6 9.6 13'} />
    </>
  )
}

function GameClockImpl({ lang }: { lang: Lang }) {
  const day = useClock((c) => c.day)
  const minute = useClock((c) => Math.floor(c.minute))
  const sky = skyAt(minute)
  const hovered = useRef(false)
  const tip = () => setTip({ title: nameOf(lang, sky), hint: tl(lang, `點一下換到${nameOf(lang, AFTER[sky])}`, `クリックで${nameOf(lang, AFTER[sky])}へ`, `Click for ${nameOf(lang, AFTER[sky]).toLowerCase()}`) })
  // (pressed with the pointer still on it: its label says what it is now)
  useEffect(() => { if (hovered.current) tip() })
  useEffect(() => () => { if (hovered.current) setTip(null) }, [])
  return (
    <div className={`game-clock${sky === 'night' ? ' is-night' : ''}`} role="timer"
      aria-label={tl(lang, `第 ${day} 天 ${hhmm(minute)}`, `${day} 日目 ${hhmm(minute)}`, `Day ${day}, ${hhmm(minute)}`)}>
      <button type="button" className={`game-clock-sky is-${sky}`} onClick={() => setClock(nextSky(getClock()))}
        aria-label={tl(lang, `${nameOf(lang, sky)}，換到${nameOf(lang, AFTER[sky])}`, `${nameOf(lang, sky)}、${nameOf(lang, AFTER[sky])}へ`, `${nameOf(lang, sky)}: go on to ${nameOf(lang, AFTER[sky]).toLowerCase()}`)}
        onPointerEnter={() => { hovered.current = true; tip() }} onPointerLeave={() => { hovered.current = false; setTip(null) }}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><SkyIcon sky={sky} /></svg>
      </button>
      <span className="game-clock-day">{tl(lang, `第 ${day} 天`, `${day} 日目`, `Day ${day}`)}</span>
      <span className="game-clock-time">{hhmm(minute)}</span>
      <SfxToggle lang={lang} />
    </div>
  )
}
export const GameClock = memo(GameClockImpl)

/** the sound effects on or off (the owner's: muted on their own, top right; the music has the speaker on the wall): a little speaker at the
 * clock's end, its waves while they sound, struck through while they're muted */
function SfxToggle({ lang }: { lang: Lang }) {
  const muted = useSfxMuted()
  const hovered = useRef(false)
  const tip = (m: boolean) => setTip({ title: tl(lang, '音效', '効果音', 'Sound effects'),
    hint: m ? tl(lang, '點一下開啟音效', 'クリックでオン', 'Click to turn on') : tl(lang, '點一下關閉音效', 'クリックでオフ', 'Click to turn off') })
  return (
    <button type="button" className={`game-clock-sfx${muted ? ' is-off' : ''}`} aria-pressed={!muted}
      aria-label={tl(lang, muted ? '開啟音效' : '關閉音效', muted ? '効果音をオン' : '効果音をオフ', muted ? 'Turn sound effects on' : 'Turn sound effects off')}
      onClick={() => { setSfxMuted(!muted); if (hovered.current) tip(!muted) }}
      onPointerEnter={() => { hovered.current = true; tip(muted) }} onPointerLeave={() => { hovered.current = false; setTip(null) }}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path className="game-clock-sfx-box" d="M2.5 6h2.6L8.6 3v10L5.1 10H2.5Z" />
        {muted ? <path d="M10.6 6 14 9.8M14 6l-3.4 3.8" /> : <path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.9a5.8 5.8 0 0 1 0 8.2" />}
      </svg>
    </button>
  )
}
