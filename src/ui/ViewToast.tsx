// The view's name, a moment at the foot of the screen whenever the camera's changed to another (the owner's): a small dark glass capsule, an
// eye and the view's name (no number, no border: the owner's); it slides in from the side the view lies toward in the list (on to a later one,
// in from the right; back to an earlier one, from the left), fading, stays a little under two seconds and fades away. Not as the game opens
// (the first view is the one it's always on), nor as editing starts (that's the free camera, and the developer panel says so).
import { memo, useEffect, useRef, useState } from 'react'
import { VIEW_SPOTS, viewName, type ViewId } from '@/data/views'
import type { Lang } from '@/data/i18n'
import { Glyph } from './GameIcons'

const SHOW_MS = 1800
const indexOf = (v: ViewId) => VIEW_SPOTS.findIndex((x) => x.id === v)

export const ViewToast = memo(function ViewToast({ view, lang, quiet }: { view: ViewId; lang: Lang; quiet: boolean }) {
  const [shown, setShown] = useState<{ id: ViewId; k: number; from: 'left' | 'right' } | null>(null)
  const was = useRef(view)
  useEffect(() => {
    if (view === was.current) return
    const from = indexOf(view) >= indexOf(was.current) ? 'right' : 'left'
    was.current = view
    if (quiet) return
    setShown({ id: view, k: Date.now(), from })
    const t = window.setTimeout(() => setShown(null), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [view, quiet])
  if (!shown) return null
  const i = indexOf(shown.id)
  if (i < 0) return null
  return (
    <div key={shown.k} className={`view-toast is-from-${shown.from}`} role="status" aria-live="polite">
      <Glyph id="eye" size={14} />
      <span>{viewName(VIEW_SPOTS[i], lang)}</span>
    </div>
  )
})
