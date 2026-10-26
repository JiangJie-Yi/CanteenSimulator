import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Lang } from '@/data/i18n'
import { REGISTER_MANUAL } from '@/data/registerManual'

/** whether the register's manual is open (opened by clicking the booklet under the till) */
let open = false
const subs = new Set<() => void>()
const set = (v: boolean) => { open = v; subs.forEach((f) => f()) }
export const openRegisterManual = () => set(true)
const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => open)

/** a page turned: the paper's soft swish across, rising then falling, and the faint flap as it settles */
let audio: AudioContext | null = null
function flip() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime, sr = audio.sampleRate, len = 0.32
    const b = audio.createBuffer(1, Math.round(sr * len), sr)
    const d = b.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const x = i / d.length
      // (brown-ish noise: paper's rustle, swelling and dying, a little crackle through it)
      last = last * 0.82 + (Math.random() * 2 - 1) * 0.18
      d[i] = last * Math.sin(Math.PI * Math.min(1, x * 1.25)) ** 1.5 * (1 + (Math.random() < 0.004 ? 3 : 0))
    }
    const n = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain()
    n.buffer = b
    f.type = 'bandpass'
    f.frequency.setValueAtTime(1400, t)
    f.frequency.linearRampToValueAtTime(3200, t + len * 0.6)
    f.Q.value = 0.6
    g.gain.value = 0.9
    n.connect(f).connect(g).connect(audio.destination)
    n.start(t)
  } catch { /* (no sound to be had) */ }
}
/** the page shown, and turning to another (with the sound, only when it really is another: the state set from it, never a side effect inside an updater) */
let shown = 0
const turn = (set: (n: number) => void, by: number) => {
  const m = Math.max(0, Math.min(REGISTER_MANUAL.length - 1, shown + by))
  if (m === shown) return
  shown = m
  flip()
  set(m)
}

/** the manual, opened: a booklet's pages, one at a time, turned with the arrows, shut with × or Esc or a click outside */
export function RegisterManual({ lang }: { lang: Lang }) {
  const isOpen = useOpen()
  const [page, setPage] = useState(0)
  useEffect(() => { shown = page }, [page])
  // (Esc shuts it; the arrow keys turn the pages)
  useEffect(() => {
    if (!isOpen) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set(false)
      if (e.key === 'ArrowRight') turn(setPage, 1)
      if (e.key === 'ArrowLeft') turn(setPage, -1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [isOpen])
  if (!isOpen) return null
  const p = REGISTER_MANUAL[page]
  const last = REGISTER_MANUAL.length - 1
  return (
    <div className="reg-manual-veil" onClick={() => set(false)} role="presentation">
      <div className="reg-manual" role="dialog" aria-label={lang === 'ja' ? 'レジスター取扱説明書' : '收銀機操作說明書'} onClick={(e) => e.stopPropagation()}>
        <header>
          <span>{lang === 'ja' ? 'レジスター 取扱説明書' : '收銀機操作說明書'}</span>
          <button type="button" onClick={() => set(false)} aria-label={lang === 'ja' ? '閉じる' : '關閉'}>×</button>
        </header>
        <h3>{p.title[lang]}</h3>
        <dl>
          {p.steps.map((s, i) => (
            <div key={i}>
              <dt><kbd>{s.keys}</kbd></dt>
              <dd>{s.text[lang]}</dd>
            </div>
          ))}
        </dl>
        <footer>
          <button type="button" disabled={page === 0} onClick={() => turn(setPage, -1)}>‹</button>
          <span>{page + 1} / {last + 1}</span>
          <button type="button" disabled={page === last} onClick={() => turn(setPage, 1)}>›</button>
        </footer>
      </div>
    </div>
  )
}
