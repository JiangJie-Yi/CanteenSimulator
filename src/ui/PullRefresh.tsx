import { memo, type CSSProperties } from 'react'
import { UI, type Lang } from '@/data/i18n'
import { Glyph } from './GameIcons'
import { usePull } from './pullStore'

/** the pull-to-reload mark over the 3D view while the page is pulled down by a finger: how far, and "let go" once it's far enough. Drawn
 * again by itself as the finger moves (ui/pullStore), the page round it not */
export const PullRefresh = memo(function PullRefresh({ lang }: { lang: Lang }) {
  const pull = usePull()
  if (pull <= 0) return null
  return (
    <div className={`pull-refresh${pull >= 1 ? ' is-ready' : ''}`} style={{ '--pull': pull } as CSSProperties}>
      <Glyph id="refresh" size="1em" />{pull >= 1 ? UI[lang].pullGo : UI[lang].pullMore}
    </div>
  )
})
