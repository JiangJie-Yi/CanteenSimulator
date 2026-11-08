// What the staff (and the owner) say as the day ends and begins, over their heads (game/shopState's STAFF_TALK, App says them): a bubble
// that follows whoever said it as they walk, gone after a few seconds. Only those speaking just now are drawn (each one its own little
// page root, so none are kept about between times).
import { memo, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { LATE, SPEAKERS, STAFF_SKILLS, STAFF_TALK, STAFF_TIRED, type StaffWord } from '@/game/shopState'
import { SKILLS, TIERS, type SkillId } from '@/data/staff'

const STYLE = { pointerEvents: 'none' } as const
const Z = [21, 11]
/** over the head, in the figure's own frame (the staff and the owner are one model's size) */
const HEAD = new THREE.Vector3(0, 1.5, 0)
const AT = new THREE.Vector3()

export const StaffWords = memo(function StaffWords() {
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
  const g = useRef<THREE.Group>(null)
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
    o.visible = !!t && t.visible
    if (!t) return
    o.position.copy(o.parent.worldToLocal(t.localToWorld(AT.copy(HEAD))))
  })
  return (
    <group ref={g} visible={false}>
      <Html center zIndexRange={Z} style={STYLE}>
        <div className="g3-label"><span className="g3-bubble g3-say staff-say"><b className="say-who">{SPEAKERS.get(word.id) ?? ''}</b>{word.text}</span></div>
      </Html>
    </group>
  )
}

/** beside the head, to one side (the bubble's over it), in the figure's own frame */
const SIDE = new THREE.Vector3(0.42, 1.3, 0)
const BADGE_Z = [20, 10]
/** the worn out's debuff, in the page's language */
const TIRED_SAYS: Record<string, [string, string, string]> = {
  zh: ['疲', '疲勞', '能力減半・動作變慢'], ja: ['疲', '疲労', '能力半減・動きが遅い'], en: ['Tired', 'Worn out', 'Half as able, half as quick'],
}
type Marks = { tired: boolean; buffs: SkillId[] }
/** a skill working just now by the time of night (only those that have a time: before midnight, or in the deep night) */
const timedNow = (k: SkillId) => { const sk = SKILLS[k]; return LATE.on ? !!(sk.late || sk.latePace) : !!sk.early }
const marksOf = (id: string): Marks => ({ tired: STAFF_TIRED.has(id), buffs: (STAFF_SKILLS.get(id) ?? []).filter(timedNow) })

/**
 * Beside each of the staff, what's on them (the owner's): worn out (data/staff's isTired: game/shopState's STAFF_TIRED, App keeps it), a
 * little dark-red debuff, ▼ and 疲; a special skill of theirs that's working just now by the time of night (the night owl in the deep
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
    if (!t || !shown) return
    o.position.copy(o.parent.worldToLocal(t.localToWorld(AT.copy(SIDE))))
  })
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'zh'
  const tired = () => {
    const [mark, name, says] = TIRED_SAYS[lang] ?? TIRED_SAYS.zh
    return <span key="tired" className="staff-badge is-tired" title={`${name}：${says}`} aria-label={`${name}：${says}`}><b aria-hidden="true">▼</b>{mark}</span>
  }
  const buff = (k: SkillId) => {
    const sk = SKILLS[k], tier = TIERS[sk.tier]
    const [name, says, q] = lang === 'ja' ? [sk.ja, sk.jaSays, tier.ja] : lang === 'en' ? [sk.en, sk.enSays, tier.en] : [sk.zh, sk.zhSays, tier.zh]
    return <span key={k} className={`staff-badge is-buff is-${sk.tier}`} title={`${q}・${name}：${says}`} aria-label={`${name}：${says}`}><b aria-hidden="true">▲</b>{sk.icon}</span>
  }
  return (
    <group ref={g} visible={false}>
      <Html center zIndexRange={BADGE_Z}>
        <span className="staff-badges">{marks.tired && tired()}{marks.buffs.map(buff)}</span>
      </Html>
    </group>
  )
}
