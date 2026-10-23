import { useEffect, useRef, useState } from 'react'

/** the shop's background music, 居酒屋の夜, looped quietly: public/audio/izakaya-night.mp3 (a missing file just means no music) */
const SRC = import.meta.env.BASE_URL + 'audio/izakaya-night.mp3'
const KEY = 'jgs-bgm-off'
const VOLUME = 0.35

export function Bgm() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [off, setOff] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  useEffect(() => {
    const a = new Audio(SRC)
    a.loop = true
    a.volume = VOLUME
    audio.current = a
    return () => { a.pause(); audio.current = null }
  }, [])
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (off) { a.pause(); return }
    // (browsers only let sound start after a touch of the page: it begins at the first one)
    const go = () => { a.play().catch(() => {}) }
    go()
    window.addEventListener('pointerdown', go, { once: true })
    window.addEventListener('keydown', go, { once: true })
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go) }
  }, [off])
  return (
    <button type="button" className={`bgm-toggle${off ? '' : ' is-on'}`} aria-pressed={!off} aria-label="背景音樂 BGM" title="居酒屋の夜"
      onClick={() => setOff((v) => { const n = !v; try { localStorage.setItem(KEY, n ? '1' : '0') } catch { /* private window */ } return n })}>
      {off ? '♪̸' : '♪'}
    </button>
  )
}
