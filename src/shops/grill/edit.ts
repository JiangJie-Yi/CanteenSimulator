// The shop's edit mode: press G while the shop is shut and its furnishings can be moved about by hand (see Movable). Each moved piece's
// offset is kept in the browser. While the shop is open it can't be switched on (and is switched off if the shop opens), since customers and
// staff are walking about. Here: the state, the key, the panel at the screen's corner, and the list of what can be moved.

import { useSyncExternalStore } from 'react'

export type V3 = [number, number, number]
const KEY = 'jgs-edit-offsets'
const load = (): Record<string, V3> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}
type State = { on: boolean; locked: boolean; offsets: Record<string, V3>; selected: string | null }
let state: State = { on: false, locked: false, offsets: load(), selected: null }
const subs = new Set<() => void>()
const emit = () => { state = { ...state }; subs.forEach((f) => f()); panel() }
export const getEdit = () => state
export const useEdit = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
/** where a piece stands when it hasn't been moved by hand: the places the owner has settled on */
const DEFAULTS: Record<string, V3> = { gate1: [0, 0, 0.17] }
export const offsetOf = (id: string): V3 => state.offsets[id] ?? DEFAULTS[id] ?? [0, 0, 0]
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state.offsets)) } catch { /* private window: it just won't be kept */ } }
// ---- undo: each change (a drag, an arrow, a field edited, reset all) is a step; Ctrl+Z goes back one, Ctrl+Y (or Ctrl+Shift+Z) forward again
const past: Record<string, V3>[] = []
let future: Record<string, V3>[] = []
const snap = () => JSON.stringify(state.offsets)
/** called as a change begins: the way things are now is kept, to go back to */
export function beginChange() {
  const last = past.length ? JSON.stringify(past[past.length - 1]) : null
  if (last === snap()) return
  past.push(JSON.parse(snap()))
  if (past.length > 100) past.shift()
  future = []
  panel()
}
export function undo() {
  const prev = past.pop()
  if (!prev) { toast('沒有可以復原的動作'); return }
  future.push(JSON.parse(snap()))
  state.offsets = prev
  save()
  emit()
}
export function redo() {
  const next = future.pop()
  if (!next) { toast('沒有可以重做的動作'); return }
  past.push(JSON.parse(snap()))
  state.offsets = next
  save()
  emit()
}
/** a piece moved (live, while it's dragged) */
export function moveTo(id: string, v: V3) { state.offsets = { ...state.offsets, [id]: v }; state.selected = id; emit() }
export const commitOffsets = () => save()
export function resetAll() { beginChange(); state.offsets = {}; save(); emit() }
export const select = (id: string | null) => { state.selected = id; emit() }

/** what can be moved: each piece says what it's called and how to bring the camera to it */
const registry = new Map<string, { label: string; focus: () => void }>()
export function registerMovable(id: string, label: string, focus: () => void) {
  registry.set(id, { label, focus })
  panel()
  return () => { registry.delete(id); panel() }
}

/** the shop opening (locked) or shut: opening switches the mode off */
export function setLocked(locked: boolean) {
  if (state.locked === locked) return
  state.locked = locked
  if (locked) state.on = false
  emit()
}
export function toggleEdit() {
  if (state.locked) { toast('營業中不能編輯，請先閉店'); return }
  state.on = !state.on
  state.selected = null
  if (!state.on) { past.length = 0; future = [] }
  emit()
}

// ---- the panel (plain DOM: it sits over the canvas, and must show even when what's being moved is out of view)
let toastEl: HTMLDivElement | null = null
function toast(text: string) {
  if (typeof document === 'undefined') return
  toastEl?.remove()
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = 'position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9999;background:rgba(60,16,12,.94);color:#ffd9d2;font:14px sans-serif;padding:8px 16px;border-radius:8px;border:1px solid #c0392b;pointer-events:none'
  document.body.appendChild(el)
  toastEl = el
  window.setTimeout(() => { if (toastEl === el) { el.remove(); toastEl = null } }, 2600)
}
let el: HTMLDivElement | null = null
let info: HTMLDivElement | null = null
let fields: HTMLInputElement[] = []
let built = ''
function panel() {
  if (typeof document === 'undefined') return
  if (!state.on) { el?.remove(); el = null; info = null; fields = []; built = ''; return }
  // (rebuilt only when the list of pieces changes; the numbers line is just rewritten as one is dragged)
  const sig = [...registry.keys()].join('|')
  if (!el || built !== sig) {
    el?.remove()
    el = document.createElement('div')
    el.style.cssText = 'position:fixed;left:16px;bottom:96px;z-index:9999;max-width:300px;background:rgba(10,20,40,.93);color:#bfe3ff;font:13px/1.5 sans-serif;padding:10px 12px;border-radius:8px;border:1px solid #3fa9ff;max-height:60vh;overflow:auto'
    const title = document.createElement('div')
    title.textContent = '編輯模式（G 離開）：拖藍色方塊移動擺設，Shift 抬高'
    title.style.cssText = 'font-weight:bold;margin-bottom:6px'
    el.appendChild(title)
    info = document.createElement('div')
    info.style.cssText = 'font:12px monospace;color:#9fd0ff;min-height:18px;margin-bottom:6px;white-space:pre'
    el.appendChild(info)
    // (the numbers by hand: X, Y, Z of the selected piece, typed or stepped with the arrow keys; they follow it as it's dragged)
    const xyz = document.createElement('div')
    xyz.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;align-items:center'
    fields = ['X', 'Y', 'Z'].map((name, k) => {
      const wrap = document.createElement('label')
      wrap.style.cssText = 'display:flex;align-items:center;gap:3px;font:12px monospace;color:#9fd0ff'
      wrap.append(name)
      const inp = document.createElement('input')
      inp.type = 'number'
      inp.step = '0.01'
      inp.style.cssText = 'width:64px;background:#0b1a2e;color:#dff0ff;border:1px solid #3fa9ff;border-radius:4px;padding:2px 4px;font:12px monospace'
      inp.oninput = () => {
        const id = state.selected
        if (!id || inp.value === '' || Number.isNaN(Number(inp.value))) return
        const v = [...offsetOf(id)] as V3
        v[k] = Number(inp.value)
        moveTo(id, v)
      }
      inp.onfocus = () => beginChange()
      inp.onchange = () => save()
      wrap.appendChild(inp)
      xyz.appendChild(wrap)
      return inp
    })
    el.appendChild(xyz)
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px'
    for (const [id, r] of registry) {
      const b = document.createElement('button')
      b.textContent = r.label
      b.title = '把鏡頭帶到它'
      b.style.cssText = 'background:#16345a;color:#dff0ff;border:1px solid #3fa9ff;border-radius:4px;padding:2px 8px;cursor:pointer;font:12px sans-serif'
      b.onclick = () => { registry.get(id)?.focus(); select(id) }
      row.appendChild(b)
    }
    el.appendChild(row)
    const foot = document.createElement('div')
    foot.style.cssText = 'display:flex;gap:6px;margin-top:8px'
    const reset = document.createElement('button')
    reset.textContent = '還原全部位置'
    reset.style.cssText = 'background:#5a1f16;color:#ffe3de;border:1px solid #c0392b;border-radius:4px;padding:2px 8px;cursor:pointer;font:12px sans-serif'
    reset.onclick = () => { if (window.confirm('把所有被移動的擺設放回原位？')) resetAll() }
    const done = document.createElement('button')
    done.textContent = '離開編輯'
    done.style.cssText = 'background:#16345a;color:#dff0ff;border:1px solid #3fa9ff;border-radius:4px;padding:2px 8px;cursor:pointer;font:12px sans-serif'
    done.onclick = () => toggleEdit()
    const mk = (text: string, title: string, fn: () => void) => {
      const b = document.createElement('button')
      b.textContent = text
      b.title = title
      b.style.cssText = 'background:#16345a;color:#dff0ff;border:1px solid #3fa9ff;border-radius:4px;padding:2px 8px;cursor:pointer;font:12px sans-serif'
      b.onclick = fn
      return b
    }
    foot.append(mk('復原', 'Ctrl+Z', undo), mk('重做', 'Ctrl+Y', redo), reset, done)
    el.appendChild(foot)
    document.body.appendChild(el)
    built = sig
  }
  if (info) {
    const id = state.selected
    const r = id ? registry.get(id) : null
    info.textContent = id ? `${r?.label ?? id}\noffset [${offsetOf(id).map((v) => v.toFixed(3)).join(', ')}]` : '（點方塊或下面的名字選一個）'
    fields.forEach((f, k) => {
      f.disabled = !id
      if (id && document.activeElement !== f) f.value = offsetOf(id)[k].toFixed(3)
      if (!id) f.value = ''
    })
  }
}

// ---- the key (once, whichever pieces are mounted)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    const t0 = e.target
    const typing = t0 instanceof HTMLInputElement || t0 instanceof HTMLTextAreaElement || (t0 instanceof HTMLElement && t0.isContentEditable)
    // (Ctrl+Z / Ctrl+Y in edit mode, unless it's text being typed into a field, which has its own)
    if ((e.ctrlKey || e.metaKey) && state.on && !typing) {
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (k === 'y') { e.preventDefault(); redo(); return }
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key !== 'g' && e.key !== 'G') return
    const t = e.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return
    toggleEdit()
  })
  if (import.meta.env?.DEV) (window as unknown as { __edit?: unknown }).__edit = { get: getEdit, toggle: toggleEdit, setLocked, undo, redo }
}
