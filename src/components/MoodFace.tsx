import type { GuestView } from './Roasting'

/**
 * How pleased a customer is, as a face: a wide grin for food they loved, a smile, a flat mouth, a frown, a sad
 * face for food that let them down; still waiting, a plain face with its eyes glancing aside; walked out, red
 * and cross. The face is coloured from warm yellow (happy) to grey-blue (unhappy).
 */
export function MoodFace({ guest }: { guest: GuestView }) {
  const r = guest.rating
  const mood = guest.state === 'angry' ? 'angry'
    : r === null ? 'wait'
      : r >= 80 ? 'love' : r >= 65 ? 'happy' : r >= 45 ? 'ok' : r >= 25 ? 'meh' : 'sad'
  const fill = { love: '#ffd23f', happy: '#ffdc6a', ok: '#f3dfa0', meh: '#d9d2b8', sad: '#b9c2cc', wait: '#f1e6c8',
    angry: '#f08a6c' }[mood]
  const mouth = {
    love: 'M12 21q6 7 12 0z',
    happy: 'M12.5 21q5.5 5 11 0',
    ok: 'M13 23h10',
    meh: 'M13 24q5-2.5 10 0',
    sad: 'M12.5 26q5.5-5 11 0',
    wait: 'M15 23.5h6',
    angry: 'M12.5 26q5.5-4 11 0',
  }[mood]
  const label = { love: '超滿意', happy: '滿意', ok: '普通', meh: '不太滿意', sad: '失望', wait: '等餐中', angry: '生氣離開' }[mood]
  return (
    <svg className={`mood-face is-${mood}`} viewBox="0 0 36 36" role="img" aria-label={label}>
      <title>{label}{r !== null ? ` ${Math.round(r)}` : ''}</title>
      <circle cx="18" cy="18" r="15" fill={fill} stroke="#3b2a20" strokeWidth="1.6" />
      {mood === 'love' ? (
        // eyes squeezed shut with joy, and rosy cheeks
        <>
          <path d="M10.5 15q2.5-3 5 0M20.5 15q2.5-3 5 0" fill="none" stroke="#3b2a20" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9.5" cy="20" r="2" fill="#f2907a" opacity="0.7" />
          <circle cx="26.5" cy="20" r="2" fill="#f2907a" opacity="0.7" />
        </>
      ) : mood === 'angry' ? (
        <>
          <path d="M10 12l5 2.5M26 12l-5 2.5" stroke="#3b2a20" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="13.5" cy="16.5" r="1.5" fill="#3b2a20" />
          <circle cx="22.5" cy="16.5" r="1.5" fill="#3b2a20" />
        </>
      ) : mood === 'wait' ? (
        <>
          <circle cx="14.5" cy="15.5" r="1.5" fill="#3b2a20" />
          <circle cx="24.5" cy="15.5" r="1.5" fill="#3b2a20" />
        </>
      ) : (
        <>
          <circle cx="13" cy="15.5" r="1.6" fill="#3b2a20" />
          <circle cx="23" cy="15.5" r="1.6" fill="#3b2a20" />
          {mood === 'sad' && <path d="M25.5 18q1.5 3 0 4.5q-1.5-1.5 0-4.5z" fill="#6aa8e0" />}
        </>
      )}
      <path d={mouth} fill={mood === 'love' ? '#a8432f' : 'none'} stroke="#3b2a20" strokeWidth="1.6" strokeLinecap="round"
        strokeLinejoin="round" />
    </svg>
  )
}