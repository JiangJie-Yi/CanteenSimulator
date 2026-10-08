import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { GuestView } from './Roasting'
import { MoodFace } from './MoodFace'

/*
 * The inside of the shop on screen, drawn small above the guest list, each of the three in its own style:
 *   聞野燒烤  a dark-timbered robata bar: menu slips (短冊) hung along the wall, red paper lanterns, a shelf of sake,
 *            and behind the counter the charcoal grill with the chef (板前) fanning it, the cashier at the till
 *   鼎沸火鍋  a red-walled hot pot room: a gold 福 diamond, round lanterns with tassels, a black menu board, a pass
 *            window onto the kitchen where the back-kitchen cooks chop, floor staff carrying trays out
 *   甲粗飽食堂 a white-tiled noodle shop: wooden menu plaques, a ceiling fan, the stockpot steaming, the noodle cook
 *            in his tall white hat lifting noodles with a strainer
 * Customers come in through the noren (it sways), walk to a stool and sit; a "…" while they wait, nodding over the
 * bowl while they eat; when they're done their face says how it was and they walk back out. Someone kept waiting
 * too long stamps out with an anger mark. Only the staff actually hired are there.
 */

const SEATS = [34, 50, 66, 82]          // % along the counter
const DOOR = 7
const WALK_MS = 1700
const LEAVE_MS = 2600

const SKIN = ['#f3d2b0', '#eac39c', '#d9a77e', '#f6dcc0', '#c99470']
const HAIR = ['#2b1d14', '#4a3020', '#1c1c22', '#7a5a3a', '#a8a8a8', '#5a3a2a']
const pick = <T,>(list: T[], n: number) => list[n % list.length]
const INK = '#3b2a20'

/** customers come in all sorts: office workers in a suit, students, an old man in a cardigan, a woman in a
 * yukata, someone in a hoodie… with glasses or a cap now and then */
function Person({ id, walking, eating }: { id: number; walking: boolean; eating: boolean }) {
  const skin = pick(SKIN, id * 7 + 1)
  const kind = id % 6                  // 0 suit, 1 hoodie, 2 yukata, 3 student, 4 elder, 5 t-shirt
  const hair = kind === 4 ? '#c8c8c8' : pick(HAIR, id * 3)
  const wide = id % 3 === 0 ? 1.12 : id % 3 === 1 ? 0.94 : 1
  const glasses = id % 4 === 1 || kind === 4
  const cap = kind === 1 && id % 2 === 0
  const longHair = kind === 2 || (kind === 3 && id % 2) || (kind === 5 && id % 4 === 3)
  const top = { 0: '#2f3a4a', 1: pick(['#6d7f8c', '#8a4a3a', '#4a6a4a'], id), 2: pick(['#3a5a8c', '#a84a6a', '#5a7a5a'], id),
    3: '#23324a', 4: '#8a7a5a', 5: pick(['#e8e0d0', '#c0892e', '#7b5aa0', '#3d8a8a'], id) }[kind] as string
  return (
    <svg viewBox="0 0 40 60" className={`gc-person${walking ? ' is-walking' : ''}${eating ? ' is-eating' : ''}`}
      aria-hidden="true">
      {!walking && (
        <g className="gc-stool">
          <ellipse cx="20" cy="48.5" rx="9.5" ry="2.2" fill="#8a5a30" stroke={INK} strokeWidth="0.8" />
          <path d="M13 50l-2 9M27 50l2 9M20 50v9" stroke="#5a3a20" strokeWidth="1.6" />
        </g>
      )}
      <g className="gc-body" transform={`translate(20 0) scale(${wide} 1) translate(-20 0)`}>
        {walking && (
          <g className="gc-legs">
            <path d="M16 44l-2 12M24 44l2 12" stroke={kind === 0 ? '#2a2f3a' : kind === 3 ? '#23324a' : '#3a3a40'} strokeWidth="3.4"
              strokeLinecap="round" />
            <path d="M12 56h4M24 56h4" stroke="#1c1c1c" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        )}
        {/* the body: shoulders and arms in the clothes, with the details of each kind */}
        <path d="M9 47c0-11 4-19 11-19s11 8 11 19z" fill={top} stroke={INK} strokeWidth="1.1" />
        {kind === 0 && <><path d="M17 29l3 9 3-9" fill="#f4f1ea" /><path d="M20 30l-1 2 1 7 1-7z" fill="#a8322a" /></>}
        {kind === 1 && <><path d="M14 30q6 5 12 0" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.4" /><path d="M18 36v5M22 36v5" stroke="#f1ead8" strokeWidth="0.9" /></>}
        {kind === 2 && <><path d="M15 29l5 9 5-9" fill="none" stroke="#f4f0e6" strokeWidth="1.6" /><path d="M10 40h20" stroke="#e8c45a" strokeWidth="3" /></>}
        {kind === 3 && <><path d="M14 29l6 6 6-6" fill="#f4f1ea" stroke={INK} strokeWidth="0.6" /><path d="M18 34l2 3 2-3z" fill="#c4302a" /></>}
        {kind === 4 && <><path d="M20 29v18" stroke="rgb(0 0 0 / 0.3)" strokeWidth="1" /><circle cx="20" cy="34" r="0.8" fill="#3b2a20" /><circle cx="20" cy="39" r="0.8" fill="#3b2a20" /></>}
        {kind === 5 && <path d="M15 33h10" stroke="rgb(255 255 255 / 0.5)" strokeWidth="2" />}
        <g className="gc-head">
          {longHair && <path d="M11 20c0 9 2 12 9 12s9-3 9-12z" fill={hair} />}
          <circle cx="20" cy="20" r="8.5" fill={skin} stroke={INK} strokeWidth="1.1" />
          <path d="M11.6 19c0-6 4-9.5 8.4-9.5s8.4 3.5 8.4 9.5c-2-3-5-4.5-8.4-4.5s-6.4 1.5-8.4 4.5z" fill={hair} />
          {kind === 4 && <path d="M13 13q7-5 14 0" fill="none" stroke={skin} strokeWidth="2.4" />}
          {kind === 2 && <><circle cx="27" cy="13" r="2.4" fill={hair} /><path d="M26 11l4-3" stroke="#c4302a" strokeWidth="1" /></>}
          {cap && <path d="M11 15c1-7 17-7 18 0zM27 15h6" fill="#2f4a6a" stroke="#2f4a6a" strokeWidth="1.6" />}
          {glasses ? (
            <g fill="none" stroke="#2a1d16" strokeWidth="0.8">
              <circle cx="16.8" cy="21" r="2" /><circle cx="23.2" cy="21" r="2" /><path d="M18.8 21h2.4" />
            </g>
          ) : (
            <><circle cx="17" cy="21" r="0.9" fill="#2a1d16" /><circle cx="23" cy="21" r="0.9" fill="#2a1d16" /></>
          )}
          <circle cx="15" cy="24" r="1.3" fill="#f2907a" opacity="0.35" />
          <circle cx="25" cy="24" r="1.3" fill="#f2907a" opacity="0.35" />
          <path d={eating ? 'M18 25.5q2 1.5 4 0' : 'M18.5 25.5h3'} fill="none" stroke="#7a3a2a" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
      {eating && (
        <g className="gc-bowl">
          <path d="M12 41h16q-1 6-8 6t-8-6z" fill="#e9e1cf" stroke={INK} strokeWidth="1" />
          <path d="M13 42h14" stroke="#3a5a8c" strokeWidth="0.8" />
          <path d="M24 32l6 8M26 31l5 9" stroke="#8a5a30" strokeWidth="1" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

/** a member of staff, drawn standing behind the counter (or walking, for floor staff) */
function Staff({ look, action }: { look: 'itamae' | 'cook' | 'noodle' | 'cashier' | 'server'; action?: boolean }) {
  const coat = { itamae: '#f1ece0', cook: '#f4f1ea', noodle: '#f6f4ee', cashier: '#3d6a9a', server: '#2a2a2e' }[look]
  return (
    <svg viewBox="0 0 40 60" className={`gc-staff gc-staff-${look}${action ? ' is-working' : ''}`} aria-hidden="true">
      <path d="M8 60c0-14 5-24 12-24s12 10 12 24z" fill={coat} stroke={INK} strokeWidth="1.1" />
      {look === 'itamae' && <path d="M15 37l5 10 5-10" fill="none" stroke="#2f3a4a" strokeWidth="1.6" />}
      {(look === 'cook' || look === 'noodle') && <><circle cx="17" cy="44" r="0.9" fill={INK} /><circle cx="17" cy="50" r="0.9" fill={INK} /><circle cx="23" cy="44" r="0.9" fill={INK} /><circle cx="23" cy="50" r="0.9" fill={INK} /></>}
      {look === 'server' && <path d="M12 46h16v14H12z" fill="#7a2a22" />}
      {look === 'cashier' && <path d="M14 42h12v18H14z" fill="#e8e0d0" />}
      <circle cx="20" cy="27" r="8" fill="#eac39c" stroke={INK} strokeWidth="1.1" />
      <path d="M12 26c0-6 4-9 8-9s8 3 8 9c-2-3-5-4-8-4s-6 1-8 4z" fill="#2b1d14" />
      {look === 'itamae' && <><rect x="11.5" y="20" width="17" height="3.4" rx="1.6" fill="#f6f2ea" stroke="#b4302a" strokeWidth="0.9" /><path d="M28 21l4-2M28 22l4 2" stroke="#b4302a" strokeWidth="1" /></>}
      {look === 'noodle' && <path d="M12 21c-2-9 18-9 16 0z" fill="#fbfaf6" stroke={INK} strokeWidth="1" />}
      {look === 'cook' && <rect x="12" y="17" width="16" height="5" rx="2" fill="#fbfaf6" stroke={INK} strokeWidth="0.9" />}
      {look === 'server' && <path d="M12 22h16" stroke="#7a2a22" strokeWidth="2.4" />}
      <circle cx="17" cy="28" r="0.9" fill="#2a1d16" />
      <circle cx="23" cy="28" r="0.9" fill="#2a1d16" />
      <path d="M18 31.5q2 1.2 4 0" fill="none" stroke="#7a3a2a" strokeWidth="0.9" />
      {/* the tool in hand */}
      {look === 'itamae' && (
        <g className="gc-tool">
          <path d="M31 46l5-9" stroke="#8a5a30" strokeWidth="1.2" />
          <ellipse cx="36.5" cy="35" rx="4" ry="4.6" fill="#e8d6a8" stroke={INK} strokeWidth="0.8" />
        </g>
      )}
      {look === 'noodle' && (
        <g className="gc-tool">
          <path d="M31 50l4-14" stroke="#8a5a30" strokeWidth="1.2" />
          <circle cx="35.5" cy="34" r="3.4" fill="none" stroke="#9aa0a6" strokeWidth="1.1" />
          <path d="M33 34h5M35.5 31.5v5" stroke="#9aa0a6" strokeWidth="0.5" />
        </g>
      )}
      {look === 'cook' && (
        <g className="gc-tool">
          <path d="M28 50l9-4" stroke="#c8ccd0" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {look === 'server' && (
        <g className="gc-tool">
          <ellipse cx="33" cy="40" rx="7" ry="1.6" fill="#b06a3a" stroke={INK} strokeWidth="0.7" />
          <path d="M30 39q3-4 6 0" fill="#e9e1cf" stroke={INK} strokeWidth="0.6" />
        </g>
      )}
    </svg>
  )
}

/** the back wall and fittings of each shop (a 300 × 140 picture) */
function Backdrop({ shop }: { shop: string }): ReactNode {
  if (shop === 'hotpot') {
    return (
      <svg className="gc-backdrop" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true">
        <rect width="300" height="140" fill="#a8352a" />
        <rect y="0" width="300" height="10" fill="#5a1a14" />
        <path d="M0 18h300" stroke="#e0a83a" strokeWidth="1.2" opacity="0.6" />
        {/* the gold 福 diamond, upside down for luck */}
        <g transform="translate(140 40) rotate(45)">
          <rect x="-13" y="-13" width="26" height="26" fill="#c4302a" stroke="#f2c75c" strokeWidth="1.6" />
        </g>
        <text x="140" y="46" textAnchor="middle" fontSize="16" fill="#f2c75c" transform="rotate(180 140 40)" fontFamily="serif">福</text>
        {/* round red lanterns with gold bands and tassels */}
        {[86, 196].map((x) => (
          <g key={x} className="gc-sway">
            <path d={`M${x} 10v8`} stroke="#3b2a20" strokeWidth="1" />
            <ellipse cx={x} cy="30" rx="11" ry="12" fill="#d63a26" stroke="#7a140e" strokeWidth="1" />
            <path d={`M${x - 11} 30h22M${x - 9} 23h18M${x - 9} 37h18`} stroke="#f2c75c" strokeWidth="1" />
            <path d={`M${x} 42v8`} stroke="#f2c75c" strokeWidth="1.6" />
          </g>
        ))}
        {/* the black menu board with gold lettering */}
        <rect x="222" y="16" width="64" height="40" rx="2" fill="#1e1a18" stroke="#c49a3a" strokeWidth="1.4" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${230 + i * 11} 22v28`} stroke="#e0c070" strokeWidth="1.6" strokeDasharray="3 2" />
        ))}
        {/* the pass window onto the kitchen, where the back-kitchen cooks work */}
        <rect x="44" y="40" width="58" height="34" fill="#3a2a22" stroke="#5a1a14" strokeWidth="2" />
        <rect x="44" y="40" width="58" height="6" fill="#e0a83a" opacity="0.5" />
        {/* the wainscot */}
        <rect y="74" width="300" height="20" fill="#5a2a1c" />
        <path d="M0 74h300" stroke="#e0a83a" strokeWidth="1" />
        {/* the counter */}
        <rect y="88" width="300" height="10" fill="#7a3a22" stroke={INK} strokeWidth="0.8" />
        <rect y="98" width="300" height="42" fill="#5a2e1e" />
        <path d="M0 98h300" stroke="rgb(0 0 0 / 0.3)" strokeWidth="2" />
      </svg>
    )
  }
  if (shop === 'beefnoodle') {
    return (
      <svg className="gc-backdrop" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true">
        <rect width="300" height="140" fill="#eef0ea" />
        {/* white tiles above, a band of green tiles below */}
        <g stroke="rgb(90 110 100 / 0.22)" strokeWidth="0.8">
          {Array.from({ length: 30 }, (_, i) => <path key={`v${i}`} d={`M${i * 10} 0v74`} />)}
          {Array.from({ length: 8 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 10}h300`} />)}
        </g>
        <rect y="62" width="300" height="14" fill="#5f8f7a" />
        <g stroke="rgb(255 255 255 / 0.35)" strokeWidth="0.7">
          {Array.from({ length: 30 }, (_, i) => <path key={i} d={`M${i * 10} 62v14`} />)}
        </g>
        {/* wooden menu plaques with prices */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect x={118 + i * 26} y="8" width="20" height="40" fill="#e6c88e" stroke="#7a5a30" strokeWidth="1" />
            <path d={`M${128 + i * 26} 13v20`} stroke="#3b2a20" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx={128 + i * 26} cy="41" r="2.4" fill="#c4302a" />
          </g>
        ))}
        {/* the ceiling fan */}
        <g className="gc-fan">
          <path d="M70 0v8" stroke="#555" strokeWidth="1.4" />
          <ellipse cx="70" cy="9" rx="22" ry="1.8" fill="#6a6a6a" />
        </g>
        {/* the stockpot on its burner, steaming */}
        <rect x="26" y="52" width="38" height="34" rx="3" fill="#b8bec4" stroke={INK} strokeWidth="1" />
        <path d="M26 58h38" stroke="#8a9096" strokeWidth="2" />
        <g className="gc-steam" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8">
          <path d="M36 50q-4-8 0-14t0-14" />
          <path d="M48 50q4-8 0-14t0-14" />
        </g>
        <rect y="88" width="300" height="10" fill="#c49a5a" stroke={INK} strokeWidth="0.8" />
        <rect y="98" width="300" height="42" fill="#8a6a44" />
        <path d="M0 98h300" stroke="rgb(0 0 0 / 0.25)" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg className="gc-backdrop" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true">
      {/* dark timber walls, a beam along the top */}
      <rect width="300" height="140" fill="#4a3324" />
      <g stroke="rgb(0 0 0 / 0.25)" strokeWidth="1">
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${i * 20 + 6} 12v76`} />)}
      </g>
      <rect width="300" height="12" fill="#2a1d14" />
      {/* the menu slips (短冊) hung along the wall */}
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <rect x={118 + i * 18} y="16" width="13" height="36" fill="#f2e6cc" stroke="#7a5a30" strokeWidth="0.6" />
          <path d={`M${124.5 + i * 18} 20v24`} stroke="#2a1d14" strokeWidth="1.8" strokeDasharray="3 2.2" />
          <path d={`M${124.5 + i * 18} 46v3`} stroke="#b4302a" strokeWidth="1.8" />
        </g>
      ))}
      {/* red paper lanterns (提灯) */}
      {[70, 286].map((x) => (
        <g key={x} className="gc-sway">
          <path d={`M${x} 12v6`} stroke="#1c1410" strokeWidth="1" />
          <rect x={x - 8} y="18" width="16" height="4" fill="#1c1410" />
          <ellipse cx={x} cy="34" rx="10" ry="13" fill="#d63a26" />
          <path d={`M${x - 10} 30h20M${x - 10} 38h20`} stroke="rgb(0 0 0 / 0.18)" strokeWidth="0.8" />
          <rect x={x - 8} y="46" width="16" height="4" fill="#1c1410" />
          <text x={x} y="38" textAnchor="middle" fontSize="10" fill="#1c1410" fontFamily="serif">炭</text>
        </g>
      ))}
      {/* a shelf of sake bottles */}
      <rect x="40" y="56" width="62" height="3" fill="#2a1d14" />
      {[46, 56, 66, 76, 88].map((x, i) => (
        <path key={x} d={`M${x} 56v-12q0-4 3-6v-4h2v4q3 2 3 6v12z`} fill={['#2f5a3a', '#5a3a1a', '#e8e0d0', '#2f5a3a', '#7a2a1a'][i]}
          stroke={INK} strokeWidth="0.5" />
      ))}
      {/* the charcoal grill behind the counter, glowing */}
      <rect x="112" y="72" width="96" height="16" fill="#2a2522" stroke={INK} strokeWidth="1" />
      <rect x="116" y="74" width="88" height="6" fill="url(#gc-coals)" />
      <defs>
        <linearGradient id="gc-coals" x1="0" x2="1">
          <stop offset="0" stopColor="#ff7a2a" /><stop offset="0.5" stopColor="#ffb347" /><stop offset="1" stopColor="#ff6a1e" />
        </linearGradient>
      </defs>
      {[124, 140, 156, 172, 188].map((x) => <path key={x} d={`M${x} 70l4-14`} stroke="#c9a46a" strokeWidth="1.2" />)}
      <g className="gc-steam" stroke="#e8e0d8" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5">
        <path d="M140 66q-4-8 0-14t0-12" /><path d="M176 66q4-8 0-14t0-12" />
      </g>
      {/* the counter: a thick plank of hinoki */}
      <rect y="88" width="300" height="10" fill="#d9b884" stroke={INK} strokeWidth="0.8" />
      <rect y="98" width="300" height="42" fill="#3a2a1e" />
      <path d="M0 98h300" stroke="rgb(0 0 0 / 0.35)" strokeWidth="2" />
    </svg>
  )
}

type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave'; at: number }

/** each shop's noren: its colour and words */
const NOREN: Record<string, [string, string]> = {
  grilledfish: ['炭', '火'],
  hotpot: ['火', '鍋'],
  beefnoodle: ['麵', '處'],
}

export type StaffOnShow = { chef: number; cashier: number; server: number }

export function GuestCounter({ guests, shop = 'grilledfish', staff = { chef: 1, cashier: 0, server: 0 } }:
  { guests: GuestView[]; shop?: string; staff?: StaffOnShow }) {
  const noren = NOREN[shop] ?? NOREN.grilledfish
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
          const taken = new Set(next.map((x) => x.seat))
          const seat = SEATS.findIndex((_, i) => !taken.has(i))
          if (seat < 0) continue
          next.push({ id: g.id, seat, phase: 'enter', at: performance.now() })
          swayed = true
          timers.current.push(window.setTimeout(() => setShown((all) => all.map((x) => (x.id === g.id && x.phase === 'enter'
            ? { ...x, phase: 'sit' } : x))), WALK_MS))
        } else if (s && !seated && s.phase !== 'leave') {
          next = next.map((x) => (x.id === g.id ? { ...x, phase: 'leave', at: performance.now() } : x))
          timers.current.push(window.setTimeout(() => setSway((n) => n + 1), LEAVE_MS - 700))
          timers.current.push(window.setTimeout(() => setShown((all) => all.filter((x) => x.id !== g.id)), LEAVE_MS))
        }
      }
      if (swayed) setSway((n) => n + 1)
      return next
    })
  }, [guests])

  const busy = guests.some((g) => g.state === 'waiting' || g.state === 'eating')
  return (
    <div className={`gc-scene shop-${shop}`} aria-hidden="true">
      <Backdrop shop={shop} />
      {/* the staff: the chef behind the counter, the back-kitchen cooks in the pass window, the cashier at the
          till at the far end, floor staff walking between */}
      {staff.chef > 0 && (
        <div className={`gc-stand gc-stand-chef gc-at-${shop}`}>
          <Staff look={shop === 'grilledfish' ? 'itamae' : shop === 'beefnoodle' ? 'noodle' : 'cook'} action={busy} />
        </div>
      )}
      {shop === 'hotpot' && staff.chef > 1 && (
        <div className="gc-stand gc-stand-chef2"><Staff look="cook" action={busy} /></div>
      )}
      {staff.cashier > 0 && (
        <div className="gc-stand gc-stand-cashier">
          <Staff look="cashier" />
          <span className="gc-till" />
        </div>
      )}
      {Array.from({ length: staff.server }, (_, i) => (
        <div key={i} className="gc-walker" style={{ animationDelay: `${-i * 3.1}s` } as CSSProperties}>
          <Staff look="server" />
        </div>
      ))}
      {/* the noren over the doorway, swaying when someone passes */}
      <div key={sway} className={`gc-noren${sway ? ' is-swaying' : ''}`}>
        <span>{noren[0]}</span>
        <span>{noren[1]}</span>
      </div>
      {shop !== 'grilledfish' && SEATS.map((x, i) => (
        <span key={i} className={`gc-ware gc-ware-${shop}`} style={{ left: `calc(${x}% - 8px)` }} />
      ))}
      {shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const eating = g?.state === 'eating' && s.phase === 'sit'
        return (
          <div key={s.id} className={`gc-guest is-${s.phase}${g?.state === 'angry' ? ' is-angry' : ''}`}
            style={{ '--seat': `${SEATS[s.seat]}%`, '--door': `${DOOR}%` } as CSSProperties}>
            {s.phase === 'sit' && g?.state === 'waiting' && <span className="gc-bubble">…</span>}
            {/* leaving: their face says how it was (no score is shown) */}
            {s.phase === 'leave' && g?.state === 'done' && <span className="gc-stars"><MoodFace guest={g} /></span>}
            {s.phase === 'leave' && g?.state === 'angry' && (
              <svg className="gc-anger" viewBox="0 0 20 20"><path d="M3 8q5 0 5-5M17 8q-5 0-5-5M3 12q5 0 5 5M17 12q-5 0-5 5"
                fill="none" stroke="#d23a28" strokeWidth="2.4" strokeLinecap="round" /></svg>
            )}
            <span className="gc-tag">#{s.id}</span>
            {g && s.phase === 'sit' && g.rating !== null && <span className="gc-belly"><MoodFace guest={g} /></span>}
            <Person id={s.id} walking={s.phase !== 'sit'} eating={eating} />
          </div>
        )
      })}
    </div>
  )
}
