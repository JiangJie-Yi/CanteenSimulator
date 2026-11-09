// The view's name, a moment at the foot of the screen whenever the camera's changed to another (the owner's): a small dark glass capsule, an
// eye and the view's number and name; it fades in, stays a little under two seconds and fades away. Not as the game opens (the first view
// is the one it's always on), nor as editing starts (that's the free camera, and the developer panel says so).
import { memo, useEffect, useRef, useState } from 'react'
import { VIEW_SPOTS, viewName, type ViewId } from '@/data/views'
import type { Lang } from '@/data/i18n'
import { Glyph } from './GameIcons'

const SHOW_MS = 1800

export const ViewToast = memo(function ViewToast({ view, lang, quiet }: { view: ViewId; lang: Lang; quiet: boolean }) {
  const [shown, setShown] = useState<{ id: ViewId; k: number } | null>(null)
  const was = useRef(view)
  useEffect(() => {
    if (view === was.current) return
    was.current = view
    if (quiet) return
    setShown({ id: view, k: Date.now() })
    const t = window.setTimeout(() => setShown(null), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [view, quiet])
  if (!shown) return null
  const i = VIEW_SPOTS.findIndex((v) => v.id === shown.id)
  if (i < 0) return null
  return (
    <div key={shown.k} className="view-toast" role="status" aria-live="polite">
      <Glyph id="eye" size={14} />
      <b>{i + 1}</b>
      <span>{viewName(VIEW_SPOTS[i], lang)}</span>
    </div>
  )
})
