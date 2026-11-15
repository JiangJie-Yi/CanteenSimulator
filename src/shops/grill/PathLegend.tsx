import { memo, useEffect, useRef, useState } from 'react'
import { EDIT_TEXT } from '@/data/editText'
import type { Lang } from '@/data/i18n'
import { Glyph } from '@/ui/GameIcons'
import { usePanelSound } from '@/ui/uiSound'
import { PATH_MAP } from './bar'
import { addVia, useEditSel } from './edit'
import { placeName, whoColor, whoName } from './PathMap'

/**
 * The paths' list (item 189, the owner's, 2026-11-16: "mark clearly whose each way is, and let them be edited by hand"), beside the map on the
 * floor: each person in their colour (how many waypoints their ways have), a click opening their usual ways (one person's at a time: the place
 * each goes to, how many waypoints it's been given, a button to give it one at its middle) and keeping them lit; who's walking just now; the
 * customers' ways. Pointing at a person or a way lights it on the floor (PATH_MAP.hot), the rest going faint; a click keeps it lit. Over the
 * 3D view's top left corner in the editor, while the map's shown (kept short: all of everyone's ways listed, it covered half the kitchen).
 */
type Snap = { staff: { who: string; ways: { key: string; to: string }[] }[]; live: string[]; guests: number }
const EMPTY: Snap = { staff: [], live: [], guests: 0 }
export const PathLegend = memo(function PathLegend({ lang }: { lang: Lang }) {
  const T = EDIT_TEXT[lang]
  const open = useEditSel((s) => s.on && s.paths)
  const vias = useEditSel((s) => s.vias)
  usePanelSound(open)
  const [snap, setSnap] = useState<Snap>(EMPTY)
  const [pinned, setPinned] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  /** whose ways are listed */
  const [shown, setShown] = useState<string | null>(null)
  const seen = useRef(-1)
  // (read off the map a few times a second while it's shown: its ways are worked out twice a second)
  useEffect(() => {
    if (!open) { seen.current = -1; return }
    const read = () => {
      if (PATH_MAP.v === seen.current) return
      seen.current = PATH_MAP.v
      const staff = new Map<string, { key: string; to: string }[]>()
      for (const r of PATH_MAP.routes) if (r.kind === 'staff' && r.key) staff.set(r.who, [...(staff.get(r.who) ?? []), { key: r.key, to: r.to }])
      const next: Snap = { staff: [...staff].map(([who, ways]) => ({ who, ways })), live: [...new Set(PATH_MAP.routes.filter((r) => r.kind === 'live').map((r) => r.who))],
        guests: PATH_MAP.routes.filter((r) => r.kind === 'guest').length }
      setSnap((o) => (JSON.stringify(o) === JSON.stringify(next) ? o : next))
    }
    read()
    const t = window.setInterval(read, 400)
    return () => window.clearInterval(t)
  }, [open])
  // (lit on the floor: what's pointed at, else what's been clicked)
  const hot = hover ?? pinned
  useEffect(() => { PATH_MAP.hot = open ? hot : null }, [hot, open])
  if (!open) return null
  const pin = (k: string) => setPinned((p) => (p === k ? null : k))
  /** a waypoint put on a way at its middle (by its length), to be dragged where the way should pass */
  const addAt = (key: string) => {
    const r = PATH_MAP.routes.find((x) => x.key === key), home = PATH_MAP.home
    if (!r || !home || r.pts.length < 2) return
    let left = 0
    for (let i = 1; i < r.pts.length; i++) left += r.pts[i].distanceTo(r.pts[i - 1])
    left /= 2
    let at = r.pts[r.pts.length - 1]
    for (let i = 1; i < r.pts.length; i++) {
      const d = r.pts[i].distanceTo(r.pts[i - 1])
      if (d >= left) { at = r.pts[i - 1].clone().lerp(r.pts[i], d > 0 ? left / d : 0); break }
      left -= d
    }
    addVia(key, [at.x - home.x, 0, at.z - home.z])
  }
  const cls = (k: string) => (hot === k ? ' is-hot' : '') + (pinned === k ? ' is-pinned' : '')
  return (
    <div className="bt-paths" onMouseLeave={() => setHover(null)}>
      <div className="bt-paths-head">{T.pathTitle}</div>
      <div className="bt-paths-key"><span><i className="is-block" />{T.pathBlocks}</span><span><i className="is-zone" />{T.pathZones}</span></div>
      <div className="bt-paths-sec">{T.pathUsual}</div>
      {snap.staff.map((p) => (
        <div key={p.who} className="bt-paths-who">
          <button type="button" className={`bt-paths-name${cls(p.who)}${shown === p.who ? ' is-open' : ''}`} onMouseEnter={() => setHover(p.who)}
            onClick={() => { const opening = shown !== p.who; setShown(opening ? p.who : null); setPinned(opening ? p.who : null) }}>
            <i style={{ background: whoColor(p.who) }} />{whoName(p.who)}
            {(() => { const n = p.ways.reduce((k, w) => k + (vias[w.key]?.length ?? 0), 0); return n > 0 ? <em>{n}</em> : null })()}
            <span className="bt-paths-caret"><Glyph id="arrowR" size={10} /></span>
          </button>
          {shown === p.who && p.ways.map((w) => {
            const n = vias[w.key]?.length ?? 0
            return (
              <div key={w.key} className={`bt-paths-way${cls(w.key)}`} onMouseEnter={() => setHover(w.key)} onClick={() => pin(w.key)}>
                <Glyph id="arrowR" size={11} />
                <span>{placeName(w.to)}</span>
                {n > 0 && <em>{n}</em>}
                <button type="button" onClick={(e) => { e.stopPropagation(); addAt(w.key) }}>{T.pathAddVia}</button>
              </div>
            )
          })}
        </div>
      ))}
      <div className="bt-paths-sec">{T.pathLive}</div>
      {snap.live.length ? (
        <div className="bt-paths-live">
          {snap.live.map((w) => (
            <button key={w} type="button" className={`bt-paths-name${cls(w)}`} onMouseEnter={() => setHover(w)} onClick={() => pin(w)}>
              <i style={{ background: whoColor(w) }} />{whoName(w)}
            </button>
          ))}
        </div>
      ) : <div className="bt-paths-none">{T.pathNone}</div>}
      <div className="bt-paths-sec">{T.pathGuests}</div>
      <button type="button" className={`bt-paths-name${cls('guest')}`} onMouseEnter={() => setHover('guest')} onClick={() => pin('guest')}>
        <i style={{ background: whoColor('guest') }} />{T.pathGuestsTo(snap.guests)}
      </button>
      <p className="bt-paths-hint">{T.pathHint}</p>
    </div>
  )
})
