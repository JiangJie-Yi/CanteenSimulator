import { memo, type ReactNode } from 'react'
import { avatarOf, initialOf, type AvatarSpec, type Pet, type Scene } from '@/game/avatars'

/*
 * A reviewer's profile picture in the shop's reviews (the owner's: as Google Maps' reviews have them, not an emoji): game/avatars makes up
 * which picture from the reviewer's id; this draws it, in a round frame, in the hand-inked style of the rest (flat colours, a little light
 * from above, a fine brown ink line round what's alive): the letter disc or the grey figure of someone with no picture, a pet's face
 * close up (a cat of six coats, dogs, a shiba, a corgi, a rabbit, a hamster with its cheeks full, a budgie, a goldfish in its water), a view
 * (Fuji, a sunset over the sea, cherry blossom, a city at night, ridges of mountains, the torii in the sea, a temple in autumn leaves, a
 * beach) by day, evening or night, or a selfie (the phone held a little askew, a café, a park, a wall, a street at night behind).
 */

const INK = '#3b2a20'
const SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
const HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#8a5a32', '#b9844e', '#cfc9c0']
const PET_GROUND = [['#fbe3cf', '#f0c9a8'], ['#dcecf6', '#b9d6ea'], ['#f1ecd2', '#ddd3a8'], ['#e1f0da', '#bfdcb2'], ['#f7dfe7', '#e9bccb'], ['#e9e3f3', '#cbbfe2']]
/** a colour a little lighter (k > 0) or darker (k < 0) */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}
/** a vertical gradient's stops */
const Sky = ({ id, stops }: { id: string; stops: [number, string][] }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">{stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</linearGradient>
)

// ---- pets: each a face close up, about the middle of the frame, its chest at the foot
const CAT_COATS = [
  { fur: '#f2a64e', mark: '#c9702a', eye: '#8cc04a' }, // orange tabby
  { fur: '#2e2c33', mark: '#2e2c33', eye: '#e8b730' }, // black
  { fur: '#f8f5ee', mark: '#f8f5ee', eye: '#6fb7e8' }, // white
  { fur: '#f8f5ee', mark: '#e58e3c', eye: '#9cc650', calico: true }, // calico
  { fur: '#a3a8b0', mark: '#6e7480', eye: '#a8c94a' }, // grey tabby
  { fur: '#efe5d1', mark: '#6b4a38', eye: '#5aa6e0', points: true }, // siamese
]
function Cat({ coat }: { coat: number }) {
  const c = CAT_COATS[coat] as { fur: string; mark: string; eye: string; calico?: boolean; points?: boolean }
  const tabby = coat === 0 || coat === 4
  const head = 'M24 12.5c8.6 0 15.6 5.8 15.6 14.6 0 8.4-7 13.6-15.6 13.6S8.4 35.5 8.4 27.1C8.4 18.3 15.4 12.5 24 12.5z'
  return (
    <g>
      <ellipse cx="24" cy="50" rx="17" ry="11" fill={c.fur} stroke={INK} strokeWidth="1.1" />
      {[-1, 1].map((sd) => (
        <g key={sd} transform={sd < 0 ? undefined : 'translate(48 0) scale(-1 1)'}>
          <path d="M10.6 21.5 12.2 5.8 22 13.8z" fill={c.points || (c.calico && sd < 0) ? c.mark : c.calico ? '#2e2c33' : c.fur} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M13 17.6 13.9 9.8 19 14.2z" fill="#f2a9a6" opacity={c.points || coat === 1 ? 0.55 : 1} />
        </g>
      ))}
      <path d={head} fill={c.fur} />
      {/* (a calico's patches, a siamese's mask) */}
      {c.calico && <><path d="M24 12.5c-7 0-13.5 4-15 10.5 4 1 9-1 11.5-4.5C22 16 23.5 14 24 12.5z" fill="#e58e3c" /><path d="M30 13.6c4.5 1.6 8.4 5 9.4 9.6-3.6 1-7-.6-8.4-3.4z" fill="#2e2c33" /></>}
      {c.points && <ellipse cx="24" cy="31" rx="8.6" ry="7.4" fill={c.mark} opacity=".75" />}
      {tabby && (
        <g stroke={c.mark} strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M24 13.4v4.4M20.4 14.2l1 3.6M27.6 14.2l-1 3.6" />
          <path d="M9.6 25.5l4 .8M9.4 29.4l4-.2M38.4 25.5l-4 .8M38.6 29.4l-4-.2" />
        </g>
      )}
      <path d={head} fill="none" stroke={INK} strokeWidth="1.1" />
      {/* (a little light on the brow) */}
      <ellipse cx="21" cy="18" rx="5" ry="2.4" fill="#fff" opacity=".18" />
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <ellipse cx={24 + sd * 6.2} cy="25.8" rx="3.4" ry="3.8" fill={c.eye} stroke={INK} strokeWidth=".9" />
          <ellipse cx={24 + sd * 6.2} cy="26" rx="1.1" ry="3" fill="#1d1a1a" />
          <circle cx={24 + sd * 6.2 - 1} cy="24.4" r=".9" fill="#fff" />
        </g>
      ))}
      <path d="M22.4 30.2h3.2L24 32.1z" fill="#e88a8a" stroke={INK} strokeWidth=".5" strokeLinejoin="round" />
      <path d="M24 32.1c-.4 1.6-1.8 2.2-3 1.4M24 32.1c.4 1.6 1.8 2.2 3 1.4" fill="none" stroke={INK} strokeWidth=".9" strokeLinecap="round" />
      <g stroke={coat === 1 ? '#bdb6ae' : INK} strokeWidth=".55" strokeLinecap="round" opacity=".8">
        <path d="M16.5 31.5 7 30.2M16.5 33 7.4 34.2M31.5 31.5 41 30.2M31.5 33 40.6 34.2" />
      </g>
    </g>
  )
}
const DOG_COATS = [
  { fur: '#b07a44', ear: '#7a4f2a', muzzle: '#e9cfa8' }, // brown
  { fur: '#d8a05c', ear: '#6a4024', muzzle: '#fbf6ee', blaze: true }, // beagle-ish
  { fur: '#2f2c2c', ear: '#1f1d1d', muzzle: '#4a4544' }, // black
  { fur: '#e8bd72', ear: '#cf9a4e', muzzle: '#f6e2bb' }, // golden
]
function Dog({ coat }: { coat: number }) {
  const c = DOG_COATS[coat] as { fur: string; ear: string; muzzle: string; blaze?: boolean }
  return (
    <g>
      <ellipse cx="24" cy="50" rx="17" ry="11" fill={c.fur} stroke={INK} strokeWidth="1.1" />
      <circle cx="24" cy="26" r="13.6" fill={c.fur} stroke={INK} strokeWidth="1.1" />
      {c.blaze && <path d="M24 13.2c1.6 0 2.4 4 2.4 9 0 3-1 5-2.4 5s-2.4-2-2.4-5c0-5 .8-9 2.4-9z" fill={c.muzzle} />}
      {[-1, 1].map((sd) => (
        <path key={sd} transform={sd < 0 ? undefined : 'translate(48 0) scale(-1 1)'} d="M13.5 16.4c-5 .4-7.8 6.6-6.6 13.4.6 3.4 3 5 5 4 2.4-1.2 3.2-6.4 4.4-11.4.8-3.4-.2-6.2-2.8-6z"
          fill={c.ear} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      ))}
      <ellipse cx="24" cy="31.4" rx="7.6" ry="6" fill={c.muzzle} stroke={INK} strokeWidth=".9" />
      <path d="M21.2 28.4c0-1.6 5.6-1.6 5.6 0 0 1.4-1.6 2.6-2.8 2.6s-2.8-1.2-2.8-2.6z" fill="#1d1a1a" />
      <ellipse cx="23" cy="28.3" rx=".9" ry=".5" fill="#fff" opacity=".6" />
      <path d="M24 31v1.6c-.6 1.6-2.6 2.2-3.8 1M24 32.6c.6 1.6 2.6 2.2 3.8 1" fill="none" stroke={INK} strokeWidth=".9" strokeLinecap="round" />
      {coat !== 2 && <path d="M22.8 34.6c0 2.4 2.4 2.4 2.4 0z" fill="#e9737f" stroke={INK} strokeWidth=".5" />}
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <circle cx={24 + sd * 5.6} cy="23.6" r="2.1" fill="#1d1a1a" />
          <circle cx={24 + sd * 5.6 - .7} cy="22.9" r=".7" fill="#fff" />
        </g>
      ))}
    </g>
  )
}
function Shiba({ coat }: { coat: number }) {
  const fur = coat ? '#2a2525' : '#d98a40', cream = '#fbf3e4', tan = '#d9a560'
  const head = 'M24 13c8.4 0 14.6 6 14.6 13.4 0 7.6-6.4 12.8-14.6 12.8S9.4 34 9.4 26.4C9.4 19 15.6 13 24 13z'
  return (
    <g>
      <ellipse cx="24" cy="50" rx="17" ry="11" fill={fur} stroke={INK} strokeWidth="1.1" />
      <ellipse cx="24" cy="46" rx="8" ry="7" fill={cream} />
      {[-1, 1].map((sd) => (
        <g key={sd} transform={sd < 0 ? undefined : 'translate(48 0) scale(-1 1)'}>
          <path d="M11.4 20.4 13.6 7.4 21.4 14.4z" fill={fur} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M13.8 16.8 14.6 10.8 18.6 14.4z" fill="#f2c3b0" opacity=".8" />
        </g>
      ))}
      <path d={head} fill={fur} />
      {/* (the pale 裏白: cheeks, muzzle and throat; a black-and-tan's tan brows and cheeks) */}
      <path d="M12 27.5c2 7.5 7 11.6 12 11.6s10-4.1 12-11.6c-2.6 1.4-5.4 1.4-7.4.4-1.4 2-3 3-4.6 3s-3.2-1-4.6-3c-2 1-4.8 1-7.4-.4z" fill={cream} />
      {coat === 1 && <path d="M13.4 27.2c2.4 1 5 .8 7.2-.4l-.8 2.6c-2.4.6-4.6.2-6.4-.6zM34.6 27.2c-2.4 1-5 .8-7.2-.4l.8 2.6c2.4.6 4.6.2 6.4-.6z" fill={tan} />}
      {[-1, 1].map((sd) => <ellipse key={sd} cx={24 + sd * 5.4} cy="20.2" rx="1.7" ry="1.1" fill={coat ? tan : cream} />)}
      <path d={head} fill="none" stroke={INK} strokeWidth="1.1" />
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <path d={`M${24 + sd * 5.4 - 2} 23.6q2-1.8 4 0q-2 1.6-4 0z`} fill="#1d1a1a" />
          <circle cx={24 + sd * 5.4 - .6} cy="23.1" r=".5" fill="#fff" />
        </g>
      ))}
      <path d="M21.8 29.4c0-1.4 4.4-1.4 4.4 0 0 1.2-1.2 2-2.2 2s-2.2-.8-2.2-2z" fill="#1d1a1a" />
      <path d="M24 31.4v1c-.8 1.8-3 2.2-4.4.8M24 32.4c.8 1.8 3 2.2 4.4.8" fill="none" stroke={INK} strokeWidth=".9" strokeLinecap="round" />
      <path d="M22.6 33.8c.2 2.6 2.6 2.6 2.8 0z" fill="#e9737f" stroke={INK} strokeWidth=".5" />
    </g>
  )
}
function Corgi({ coat }: { coat: number }) {
  const fur = '#df8f3e', dark = coat ? '#2e2828' : fur, white = '#fbf6ee'
  const head = 'M24 14c8 0 13.8 5.6 13.8 12.6S32 39 24 39s-13.8-5.4-13.8-12.4S16 14 24 14z'
  return (
    <g>
      <ellipse cx="24" cy="50" rx="17" ry="11" fill={white} stroke={INK} strokeWidth="1.1" />
      {[-1, 1].map((sd) => (
        <g key={sd} transform={sd < 0 ? undefined : 'translate(48 0) scale(-1 1)'}>
          <path d="M8.6 19.6 9.4 2.6 20.6 13.2z" fill={dark} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M11 16.4 11.4 7 17.8 13.2z" fill="#f2c3b0" />
        </g>
      ))}
      <path d={head} fill={coat ? dark : fur} />
      {coat === 1 && <><path d="M13 25c1-4.6 4.6-7.6 8-8.4l.4 6c-2.6.6-5.4 1.6-8.4 2.4zM35 25c-1-4.6-4.6-7.6-8-8.4l-.4 6c2.6.6 5.4 1.6 8.4 2.4z" fill={fur} /></>}
      {/* (the white blaze down the middle to the muzzle) */}
      <path d="M24 14.6c1.4 0 2 4.4 2 7.4 0 1.4 4.4 3.4 4.4 7.8 0 4-3 7-6.4 7s-6.4-3-6.4-7c0-4.4 4.4-6.4 4.4-7.8 0-3 .6-7.4 2-7.4z" fill={white} />
      <path d={head} fill="none" stroke={INK} strokeWidth="1.1" />
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <circle cx={24 + sd * 5.8} cy="24.4" r="2" fill="#1d1a1a" />
          <circle cx={24 + sd * 5.8 - .6} cy="23.7" r=".7" fill="#fff" />
        </g>
      ))}
      <path d="M21.9 28.9c0-1.4 4.2-1.4 4.2 0 0 1.1-1.1 1.9-2.1 1.9s-2.1-.8-2.1-1.9z" fill="#1d1a1a" />
      <path d="M24 30.8v.8c-1 2-3.6 2.4-5 .6M24 31.6c1 2 3.6 2.4 5 .6" fill="none" stroke={INK} strokeWidth=".9" strokeLinecap="round" />
      <path d="M22.2 32.6c.2 3.6 3.4 3.6 3.6 0z" fill="#e9737f" stroke={INK} strokeWidth=".5" />
    </g>
  )
}
const RABBIT_COATS = ['#f7f4ef', '#aaa49b', '#a97e5a']
function Rabbit({ coat }: { coat: number }) {
  const fur = RABBIT_COATS[coat]
  return (
    <g>
      <ellipse cx="24" cy="51" rx="16" ry="11" fill={fur} stroke={INK} strokeWidth="1.1" />
      {[-1, 1].map((sd) => (
        <g key={sd} transform={`rotate(${sd * 10} ${24 + sd * 5} 18)`}>
          <ellipse cx={24 + sd * 5} cy="8" rx="4.2" ry="11.5" fill={fur} stroke={INK} strokeWidth="1.1" />
          <ellipse cx={24 + sd * 5} cy="8.6" rx="2" ry="8.4" fill="#f2b3b8" opacity=".85" />
        </g>
      ))}
      <ellipse cx="24" cy="29" rx="12.6" ry="11.4" fill={fur} stroke={INK} strokeWidth="1.1" />
      <ellipse cx="21" cy="22" rx="4.6" ry="2.2" fill="#fff" opacity=".22" />
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <circle cx={24 + sd * 5.6} cy="27" r="2.2" fill={coat === 0 ? '#c0394a' : '#1d1a1a'} />
          <circle cx={24 + sd * 5.6 - .7} cy="26.3" r=".75" fill="#fff" />
          <ellipse cx={24 + sd * 7.4} cy="31.4" rx="2" ry="1.1" fill="#f2a1a8" opacity=".55" />
        </g>
      ))}
      <path d="M22.8 30.4h2.4l-1.2 1.3z" fill="#e88a95" />
      <path d="M24 31.7v1.4m0 0c-.6 1-1.8 1.2-2.6.6m2.6-.6c.6 1 1.8 1.2 2.6.6" fill="none" stroke={INK} strokeWidth=".8" strokeLinecap="round" />
      <g stroke={INK} strokeWidth=".5" strokeLinecap="round" opacity=".7"><path d="M18 31.6 10.5 30.6M18 33 11 34M30 31.6 37.5 30.6M30 33 37 34" /></g>
    </g>
  )
}
const HAMSTER_COATS = [{ fur: '#e3ad66', belly: '#fbf4e8' }, { fur: '#f4f0e9', belly: '#ffffff' }, { fur: '#a8a49e', belly: '#efece6' }]
function Hamster({ coat }: { coat: number }) {
  const c = HAMSTER_COATS[coat]
  return (
    <g>
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <circle cx={24 + sd * 9.4} cy="14.4" r="4" fill={c.fur} stroke={INK} strokeWidth="1.1" />
          <circle cx={24 + sd * 9.4} cy="14.8" r="2.2" fill="#f2b3b8" />
        </g>
      ))}
      <path d="M24 12c10.6 0 18 8 18 18.6 0 10-8 17-18 17s-18-7-18-17C6 20 13.4 12 24 12z" fill={c.fur} stroke={INK} strokeWidth="1.1" />
      {/* (the cheeks full, the belly pale, a seed held up in its paws) */}
      <path d="M12 31c0-4 3-6.4 6.6-6.4 2.6 0 4 1.4 5.4 3 1.4-1.6 2.8-3 5.4-3 3.6 0 6.6 2.4 6.6 6.4 0 7-5.4 13.4-12 13.4S12 38 12 31z" fill={c.belly} />
      <ellipse cx="20" cy="18.6" rx="5" ry="2.2" fill="#fff" opacity=".22" />
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <circle cx={24 + sd * 6} cy="24" r="2" fill="#1d1a1a" />
          <circle cx={24 + sd * 6 - .6} cy="23.4" r=".7" fill="#fff" />
        </g>
      ))}
      <ellipse cx="24" cy="27.6" rx="1.3" ry=".9" fill="#e88a95" />
      <path d="M24 28.5v.9c-.5.9-1.5 1-2.2.5M24 29.4c.5.9 1.5 1 2.2.5" fill="none" stroke={INK} strokeWidth=".75" strokeLinecap="round" />
      <ellipse cx="24" cy="35.6" rx="2" ry="3.2" fill="#3b3330" transform="rotate(-20 24 35.6)" />
      <path d="M23.2 33.4l1.6 4.4" stroke="#cfc7b8" strokeWidth=".7" />
      {[-1, 1].map((sd) => <ellipse key={sd} cx={24 + sd * 2.8} cy="36.6" rx="1.8" ry="1.3" fill="#f2b3b8" stroke={INK} strokeWidth=".5" />)}
    </g>
  )
}
const BUDGIE_COATS = [{ body: '#7ccf5a', face: '#f4e04a', cere: '#5a8ad8' }, { body: '#6fa8e8', face: '#f6f6f2', cere: '#5a8ad8' }, { body: '#f2d84a', face: '#fbf0a0', cere: '#c9a27a' }]
function Budgie({ coat }: { coat: number }) {
  const c = BUDGIE_COATS[coat]
  return (
    <g>
      {/* (in profile, facing left, on a perch) */}
      <path d="M10 45h30" stroke="#8a6440" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M27 14c8 0 12.4 7 12.4 15.4 0 7.6-3.4 13.6-11 15.6-6.4 1.6-12-2.4-13.4-8.6C13 28 18 14 27 14z" fill={c.body} stroke={INK} strokeWidth="1.1" />
      <path d="M22.4 15.6c5.6-2.6 12-.4 13.6 5-3.2 1.6-6 2-9 1.4-3.2 2.6-7.6 3-10.6 1.6 1.4-3.6 3.4-6.4 6-8z" fill={c.face} />
      {/* (the black scallops over the back of the head) */}
      <g fill="none" stroke="#2a2626" strokeWidth=".8">
        {[[30, 18], [33, 19.6], [35.6, 21.8], [31, 21.6], [34, 24], [36.6, 26.6], [33.6, 27.6]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x - 1.6} ${y}q1.6 1.4 3.2 0`} />)}
      </g>
      <path d="M17 21.4c-2.6.4-4 2.6-3.6 5.2.4 1.8 1.8 2.6 3.4 2.2-.8-1.6-.6-3.4.6-4.8z" fill="#e2b866" stroke={INK} strokeWidth=".8" strokeLinejoin="round" />
      <ellipse cx="18.4" cy="20.6" rx="2" ry="1.2" fill={c.cere} />
      <circle cx="22.6" cy="21.6" r="1.6" fill="#1d1a1a" />
      <circle cx="22.6" cy="21.6" r="2.3" fill="none" stroke="#fff" strokeWidth=".7" />
      <circle cx="22" cy="21" r=".5" fill="#fff" />
      <circle cx="20" cy="27.4" r="1.2" fill="#6a5ad0" />
      <path d="M29 32c3 1.6 5.4 4.6 6.4 8.4" fill="none" stroke={shade(c.body, -0.3)} strokeWidth="1" strokeLinecap="round" />
      <path d="M22 43.6l-.6 2.2M26 44l.4 2.2" stroke="#d9a0a0" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  )
}
function Goldfish({ coat, uid }: { coat: number; uid: string }) {
  const body = '#f2762a', belly = coat ? '#fbf4ee' : '#f9b06a'
  return (
    <g>
      <rect width="48" height="48" fill={`url(#${uid}w)`} />
      <path d="M0 40c8-2 14 2 24 0s16-2 24 0v8H0z" fill="#e3c98f" opacity=".7" />
      {[[8, 34, 1.3], [11, 26, .9], [40, 18, 1.1], [38, 12, .8]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="none" stroke="#fff" strokeWidth=".6" opacity=".7" />)}
      <g transform="rotate(-8 24 24)">
        {/* (the tail, long and flowing, fins, the body; a red-and-white's white saddle) */}
        <path d="M31 23c5-6 11-8 14-6-2 3-4 5-4 7.4 0 2.4 2.4 4.4 4.4 7.6-3.6 1.4-9-1-14.4-6.2z" fill={body} opacity=".85" stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M20 17.6c1-4 4-6.4 7.6-6.2-.8 2.6-1.4 4.4-1.2 6.4z" fill={body} opacity=".85" stroke={INK} strokeWidth=".8" strokeLinejoin="round" />
        <ellipse cx="21" cy="24.6" rx="11.6" ry="7.6" fill={body} stroke={INK} strokeWidth="1.1" />
        <path d="M11 26.4c2 3.4 6 5.4 10.4 5.4 4 0 7.6-1.6 9.6-4.4-4.6 1.2-13.6 1.2-20-1z" fill={belly} />
        {coat === 1 && <path d="M16 18c4-1.6 8-1.4 11 .4-1.4 2.4-4.6 3.6-8 3.2-2.4-.4-3.4-1.6-3-3.6z" fill="#fbf4ee" />}
        <path d="M19 30.6c-1 2.6-.4 5.4 1.6 6.6 1-1.8 1.4-4 1-6.4z" fill={body} opacity=".85" stroke={INK} strokeWidth=".7" strokeLinejoin="round" />
        <circle cx="13.4" cy="23" r="2.2" fill="#fff" stroke={INK} strokeWidth=".6" />
        <circle cx="13" cy="23" r="1.2" fill="#1d1a1a" />
        <path d="M10.2 25.6q.8.8 1.8.2" fill="none" stroke={INK} strokeWidth=".7" strokeLinecap="round" />
        <path d="M17 21c2-.6 4-.6 5.6.2M18.4 25c2-.6 4-.6 5.6.2M20 29c2-.4 3.6-.4 5 .2" fill="none" stroke="#c4501a" strokeWidth=".6" opacity=".6" />
      </g>
    </g>
  )
}
const PET_DRAW: Record<Pet, (p: { coat: number; uid: string }) => ReactNode> = {
  cat: Cat, dog: Dog, shiba: Shiba, corgi: Corgi, rabbit: Rabbit, hamster: Hamster, budgie: Budgie, goldfish: Goldfish,
}

// ---- views: each fills the frame
const SKIES: Record<number, [number, string][]> = {
  0: [[0, '#6fb6ea'], [1, '#d8eefb']],
  1: [[0, '#f08a5d'], [0.55, '#f6b26b'], [1, '#fbe0a6']],
  2: [[0, '#0e1636'], [1, '#33406f']],
}
function View({ scene, time, uid }: { scene: Scene; time: number; uid: string }) {
  const night = time === 2, eve = time === 1
  const stars = night && [[6, 8], [14, 4], [33, 6], [41, 12], [26, 3], [20, 10]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r=".55" fill="#fff" opacity=".85" />)
  const moon = night && <circle cx="37" cy="10" r="3.4" fill="#f6f1d8" />
  if (scene === 'fuji') {
    const mtn = night ? '#2c3a62' : eve ? '#6c5b86' : '#4f78a8', snow = night ? '#c6d0ea' : eve ? '#f6d6c8' : '#f5f8fc'
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
        {eve && <circle cx="10" cy="27" r="4" fill="#ffe7a8" opacity=".9" />}
        {!night && !eve && <g fill="#fff" opacity=".85"><ellipse cx="10" cy="11" rx="5" ry="1.8" /><ellipse cx="13" cy="9.8" rx="3" ry="1.8" /></g>}
        <path d="M-4 40 15 22c2.4-2.4 4.4-4.6 5.6-6h6.8c1.2 1.4 3.2 3.6 5.6 6L52 40z" fill={mtn} />
        <path d="M17.4 20.2c1.4-1.4 2.4-2.8 3.2-4.2h6.8c.8 1.4 1.8 2.8 3.2 4.2l-2 1.4-1.4-1.6-2.2 2.4-2-2.6-2.2 2.2-1.4-1.8z" fill={snow} />
        <path d="M24 16 27.4 16c1.2 1.4 3.2 3.6 5.6 6L52 40H40z" fill="#000" opacity=".12" />
        <rect y="38" width="48" height="10" fill={night ? '#1b2546' : eve ? '#7b6a8c' : '#5e93c4'} />
        <path d="M-2 38c6-1.6 10-1 14-.2s8 1 12 0 9-1 12-.4 8 .8 12 .4v-2H-2z" fill={night ? '#15203c' : '#3e6a3a'} />
        <path d="M18 42h12M14 44.6h20" stroke="#fff" strokeWidth=".6" opacity=".45" />
      </g>
    )
  }
  if (scene === 'sunset') {
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
        {!night && <circle cx="24" cy="29" r="6.4" fill={eve ? '#ffe2a0' : '#fff6d8'} opacity={eve ? 1 : 0.9} />}
        <rect y="29" width="48" height="19" fill={night ? '#16234a' : eve ? '#5a4f8e' : '#3a7cc0'} />
        <path d="M30 29c2-2.4 4-3.4 6-3.4s5 1 8 3.4z" fill={night ? '#0c1430' : eve ? '#3c2f5c' : '#3a6a5a'} />
        <g stroke={night ? '#f6f1d8' : '#ffe9b0'} strokeWidth=".9" strokeLinecap="round" opacity=".8">
          <path d="M19 31.6h10M20.6 34h6.8M21.8 36.6h4.4M22.8 39.4h2.4" />
        </g>
      </g>
    )
  }
  if (scene === 'sakura') {
    const blossoms: [number, number, number][] = [[10, 12, 4.4], [16, 8, 3.6], [6, 20, 3.8], [22, 14, 3.2], [30, 6, 3.8], [37, 11, 4.2], [42, 20, 3.4], [33, 18, 3]]
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
        <path d="M-2 30c8-4 16-8 24-15M14 23c4 0 8 2 12 5M22 15c4-6 10-9 16-10M30 9c3 4 6 7 12 9" stroke="#4a3328" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {blossoms.map(([x, y, r]) => (
          <g key={`${x}${y}`}>
            <circle cx={x} cy={y} r={r} fill={night ? '#c99ab2' : '#f6bfd2'} />
            <circle cx={x - r * 0.35} cy={y - r * 0.3} r={r * 0.55} fill={night ? '#d8b0c4' : '#fbd9e5'} />
            <circle cx={x + r * 0.2} cy={y + r * 0.2} r={r * 0.25} fill="#e98aab" opacity=".7" />
          </g>
        ))}
        {[[12, 34], [26, 30], [36, 38], [18, 42], [40, 28]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.2" ry=".7" fill="#f6bfd2" transform={`rotate(${x * 7} ${x} ${y})`} />)}
        <rect y="42" width="48" height="6" fill={night ? '#20263c' : '#9cc78a'} />
      </g>
    )
  }
  if (scene === 'cityNight') {
    const dusk = time === 0
    const blocks: [number, number, number][] = [[0, 26, 8], [7, 18, 7], [13, 30, 6], [19, 22, 6], [29, 16, 6], [35, 26, 7], [41, 20, 8]]
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}c)`} />
        {[[6, 6], [16, 4], [40, 8], [30, 4]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r=".5" fill="#fff" opacity=".8" />)}
        <circle cx="38" cy="9" r="2.8" fill="#f6f1d8" opacity={dusk ? 0.6 : 1} />
        {/* (a red tower among the blocks, its lights) */}
        <path d="M24 6l3.6 28h-7.2z" fill="#d9452b" />
        <path d="M21.6 22h4.8M22.4 16h3.2M21 28h6" stroke="#f6d6a8" strokeWidth=".8" />
        <circle cx="24" cy="6" r=".8" fill="#ff5a4a" />
        {blocks.map(([x, top, w]) => <rect key={x} x={x} y={top} width={w} height={48 - top} fill="#171a30" />)}
        {blocks.flatMap(([x, top, w], i) => Array.from({ length: 12 }, (_, k) => {
          const cx = x + 1.2 + (k % 3) * (w - 2.4) / 2, cy = top + 2.4 + Math.floor(k / 3) * 3.6
          return (k * 7 + i * 3) % 5 < 3 && cy < 46 ? <rect key={`${i}-${k}`} x={cx - 0.5} y={cy} width="1" height="1.4" fill={(k + i) % 4 ? '#ffd27a' : '#bfe1ff'} /> : null
        }))}
      </g>
    )
  }
  if (scene === 'mountains') {
    const far = night ? '#3b4a78' : eve ? '#c99aa8' : '#a9c6dc', mid = night ? '#26315a' : eve ? '#8a6a8e' : '#6f9ab8', near = night ? '#141c36' : eve ? '#4e3f5c' : '#3e6e58'
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
        {eve && <circle cx="34" cy="24" r="4.2" fill="#ffe6a6" />}
        <path d="M-2 30 8 20l6 5 8-11 9 9 6-5 13 12v20H-2z" fill={far} />
        <path d="M-2 36 6 29l7 4 9-8 8 7 7-4 13 8v14H-2z" fill={mid} />
        <path d="M-2 42 8 36l8 3 10-6 9 6 8-3 7 4v10H-2z" fill={near} />
        {!night && <path d="M20.6 15.6 22 14l2.6 2.6-1.2.4-1-1-1 .8z" fill="#fff" opacity=".85" />}
      </g>
    )
  }
  if (scene === 'torii') {
    const red = '#d8392b'
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
        <path d="M-2 28c6-6 12-8 18-6s10 4 16 1 12-2 18 1v6H-2z" fill={night ? '#16203e' : eve ? '#6a4f6e' : '#5d8a6e'} opacity=".9" />
        <rect y="30" width="48" height="18" fill={night ? '#1a2a52' : eve ? '#7a5f8e' : '#3f8ac2'} />
        {/* (the torii standing in the sea, and its wavering reflection) */}
        <g>
          <path d="M8 14.4c6 1.2 26 1.2 32 0l-.8 2.4c-6 .8-24.4.8-30.4 0z" fill="#2a2222" />
          <path d="M9 16.8h30v2H9z" fill={red} />
          <path d="M11 21.4h26v1.6H11z" fill={red} />
          <path d="M14.6 18.6h2.4V31h-2.4zM31 18.6h2.4V31H31z" fill={red} />
          <path d="M23 18.8h2V21.4h-2z" fill={red} />
        </g>
        <g opacity=".35" transform="translate(0 62) scale(1 -1)">
          <path d="M14.6 31h2.4v9h-2.4zM31 31h2.4v9H31z" fill={red} />
        </g>
        <path d="M10 34h8M30 35.6h8M18 39h12" stroke="#fff" strokeWidth=".5" opacity=".5" />
      </g>
    )
  }
  if (scene === 'autumn') {
    const leaves: [number, number, number, string][] = [[6, 8, 6, '#d9452b'], [14, 4, 5, '#e8742a'], [40, 6, 6, '#c73a28'], [34, 2, 5, '#f0a030'], [44, 16, 4.6, '#e8742a'], [2, 18, 4.6, '#f0a030'], [24, -1, 5, '#d9452b']]
    return (
      <g>
        <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
        {/* (a five-storey pagoda off in the distance) */}
        <g fill={night ? '#0f1428' : '#4a2e24'}>
          {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${16 - (4 - k) * 0.6} ${40 - k * 5}h${16 + (4 - k) * 1.2}l-${2.6} -1.6h-${10.8 + (4 - k) * 1.2 - 2.6}z`} transform={`translate(${-(4 - k) * 0.6} 0)`} />)}
          <path d="M23.6 14.4h.8v6h-.8z" />
          {[0, 1, 2, 3].map((k) => <rect key={k} x={20.4 + k * 0.2} y={36 - k * 5} width={7.2 - k * 0.4} height="3.4" />)}
        </g>
        {leaves.map(([x, y, r, c]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={night ? shade(c, -0.45) : c} />)}
        {[[10, 30], [30, 26], [38, 36], [18, 38]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y}l1.2-1.6 1.2 1.6-1.2 1.4z`} fill="#e8742a" opacity=".9" />)}
        <rect y="42" width="48" height="6" fill={night ? '#1c1420' : '#8a5a3a'} />
      </g>
    )
  }
  // (a beach: the sea turquoise, the surf, the sand, a palm's fronds in from the corner, a sunshade)
  return (
    <g>
      <rect width="48" height="48" fill={`url(#${uid}s)`} />{stars}{moon}
      {!night && <circle cx="12" cy="10" r="3.4" fill={eve ? '#ffd690' : '#fff4c8'} />}
      <rect y="24" width="48" height="12" fill={night ? '#173a5c' : eve ? '#4f7fa0' : '#2fb6c4'} />
      <path d="M0 34c4 1 8-1 12 0s8 1 12 0 8-1 12 0 8 1 12 0v2H0z" fill="#fff" opacity=".8" />
      <rect y="35" width="48" height="13" fill={night ? '#5a5464' : '#f0d9a2'} />
      <path d="M30 44 33 30" stroke="#e8e2d6" strokeWidth=".9" />
      <path d="M25 31c3-4 13-4 16 0z" fill="#e8483a" />
      <path d="M29 31c1-3 5-4 8 0z" fill="#fff" opacity=".85" />
      <g fill={night ? '#1f3328' : '#3f8a4a'}>
        <path d="M48 0c-6 2-12 6-15 12 3-1 6-4 8-6-2 4-3 7-3 10 2-2 4-6 5-10 0 3 1 6 2 8 1-4 2-9 3-14z" />
      </g>
    </g>
  )
}

// ---- selfies
const PLACES = [
  { a: '#7a5a42', b: '#c49a6a', bokeh: ['#ffd790', '#ffefc8', '#f2b46a'] }, // a café
  { a: '#7fbf8a', b: '#bfe3f2', bokeh: ['#e6f6d8', '#ffffff', '#d2ecc0'] }, // a park
  { a: '#e9d8c8', b: '#f6eee4', bokeh: [] as string[] }, // a wall at home
  { a: '#141a34', b: '#3a2f5a', bokeh: ['#ff8aa8', '#7ad4ff', '#ffd27a'] }, // a street at night
]
function Selfie({ a, uid }: { a: Extract<AvatarSpec, { kind: 'selfie' }>; uid: string }) {
  const skin = SKIN[a.skin], hair = HAIR[a.hair], place = PLACES[a.place]
  const back = a.cut === 1 || a.cut === 3
  return (
    <g>
      <rect width="48" height="48" fill={`url(#${uid}p)`} />
      {place.bokeh.map((c, i) => [[6, 9, 4], [40, 7, 3.2], [36, 20, 2.4], [8, 24, 2.8], [44, 30, 3.4]].map(([x, y, r], k) => (
        <circle key={`${i}-${k}`} cx={(x + i * 13) % 48} cy={(y + i * 5) % 34} r={r * (1 - i * 0.18)} fill={c} opacity=".42" />
      )))}
      <g transform={`rotate(${a.tilt * 0.6} 24 30)`}>
        {/* (long hair behind, then the shoulders in what they wear, the neck, the face) */}
        {back && <path d="M13 20c0-8 5-12.6 11-12.6S35 12 35 20v18H13z" fill={hair} />}
        <path d="M5 50c0-8.6 7.6-13 19-13s19 4.4 19 13z" fill={a.shirt} stroke={INK} strokeWidth="1.1" />
        <path d="M18.6 38c1.4 2.6 3.4 4 5.4 4s4-1.4 5.4-4" fill="none" stroke={shade(a.shirt, -0.35)} strokeWidth="1" />
        <path d="M20.6 31.6h6.8v6.4c-1 1.6-2.2 2.2-3.4 2.2s-2.4-.6-3.4-2.2z" fill={shade(skin, -0.12)} />
        <ellipse cx="24" cy="23.4" rx="9.2" ry="10.6" fill={skin} stroke={INK} strokeWidth="1.1" />
        {/* (the hair over the head: short, long, a bob, a ponytail, a bun, cropped close) */}
        {a.cut === 0 && <path d="M14.6 21.6c-.6-7.4 4-11.6 9.4-11.6 6 0 10.2 4.4 9.6 11.2-1.4-2.8-3.4-4.6-6.4-5.4-2.6 2-7 3.6-12.6 5.8z" fill={hair} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />}
        {(a.cut === 1 || a.cut === 2) && <path d="M14.4 26c-1.6-9.4 3-15.4 9.6-15.4 6.8 0 11.4 5.6 9.6 15.4-1-4.6-2.6-7.6-4.6-9-3 2.4-8.6 3.6-11.4 3.2-1.4 1.4-2.6 3.4-3.2 5.8z" fill={hair} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />}
        {a.cut === 2 && <path d="M14.2 22c-1 5 .2 9 1.6 10.6l1.4-.4c-.6-3.4-.6-6.4 0-9.4zM33.8 22c1 5-.2 9-1.6 10.6l-1.4-.4c.6-3.4.6-6.4 0-9.4z" fill={hair} />}
        {a.cut === 3 && <><path d="M14.6 22c-.8-7.6 3.6-11.8 9.4-11.8s10.2 4.2 9.4 11.8c-1.4-3-3.8-5-7-5.6-2.4 1.6-7.4 3.2-11.8 5.6z" fill={hair} stroke={INK} strokeWidth=".9" strokeLinejoin="round" /><path d="M33.4 14c4 1 5.6 6 4 12-1-1.8-2.4-3-4-3.4z" fill={hair} stroke={INK} strokeWidth=".8" /></>}
        {a.cut === 4 && <><circle cx="24" cy="10" r="4.4" fill={hair} stroke={INK} strokeWidth=".9" /><path d="M14.6 22c-.8-7.6 3.6-11.8 9.4-11.8s10.2 4.2 9.4 11.8c-2-3-5.4-5.2-9.4-5.2S16.6 19 14.6 22z" fill={hair} stroke={INK} strokeWidth=".9" strokeLinejoin="round" /></>}
        {a.cut === 5 && <path d="M15 19.6c.4-5.6 4.2-8.8 9-8.8s8.6 3.2 9 8.8c-2.4-2-5.4-3-9-3s-6.6 1-9 3z" fill={hair} opacity=".85" />}
        {/* (smiling: eyes shut happy or open, a little blush, the mouth open in a grin) */}
        {[-1, 1].map((sd) => (
          <g key={sd}>
            {a.peace ? <path d={`M${24 + sd * 3.8 - 1.8} 24.2q1.8-1.8 3.6 0`} fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
              : <><circle cx={24 + sd * 3.8} cy="23.8" r="1.25" fill="#1d1a1a" /><circle cx={24 + sd * 3.8 - .4} cy="23.4" r=".4" fill="#fff" /></>}
            <ellipse cx={24 + sd * 5.6} cy="27.4" rx="1.8" ry="1" fill="#f08a8a" opacity=".45" />
          </g>
        ))}
        {a.glasses && <g fill="none" stroke={INK} strokeWidth=".8"><circle cx="20.2" cy="23.8" r="2.8" /><circle cx="27.8" cy="23.8" r="2.8" /><path d="M23 23.6h2" /></g>}
        <path d="M21.6 28.2c.8 1.8 4 1.8 4.8 0z" fill="#b8434a" stroke={INK} strokeWidth=".6" strokeLinejoin="round" />
        {/* (a peace sign by the cheek) */}
        {a.peace && (
          <g transform="rotate(-12 37 34)">
            <path d="M34.4 36.6c-.6-2.6.4-4.2 2.4-4.4l.2-6.4c0-1 1.6-1 1.6 0l.2 5.4.8-5.8c.2-1 1.6-.8 1.6.2l-.4 6.6c1.6.6 2 2.4 1.4 4.2-.8 2.4-3 3.4-5.2 3-1.6-.4-2.4-1.4-2.6-2.8z" fill={skin} stroke={INK} strokeWidth=".8" strokeLinejoin="round" />
          </g>
        )}
      </g>
    </g>
  )
}

/** a reviewer's picture, `size` px round */
export const ReviewerAvatar = memo(function ReviewerAvatar({ id, name, size = 38 }: { id: number; name: string; size?: number }) {
  const a = avatarOf(id)
  const uid = `rv${id}`
  let body: ReactNode
  const defs: ReactNode[] = []
  if (a.kind === 'letter') {
    const ch = initialOf(name)
    body = (
      <>
        <rect width="48" height="48" fill={a.bg} />
        <text x="24" y="24" dy=".36em" textAnchor="middle" fontSize={/[　-鿿]/.test(ch) ? 21 : 23} fontWeight="600" fill="#fff"
          fontFamily="'Noto Sans TC', 'Noto Sans JP', 'Segoe UI', sans-serif">{ch}</text>
      </>
    )
  } else if (a.kind === 'blank') {
    body = (
      <>
        <rect width="48" height="48" fill="#bfc4ca" />
        <circle cx="24" cy="19" r="8.6" fill="#eef0f2" />
        <path d="M7 48c0-9.4 7.6-15 17-15s17 5.6 17 15z" fill="#eef0f2" />
      </>
    )
  } else if (a.kind === 'pet') {
    const [g0, g1] = PET_GROUND[a.bg]
    defs.push(<radialGradient key="g" id={`${uid}g`} cx="50%" cy="35%" r="70%"><stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} /></radialGradient>)
    defs.push(<Sky key="w" id={`${uid}w`} stops={[[0, '#9fd6f2'], [1, '#3d8fc4']]} />)
    const Draw = PET_DRAW[a.pet]
    body = (
      <>
        <rect width="48" height="48" fill={`url(#${uid}g)`} />
        <g transform={`translate(24 27) rotate(${a.tilt}) scale(${a.zoom}) translate(-24 -27)`}><Draw coat={a.coat} uid={uid} /></g>
      </>
    )
  } else if (a.kind === 'scene') {
    defs.push(<Sky key="s" id={`${uid}s`} stops={SKIES[a.time]} />)
    defs.push(<Sky key="c" id={`${uid}c`} stops={a.time === 0 ? [[0, '#2a2a5e'], [0.6, '#7a4a7a'], [1, '#e08a6a']] : [[0, '#0b1230'], [1, '#2c2a5a']]} />)
    body = <g transform={`rotate(${a.tilt} 24 24) scale(1.06) translate(-1.4 -1.4)`}><View scene={a.scene} time={a.time} uid={uid} /></g>
  } else {
    const pl = PLACES[a.place]
    defs.push(<Sky key="p" id={`${uid}p`} stops={[[0, pl.b], [1, pl.a]]} />)
    body = <Selfie a={a} uid={uid} />
  }
  return (
    <svg className="rev-avatar" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}k`}><circle cx="24" cy="24" r="24" /></clipPath>
        {defs}
      </defs>
      <g clipPath={`url(#${uid}k)`}>{body}</g>
      <circle cx="24" cy="24" r="23.5" fill="none" stroke="rgb(0 0 0 / 0.12)" strokeWidth="1" />
    </svg>
  )
})
