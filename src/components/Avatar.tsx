import type { Look, Role } from '../staff'

/*
 * A worker's picture (大頭貼), drawn rather than photographed, in the same hand-inked style as the rest: their face
 * and hair (a woman's longer, an older person's grey and lined), and what they wear for the job — a cook's white
 * hat and jacket, a server's dark vest, a cashier's apron — on a ground of their role's colour.
 */

const SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
const HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#4a3020']
const GROUND: Record<Role | 'owner', string> = { owner: '#c4442f', chef: '#e8b04a', sous: '#d9c27a', server: '#5a7a9a', cashier: '#7aa070' }
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Avatar({ id, look, role, size = 44 }: { id: string; look: Look; role: Role | 'owner'; size?: number }) {
  const h = hash(id)
  const skin = SKIN[h % SKIN.length]
  const hair = look.age === 'old' ? '#c9c4bc' : HAIR[(h >> 3) % HAIR.length]
  const cook = role === 'chef' || role === 'sous' || role === 'owner'
  const ink = '#3b2a20'
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill={GROUND[role]} stroke={ink} strokeWidth="1.5" />
      <clipPath id={`av-${id}`}><circle cx="24" cy="24" r="22" /></clipPath>
      <g clipPath={`url(#av-${id})`}>
        {/* shoulders, in what they wear for the job */}
        <path d="M6 48c1-9 8-13 18-13s17 4 18 13z" fill={cook ? '#f7f3ea' : role === 'server' ? '#2b2b33' : '#e9e2d2'} stroke={ink} strokeWidth="1.2" />
        {role === 'server' && <path d="M19 36l5 6 5-6" fill="#f7f3ea" stroke={ink} strokeWidth="1" />}
        {role === 'cashier' && <path d="M15 40h18v8H15z" fill="#a8432f" stroke={ink} strokeWidth="1" />}
        {cook && <path d="M24 36v12M20 40h.1M20 44h.1" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />}
        {/* long hair behind the head */}
        {look.female && <path d="M12 22c0-9 5-14 12-14s12 5 12 14v14H12z" fill={hair} stroke={ink} strokeWidth="1.2" />}
        <rect x="21" y="29" width="6" height="7" fill={skin} />
        <ellipse cx="24" cy="23" rx="9" ry="10" fill={skin} stroke={ink} strokeWidth="1.3" />
        {/* hair (or a cook's hat over it) */}
        {cook ? (
          <path d="M14 17c-3-6 3-10 6-8 1-4 7-4 8 0 3-2 9 2 6 8z" fill="#fff" stroke={ink} strokeWidth="1.3" />
        ) : look.female ? (
          <path d="M15 22c0-8 4-12 9-12s9 4 9 12c-3-4-6-6-9-6s-6 2-9 6z" fill={hair} stroke={ink} strokeWidth="1.1" />
        ) : look.age === 'old' && (h & 1) ? (
          <path d="M15 20c1-4 3-6 4-6M33 20c-1-4-3-6-4-6" stroke={hair} strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M15 21c0-7 4-10 9-10s9 3 9 10c-2-3-5-4-9-4s-7 1-9 4z" fill={hair} stroke={ink} strokeWidth="1.1" />
        )}
        {/* the face */}
        <circle cx="20.5" cy="24" r="1.1" fill={ink} />
        <circle cx="27.5" cy="24" r="1.1" fill={ink} />
        <path d={h & 2 ? 'M21 28.5q3 2.2 6 0' : 'M21.5 28.6q2.5 1.4 5 0'} stroke={ink} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {look.age === 'old' && <path d="M17.5 21.3l2-.6M30.5 21.3l-2-.6M18 27.5l1 .6M30 27.5l-1 .6" stroke={ink} strokeWidth=".7" />}
        {(h >> 5) % 3 === 0 && !look.female && look.age !== 'young' && <path d="M21 30.8h6" stroke={hair} strokeWidth="1.6" strokeLinecap="round" />}
        <circle cx="18.5" cy="26.5" r="1.4" fill="#e88a7a" opacity=".45" />
        <circle cx="29.5" cy="26.5" r="1.4" fill="#e88a7a" opacity=".45" />
      </g>
    </svg>
  )
}
