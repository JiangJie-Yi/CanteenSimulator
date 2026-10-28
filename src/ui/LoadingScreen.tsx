import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

/** how long the loading may sit without any file coming in before it's called stuck (ms) */
const STALL_MS = 20000

/**
 * The loading veil over the 3D shop: how far the models and pictures have come in (never more than 100%, never "Infinity", which drei's own
 * shows when its counts go wrong), and, when nothing has come in for a while or a file failed (a model being rewritten while it's read, the
 * dev server restarting), a word saying so and a button to load the page again.
 */
export function LoadingScreen() {
  const { active, loaded, total, errors, progress } = useProgress()
  const [stuck, setStuck] = useState(false)
  const last = useRef({ loaded: -1, at: performance.now() })
  useEffect(() => {
    if (loaded !== last.current.loaded) { last.current = { loaded, at: performance.now() }; setStuck(false) }
    if (!active) return
    const t = window.setInterval(() => { if (performance.now() - last.current.at > STALL_MS) setStuck(true) }, 1000)
    return () => window.clearInterval(t)
  }, [active, loaded])
  const failed = errors.length > 0
  if (!active && !failed) return null
  const pct = total > 0 && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : null
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-bar"><i style={{ width: `${pct ?? 0}%` }} /></div>
      <p>{pct === null ? '載入中…' : `載入中 ${pct.toFixed(0)}%（${loaded}/${total}）`}</p>
      {(stuck || failed) && (
        <div className="loading-stuck">
          <p>{failed ? `有 ${errors.length} 個檔案沒有載入成功` : '載入好像卡住了'}（可能是模型正在更新，或開發伺服器在重啟）</p>
          <button type="button" onClick={() => window.location.reload()}>重新載入</button>
        </div>
      )}
    </div>
  )
}
