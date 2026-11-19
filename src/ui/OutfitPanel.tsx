import { memo, useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Lang } from '@/data/i18n'
import { tl } from '@/data/i18n'
import { OUTFIT_COLOURS, OUTFIT_PARTS, OUTFIT_PART_NAMES, type OutfitPart } from '@/data/bossOutfit'
import { OUTFIT_DEFAULT, OUTFIT_KEY, getOutfit, setOutfit, subscribeOutfit, type Outfit } from '@/game/bossOutfit'
import { usePanelSound } from './uiSound'

/** how each part looks as he's made (its first colour has no dye of its own: his picture as it is) */
const AS_MADE: Record<OutfitPart, string> = { coat: '#f2efe8', apron: '#1f2a48', trousers: '#33405f', headband: '#29386b', towel: '#e7e0ce' }

/**
 * The owner's clothes, his to choose (item 376, the owner's 「老闆可客製化服裝」): opened by clicking him in the room; a row for each part (the
 * coat, the apron, the trousers, the headband, the towel), its colours as round swatches, the one he's wearing ringed; a click and he's
 * wearing it (Boss: his picture recoloured, its weave and creases kept); all back as he was made. Kept in the browser (read back as the game
 * loads: App). Shut with ×, Esc. What's chosen is game/bossOutfit's store: this panel and he alone are told of it (not the whole page).
 */
export const OutfitPanel = memo(function OutfitPanel({ lang, open, onClose }: { lang: Lang; open: boolean; onClose: () => void }) {
  usePanelSound(open)
  const outfit = useSyncExternalStore(subscribeOutfit, getOutfit)
  const onPick = useCallback((o: Outfit) => {
    setOutfit(o)
    try { localStorage.setItem(OUTFIT_KEY, JSON.stringify(o)) } catch { /* (storage blocked: worn till the page is left) */ }
  }, [])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); e.preventDefault() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  if (!open) return null
  const t3 = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  const nm = (x: { zh: string; ja: string; en: string }) => t3(x.zh, x.ja, x.en)
  const same = OUTFIT_PARTS.every((p) => outfit[p] === OUTFIT_DEFAULT[p])
  return (
    <section className="outfit-panel" role="dialog" aria-label={t3('老闆的衣服', '店主の服', "The owner's clothes")}>
      <header className="outfit-head">
        <b>{t3('老闆的衣服', '店主の服', "The owner's clothes")}</b>
        <button type="button" className="panel-x" onClick={onClose} aria-label={t3('關閉', '閉じる', 'Close')}>×</button>
      </header>
      <div className="outfit-rows">
        {OUTFIT_PARTS.map((part) => {
          const now = OUTFIT_COLOURS[part].find((c) => c.id === outfit[part]) ?? OUTFIT_COLOURS[part][0]
          return (
            <div key={part} className="outfit-row">
              <span className="outfit-part">{nm(OUTFIT_PART_NAMES[part])}<small>{nm(now)}</small></span>
              <span className="outfit-swatches">
                {OUTFIT_COLOURS[part].map((c, i) => (
                  <button key={c.id} type="button" className={`outfit-swatch${c.id === outfit[part] ? ' is-on' : ''}`} title={i === 0 ? t3(`${nm(c)}（原本的）`, `${nm(c)}（元の）`, `${nm(c)} (as made)`) : nm(c)}
                    aria-label={nm(c)} aria-pressed={c.id === outfit[part]} style={{ background: c.hex ?? AS_MADE[part] }}
                    onClick={() => onPick({ ...outfit, [part]: c.id })} />
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <footer className="outfit-foot">
        <button type="button" disabled={same} onClick={() => onPick({ ...OUTFIT_DEFAULT })}>{t3('全部恢復原樣', '全部元に戻す', 'All as he was')}</button>
      </footer>
    </section>
  )
})
