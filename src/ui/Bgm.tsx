import { useEffect, useRef, useState } from 'react'
import { getBgm, setBgmOff, setBgmVolume, toggleBgmPanel, useBgm } from './bgmStore'

/**
 * The shop's background music, 居酒屋の夜, looped quietly: src/IzakayaNight.mp3, or public/audio/izakaya-night.mp3. If those aren't there, the others it might have been
 * saved as are tried in turn (the song's own title, another format); with none, there's no music and the button says what file it looked for.
 */
const NAMES = ['izakaya-night.mp3', '居酒屋の夜.mp3', 'izakaya-night.m4a', 'izakaya-night.ogg', 'izakaya-night.wav', 'bgm.mp3']
// (the song kept in src/ as it is on the owner's machine (src/IzakayaNight.mp3) is bundled with the page when it's there; the glob finds nothing, and breaks nothing, when it isn't)
const IN_SRC = Object.values(import.meta.glob<string>('/src/*.{mp3,m4a,ogg,wav}', { eager: true, query: '?url', import: 'default' }))
const SRCS = [...IN_SRC, ...NAMES.map((n) => import.meta.env.BASE_URL + 'audio/' + encodeURIComponent(n))]

export function Bgm() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const { off, volume, panel, seen } = useBgm()
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    const a = new Audio()
    a.loop = true
    a.volume = getVolume()
    let i = 0
    // (a file that isn't there (or can't be played) hands over to the next name on the list)
    const next = () => {
      if (i >= SRCS.length) { setMissing(true); return }
      a.src = SRCS[i++]
      a.load()
      if (!a.paused || startedRef.current) a.play().catch(() => {})
    }
    a.addEventListener('error', next)
    next()
    audio.current = a
    return () => { a.removeEventListener('error', next); a.pause(); audio.current = null }
  }, [])
  const startedRef = useRef(false)
  useEffect(() => { if (audio.current) audio.current.volume = volume }, [volume])
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (off) { a.pause(); return }
    // (browsers only let sound start after a touch of the page: it begins at the first one)
    const go = () => { startedRef.current = true; a.play().catch(() => {}) }
    go()
    window.addEventListener('pointerdown', go, { once: true })
    window.addEventListener('keydown', go, { once: true })
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go) }
  }, [off])
  return (
    <>
      <button type="button" className={`bgm-toggle${off || missing ? '' : ' is-on'}${seen ? ' is-seen' : ''}`} aria-pressed={!off} aria-label="背景音樂 BGM" title={missing ? '找不到音檔：請放到 src/IzakayaNight.mp3' : '居酒屋の夜'}
        onClick={() => toggleBgmPanel()}>
        {off ? '♪̸' : '♪'}
      </button>
      {panel && (
        <div className="bgm-panel" role="dialog" aria-label="音樂與音量">
          <b>🔊 居酒屋の夜</b>
          <button type="button" className={`bgm-power${off ? '' : ' is-on'}`} aria-pressed={!off} onClick={() => setBgmOff(!off)}>{off ? '播放' : '暫停'}</button>
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => setBgmVolume(Number(e.target.value) / 100)} aria-label="音量" />
          <span>{Math.round(volume * 100)}%</span>
          <button type="button" className="bgm-close" onClick={() => toggleBgmPanel(false)} aria-label="關閉">×</button>
        </div>
      )}
    </>
  )
}
const getVolume = () => getBgm().volume
