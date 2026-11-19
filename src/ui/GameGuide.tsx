import { memo, useEffect, useMemo, useState } from 'react'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'
import { GAME_GUIDE, type GuideIcon } from '@/data/gameGuide'
import { emotePicture } from '@/scene/crewEmote'
import type { GlyphId } from './glyphs'
import { FitLine } from './FitLine'
import { Glyph } from './GameIcons'
import { withArrows } from './RegisterManual'
import { usePanelSound } from './uiSound'

/**
 * The game's guide (item 388, the owner's, 2026-11-20: 「左下加入一個小Icon 是有關魚遊戲說明，引導、教學、玩法，及員工、客人各種狀態說明。」): a
 * little round button with a fish on it at the bottom left, beside the views' eye, and the booklet it opens (data/gameGuide): six tabs
 * (starting out, a night's business, grilling, the staff, the customers, the controls), each a few short lines with a picture by each: the
 * staff's own stickers as they show over their heads (scene/crewEmote), the customers' marks and the game's glyphs drawn as the rest of the
 * game's are. The first page offers the first day's guide again. Shut with Esc, its own button, or a click outside; the arrow keys turn the
 * tabs; its sound as every panel's (usePanelSound).
 */
const EMOTES = new Set<GuideIcon>(['alarm', 'anger', 'shy', 'sparkle', 'gloom', 'sweat', 'note'])
/** the customers' marks and the rest, as the game's glyphs */
const GLYPH_OF: Partial<Record<GuideIcon, GlyphId>> = { steam: 'steam', cross: 'crossFace', hop: 'gladFace' }

function Picture({ icon }: { icon: GuideIcon }) {
  // (a sticker's picture made once, from the scene's own canvas)
  const src = useMemo(() => (EMOTES.has(icon) ? emotePicture(icon as Parameters<typeof emotePicture>[0]) : ''), [icon])
  if (src) return <img className="gg-sticker" src={src} alt="" draggable={false} />
  return <Glyph id={GLYPH_OF[icon] ?? (icon as GlyphId)} size={22} />
}

export const GameGuide = memo(function GameGuide({ lang, onReplay }: { lang: Lang
  /** the first day's guide shown again (App: its kept "done" cleared) */
  onReplay: () => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)
  usePanelSound(open)
  // (Esc shuts it; the arrow keys turn the tabs)
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); e.preventDefault() }
      else if (e.key === 'ArrowRight') { setTab((t) => (t + 1) % GAME_GUIDE.length); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { setTab((t) => (t + GAME_GUIDE.length - 1) % GAME_GUIDE.length); e.preventDefault() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])
  const page = GAME_GUIDE[tab]
  const name = tl(lang, '遊戲說明', 'ゲームの説明', 'How to play')
  return (
    <>
      <button type="button" className={`guide-fish${open ? ' is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={name} title={name}
        aria-expanded={open}>
        <Glyph id="fish" size={22} />
      </button>
      {open && (
        <div className="game-guide-veil" onClick={() => setOpen(false)} role="presentation">
          <div className="game-guide" role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()}>
            <header>
              <span><Glyph id="fish" size={18} />{name}</span>
              <button type="button" className="gg-x" onClick={() => setOpen(false)} aria-label={tl(lang, '關閉', '閉じる', 'Close')}><Glyph id="close" size={16} /></button>
            </header>
            <nav className="gg-tabs" role="tablist">
              {GAME_GUIDE.map((p, i) => (
                <button key={p.id} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'is-on' : ''} onClick={() => setTab(i)}>
                  {p.tab[lang]}
                </button>
              ))}
            </nav>
            <FitLine className="gg-title">{page.title[lang]}</FitLine>
            <ul className="gg-lines">
              {page.lines.map((l, i) => (
                <li key={`${page.id}-${i}`}>
                  <span className={`gg-icon${EMOTES.has(l.icon) ? ' is-sticker' : ''}`}><Picture icon={l.icon} /></span>
                  <div>
                    <b>{l.head[lang]}</b>
                    <p>{withArrows(l.text[lang])}</p>
                  </div>
                </li>
              ))}
            </ul>
            {page.id === 'start' && (
              <footer>
                <button type="button" className="gg-replay" onClick={() => { setOpen(false); onReplay() }}>
                  <Glyph id="refresh" size={14} />{tl(lang, '重看新手引導', '初日ガイドをもう一度', 'Show the first-day guide again')}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  )
})
