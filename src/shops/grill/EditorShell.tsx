import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EDIT_TEXT } from '@/data/editText'
import type { Lang } from '@/data/i18n'
import { Glyph } from '@/ui/GameIcons'
import { useProgress } from '@react-three/drei'
import { laterPending, laterSeen, sceneDrawn } from '@/scene/Later'
import { VERSION, versionText } from '@/data/credits'
import { panelSound } from '@/ui/uiSound'
import { PathLegend } from './PathLegend'
import { ADMIN_URL } from '@/scene/toolPage'
import { discardEdit, dissolveGroup, frameSelected, freezeSelected, getCharHidden, hideSelected, isDirty, makeGroup, playGame, redo, resetAll, saveEdit,
  resetAllPivots, resetPivot, select, selectedName, setCharHidden, setPaths, setShade, SHADES, showHidden, subscribeEdit, undo, useEditSel } from './edit'

/**
 * The shop's editor (editor.html, item 178, the owner's, 2026-11-15: "the developer's way of working: more professional, as the mainstream
 * tools are, and split off into a tool of its own"): the frame round the shop as the mainstream editors have it. Along the top its menus
 * (File, Edit, View, Window, Help: each thing the developer mode does, with its key) and Play; under them the tools (edit.ts puts its own
 * there: select, move, rotate, scale, their axes and pivot); down the left the outliner, down the right the inspector (edit.ts's panel,
 * docked); at the foot a status line: what's chosen, and whether all's saved. It never leaves editing: Ctrl+S saves, its File menu discards
 * back to the last save, Play saves and opens the game in its own tab. Leaving it with something unsaved asks first, and discards it.
 */
type Item = { label: string; keys?: string; run: () => void; on?: boolean; off?: boolean } | 'gap'
export const EditorShell = memo(function EditorShell({ lang }: { lang: Lang }) {
  const T = EDIT_TEXT[lang]
  // (only what it shows: what's chosen, how the scene's drawn, the paths' map; not every step of a drag (item 186))
  const st = { selected: useEditSel((s) => s.selected), shade: useEditSel((s) => s.shade), paths: useEditSel((s) => s.paths) }
  // (whether anything's unsaved: worked out a quarter second after the last change, not with every step of a drag (it compares the whole
  // layout as written out))
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    let t = 0
    const check = () => { window.clearTimeout(t); t = window.setTimeout(() => setDirty(isDirty()), 250) }
    const off = subscribeEdit(check)
    check()
    return () => { off(); window.clearTimeout(t) }
  }, [])
  const [menu, setMenu] = useState<number | null>(null)
  const [keysOpen, setKeysOpen] = useState(false)
  const [charOn, setCharOn] = useState(!getCharHidden())
  const bar = useRef<HTMLDivElement>(null)
  // (a menu open or shut, the panels' sound)
  const was = useRef<number | null>(null)
  useEffect(() => { if ((menu === null) !== (was.current === null)) panelSound(menu !== null); was.current = menu }, [menu])
  useEffect(() => { if (keysOpen) panelSound(true) }, [keysOpen])
  // (a click anywhere off the menus, or Esc, shuts the one open)
  useEffect(() => {
    if (menu === null) return
    const off = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) setMenu(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(null) } }
    window.addEventListener('pointerdown', off, true)
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', off, true); window.removeEventListener('keydown', esc, true) }
  }, [menu])
  // (the tab's title says when something's unsaved; leaving then asks, and what's unsaved is let go of: it's kept as it's made)
  useEffect(() => { document.title = `${T.appTitle}${dirty ? `（${T.dirty}）` : ''} · 烤魚經營` }, [dirty, T])
  useEffect(() => {
    const ask = (e: BeforeUnloadEvent) => { if (isDirty()) { e.preventDefault(); e.returnValue = T.leaveDirty } }
    const gone = () => { if (isDirty()) discardEdit() }
    window.addEventListener('beforeunload', ask)
    window.addEventListener('pagehide', gone)
    return () => { window.removeEventListener('beforeunload', ask); window.removeEventListener('pagehide', gone) }
  }, [T])
  const toggleChar = () => { const next = !charOn; setCharHidden(!next); setCharOn(next) }
  const menus: { name: string; items: Item[] }[] = [
    { name: T.menuFile, items: [
      { label: T.save, keys: 'Ctrl+S', run: saveEdit },
      { label: T.discard, run: discardEdit, off: !dirty },
      'gap',
      { label: T.resetAll, run: () => { if (window.confirm(T.resetAllAsk)) resetAll() } },
      'gap',
      { label: T.play, run: playGame },
    ] },
    { name: T.menuEdit, items: [
      { label: T.undo, keys: 'Ctrl+Z', run: undo }, { label: T.redo, keys: 'Ctrl+Y', run: redo },
      'gap',
      { label: T.deselect, keys: 'Esc', run: () => select(null), off: !st.selected },
      { label: T.hideSel, keys: 'H', run: hideSelected, off: !st.selected }, { label: T.showAll, keys: 'Alt+H', run: showHidden },
      'gap',
      { label: T.group, run: makeGroup }, { label: T.ungroup, run: () => dissolveGroup() }, { label: T.freeze, run: () => freezeSelected(), off: !st.selected },
      // (the pivots back at their pieces' feet: the chosen one's, or every one's (item 307))
      { label: T.pivotHome, run: () => resetPivot('foot'), off: !st.selected }, { label: T.pivotHomeAll, run: () => { if (window.confirm(T.pivotHomeAllAsk)) resetAllPivots() } },
    ] },
    { name: T.menuView, items: [
      { label: T.frameSel, keys: 'F', run: frameSelected, off: !st.selected },
      { label: T.frameAll, keys: 'A', run: () => window.dispatchEvent(new CustomEvent('edit-frame-all')) },
      'gap',
      // (the five ways the scene's drawn, on 1 to 5 (item 191))
      ...SHADES.map((s, i): Item => ({ label: T.shades[s], keys: String(i + 1), run: () => setShade(s), on: st.shade === s })),
      'gap',
      { label: st.paths ? T.pathsOff : T.pathsOn, run: () => setPaths(!st.paths), on: st.paths },
    ] },
    { name: T.menuWindow, items: [{ label: T.charWin, run: toggleChar, on: charOn }, { label: T.adminWin, run: () => window.open(ADMIN_URL, 'grill-admin') }] },
    { name: T.menuHelp, items: [{ label: T.hotkeysWin, run: () => setKeysOpen(true) }] },
  ]
  const name = selectedName()
  // (in the page's body, not the game's own layer: that's put out of sight in the editor)
  return createPortal(
    <>
      <div className="bt-top" ref={bar}>
        <div className="bt-brand"><Glyph id="tools" size={14} /><b>{T.appTitle}</b>{dirty && <i className="bt-dot" title={T.dirty} />}</div>
        <nav className="bt-menus" role="menubar">
          {menus.map((m, i) => (
            <div key={m.name} className={`bt-menu${menu === i ? ' is-open' : ''}`}>
              <button type="button" role="menuitem" aria-haspopup="true" aria-expanded={menu === i}
                onClick={() => setMenu(menu === i ? null : i)} onPointerEnter={() => { if (menu !== null && menu !== i) setMenu(i) }}>{m.name}</button>
              {menu === i && (
                <ul className="bt-list" role="menu">
                  {m.items.map((it, k) => (it === 'gap' ? <li key={`g${k}`} className="bt-gap" role="separator" /> : (
                    <li key={it.label}>
                      <button type="button" role="menuitem" disabled={it.off} className={it.on ? 'is-on' : ''} onClick={() => { setMenu(null); it.run() }}>
                        <span className="bt-check">{it.on && <Glyph id="arrowR" size={10} />}</span>
                        <span className="bt-label">{it.label}</span>
                        {it.keys && <kbd>{it.keys}</kbd>}
                      </button>
                    </li>
                  )))}
                </ul>
              )}
            </div>
          ))}
        </nav>
        <button type="button" className="bt-play" title={T.playTip} onClick={playGame}><Glyph id="gamepad" size={14} />{T.play}</button>
      </div>
      {/* (edit.ts puts its tools here, and its outliner in the left dock, as it builds its panel) */}
      <div className="bt-tools" id="bt-tools" />
      <div className="bt-left" id="bt-left" />
      <div className="bt-status" role="status">
        <span className="bt-sel">{name ? T.selectedIs(name) : T.noSelection}</span>
        <span className={`bt-saved${dirty ? ' is-dirty' : ''}`}>{dirty && <i className="bt-dot" />}{dirty ? T.dirty : T.clean}</span>
      </div>
      <PathLegend lang={lang} />
      <EditorSplash lang={lang} />
      {keysOpen && (
        <div className="bt-keys" role="dialog" aria-label={T.hotkeysWin} onClick={() => { setKeysOpen(false); panelSound(false) }}>
          <div className="bt-keys-card" onClick={(e) => e.stopPropagation()}>
            <div className="bt-keys-head"><b>{T.hotkeysWin}</b>
              <button type="button" aria-label={T.close} onClick={() => { setKeysOpen(false); panelSound(false) }}><Glyph id="close" size={12} /></button></div>
            <pre>{`Ctrl+S  ${T.save}\n${T.hotkeys}`}</pre>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
})

/**
 * The editor's start-up screen (item 190, the owner's, 2026-11-16: "the loading page, more professional"): as the mainstream tools open, over
 * the whole frame until it can be edited in: the tool's name, its version, a bar that goes as the shop really comes in (its models and
 * pictures counted, the one coming in named; then the scene laid out, the pieces measured and the areas made, the editing tools opened), the
 * steps, each ticked as it's done; a word and a reload if nothing moves for a long while. It fades away as editing begins.
 */
type Step = 'files' | 'stage' | 'measure' | 'tools'
const STEPS: Step[] = ['files', 'stage', 'measure', 'tools']
/** how long with nothing coming in and no step done before it's called stuck (ms) */
const SPLASH_STALL_MS = 20000
/** each step's part of the bar: where it starts, how much of it is the step's, how quickly the step's eased along it (ms; the files' part goes
 * as they come in) */
const SPLASH_SPAN: Record<Step, [number, number, number]> = { files: [0, 80, 0], stage: [80, 10, 4000], measure: [90, 7, 2500], tools: [97, 2.5, 800] }
const EditorSplash = memo(function EditorSplash({ lang }: { lang: Lang }) {
  const T = EDIT_TEXT[lang]
  const on = useEditSel((s) => s.on)
  const [st, setSt] = useState({ step: 0, loaded: 0, total: 0, active: false, name: '', pct: 0 })
  const [gone, setGone] = useState(false)
  const [stuck, setStuck] = useState(false)
  const run = useRef({ step: 0, at: 0, pct: 0, name: '', loaded: -1, movedAt: 0 })
  // (looked at a few times a second, as the game's loading screen does: a storm of files finishing at once isn't a storm of redraws)
  useEffect(() => {
    if (on) return
    const r = run.current
    r.at = r.movedAt = performance.now()
    const t = window.setInterval(() => {
      const p = useProgress.getState(), now = performance.now()
      const filesIn = p.total > 0 && !p.active
      const staged = filesIn && laterPending() === 0 && laterSeen() && sceneDrawn()
      // (the game's own loading veil is held till every piece has been measured and shown: gone, the scene is ready to be edited)
      const measured = staged && !document.querySelector('.loading-screen')
      // (a step once done stays done: the shop's later parts come in waves, each one's models only asked for as it's built, and the list and
      // the bar went back with each (66%, on to 84%, back to 57%))
      const step = Math.max(r.step, !filesIn ? 0 : !staged ? 1 : !measured ? 2 : 3)
      if (step !== r.step) { r.step = step; r.at = r.movedAt = now }
      const [from, span, ms] = SPLASH_SPAN[STEPS[step]]
      const files = p.total > 0 && Number.isFinite(p.progress) ? Math.max(0, Math.min(100, p.progress)) / 100 : 0
      // (the files' part as they come in (never back, though more are found as it goes); each later step's eased along as it goes on, never
      // all the way, so the bar's never standing still)
      r.pct = Math.max(r.pct, from + span * (step === 0 ? files : 1 - Math.exp(-(now - r.at) / ms)))
      // (a real file named: a model's own pictures come in as blob: addresses, a long string of letters and numbers)
      const item = p.item ?? ''
      if (item && !/^(blob|data):/.test(item)) { try { r.name = decodeURIComponent(item.split('?')[0].split('/').pop() ?? '') } catch { r.name = '' } }
      setSt((o) => (o.step === step && o.loaded === p.loaded && o.total === p.total && o.active === p.active && o.name === r.name && Math.abs(o.pct - r.pct) < 0.3 ? o
        : { step, loaded: p.loaded, total: p.total, active: p.active, name: r.name, pct: r.pct }))
      if (p.loaded !== r.loaded) { r.loaded = p.loaded; r.movedAt = now; setStuck(false) }
      else if (now - r.movedAt > SPLASH_STALL_MS) setStuck(true)
    }, 150)
    return () => window.clearInterval(t)
  }, [on])
  // (editing begun: the bar full, then faded away)
  useEffect(() => {
    if (!on) return
    const t = window.setTimeout(() => setGone(true), 450)
    return () => window.clearTimeout(t)
  }, [on])
  if (gone) return null
  const pct = on ? 100 : st.pct
  const label = [T.stepFiles, T.stepStage, T.stepMeasure, T.stepTools]
  const at = on ? STEPS.length : st.step
  // (the files counted while any are coming in, whichever step it's at)
  const counting = !on && st.active && st.total > 0
  return (
    <div className={`bt-splash${on ? ' is-done' : ''}`} role="status">
      <div className="bt-splash-card">
        <div className="bt-splash-head">
          <span className="bt-splash-mark"><Glyph id="tools" size={26} /></span>
          <div className="bt-splash-name"><b>{T.appTitle}</b><small>{T.splashSub}</small></div>
          <span className="bt-splash-ver">{versionText(VERSION, 'dev')}</span>
        </div>
        <div className="bt-splash-bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="bt-splash-now">
          <span>{label[Math.min(at, STEPS.length - 1)]}</span>
          {counting && <em>{st.loaded}／{st.total}</em>}
          <b>{pct.toFixed(0)}%</b>
        </div>
        <div className="bt-splash-file">{counting ? st.name : ''}</div>
        <ol className="bt-splash-steps">
          {STEPS.map((k, i) => (
            <li key={k} className={i < at ? 'is-done' : i === at ? 'is-now' : ''}>
              <span className="bt-splash-tick">{i < at ? <Glyph id="check" size={11} /> : <i />}</span>{label[i]}
            </li>
          ))}
        </ol>
        {stuck && (
          <div className="bt-splash-stuck">
            <span>{T.splashStuck}</span>
            <button type="button" onClick={() => window.location.replace(window.location.pathname + '?v=' + Date.now())}>{T.reload}</button>
          </div>
        )}
      </div>
    </div>
  )
})
