import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { GuestView } from './Roasting'
import { MiniStomach } from './Fullness'

/*
 * The shop as the AI customers see it, drawn small above the guest list: a wooden counter with four stools and
 * the noren curtain over the door on the left. A customer steps in through the noren (it sways as they pass),
 * walks along to a free stool and sits; while they wait a "…" bubble hangs over them, while they eat they lean
 * over a bowl, nodding; once they've had everything their stars float up and they walk back out the way they
 * came. Someone kept waiting too long stamps out with an anger mark.
 */

const SEATS = [34, 52, 70, 88]          // % along the counter
const DOOR = 8
const WALK_MS = 1700
const LEAVE_MS = 2600

const SKIN = ['#f3d2b0', '#eac39c', '#d9a77e', '#f6dcc0']
const HAIR = ['#2b1d14', '#4a3020', '#1c1c22', '#7a5a3a', '#9a9a9a']
const CLOTH = ['#3d6a9a', '#a8432f', '#5f7f3e', '#7b5aa0', '#c0892e', '#2f5d5a', '#8a3b5a']
const pick = <T,>(list: T[], n: number) => list[n % list.length]

/** a customer, sitting or walking: stool, kimono-ish jacket, round head, and a hat or headband now and then */
function Person({ id, walking, eating }: { id: number; walking: boolean; eating: boolean }) {
  const skin = pick(SKIN, id * 7)
  const hair = pick(HAIR, id * 3)
  const cloth = pick(CLOTH, id * 5)
  const extra = id % 4             // 0 none, 1 headband, 2 cap, 3 bun
  return (
    <svg viewBox="0 0 40 60" className={`gc-person${walking ? ' is-walking' : ''}${eating ? ' is-eating' : ''}`}
      aria-hidden="true">
      {!walking && (
        <g className="gc-stool">
          <rect x="11" y="47" width="18" height="3" rx="1.5" fill="#7a4e2a" />
          <path d="M13 50l-2 9M27 50l2 9M20 50v9" stroke="#5a3a20" strokeWidth="1.6" />
        </g>
      )}
      <g className="gc-body">
        {walking && <path className="gc-legs" d="M16 44l-2 13M24 44l2 13" stroke="#3a2e28" strokeWidth="3" strokeLinecap="round" />}
        <path d="M10 46c0-10 4-18 10-18s10 8 10 18z" fill={cloth} stroke="#3b2a20" strokeWidth="1.2" />
        <path d="M17 29l3 7 3-7" fill="none" stroke="#f1ead8" strokeWidth="1.6" />
        <g className="gc-head">
          <circle cx="20" cy="20" r="8.5" fill={skin} stroke="#3b2a20" strokeWidth="1.2" />
          <path d="M11.6 19c0-6 4-9.5 8.4-9.5s8.4 3.5 8.4 9.5c-2-3-5-4.5-8.4-4.5s-6.4 1.5-8.4 4.5z" fill={hair} />
          {extra === 1 && <rect x="11.5" y="14.5" width="17" height="3" rx="1.5" fill="#f4f0e6" stroke="#b4302a" strokeWidth="0.8" />}
          {extra === 2 && <path d="M11 15c1-6 17-6 18 0zM27 15h5" fill="#2f4a6a" stroke="#2f4a6a" strokeWidth="1.5" />}
          {extra === 3 && <circle cx="20" cy="9.5" r="3" fill={hair} />}
          <circle cx="17" cy="21" r="0.9" fill="#2a1d16" />
          <circle cx="23" cy="21" r="0.9" fill="#2a1d16" />
          <path d={eating ? 'M18 25q2 1.5 4 0' : 'M18.5 25h3'} fill="none" stroke="#7a3a2a" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
      {eating && (
        <g className="gc-bowl">
          <path d="M12 41h16q-1 6-8 6t-8-6z" fill="#e9e1cf" stroke="#3b2a20" strokeWidth="1" />
          <path d="M24 32l6 8M26 31l5 9" stroke="#8a5a30" strokeWidth="1" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave'; at: number }

export function GuestCounter({ guests, fullness }: { guests: GuestView[]; fullness: (g: GuestView) => number }) {
  const [shown, setShown] = useState<Shown[]>([])
  const [sway, setSway] = useState(0)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  useEffect(() => {
    setShown((cur) => {
      let next = [...cur]
      let swayed = false
      for (const g of guests) {
        const s = next.find((x) => x.id === g.id)
        const seated = g.state === 'waiting' || g.state === 'eating'
        if (!s && seated) {
          // a newcomer takes the first free stool
          const taken = new Set(next.map((x) => x.seat))
          const seat = SEATS.findIndex((_, i) => !taken.has(i))
          if (seat < 0) continue
          next.push({ id: g.id, seat, phase: 'enter', at: performance.now() })
          swayed = true
          timers.current.push(window.setTimeout(() => setShown((all) => all.map((x) => (x.id === g.id && x.phase === 'enter'
            ? { ...x, phase: 'sit' } : x))), WALK_MS))
        } else if (s && !seated && s.phase !== 'leave') {
          // finished (or fed up): out the way they came, and gone
          next = next.map((x) => (x.id === g.id ? { ...x, phase: 'leave', at: performance.now() } : x))
          timers.current.push(window.setTimeout(() => setSway((n) => n + 1), LEAVE_MS - 700))
          timers.current.push(window.setTimeout(() => setShown((all) => all.filter((x) => x.id !== g.id)), LEAVE_MS))
        }
      }
      if (swayed) setSway((n) => n + 1)
      return next
    })
  }, [guests])

  return (
    <div className="gc-scene" aria-hidden="true">
      <div className="gc-wall" />
      {/* the noren over the doorway: two indigo panels with the shop's crest, swaying when someone passes */}
      <div key={sway} className={`gc-noren${sway ? ' is-swaying' : ''}`}>
        <span>甲</span>
        <span>粗</span>
      </div>
      <div className="gc-counter" />
      {shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const eating = g?.state === 'eating' && s.phase === 'sit'
        const stars = g?.rating == null ? 0 : Math.max(1, Math.round(g.rating / 20))
        return (
          <div key={s.id} className={`gc-guest is-${s.phase}${g?.state === 'angry' ? ' is-angry' : ''}`}
            style={{ '--seat': `${SEATS[s.seat]}%`, '--door': `${DOOR}%` } as CSSProperties}>
            {s.phase === 'sit' && g?.state === 'waiting' && <span className="gc-bubble">…</span>}
            {s.phase === 'leave' && g?.state === 'done' && (
              <span className="gc-stars">{'★'.repeat(stars)}<i>{'★'.repeat(5 - stars)}</i></span>
            )}
            {s.phase === 'leave' && g?.state === 'angry' && (
              <svg className="gc-anger" viewBox="0 0 20 20"><path d="M3 8q5 0 5-5M17 8q-5 0-5-5M3 12q5 0 5 5M17 12q-5 0-5 5"
                fill="none" stroke="#d23a28" strokeWidth="2.4" strokeLinecap="round" /></svg>
            )}
            <span className="gc-tag">#{s.id}</span>
            {g && s.phase === 'sit' && <span className="gc-belly"><MiniStomach pct={fullness(g)} /></span>}
            <Person id={s.id} walking={s.phase !== 'sit'} eating={eating} />
          </div>
        )
      })}
    </div>
  )
}
