import type { Look, Role } from '@/data/staff'
import { featuresOf, TENUGUI, variantOf, WEAR } from '@/data/crewLook'

/*
 * A worker's picture (大頭貼), drawn rather than photographed, in the same hand-inked style as the rest: the same person their figure in the
 * shop is (item 321, the owner's: 「員工的SVG 大頭 需與 模型一致，要好好規劃」). What they wear and their own skin, hair and glasses come from
 * the one list the figures are drawn from too (data/crewLook): the cooks at the fire (二廚, 三廚) in a white kappōgi under a white cap; the
 * floor and the till in a navy samue with a pale grid under a white band, the women in a plum kimono with little pink flowers, a gold obi,
 * their hair up in a bun; the stock keeper in khaki under the band, his clipboard. The rest of the face (brows, eyes with a glint, a nose,
 * a mouth, the lines of age) by the same hash of their id. The owner's own: the twisted hachimaki and the kappōgi with its red line, as
 * his figure. The ground is the role's colour, lit from the top.
 */

const GROUND: Record<Role | 'owner', string> = { owner: '#c4442f', chef: '#e8b04a', sous: '#d9c27a', server: '#5a7a9a', cashier: '#7aa070', stock: '#a08a5c' }
const INK = '#3b2a20'
/** a colour a little lighter (k > 0) or darker (k < 0) */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}
/** the shoulders' outline */
const SHOULDERS = 'M5 48c1-9 8-13.5 19-13.5S42 39 43 48z'

export function Avatar({ id, look, role, size = 44 }: { id: string; look: Look; role: Role | 'owner'; size?: number }) {
  const own = featuresOf(id, look)
  const h = own.h
  const uid = `av${h.toString(36)}${role}`
  const { skin, hair, glasses } = own
  const old = look.age === 'old'
  const young = look.age === 'young'
  const owner = role === 'owner'
  const wear = owner ? null : WEAR[variantOf(role, look.female)]
  const coat = wear ? wear.coat : '#f7f3ea'
  const ground = GROUND[role]
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}g`} cx="50%" cy="28%" r="75%">
          <stop offset="0" stopColor={shade(ground, 0.35)} />
          <stop offset="1" stopColor={shade(ground, -0.12)} />
        </radialGradient>
        <clipPath id={`${uid}c`}><circle cx="24" cy="24" r="22.2" /></clipPath>
        <clipPath id={`${uid}s`}><path d={SHOULDERS} /></clipPath>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${uid}g)`} stroke={INK} strokeWidth="1.5" />
      <g clipPath={`url(#${uid}c)`}>
        {/* a faint ring pattern in the ground */}
        <circle cx="24" cy="24" r="19" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="1" strokeDasharray="2 3" />

        {/* shoulders, in what they wear for the job, and what's on its cloth: the samue's pale grid, the kimono's little flowers */}
        <path d={SHOULDERS} fill={coat} stroke={INK} strokeWidth="1.2" />
        {wear?.grid && (
          <g clipPath={`url(#${uid}s)`} stroke="#c3cbe2" strokeOpacity=".5" strokeWidth=".6">
            <path d="M4 40.5h40M4 44.5h40M11 34v14M18 34v14M30 34v14M37 34v14" />
          </g>
        )}
        {wear?.flowers && (
          <g clipPath={`url(#${uid}s)`}>
            {[[10.5, 43.5], [16.5, 39.5], [31.5, 39.5], [37.5, 43.5], [13, 47.3], [35, 47.3]].map(([x, y]) => (
              <g key={`${x}-${y}`}><circle cx={x} cy={y} r="1.25" fill="#f2c6d0" /><circle cx={x} cy={y} r=".42" fill="#e6b24c" /></g>
            ))}
          </g>
        )}
        {/* the collar's wide bands crossed left over right, kimono-wise, inked, the under-collar showing at the neck (the owner's with its red
            line) */}
        <path d="M18.5 35l9 13M29.5 35L24 43" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M18.5 35l9 13M29.5 35L24 43" fill="none" stroke={wear ? wear.collar : '#d8cfbd'} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20 35.2l4 4.6 4-4.6" fill="none" stroke={wear ? wear.neck : '#334066'} strokeWidth="1.5" />
        {owner && <path d="M19 36.2l5 3.2 5-3.2" fill="none" stroke="#c4442f" strokeWidth="1.6" />}
        {wear?.obi && <path d="M8 45.5h32v3H8z" fill={wear.obi} stroke={INK} strokeWidth=".8" />}
        {wear?.clip && <>
          {/* the clipboard held up */}
          <rect x="28.5" y="38.5" width="9" height="10" rx="1" fill="#c9a66b" stroke={INK} strokeWidth="1" />
          <rect x="29.8" y="40.4" width="6.4" height="7" fill="#f7f3ea" stroke={INK} strokeWidth=".5" />
          <path d="M31 42.3h4M31 44h3.4M31 45.7h4" stroke={INK} strokeWidth=".6" />
          <rect x="31.5" y="37.8" width="3" height="1.6" rx=".4" fill="#8a8a8a" stroke={INK} strokeWidth=".5" />
        </>}

        {/* neck, shadowed under the chin */}
        <path d="M20.5 29h7v7.5c-2 1.4-5 1.4-7 0z" fill={skin} stroke={INK} strokeWidth=".8" />
        <path d="M20.5 31.5c2 1.4 5 1.4 7 0v-2.5h-7z" fill={INK} opacity=".14" />

        {/* ears */}
        <ellipse cx="14.6" cy="24.5" rx="1.9" ry="2.7" fill={skin} stroke={INK} strokeWidth="1" />
        <ellipse cx="33.4" cy="24.5" rx="1.9" ry="2.7" fill={skin} stroke={INK} strokeWidth="1" />

        {/* the face, with a soft shadow down one side */}
        <ellipse cx="24" cy="23.5" rx="9.2" ry="10.4" fill={skin} stroke={INK} strokeWidth="1.3" />
        <path d="M29.5 15.5c3 3 3.6 10 .4 14.5-1.5 2-3.6 3.4-5.9 3.9 4.5-3 6.5-10 5.5-18.4z" fill={INK} opacity=".07" />

        {/* what's on the head, over their hair */}
        {owner ? (
          // the owner's hachimaki: a twisted white band round the brow over cropped hair, a red thread in it, its knot to one side
          <g>
            <path d="M14.8 21c0-7 4-10.2 9.2-10.2s9.2 3.2 9.2 10.2c-2-3-5-4.1-9.2-4.1s-7.2 1.1-9.2 4.1z" fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M14.6 16.4c6-2.2 12.8-2.2 18.8 0l-.4 3c-6-1.8-12-1.8-18 0z" fill="#f3efe6" stroke={INK} strokeWidth="1" />
            <path d="M17 16.6l1.4 2.2M20.5 15.8l1.3 2.4M24 15.5l1.2 2.5M27.5 15.8l1.2 2.4M31 16.6l1 2.1" stroke={INK} strokeWidth=".45" opacity=".55" />
            <path d="M14.6 16.4c6-2.2 12.8-2.2 18.8 0" fill="none" stroke="#c4442f" strokeWidth="1.1" />
            <path d="M32.8 17.3l3 -1.6 .4 2.6zM32.8 18.4l2.4 2.6-2.6.6z" fill="#fff" stroke={INK} strokeWidth=".8" />
          </g>
        ) : wear?.head === 'cap' ? (
          // the cook's low white cap (和帽子) of tenugui down to the brows, only their sideburns showing in front of the ears (a woman's a lock
          // a little longer there), as the figure's are
          <g>
            <path d={look.female ? 'M15.6 19.6c-.4 2.4-.2 4.6.6 6.6M32.4 19.6c.4 2.4.2 4.6-.6 6.6' : 'M15.6 19.8v3.4M32.4 19.8v3.4'}
              stroke={hair} strokeWidth={look.female ? 2.4 : 2.2} strokeLinecap="round" fill="none" />
            <path d="M15 18c0-5 4-8.5 9-8.5s9 3.5 9 8.5z" fill={TENUGUI} stroke={INK} strokeWidth="1.2" />
            <path d="M15 17.2h18" stroke={INK} strokeWidth=".7" opacity=".6" />
          </g>
        ) : wear?.head === 'bun' ? (
          // the hair swept up into a bun on top, as the kimono's worn
          <g>
            <circle cx="24" cy="10" r="4" fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M14.8 22.5c0-8 4-12 9.2-12s9.2 4 9.2 12c-3-4.2-6.2-6.2-9.2-6.2s-6.2 2-9.2 6.2z" fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M19 13.2c1.6-.9 3.4-1.2 5-1.2" stroke="#fff" strokeOpacity=".35" strokeWidth="1" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          // the band: white tenugui tied round the brow over cropped hair, its knot to one side
          <g>
            <path d="M14.8 21c0-7 4-10.2 9.2-10.2s9.2 3.2 9.2 10.2c-2-3-5-4.1-9.2-4.1s-7.2 1.1-9.2 4.1z" fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M14.6 16.4c6-2.2 12.8-2.2 18.8 0l-.4 3c-6-1.8-12-1.8-18 0z" fill={TENUGUI} stroke={INK} strokeWidth="1" />
            <path d="M32.8 17.3l3 -1.6 .4 2.6zM32.8 18.4l2.4 2.6-2.6.6z" fill={TENUGUI} stroke={INK} strokeWidth=".8" />
          </g>
        )}

        {/* brows */}
        <path d={(h >>> 2) & 1 ? 'M18.6 20.6q2-1.2 3.8-.2M25.6 20.4q1.8-1 3.8.2' : 'M18.6 20.9l3.6-.7M25.8 20.2l3.6.7'}
          stroke={old ? shade(hair, -0.4) : hair} strokeWidth={look.female ? 0.9 : 1.3} strokeLinecap="round" fill="none" />
        {/* eyes: white, iris, pupil and a glint; a lash line over a woman's */}
        {[20.4, 27.6].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="24" rx="2" ry={old ? 1.2 : 1.6} fill="#fff" stroke={INK} strokeWidth=".6" />
            <circle cx={x} cy="24.1" r={old ? 0.95 : 1.2} fill={(h >>> 15) & 1 ? '#3a2618' : '#24180f'} />
            <circle cx={x + 0.45} cy="23.6" r=".42" fill="#fff" />
            {look.female && <path d={`M${x - 2.2} 23.1q2.2-1.6 4.4 0`} stroke={INK} strokeWidth=".9" fill="none" strokeLinecap="round" />}
          </g>
        ))}
        {old && <path d="M16.9 23.4l-1-.6M16.9 24.6l-1 .5M31.1 23.4l1-.6M31.1 24.6l1 .5M20 29.6q4 1 8 0" stroke={INK} strokeWidth=".5" opacity=".6" fill="none" />}
        {/* nose */}
        <path d="M24.4 25.2l.9 2.5-1.6.3" stroke={INK} strokeWidth=".75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* mouth: a smile, a grin or a small closed one */}
        {(h >>> 6) % 3 === 0 ? (
          <path d="M21 29.3q3 2.6 6 0z" fill="#9b3f34" stroke={INK} strokeWidth=".8" strokeLinejoin="round" />
        ) : (
          <path d={(h >>> 6) % 3 === 1 ? 'M21.3 29.2q2.7 1.8 5.4 0' : 'M22.2 29.5q1.8.8 3.6 0'} stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
        )}
        {/* cheeks */}
        <ellipse cx="18" cy="27" rx="1.7" ry="1.1" fill="#e88a7a" opacity={look.female || young ? 0.5 : 0.3} />
        <ellipse cx="30" cy="27" rx="1.7" ry="1.1" fill="#e88a7a" opacity={look.female || young ? 0.5 : 0.3} />
        {glasses && (
          <g fill="none" stroke={INK} strokeWidth=".9">
            <rect x="17.6" y="21.8" width="5.6" height="4.4" rx="1.6" fill="#fff" fillOpacity=".15" />
            <rect x="24.8" y="21.8" width="5.6" height="4.4" rx="1.6" fill="#fff" fillOpacity=".15" />
            <path d="M23.2 23.4h1.6M17.6 23.2l-2.6-.6M30.4 23.2l2.6-.6" />
          </g>
        )}
      </g>
    </svg>
  )
}
