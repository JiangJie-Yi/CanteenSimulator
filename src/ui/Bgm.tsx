import { useEffect, useRef } from 'react'
import { getBgmOff, useBgmOff } from './bgmStore'

/**
 * The shop's background music, 居酒屋の夜, looped quietly, from public/music/ (IzakayaNight.mp3; failing that, the other names it might have been
 * saved as, in turn); with none there, there's no music. It starts off; the speaker on the wall switches it on and off (bgmStore).
 */
const NAMES = ['IzakayaNight.mp3', 'izakaya-night.mp3', '居酒屋の夜.mp3', 'izakaya-night.m4a', 'izakaya-night.ogg', 'izakaya-night.wav', 'bgm.mp3']
/** how loud it plays */
const VOLUME = 0.35
const SRCS = NAMES.map((n) => import.meta.env.BASE_URL + 'music/' + encodeURIComponent(n))

export function Bgm() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const off = useBgmOff()
  useEffect(() => {
    const a = new Audio()
    a.loop = true
    a.volume = VOLUME
    let i = 0
    // (a file that isn't there (or can't be played) hands over to the next name on the list)
    const next = () => {
      if (i >= SRCS.length) return
      a.src = SRCS[i++]
      a.load()
      if (!getBgmOff()) a.play().catch(() => {})
    }
    a.addEventListener('error', next)
    next()
    audio.current = a
    return () => { a.removeEventListener('error', next); a.pause(); audio.current = null }
  }, [])
  // (switched on by a click on the speaker, which is the touch the browser wants before it lets sound start)
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (off) a.pause()
    else a.play().catch(() => {})
  }, [off])
  return null
}
