import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { GrillingFish } from './GrillingFish'
import { laterPending, laterSeen, onLater } from '@/scene/Later'

/** how long the loading may sit without any file coming in before it's called stuck (ms) */
const STALL_MS = 20000

/**
 * The loading veil over the 3D shop: how far the models and pictures have come in (never more than 100%, never "Infinity", which drei's own
 * shows when its counts go wrong), and, when nothing has come in for a while or a file failed (a model being rewritten while it's read, the
 * dev server restarting), a word saying so and a button to load the page again.
 */
export function LoadingScreen({ scene = true }: { scene?: boolean }) {
  // (read a few times a second, not on every file: dozens of textures finishing at once fired an update apiece, and that storm of renders
  // tripped React's guard against runaway updates)
  const [prog, setProg] = useState(() => useProgress.getState())
  useEffect(() => {
    const t = window.setInterval(() => {
      const st = useProgress.getState()
      setProg((p) => (p.active === st.active && p.loaded === st.loaded && p.total === st.total && p.errors.length === st.errors.length ? p : st))
    }, 250)
    return () => window.clearInterval(t)
  }, [])
  const { active, loaded, total, errors, progress } = prog
  const [stuck, setStuck] = useState(false)
  // (only the first load is covered: once the shop has come in, a model or picture fetched later (a guest, a light) loads behind the scenes,
  // never bringing the veil back over the game; and a count that never started (nothing went through the loaders' tally) isn't waited on)
  // (the shop has come in when nothing's loading and every staged part (scene/Later: the decor, the fixtures, the customers) is in, and has
  // stayed so a moment: it lifted once the first files were in, and the stools, the fridges and the crates came in seconds after it)
  const [done, setDone] = useState(false)
  const [stages, setStages] = useState(laterPending)
  useEffect(() => onLater(() => setStages(laterPending())), [])
  // (`scene`: a 3D shop is coming, whose staged parts are waited for once they've begun; without one (a phone's 2D grill) only the files)
  const allIn = () => !useProgress.getState().active && laterPending() === 0 && (!scene || laterSeen())
  useEffect(() => {
    if (done) return
    if (total > 0 && allIn()) {
      const t = window.setTimeout(() => { if (allIn()) setDone(true) }, 600)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => { if (useProgress.getState().total === 0 && laterPending() === 0 && !scene) setDone(true) }, 3000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, total, done, stages, scene])
  const last = useRef({ loaded: -1, at: performance.now() })
  useEffect(() => {
    if (loaded !== last.current.loaded) { last.current = { loaded, at: performance.now() }; setStuck(false) }
    if (!active) return
    const t = window.setInterval(() => { if (performance.now() - last.current.at > STALL_MS) setStuck(true) }, 1000)
    return () => window.clearInterval(t)
  }, [active, loaded])
  // (some files are only looked for (the HDRIs are tried by several names): a miss isn't a failure unless the loading has stopped too)
  const failed = errors.length > 0 && stuck
  // (shown until the shop's all in: between one stage's files and the next's nothing's loading, and it went away in that gap)
  if (done) return null
  const pct = total > 0 && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : null
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <GrillingFish done={(pct ?? 0) / 100} />
      <div className="loading-board">
        <h1>聞野</h1>
        <small>日式烤魚</small>
        <div className="loading-bar"><i style={{ width: `${pct ?? 0}%` }} /></div>
        <p>{pct === null ? '開店準備中…' : `開店準備中 ${pct.toFixed(0)}%`}</p>
      </div>
      {stuck && (
        <div className="loading-stuck">
          <p>{failed ? `有 ${errors.length} 個檔案沒有載入成功` : '載入好像卡住了'}（可能是模型正在更新，或開發伺服器在重啟）</p>
          <button type="button" onClick={() => window.location.reload()}>重新載入</button>
        </div>
      )}
    </div>
  )
}
