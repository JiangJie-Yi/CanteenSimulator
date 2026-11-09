// What the staff (and the owner) say as the day ends and begins, over their heads (game/shopState's STAFF_TALK, App says them): a bubble
// that follows whoever said it as they walk, gone after a few seconds. Only those speaking just now are drawn (each one its own little
// page root, so none are kept about between times).
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { LATE, SPEAKERS, STAFF_SKILLS, STAFF_TALK, STAFF_TIRED, type StaffWord } from '@/game/shopState'
import { SKILLS, TIERS, type SkillId } from '@/data/staff'
import { Glyph, SkillIcon, StatusIcon } from '@/ui/GameIcons'
import { setTip } from '@/scene/hoverTip'

const STYLE = { pointerEvents: 'none' } as const
const Z = [21, 11]
/** over the head, in the figure's own frame (the staff and the owner are one model's size); a little higher than the badges, which sit
 * right over the head */
const HEAD = new THREE.Vector3(0, 1.62, 0)
/**
 * drei's Html goes on drawing its page bit whether or not its group's shown: with the one it follows out of sight (off on a round, gone out
 * of the door), the badge or bubble stayed where it last was (the owner's: a green badge left standing in the aisle). Shown or hidden here,
 * on the page bit itself
 */
const showEl = (el: HTMLElement | null, on: boolean) => { if (el && (el.style.visibility === 'hidden') === on) el.style.visibility = on ? '' : 'hidden' }
const AT = new THREE.Vector3()
/** how many lines may be up over heads at once */
const MAX_LINES = 6

/**
 * The bubbles kept from lying over one another (the owner's: two heads near together, their words piled up unreadable): a few times a
 * second, every bubble shown (the customers', the staff's, the owner's) taken from the lowest on the screen up, and one that would overlap
 * one already placed lifted just clear above it; eased there (the bubble's own transition), back down as the way clears
 */
function spreadBubbles() {
  // (at most so many lines up at once, the newest: the oldest put away (not the dots of those waiting to order); a shop full of talk
  // was a wall of bubbles)
  const lines = [...document.querySelectorAll<HTMLElement>('.g3-say')]
  const now = performance.now()
  for (const el of lines) if (!el.dataset.born) el.dataset.born = String(now)
  lines.sort((a, b) => +b.dataset.born! - +a.dataset.born!)
  lines.forEach((el, i) => el.classList.toggle('is-crowded', i >= MAX_LINES))
  const placed: { l: number; r: number; t: number; h: number }[] = []
  const all = [...document.querySelectorAll<HTMLElement>('.g3-bubble')].map((el) => {
    // (where it stands unlifted: its place now less the lift it has just now, mid-ease, not the lift it's easing to (that set it a
    // little higher each time while it eased, and a bubble crept up off its speaker onto the wall))
    const r = el.getBoundingClientRect(), lift = -parseFloat(getComputedStyle(el).translate.split(' ')[1] ?? '0') || 0
    return { el, r, base: r.top + lift, shown: r.width > 0 && !el.classList.contains('is-crowded') && el.closest<HTMLElement>('[style*="visibility: hidden"]') === null }
  }).filter((x) => x.shown).sort((a, b) => b.base - a.base)
  for (const x of all) {
    const h = x.r.height
    let top = x.base
    for (let guard = 0; guard < 8; guard++) {
      const hit = placed.find((p) => x.r.left < p.r - 2 && x.r.right > p.l + 2 && top < p.t + p.h + 4 && top + h > p.t - 4)
      if (!hit) break
      top = hit.t - h - 4
    }
    // (lifted a little at most: further, the bubble's off its speaker's head, over someone else or the wall)
    const dy = Math.min(60, Math.max(0, x.base - top))
    placed.push({ l: x.r.left, r: x.r.right, t: x.base - dy, h })
    if (Math.abs(dy - +(x.el.dataset.dy ?? 0)) > 1) { x.el.dataset.dy = String(dy); x.el.style.translate = dy ? `0 ${-dy}px` : '' }
  }
}

export const StaffWords = memo(function StaffWords() {
  useEffect(() => { const t = window.setInterval(spreadBubbles, 150); return () => window.clearInterval(t) }, [])
  const [words, setWords] = useState<StaffWord[]>([])
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = performance.now()
      for (let i = STAFF_TALK.length - 1; i >= 0; i--) if (STAFF_TALK[i].until < now) STAFF_TALK.splice(i, 1)
      // (one bubble a speaker: a newer word takes an older one's place, never two stacked over one head)
      // (the same person by who they are, not by the id the word was given: the till's words are the owner's when no cashier's hired)
      const who = (id: string) => SPEAKERS.get(id) ?? id
      for (let i = STAFF_TALK.length - 1; i >= 0; i--) if (STAFF_TALK.findIndex((w, k) => k > i && who(w.id) === who(STAFF_TALK[i].id)) >= 0) STAFF_TALK.splice(i, 1)
      setWords((was) => (was.length === STAFF_TALK.length && was.every((w, i) => w.key === STAFF_TALK[i].key) ? was : [...STAFF_TALK]))
    }, 250)
    return () => window.clearInterval(t)
  }, [])
  return <>{words.map((w) => <Word key={w.key} word={w} />)}</>
})

function Word({ word }: { word: StaffWord }) {
  // (faded out over its last 0.3 s, as it's taken away)
  const [fadeAt] = useState(() => ({ '--out': `${Math.max(0, word.until - performance.now() - 300)}ms` }) as CSSProperties)
  const g = useRef<THREE.Group>(null)
  const el = useRef<HTMLDivElement>(null)
  const scene = useThree((s) => s.scene)
  const who = useRef<THREE.Object3D | null>(null)
  useFrame(() => {
    const o = g.current
    if (!o || !o.parent) return
    if (!who.current?.parent) {
      who.current = null
      if (word.id === 'owner') who.current = scene.getObjectByName('BossFollow') ?? null
      // (whoever's at the till: the cashier, the owner where there's none)
      else if (word.id === 'role:cashier') {
        scene.traverse((q) => { if (!who.current && q.userData.staffRole === 'cashier') who.current = q.parent })
        who.current ??= scene.getObjectByName('BossFollow') ?? null
      } else scene.traverse((q) => { if (!who.current && q.userData.staffId === word.id) who.current = q })
    }
    const t = who.current
    // (shown only while they are: not while a stand-in walks for them, nor once they've faded out of a doorway)
    let shown = !!t
    for (let q: THREE.Object3D | null = t; q && shown; q = q.parent) if (!q.visible || (q.userData.fade ?? 1) < 0.5) shown = false
    o.visible = shown
    showEl(el.current, o.visible)
    if (!t) return
    o.position.copy(o.parent.worldToLocal(t.localToWorld(AT.copy(HEAD))))
  })
  return (
    <group ref={g} visible={false}>
      <Html center zIndexRange={Z} style={STYLE}>
        <div className="g3-label" ref={el}><span className="g3-bubble g3-say staff-say" style={fadeAt}><b className="say-who">{SPEAKERS.get(word.id) ?? ''}</b>{word.text}</span></div>
      </Html>
    </group>
  )
}

/** right over the head, in its middle (the owner's: beside it, it hung behind the cap), in the figure's own frame; the bubble's over it */
const SIDE = new THREE.Vector3(0, 1.43, 0)
const BADGE_Z = [20, 10]
/** what a badge means, in the shop's paper label (the same as everything else pointed at in the room, the owner's), not the browser's own */
const tipOn = (title: string, hint: string) => ({ onPointerEnter: () => setTip({ title, hint }), onPointerLeave: () => setTip(null) })
/** the worn out's debuff, in the page's language */
const TIRED_SAYS: Record<string, [string, string, string]> = {
  zh: ['疲勞中', '疲勞', '能力減半、動作變慢・可安排休息或換班'], ja: ['疲労中', '疲労', '能力半減・動きが遅い・休憩かシフト交代を'],
  en: ['Tired', 'Worn out', 'Half as able, half as quick; give them a rest or a shift off'],
}
type Marks = { tired: boolean; buffs: SkillId[] }
/** a skill working just now by the time of night (only those that have a time: before midnight, or in the deep night) */
const timedNow = (k: SkillId) => { const sk = SKILLS[k]; return LATE.on ? !!(sk.late || sk.latePace) : !!sk.early }
const marksOf = (id: string): Marks => ({ tired: STAFF_TIRED.has(id), buffs: (STAFF_SKILLS.get(id) ?? []).filter(timedNow) })

/**
 * Beside each of the staff, what's on them (the owner's): worn out (data/staff's isTired: game/shopState's STAFF_TIRED, App keeps it), a
 * little see-through deep red badge, a bead of sweat and 疲勞中; a special skill of theirs that's working just now by the time of night (the night owl in the deep
 * night, the early bird before midnight), its icon in its quality's colour, ▲. Each says what it means when pointed at; they follow them
 * about, gone as it passes.
 */
export const TiredBadges = memo(function TiredBadges() {
  const [on, setOn] = useState<{ id: string; m: Marks }[]>([])
  useEffect(() => {
    const t = window.setInterval(() => {
      const next = [...new Set([...STAFF_TIRED, ...STAFF_SKILLS.keys()])].map((id) => ({ id, m: marksOf(id) })).filter((x) => x.m.tired || x.m.buffs.length)
      setOn((was) => (was.length === next.length && was.every((x, i) => x.id === next[i].id && x.m.tired === next[i].m.tired && x.m.buffs.join() === next[i].m.buffs.join()) ? was : next))
    }, 500)
    return () => window.clearInterval(t)
  }, [])
  return <>{on.map(({ id, m }) => <TiredBadge key={id} id={id} marks={m} />)}</>
})

function TiredBadge({ id, marks }: { id: string; marks: Marks }) {
  const g = useRef<THREE.Group>(null)
  const el = useRef<HTMLSpanElement>(null)
  const scene = useThree((s) => s.scene)
  const who = useRef<THREE.Object3D | null>(null)
  useFrame(() => {
    const o = g.current
    if (!o || !o.parent) return
    if (!who.current?.parent) {
      who.current = null
      scene.traverse((q) => { if (!who.current && q.userData.staffId === id) who.current = q })
    }
    const t = who.current
    // (with them: not while they're out of sight (off at the door, or stood in for by the one out on a round))
    // (nor as they fade out of a doorway going home: it went on hanging there, solid, after they'd gone)
    let shown = !!t
    for (let q: THREE.Object3D | null = t; q && shown; q = q.parent) if (!q.visible || (q.userData.fade ?? 1) < 0.5) shown = false
    o.visible = shown
    showEl(el.current, shown)
    if (!t || !shown) return
    o.position.copy(o.parent.worldToLocal(t.localToWorld(AT.copy(SIDE))))
  })
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'zh'
  const tired = () => {
    const [mark, name, says] = TIRED_SAYS[lang] ?? TIRED_SAYS.zh
    return <span key="tired" className="staff-badge is-tired" aria-label={`${name}：${says}`} {...tipOn(name, says)}><Glyph id="drop" size={12} />{mark}</span>
  }
  const buff = (k: SkillId) => {
    const sk = SKILLS[k], tier = TIERS[sk.tier]
    const [name, says, q] = lang === 'ja' ? [sk.ja, sk.jaSays, tier.ja] : lang === 'en' ? [sk.en, sk.enSays, tier.en] : [sk.zh, sk.zhSays, tier.zh]
    return <span key={k} className={`staff-badge is-buff is-${sk.tier}`} aria-label={`${name}：${says}`} {...tipOn(`${q}・${name}`, says)}><StatusIcon up /><SkillIcon id={k} size={14} /></span>
  }
  return (
    <group ref={g} visible={false}>
      <Html center zIndexRange={BADGE_Z}>
        <span className="staff-badges" ref={el}>{marks.tired && tired()}{marks.buffs.map(buff)}</span>
      </Html>
    </group>
  )
}
