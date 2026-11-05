// What the staff (and the owner) say as the day ends and begins, over their heads (game/shopState's STAFF_TALK, App says them): a bubble
// that follows whoever said it as they walk, gone after a few seconds. Only those speaking just now are drawn (each one its own little
// page root, so none are kept about between times).
import { memo, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { SPEAKERS, STAFF_TALK, type StaffWord } from '@/game/shopState'

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
