// The shop's edit mode: press G while the shop is shut and its furnishings can be moved about by hand (see Movable). Each moved piece's
// offset is kept in the browser. While the shop is open it can't be switched on (and is switched off if the shop opens), since customers and
// staff are walking about. Here: the state, the key, the panel at the screen's corner, and the list of what can be moved.

import { useSyncExternalStore } from 'react'

export type V3 = [number, number, number]
// (the second key: the first held offsets from before the places below were settled on; they're not carried over, or they'd count twice)
const KEY = 'jgs-edit-offsets-2'
const KEY_R = 'jgs-edit-rotations-1'
const KEY_S = 'jgs-edit-scales-1'
const load = (key: string): Record<string, V3> => {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') } catch { return {} }
}
/** offsets: where a piece is moved to (from its base); rotations: degrees turned about X, Y, Z; scales: how much larger or smaller on X, Y, Z (1 = as it is) */
type State = { on: boolean; locked: boolean; offsets: Record<string, V3>; rotations: Record<string, V3>; scales: Record<string, V3>; selected: string | null }
let state: State = { on: false, locked: false, offsets: load(KEY), rotations: load(KEY_R), scales: load(KEY_S), selected: null }
const subs = new Set<() => void>()
const emit = () => { state = { ...state }; subs.forEach((f) => f()); panel() }
export const getEdit = () => state
export const useEdit = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
/**
 * Where each piece stands to begin with: the places the owner has settled on by hand (as X, Y, Z in the piece's parent's own units). The
 * offset shown and typed in edit mode is from here, so every piece starts at 0, 0, 0, its own centre.
 */
export const BASES: Record<string, V3> = {
  gate1: [0, 0, 0.16],
  gate0: [0, 0, 0.17],
  freezer: [-1.508, 0, 1.974],
  willow: [0.38, 0, 0.201],
  sake: [0.084, 0, 0.118],
}
export const offsetOf = (id: string): V3 => state.offsets[id] ?? [0, 0, 0]
/** where the piece is: its settled place, and what's been moved by hand from it */
export const positionOf = (id: string): V3 => {
  const b = BASES[id] ?? [0, 0, 0], o = offsetOf(id)
  return [b[0] + o[0], b[1] + o[1], b[2] + o[2]]
}
export const rotationOf = (id: string): V3 => state.rotations[id] ?? [0, 0, 0]
export const scaleOf = (id: string): V3 => state.scales[id] ?? [1, 1, 1]
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.offsets))
    localStorage.setItem(KEY_R, JSON.stringify(state.rotations))
    localStorage.setItem(KEY_S, JSON.stringify(state.scales))
  } catch { /* private window: it just won't be kept */ }
}
// ---- undo: each change (a drag, an arrow, a field edited, reset all) is a step; Ctrl+Z goes back one, Ctrl+Y (or Ctrl+Shift+Z) forward again
type Snap = { o: Record<string, V3>; r: Record<string, V3>; s: Record<string, V3> }
const past: Snap[] = []
let future: Snap[] = []
const take = (): Snap => JSON.parse(JSON.stringify({ o: state.offsets, r: state.rotations, s: state.scales }))
const snap = () => JSON.stringify(take())
const put = (v: Snap) => { state.offsets = v.o; state.rotations = v.r; state.scales = v.s }
/** called as a change begins: the way things are now is kept, to go back to */
export function beginChange() {
  const last = past.length ? JSON.stringify(past[past.length - 1]) : null
  if (last === snap()) return
  past.push(take())
  if (past.length > 100) past.shift()
  future = []
  panel()
}
export function undo() {
  const prev = past.pop()
  if (!prev) { toast('沒有可以復原的動作'); return }
  future.push(take())
  put(prev)
  save()
  emit()
}
export function redo() {
  const next = future.pop()
  if (!next) { toast('沒有可以重做的動作'); return }
  past.push(take())
  put(next)
  save()
  emit()
}
/** a piece moved (live, while it's dragged) */
export function moveTo(id: string, v: V3) { state.offsets = { ...state.offsets, [id]: v }; state.selected = id; emit() }
export function turnTo(id: string, v: V3) { state.rotations = { ...state.rotations, [id]: v }; state.selected = id; emit() }
export function scaleTo(id: string, v: V3) { state.scales = { ...state.scales, [id]: v }; state.selected = id; emit() }
export const commitOffsets = () => save()
export function resetAll() { beginChange(); state.offsets = {}; state.rotations = {}; state.scales = {}; save(); emit() }
/** one piece back to where it stands to begin with: moved, turned and scaled alike */
export function resetOne(id: string) {
  beginChange()
  const { [id]: _o, ...o } = state.offsets
  const { [id]: _r, ...r } = state.rotations
  const { [id]: _s, ...sc } = state.scales
  state.offsets = o; state.rotations = r; state.scales = sc
  save(); emit()
}
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
  toast(state.on ? '進入編輯模式：拖曳擺設，再按 G 或「編」離開' : '離開編輯模式', state.on ? 'edit' : 'plain')
}

// ---- the panel (plain DOM: it sits over the canvas, and must show even when what's being moved is out of view)
let toastEl: HTMLDivElement | null = null
function toast(text: string, kind: 'warn' | 'edit' | 'plain' = 'warn') {
  if (typeof document === 'undefined') return
  toastEl?.remove()
  const el = document.createElement('div')
  el.textContent = text
  const look = kind === 'warn' ? 'background:rgba(60,16,12,.94);color:#ffd9d2;border:1px solid #c0392b'
    : kind === 'edit' ? 'background:rgba(10,30,60,.94);color:#cfeaff;border:1px solid #3fa9ff' : 'background:rgba(30,30,30,.9);color:#eee;border:1px solid #888'
  el.style.cssText = `position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9999;${look};font:15px sans-serif;padding:9px 18px;border-radius:8px;pointer-events:none`
  document.body.appendChild(el)
  toastEl = el
  window.setTimeout(() => { if (toastEl === el) { el.remove(); toastEl = null } }, kind === 'edit' ? 3200 : 2200)
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
    title.textContent = '編輯模式（G 離開）：拖藍色方塊或三軸箭頭；旋轉、縮放在下面輸入；↺ 放回原狀'
    title.style.cssText = 'font-weight:bold;margin-bottom:6px'
    el.appendChild(title)
    info = document.createElement('div')
    info.style.cssText = 'font:12px monospace;color:#9fd0ff;min-height:18px;margin-bottom:6px;white-space:pre'
    el.appendChild(info)
    // (the numbers by hand, three rows for the selected piece: where it is (X, Y, Z), how far it's turned (degrees about X, Y, Z) and how large it is
    // (a multiple on X, Y, Z); each typed or stepped with the arrow keys, following the piece as it's dragged, each with its own button to put it back)
    fields = []
    const row3 = (label: string, step: string, get: (id: string) => V3, set: (id: string, v: V3) => void, rest: V3, tip: string) => {
      const line = document.createElement('div')
      line.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;align-items:center;flex-wrap:wrap'
      const name = document.createElement('span')
      name.textContent = label
      name.title = tip
      name.style.cssText = 'width:28px;font:12px sans-serif;color:#dff0ff'
      line.appendChild(name)
      const mine: HTMLInputElement[] = []
      ;['X', 'Y', 'Z'].forEach((axis, k) => {
        const wrap = document.createElement('label')
        wrap.style.cssText = `display:flex;align-items:center;gap:2px;font:12px monospace;color:${['#ff7b72', '#6fe08a', '#6fb4ff'][k]}`
        wrap.append(axis)
        const inp = document.createElement('input')
        inp.type = 'number'
        inp.step = step
        inp.style.cssText = 'width:54px;background:#0b1a2e;color:#dff0ff;border:1px solid #3fa9ff;border-radius:4px;padding:2px 3px;font:12px monospace'
        inp.oninput = () => {
          const id = state.selected
          if (!id || inp.value === '' || Number.isNaN(Number(inp.value))) return
          const v = [...get(id)] as V3
          v[k] = Number(inp.value)
          set(id, v)
        }
        inp.onfocus = () => beginChange()
        inp.onchange = () => save()
        wrap.appendChild(inp)
        line.appendChild(wrap)
        mine.push(inp)
        fields.push(inp)
      })
      const back = document.createElement('button')
      back.textContent = '↺'
      back.title = `${tip}：放回原狀`
      back.style.cssText = 'background:#16345a;color:#dff0ff;border:1px solid #3fa9ff;border-radius:4px;padding:0 6px;cursor:pointer;font:13px sans-serif'
      back.onclick = () => { const id = state.selected; if (id) { beginChange(); set(id, [...rest] as V3); save() } }
      line.appendChild(back)
      el!.appendChild(line)
      return mine
    }
    row3('位置', '0.01', offsetOf, moveTo, [0, 0, 0], '位置')
    row3('旋轉', '5', rotationOf, turnTo, [0, 0, 0], '旋轉（度）')
    row3('縮放', '0.05', scaleOf, scaleTo, [1, 1, 1], '縮放（倍數）')
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
    info.textContent = id ? `${r?.label ?? id}\n位置 [${offsetOf(id).map((v) => v.toFixed(3)).join(', ')}]  旋轉 [${rotationOf(id).map((v) => v.toFixed(0)).join(', ')}]°  縮放 [${scaleOf(id).map((v) => v.toFixed(2)).join(', ')}]` : '（點方塊或下面的名字選一個）'
    const values = id ? [...offsetOf(id), ...rotationOf(id), ...scaleOf(id)] : []
    fields.forEach((f, k) => {
      f.disabled = !id
      if (id && document.activeElement !== f) f.value = k < 3 ? values[k].toFixed(3) : k < 6 ? values[k].toFixed(0) : values[k].toFixed(2)
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
