import type { Look, Role } from '@/data/staff'

/*
 * A worker's picture (大頭貼), drawn rather than photographed, in the same hand-inked style as the rest. Each face is
 * made up from the worker's id, so it's always the same person: skin, hair colour and cut (a woman's longer or tied
 * up, an older person's grey and thinning), eyes with a glint, brows, a nose, a mouth, and now and then glasses, a
 * moustache or earrings; lines round the eyes with age. What they wear is the job's (and the cooks dress Japanese,
 * as in the 3D shop: scene/Person3D.tsx): the head chef's and second chef's twisted hachimaki over a white kappōgi
 * crossed at the collar, the third cook's low white cap over a navy samue (a woman at the fire in the white cap and
 * kappōgi), the floor in deep red, the till in indigo and the stock keeper in brown with his clipboard: the men in
 * samue (the floor and the stock keeper under a hachimaki), the women in kimono, hair put up. The ground is the
 * role's colour, lit from the top.
 */

const SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
const HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#4a3020', '#6b4a32']
const GROUND: Record<Role | 'owner', string> = { owner: '#c4442f', chef: '#e8b04a', sous: '#d9c27a', server: '#5a7a9a', cashier: '#7aa070', stock: '#a08a5c' }
const INK = '#3b2a20'
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
/** a colour a little lighter (k > 0) or darker (k < 0) */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

export function Avatar({ id, look, role, size = 44 }: { id: string; look: Look; role: Role | 'owner'; size?: number }) {
  const h = hash(id)
  const uid = `av${h.toString(36)}${role}`
  const skin = SKIN[h % SKIN.length]
  const old = look.age === 'old'
  const young = look.age === 'young'
  const hair = old ? ((h >> 4) & 1 ? '#d6d1c8' : '#a9a49c') : HAIR[(h >> 3) % HAIR.length]
  const cook = role === 'chef' || role === 'sous' || role === 'owner'
  const glasses = (h >> 7) % 5 === 0 || (old && (h >> 7) % 2 === 0)
  const moustache = !look.female && !young && (h >> 9) % 3 === 0
  const earrings = look.female && (h >> 11) % 3 === 0
  const cut = (h >> 13) % 3
  const ground = GROUND[role]
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}g`} cx="50%" cy="28%" r="75%">
          <stop offset="0" stopColor={shade(ground, 0.35)} />
          <stop offset="1" stopColor={shade(ground, -0.12)} />
        </radialGradient>
        <clipPath id={`${uid}c`}><circle cx="24" cy="24" r="22.2" /></clipPath>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${uid}g)`} stroke={INK} strokeWidth="1.5" />
      <g clipPath={`url(#${uid}c)`}>
        {/* a faint ring pattern in the ground */}
        <circle cx="24" cy="24" r="19" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="1" strokeDasharray="2 3" />

        {/* long hair falls behind the shoulders */}
        {look.female && cut !== 2 && role !== 'server' && role !== 'cashier' && role !== 'stock' && (
          <path d={cut === 0 ? 'M12.5 22c0-9 5-14 11.5-14S35.5 13 35.5 22v17h-23z' : 'M13 22c0-9 5-14 11-14s11 5 11 14l1 10c-3 1-7 1-8-1H20c-1 2-5 2-8 1z'}
            fill={hair} stroke={INK} strokeWidth="1.1" />
        )}

        {/* shoulders, in what they wear for the job */}
        <path d="M5 48c1-9 8-13.5 19-13.5S42 39 43 48z" fill={role === 'sous' && !look.female ? '#2c3a58' : role === 'server' ? '#7a2a22' : role === 'cashier' ? '#2c3e66' : role === 'stock' ? '#6a5236' : cook ? '#f7f3ea' : role === 'stock' ? '#6a5236' : role === 'cashier' ? '#e9e2d2' : '#e9e2d2'}
          stroke={INK} strokeWidth="1.2" />
        {cook && <>
          {/* the collar crossed left over right, kimono-wise, an under-collar showing at the neck */}
          <path d="M18.5 35l9 13M29.5 35L24 43" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M20 35.2l4 4.6 4-4.6" fill="none" stroke={role === 'sous' && !look.female ? '#f7f3ea' : '#d8cfbd'} strokeWidth="1.4" />
          {role === 'owner' && <path d="M19 36.2l5 3.2 5-3.2" fill="none" stroke="#c4442f" strokeWidth="1.6" />}
        </>}
        {(role === 'server' || role === 'cashier' || role === 'stock') && <>
          {/* out front, Japanese: the collar crossed left over right, a pale under-collar at the neck; a kimono's obi */}
          <path d="M18.5 35l9 13M29.5 35L24 43" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M20 35.2l4 4.6 4-4.6" fill="none" stroke="#efe6d4" strokeWidth="1.4" />
          {look.female && <path d="M8 45.5h32v3H8z" fill="#e8c45a" stroke={INK} strokeWidth=".8" />}
        </>}
        {role === 'stock' && <>
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
        {earrings && <><circle cx="14.4" cy="27.8" r=".9" fill="#e8c35a" stroke={INK} strokeWidth=".4" />
          <circle cx="33.6" cy="27.8" r=".9" fill="#e8c35a" stroke={INK} strokeWidth=".4" /></>}

        {/* the face, with a soft shadow down one side */}
        <ellipse cx="24" cy="23.5" rx="9.2" ry="10.4" fill={skin} stroke={INK} strokeWidth="1.3" />
        <path d="M29.5 15.5c3 3 3.6 10 .4 14.5-1.5 2-3.6 3.4-5.9 3.9 4.5-3 6.5-10 5.5-18.4z" fill={INK} opacity=".07" />

        {/* hair (or a cap over it) */}
        {(role === 'chef' || role === 'owner' || role === 'server' || role === 'stock') && !look.female ? (
          // the hachimaki: a twisted white band round the brow over cropped hair, its knot to one side
          <g>
            <path d="M14.8 21c0-7 4-10.2 9.2-10.2s9.2 3.2 9.2 10.2c-2-3-5-4.1-9.2-4.1s-7.2 1.1-9.2 4.1z" fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M14.6 16.4c6-2.2 12.8-2.2 18.8 0l-.4 3c-6-1.8-12-1.8-18 0z" fill={role === 'owner' ? '#f3efe6' : '#fff'} stroke={INK} strokeWidth="1" />
            <path d="M17 16.6l1.4 2.2M20.5 15.8l1.3 2.4M24 15.5l1.2 2.5M27.5 15.8l1.2 2.4M31 16.6l1 2.1" stroke={INK} strokeWidth=".45" opacity=".55" />
            {role === 'owner' && <path d="M14.6 16.4c6-2.2 12.8-2.2 18.8 0" fill="none" stroke="#c4442f" strokeWidth="1.1" />}
            <path d="M32.8 17.3l3 -1.6 .4 2.6zM32.8 18.4l2.4 2.6-2.6.6z" fill="#fff" stroke={INK} strokeWidth=".8" />
          </g>
        ) : role === 'sous' || ((role === 'chef' || role === 'owner') && look.female) ? (
          // a cook's low white cap (和帽子), hair showing at the sides
          <g>
            <path d="M15.2 21.5c0-3 1-4.6 2-5.6M32.8 21.5c0-3-1-4.6-2-5.6" stroke={hair} strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M15 18c0-5 4-8.5 9-8.5s9 3.5 9 8.5z" fill="#fff" stroke={INK} strokeWidth="1.2" />
            <path d="M15 17.2h18" stroke={INK} strokeWidth=".7" opacity=".6" />
          </g>
        ) : look.female ? (
          <g>
            {(cut === 2 || role === 'server' || role === 'cashier' || role === 'stock') && (
              // hair tied up in a bun
              <circle cx="24" cy="10" r="4" fill={hair} stroke={INK} strokeWidth="1.1" />
            )}
            <path d={cut === 1 && role !== 'server' && role !== 'cashier' && role !== 'stock' ? 'M14.8 23c-.5-8.5 4-12.6 9.2-12.6s9.7 4.1 9.2 12.6c-1.6-4.6-4.2-7-6.6-7.6-1 2-4.6 3.6-8 3.6-1.6 0-3 1.6-3.8 4z'
              : 'M14.8 22.5c0-8 4-12 9.2-12s9.2 4 9.2 12c-3-4.2-6.2-6.2-9.2-6.2s-6.2 2-9.2 6.2z'}
              fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M19 13.2c1.6-.9 3.4-1.2 5-1.2" stroke="#fff" strokeOpacity=".35" strokeWidth="1" strokeLinecap="round" fill="none" />
          </g>
        ) : old && (h & 1) ? (
          // thinning on top: a fringe of grey round the sides
          <path d="M15 21c.6-4.4 2.6-6.6 4.4-6.6M33 21c-.6-4.4-2.6-6.6-4.4-6.6" stroke={hair} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        ) : (
          <g>
            <path d={cut === 1 ? 'M14.8 21c0-7.5 4.2-10.6 9.2-10.6s9.2 3.1 9.2 10.6c-1.5-2.6-3-3.6-4.6-3.9l-1.4 1.6-1.6-2-2 1.8-1.8-1.8c-2.6.4-5.2 1.6-7 4.3z'
              : 'M14.8 21c0-7 4-10.2 9.2-10.2s9.2 3.2 9.2 10.2c-2-3-5-4.1-9.2-4.1s-7.2 1.1-9.2 4.1z'}
              fill={hair} stroke={INK} strokeWidth="1.1" />
            <path d="M20 13.4c1.4-.7 3-1 4.6-1" stroke="#fff" strokeOpacity=".3" strokeWidth="1" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* brows */}
        <path d={(h >> 2) & 1 ? 'M18.6 20.6q2-1.2 3.8-.2M25.6 20.4q1.8-1 3.8.2' : 'M18.6 20.9l3.6-.7M25.8 20.2l3.6.7'}
          stroke={old ? shade(hair, -0.4) : hair} strokeWidth={look.female ? 0.9 : 1.3} strokeLinecap="round" fill="none" />
        {/* eyes: white, iris, pupil and a glint; a lash line over a woman's */}
        {[20.4, 27.6].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="24" rx="2" ry={old ? 1.2 : 1.6} fill="#fff" stroke={INK} strokeWidth=".6" />
            <circle cx={x} cy="24.1" r={old ? 0.95 : 1.2} fill={(h >> 15) & 1 ? '#3a2618' : '#24180f'} />
            <circle cx={x + 0.45} cy="23.6" r=".42" fill="#fff" />
            {look.female && <path d={`M${x - 2.2} 23.1q2.2-1.6 4.4 0`} stroke={INK} strokeWidth=".9" fill="none" strokeLinecap="round" />}
          </g>
        ))}
        {old && <path d="M16.9 23.4l-1-.6M16.9 24.6l-1 .5M31.1 23.4l1-.6M31.1 24.6l1 .5M20 29.6q4 1 8 0" stroke={INK} strokeWidth=".5" opacity=".6" fill="none" />}
        {/* nose */}
        <path d="M24.4 25.2l.9 2.5-1.6.3" stroke={INK} strokeWidth=".75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* mouth: a smile, a grin or a small closed one */}
        {(h >> 6) % 3 === 0 ? (
          <path d="M21 29.3q3 2.6 6 0z" fill="#9b3f34" stroke={INK} strokeWidth=".8" strokeLinejoin="round" />
        ) : (
          <path d={(h >> 6) % 3 === 1 ? 'M21.3 29.2q2.7 1.8 5.4 0' : 'M22.2 29.5q1.8.8 3.6 0'} stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
        )}
        {moustache && <path d="M21 28.2q1.5-1 3 0 1.5-1 3 0" stroke={hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />}
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
