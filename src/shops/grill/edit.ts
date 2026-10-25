// The shop's edit mode: press G while the shop is shut and its furnishings can be moved about by hand (see Movable). Each moved piece's
// offset is kept in the browser. While the shop is open it can't be switched on (and is switched off if the shop opens), since customers and
// staff are walking about. Here: the state, the key, the panel at the screen's corner, and the list of what can be moved.

import { useSyncExternalStore } from 'react'

export type V3 = [number, number, number]
// (the keys count up whenever more places are settled into the defaults below: what was kept under the old ones isn't carried over, or it would count twice)
const KEY = 'jgs-edit-offsets-3'
const KEY_R = 'jgs-edit-rotations-2'
const KEY_S = 'jgs-edit-scales-2'
const KEY_G = 'jgs-edit-groups-1'
const load = (key: string): Record<string, V3> => {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') } catch { return {} }
}
/** offsets: where a piece is moved to (from its base); rotations: degrees turned about X, Y, Z; scales: how much larger or smaller on X, Y, Z (1 = as it is) */
export type Tool = 'move' | 'rotate' | 'scale'
/**
 * A group of pieces the owner has put together by hand: moved, turned about the vertical and sized as one. `pivot` is where it turns and grows
 * from (the middle of its members, in the world, as it was when made); `t` is how far it's moved (in the room's frame), `yaw` how far it's turned
 * (degrees) and `s` how much larger (one number for all three axes). Each member still keeps its own place inside it.
 */
export type Group = { name: string; members: string[]; pivot: V3; t: V3; yaw: number; s: number }
const loadGroups = (): Record<string, Group> => {
  try { return JSON.parse(localStorage.getItem(KEY_G) ?? '{}') } catch { return {} }
}
type State = { on: boolean; locked: boolean; tool: Tool; offsets: Record<string, V3>; rotations: Record<string, V3>; scales: Record<string, V3>; selected: string | null; groups: Record<string, Group>; picked: string[] }
let state: State = { on: false, locked: false, tool: 'move', offsets: load(KEY), rotations: load(KEY_R), scales: load(KEY_S), selected: null, groups: loadGroups(), picked: [] }
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
  // (the owner's settled spot: moved by [0.2, 0.19, 0.47] in the room's frame from [-1.508, 0, 1.974], taken into this parent's own units)
  freezer: [-1.2453, 0.19, 1.5359],
  willow: [0.38, 0, 0.201],
  sake: [0.084, 0, 0.118],
  sake2: [0.084, 0, 0.118],
  // (the charcoal basket: moved by [0.273, 0.125, 0.082] in the room's frame, taken into the parent's units; its 1.75 size and 44° turn are Decor's)
  crate: [-0.0941, 0.125, -0.2691],
}
export const isGroup = (id: string | null) => !!id && id in state.groups
/** the group a piece belongs to, if any */
export const groupOf = (piece: string): string | null => Object.keys(state.groups).find((g) => state.groups[g].members.includes(piece)) ?? null
/** whether a piece is the selected one, or in the selected group */
export const isPicked = (piece: string) => state.selected === piece || (isGroup(state.selected) && state.groups[state.selected!].members.includes(piece))
export const offsetOf = (id: string): V3 => state.groups[id] ? state.groups[id].t : state.offsets[id] ?? [0, 0, 0]
/** where the piece is: its settled place, and what's been moved by hand from it */
export const positionOf = (id: string): V3 => {
  const b = BASES[id] ?? [0, 0, 0], o = offsetOf(id)
  return [b[0] + o[0], b[1] + o[1], b[2] + o[2]]
}
export const rotationOf = (id: string): V3 => state.groups[id] ? [0, state.groups[id].yaw, 0] : state.rotations[id] ?? [0, 0, 0]
export const scaleOf = (id: string): V3 => state.groups[id] ? [state.groups[id].s, state.groups[id].s, state.groups[id].s] : state.scales[id] ?? [1, 1, 1]
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.offsets))
    localStorage.setItem(KEY_R, JSON.stringify(state.rotations))
    localStorage.setItem(KEY_S, JSON.stringify(state.scales))
    localStorage.setItem(KEY_G, JSON.stringify(state.groups))
  } catch { /* private window: it just won't be kept */ }
}
// ---- undo: each change (a drag, an arrow, a field edited, reset all) is a step; Ctrl+Z goes back one, Ctrl+Y (or Ctrl+Shift+Z) forward again
type Snap = { o: Record<string, V3>; r: Record<string, V3>; s: Record<string, V3>; g: Record<string, Group> }
const past: Snap[] = []
let future: Snap[] = []
const take = (): Snap => JSON.parse(JSON.stringify({ o: state.offsets, r: state.rotations, s: state.scales, g: state.groups }))
const snap = () => JSON.stringify(take())
const put = (v: Snap) => { state.offsets = v.o; state.rotations = v.r; state.scales = v.s; state.groups = v.g ?? {} }
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
export function moveTo(id: string, v: V3) {
  if (state.groups[id]) state.groups = { ...state.groups, [id]: { ...state.groups[id], t: v } }
  else state.offsets = { ...state.offsets, [id]: v }
  state.selected = id; emit()
}
export function turnTo(id: string, v: V3) {
  if (state.groups[id]) state.groups = { ...state.groups, [id]: { ...state.groups[id], yaw: v[1] } }
  else state.rotations = { ...state.rotations, [id]: v }
  state.selected = id; emit()
}
export function scaleTo(id: string, v: V3) {
  const g = state.groups[id]
  if (g) {
    // (one size for the whole group: whichever field was changed gives it)
    const was = g.s
    const s = v.find((x) => Math.abs(x - was) > 1e-9) ?? was
    state.groups = { ...state.groups, [id]: { ...g, s: Math.max(0.05, Math.min(20, s)) } }
  } else state.scales = { ...state.scales, [id]: v }
  state.selected = id; emit()
}
export const commitOffsets = () => save()
export function resetAll() {
  beginChange(); state.offsets = {}; state.rotations = {}; state.scales = {}
  state.groups = Object.fromEntries(Object.entries(state.groups).map(([k, g]) => [k, { ...g, t: [0, 0, 0] as V3, yaw: 0, s: 1 }]))
  save(); emit()
}
export const select = (id: string | null) => { state.selected = id; emit() }
const TOOL_NAMES: Record<Tool, string> = { move: '位移 (W)', rotate: '旋轉 (R)', scale: '縮放 (S)' }
/** which handles the selected piece shows: arrows to move it, rings to turn it, boxes to scale it */
export function setTool(t: Tool) {
  if (!state.on || state.tool === t) return
  state.tool = t
  emit()
  toast(`${TOOL_NAMES[t]}`, 'edit')
}

/** the axis the + and - keys scale along (null: all three together); set with the X, Y, Z keys or by clicking an axis's letter in the Scale rows */
let scaleAxis: 0 | 1 | 2 | null = null
export const SCALE_STEP = 1.05
/** the size after one + (dir 1) or - (dir -1) step along an axis (null: all three): a twentieth bigger or smaller each, never past 0.05 or 20 times */
export const stepScale = (v: V3, dir: 1 | -1, axis: 0 | 1 | 2 | null): V3 =>
  v.map((x, k) => (axis === null || axis === k ? Math.round(Math.max(0.05, Math.min(20, dir > 0 ? x * SCALE_STEP : x / SCALE_STEP)) * 100) / 100 : x)) as V3
export function nudgeScale(dir: 1 | -1, axis: 0 | 1 | 2 | null = scaleAxis) {
  const id = state.selected
  if (!state.on || !id) return
  beginChange()
  scaleTo(id, stepScale(scaleOf(id), dir, axis))
  save()
}
export function setScaleAxis(a: 0 | 1 | 2 | null) {
  scaleAxis = scaleAxis === a ? null : a
  panel()
  toast(scaleAxis === null ? '+ / − 縮放：X Y Z 三軸一起' : `+ / − 縮放：只動 ${'XYZ'[scaleAxis]} 軸`, 'edit')
}

/** what can be moved: each piece says what it's called and how to bring the camera to it */
const registry = new Map<string, { label: string; focus: () => void; center?: () => V3 | null }>()
/** `center`: where the piece's middle is in the world (what a group of it turns and grows about); a piece without one can't be grouped */
export function registerMovable(id: string, label: string, focus: () => void, center?: () => V3 | null) {
  registry.set(id, { label, focus, center })
  panel()
  return () => { registry.delete(id); panel() }
}

// ---- groups
let groupSeq = 0
/** the pieces picked in the list (Ctrl- or Shift-click adds one), the selected one too, that can be grouped and aren't in a group already */
export const groupable = () => [...new Set([...state.picked, ...(state.selected && !isGroup(state.selected) ? [state.selected] : [])])]
  .filter((id) => registry.get(id)?.center && !groupOf(id))
export function pickToggle(id: string) {
  state.picked = state.picked.includes(id) ? state.picked.filter((x) => x !== id) : [...state.picked, id]
  if (!state.selected || isGroup(state.selected)) state.selected = id
  emit()
}
export function makeGroup() {
  const ids = groupable()
  if (ids.length < 2) { toast('先在清單裡 Ctrl 或 Shift 點選兩件以上的擺設，再按「成組」'); return }
  const pts = ids.map((id) => registry.get(id)!.center!()).filter((v): v is V3 => !!v)
  const pivot = (pts.length ? [0, 1, 2].map((k) => pts.reduce((a, v) => a + v[k], 0) / pts.length) : [0, 0, 0]) as V3
  beginChange()
  let n = ++groupSeq
  while (state.groups[`grp${n}`]) n = ++groupSeq
  const id = `grp${n}`
  state.groups = { ...state.groups, [id]: { name: `群組 ${n}`, members: ids, pivot, t: [0, 0, 0], yaw: 0, s: 1 } }
  state.picked = []
  state.selected = id
  save(); emit()
  toast(`已把 ${ids.length} 件擺設成組：${state.groups[id].name}`, 'edit')
}
export function dissolveGroup(id: string | null = state.selected) {
  if (!id || !state.groups[id]) return
  beginChange()
  const { [id]: _g, ...rest } = state.groups
  state.groups = rest
  state.selected = null
  save(); emit()
  toast('已解散群組，擺設各回自己的位置', 'edit')
}
export function renameGroup(id: string, name: string) {
  if (!state.groups[id]) return
  state.groups = { ...state.groups, [id]: { ...state.groups[id], name } }
  save(); emit()
}
/** the transform of the group a piece is in, to lay over it: where it turns from, how far it's moved (in the room's frame), turned and sized */
export const groupTransformOf = (piece: string) => {
  const g = groupOf(piece)
  return g ? state.groups[g] : null
}

/** the shop opening (locked) or shut: opening switches the mode off */
export function setLocked(locked: boolean) {
  if (state.locked === locked) return
  state.locked = locked
  // (the shop opening while editing: whatever wasn't confirmed is taken back)
  if (locked && state.on) { revert(); state.on = false; past.length = 0; future = [] }
  emit()
}
/** how things stood when edit mode was entered: what 取消 goes back to */
let baseline: Snap | null = null
/** puts everything back as it stood on entering (sizes, places and turns), and keeps that */
function revert() {
  if (baseline) { put(JSON.parse(JSON.stringify(baseline))); save() }
  baseline = null
}
function leave(text: string) {
  state.on = false
  state.selected = null
  state.picked = []
  state.tool = 'move'
  past.length = 0; future = []
  emit()
  toast(text, 'plain')
}
/** 確認: the changes stay */
export function confirmEdit() {
  if (!state.on) return
  baseline = null
  save()
  leave('已確認，擺設的位置、大小與方向已儲存')
}
/** 取消: back to how it all was before editing began */
export function cancelEdit() {
  if (!state.on) return
  const changed = baseline ? JSON.stringify(baseline) !== snap() : false
  revert()
  leave(changed ? '已取消，擺設回到編輯前的位置、大小與方向' : '離開編輯模式')
}
export function toggleEdit() {
  if (state.locked) { toast('營業中不能編輯，請先閉店'); return }
  if (state.on) { cancelEdit(); return }
  baseline = take()
  state.on = true
  state.selected = null
  state.picked = []
  state.tool = 'move'
  emit()
  toast('進入編輯模式：拖曳擺設，完成後按「確認」；按 G 或「取消」會放棄變更', 'edit')
}

// ---- the panel (plain DOM: it sits over the canvas, and must show even when what's being moved is out of view)
let toastEl: HTMLDivElement | null = null
let toastTimer = 0
/** one notice at a time: a new one takes the old one's place at once (never two over each other) */
function toast(text: string, kind: 'warn' | 'edit' | 'plain' = 'warn') {
  if (typeof document === 'undefined') return
  window.clearTimeout(toastTimer)
  toastEl?.remove()
  // (any left over from before, however it came about)
  document.querySelectorAll('[data-edit-toast]').forEach((n) => n.remove())
  const el = document.createElement('div')
  el.dataset.editToast = '1'
  el.textContent = text
  const look = kind === 'warn' ? 'background:rgba(60,16,12,.94);color:#ffd9d2;border:1px solid #c0392b'
    : kind === 'edit' ? 'background:rgba(10,30,60,.94);color:#cfeaff;border:1px solid #3fa9ff' : 'background:rgba(30,30,30,.9);color:#eee;border:1px solid #888'
  el.style.cssText = `position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9999;${look};font:15px sans-serif;padding:9px 18px;border-radius:8px;pointer-events:none;white-space:nowrap`
  document.body.appendChild(el)
  toastEl = el
  toastTimer = window.setTimeout(() => { if (toastEl === el) { el.remove(); toastEl = null } }, kind === 'edit' ? 2400 : 1800)
}
/**
 * Each piece's position is stored in its parent's own frame, which is turned a different way for different pieces; the panel shows it in the
 * room's frame (the bar's direction) instead, the same way the move arrows point, so X and Z mean the same for every piece. `theta` is the
 * turn about the vertical from the room's frame into the piece's parent's.
 */
const frames = new Map<string, number>()
export const setFrame = (id: string, theta: number) => { frames.set(id, theta) }
const turnY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
export const toRoom = (id: string, v: V3): V3 => turnY(v, -(frames.get(id) ?? 0))
export const fromRoom = (id: string, v: V3): V3 => turnY(v, frames.get(id) ?? 0)
let el: HTMLDivElement | null = null
let info: HTMLDivElement | null = null
let fields: HTMLInputElement[] = []
let toolButtons: HTMLButtonElement[] = []
let rows = new Map<string, HTMLDivElement>()
let summary: HTMLDivElement | null = null
let built = ''

/** the panel's look: after Blender's dark interface (grey panels, a darker header bar, blue for what's active, red/green/blue axis stripes) */
const PANEL_CSS = `
.be { position:fixed; left:12px; bottom:92px; z-index:9999; width:292px; max-height:70vh; display:flex; background:#303030; color:#d6d6d6;
  font:11.5px/1.35 "Inter","Segoe UI","Noto Sans TC",sans-serif; border:1px solid #1a1a1a; border-radius:6px; box-shadow:0 6px 22px rgba(0,0,0,.55); overflow:hidden; user-select:none }
.be * { box-sizing:border-box }
.be-tools { display:flex; flex-direction:column; gap:3px; padding:6px 4px; background:#262626; border-right:1px solid #1a1a1a }
.be-tool { width:30px; height:30px; display:grid; place-items:center; background:#3c3c3c; border:0; border-radius:4px; color:#d6d6d6; cursor:pointer; padding:0 }
.be-tool svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round }
.be-tool:hover { background:#4d4d4d }
.be-tool.on { background:#4772b3; color:#fff }
.be-main { flex:1; min-width:0; display:flex; flex-direction:column }
.be-head { display:flex; align-items:center; gap:6px; padding:5px 8px; background:#1f1f1f; font-weight:600; letter-spacing:.02em; color:#e6e6e6 }
.be-head small { margin-left:auto; font-weight:400; color:#8a8a8a }
.be-body { overflow:auto; flex:1; scrollbar-width:thin; scrollbar-color:#555 #2a2a2a }
.be-sec { border-top:1px solid #1d1d1d }
.be-sec > .be-st { display:flex; align-items:center; gap:5px; padding:4px 8px; background:#3d3d3d; color:#e0e0e0; font-weight:600; cursor:pointer }
.be-sec > .be-st::before { content:'▾'; color:#9a9a9a; font-size:10px }
.be-sec.shut > .be-st::before { content:'▸' }
.be-sec.shut > .be-sc { display:none }
.be-sc { padding:6px 8px 8px; background:#2b2b2b }
.be-sum { color:#9ab0c8; font-size:11px; margin-bottom:5px }
.be-find { width:100%; background:#1d1d1d; color:#d6d6d6; border:1px solid #3a3a3a; border-radius:4px; padding:3px 7px; font:inherit; margin-bottom:5px }
.be-list { max-height:150px; overflow:auto; scrollbar-width:thin; scrollbar-color:#555 #2a2a2a; background:#242424; border-radius:4px; padding:2px }
.be-row { padding:2px 8px 2px 18px; border-radius:3px; cursor:pointer; white-space:nowrap; position:relative }
.be-row::before { content:''; position:absolute; left:7px; top:50%; width:6px; height:6px; margin-top:-3px; border:1px solid #e0a030; border-radius:1px }
.be-row:hover { background:#3a3a3a }
.be-grow { font-weight:600; color:#ffd37a }
.be-grow::before { border-radius:50%; }
.be-row.multi { background:#2f4a73; color:#fff }
.be-row.on { background:#4772b3; color:#fff }
.be-row.on::before { border-color:#fff; background:#ffd37a }
.be-name { padding:2px 0 6px; color:#f0f0f0; font-weight:600; min-height:20px }
.be-name em { font-style:normal; font-weight:400; color:#8a8a8a }
.be-grp { margin-bottom:7px }
.be-gl { display:flex; align-items:center; color:#a8a8a8; margin-bottom:2px }
.be-gl button { margin-left:auto; background:#3c3c3c; color:#cfcfcf; border:0; border-radius:3px; width:22px; height:17px; cursor:pointer; padding:0; font:12px sans-serif; line-height:1 }
.be-gl button:hover { background:#4d4d4d }
.be-f { display:flex; align-items:stretch; margin-bottom:1px; border-radius:4px; overflow:hidden; background:#545454 }
.be-f:hover { background:#626262 }
.be-f b { width:20px; display:grid; place-items:center; font:600 10.5px monospace; color:#fff }
.be-f input { flex:1; min-width:0; background:transparent; color:#f0f0f0; border:0; outline:0; text-align:right; padding:3px 7px; font:12px monospace }
.be-st1 { width:22px; background:#3c3c3c; color:#e6e6e6; border:0; border-left:1px solid #2a2a2a; cursor:pointer; font:600 13px sans-serif; padding:0; line-height:1 }
.be-st1:hover { background:#5a5a5a }
.be-f.axon b { outline:2px solid #ffd37a; outline-offset:-2px }
.be-f input:focus { background:#1d1d1d }
.be-f input:disabled { color:#777 }
.be-f.x b { background:#a8433f } .be-f.y b { background:#5f8f2e } .be-f.z b { background:#3b6fb0 }
.be-foot { display:flex; flex-wrap:wrap; gap:4px; padding:6px 8px; background:#262626; border-top:1px solid #1a1a1a }
.be-foot button { background:#4a4a4a; color:#e6e6e6; border:0; border-radius:4px; padding:3px 9px; font:inherit; cursor:pointer }
.be-foot button:hover { background:#5c5c5c }
.be-foot .warn { background:#6b3030 } .be-foot .warn:hover { background:#853a3a }
.be-foot .ok { background:#4772b3; color:#fff; font-weight:600; margin-left:auto } .be-foot .ok:hover { background:#5a87cc }
`
const TOOL_ICONS: Record<Tool, string> = {
  move: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
  scale: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="10" height="10" rx="1"/><path d="M14 10l6-6M15 4h5v5"/></svg>',
}
function panel() {
  if (typeof document === 'undefined') return
  if (!state.on) { el?.remove(); el = null; info = null; fields = []; toolButtons = []; rows = new Map(); built = ''; return }
  if (!document.getElementById('be-style')) {
    const st = document.createElement('style')
    st.id = 'be-style'
    st.textContent = PANEL_CSS
    document.head.appendChild(st)
  }
  // (rebuilt only when the list of pieces changes; the numbers are just rewritten as one is dragged)
  const sig = [...registry.keys()].join('|') + '#' + Object.entries(state.groups).map(([k, g]) => `${k}:${g.name}:${g.members.join(',')}`).join(';')
  if (!el || built !== sig) {
    el?.remove()
    el = document.createElement('div')
    el.className = 'be'
    const h = (tag: string, cls?: string, text?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
    // the tool bar down the left edge: Move (W), Rotate (R), Scale (S)
    const bar = h('div', 'be-tools')
    toolButtons = (['move', 'rotate', 'scale'] as Tool[]).map((t) => {
      const b = h('button', 'be-tool') as HTMLButtonElement
      b.innerHTML = TOOL_ICONS[t]
      b.title = `${TOOL_NAMES[t]}（${t === 'move' ? 'W' : t === 'rotate' ? 'R' : 'S'}）`
      b.onclick = () => setTool(t)
      bar.appendChild(b)
      return b
    })
    const main = h('div', 'be-main')
    const head = h('div', 'be-head', '編輯模式')
    head.appendChild(h('small', '', 'G 離開　Ctrl+Z / Y'))
    const body = h('div', 'be-body')
    const section = (title: string) => {
      const sec = h('div', 'be-sec'), st = h('div', 'be-st', title), sc = h('div', 'be-sc')
      st.onclick = () => sec.classList.toggle('shut')
      sec.append(st, sc)
      body.appendChild(sec)
      return sc
    }
    // Outliner: every piece that can be taken hold of, a search above, the chosen one lit
    const out = section('場景物件')
    summary = h('div', 'be-sum') as HTMLDivElement
    out.appendChild(summary)
    const find = h('input', 'be-find') as HTMLInputElement
    find.placeholder = '搜尋…'
    const list = h('div', 'be-list')
    rows = new Map()
    // (the groups first, each with its members under it; then every piece not in one)
    const addRow = (id: string, label: string, indent: boolean, group: boolean) => {
      const row = h('div', `be-row${group ? ' be-grow' : ''}`, label)
      if (indent) row.style.paddingLeft = '30px'
      row.title = group ? '選整個群組（一起移動、轉向、縮放）' : 'Ctrl 或 Shift 點選可多選，再按「成組」；單點是把鏡頭帶到它'
      row.onclick = (e) => {
        const ev = e as MouseEvent
        if (!group && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) { pickToggle(id); return }
        if (!group) registry.get(id)?.focus()
        state.picked = []
        select(id)
      }
      list.appendChild(row)
      rows.set(id, row as HTMLDivElement)
    }
    for (const [gid, g] of Object.entries(state.groups)) {
      addRow(gid, `${g.name}（${g.members.length}）`, false, true)
      for (const m of g.members) if (registry.has(m)) addRow(m, registry.get(m)!.label, true, false)
    }
    for (const [id, r] of registry) if (!groupOf(id)) addRow(id, r.label, false, false)
    find.oninput = () => { const q = find.value.trim().toLowerCase(); for (const [id, row] of rows) row.style.display = !q || (registry.get(id)?.label ?? state.groups[id]?.name ?? id).toLowerCase().includes(q) ? '' : 'none' }
    out.append(find, list)
    // Transform: what's chosen, then Location, Rotation, Scale each as X / Y / Z stacked, a reset beside each
    const tr = section('變換')
    info = h('div', 'be-name') as HTMLDivElement
    tr.appendChild(info)
    fields = []
    const group = (label: string, step: string, get: (id: string) => V3, set: (id: string, v: V3) => void, rest: V3, stepper = false) => {
      const g = h('div', 'be-grp'), gl = h('div', 'be-gl', label)
      const back = h('button', '', '↺') as HTMLButtonElement
      back.title = `${label}：放回原狀`
      back.onclick = () => { const id = state.selected; if (id) { beginChange(); set(id, [...rest] as V3); save() } }
      gl.appendChild(back)
      g.appendChild(gl)
      ;['X', 'Y', 'Z'].forEach((axis, k) => {
        const f = h('label', `be-f ${axis.toLowerCase()}`)
        f.appendChild(h('b', '', axis))
        const inp = document.createElement('input')
        inp.type = 'number'
        inp.step = step
        inp.oninput = () => {
          const id = state.selected
          if (!id || inp.value === '' || Number.isNaN(Number(inp.value))) return
          const v = [...get(id)] as V3
          v[k] = Number(inp.value)
          set(id, v)
        }
        inp.onfocus = () => beginChange()
        inp.onchange = () => save()
        f.appendChild(inp)
        if (stepper) {
          // (the scale rows: − and + beside each axis, a twentieth smaller or bigger along it; its letter picks the axis for the − and + keys)
          const minus = h('button', 'be-st1', '−') as HTMLButtonElement, plus = h('button', 'be-st1', '+') as HTMLButtonElement
          minus.title = `${axis} 軸縮小（- 鍵）`; plus.title = `${axis} 軸放大（+ 鍵）`
          minus.onclick = () => nudgeScale(-1, k as 0 | 1 | 2); plus.onclick = () => nudgeScale(1, k as 0 | 1 | 2)
          f.append(minus, plus)
          f.firstElementChild!.addEventListener('click', () => setScaleAxis(k as 0 | 1 | 2))
          ;(f.firstElementChild as HTMLElement).style.cursor = 'pointer'
          ;(f.firstElementChild as HTMLElement).title = `選 ${axis} 軸：之後 + / - 鍵只縮放這一軸`
        }
        g.appendChild(f)
        fields.push(inp)
      })
      tr.appendChild(g)
    }
    group('位置 Location', '0.01', (id) => toRoom(id, offsetOf(id)), (id, v) => moveTo(id, fromRoom(id, v)), [0, 0, 0])
    group('旋轉 Rotation（度）', '5', rotationOf, turnTo, [0, 0, 0])
    group('縮放 Scale（+ / − 鍵）', '0.05', scaleOf, scaleTo, [1, 1, 1], true)
    const foot = h('div', 'be-foot')
    const mk = (text: string, title: string, fn: () => void, cls = '') => {
      const b = h('button', cls, text) as HTMLButtonElement
      b.title = title
      b.onclick = fn
      return b
    }
    foot.append(
      mk('成組', '先在清單裡 Ctrl 或 Shift 點選兩件以上，再按這個：把它們組成一個群組，一起移動、轉向、縮放', makeGroup),
      mk('解散', '解散選到的群組', () => dissolveGroup()),
      mk('改名', '替選到的群組改名', () => { const g = state.selected ? state.groups[state.selected] : null; if (g) { const n = window.prompt('群組名稱', g.name); if (n) renameGroup(state.selected!, n) } }),
      mk('復原', 'Ctrl+Z', undo), mk('重做', 'Ctrl+Y', redo),
      mk('全部還原', '把所有被移動的擺設放回原位', () => { if (window.confirm('把所有被移動的擺設放回原位？')) resetAll() }, 'warn'),
      mk('取消', '放棄這次所有變更', () => cancelEdit()),
      mk('確認', '保留這次所有變更', () => confirmEdit(), 'ok'),
    )
    main.append(head, body, foot)
    el.append(bar, main)
    document.body.appendChild(el)
    built = sig
  }
  ;(['move', 'rotate', 'scale'] as Tool[]).forEach((t, k) => toolButtons[k]?.classList.toggle('on', state.tool === t))
  for (const [id, row] of rows) { row.classList.toggle('on', state.selected === id); row.classList.toggle('multi', state.picked.includes(id)) }
  if (summary) {
    // (how much furniture there is: every piece that can be taken hold of, how many have been moved, turned or sized from where they began, and the groups)
    const pieces = [...registry.keys()]
    const moved = pieces.filter((id) => offsetOf(id).some((v) => Math.abs(v) > 1e-6) || rotationOf(id).some((v) => Math.abs(v) > 1e-6) || scaleOf(id).some((v) => Math.abs(v - 1) > 1e-6)).length
    summary.textContent = `共 ${pieces.length} 件擺設・調整過 ${moved} 件・群組 ${Object.keys(state.groups).length} 個`
  }
  el?.querySelectorAll('.be-grp:last-of-type .be-f').forEach((f, k) => f.classList.toggle('axon', scaleAxis === k))
  if (info) {
    const id = state.selected
    const r = id ? registry.get(id) : null
    info.innerHTML = id ? `${state.groups[id] ? '▣ ' + state.groups[id].name + '（群組）' : r?.label ?? id}` : '<em>（點方塊或左邊的名字選一個）</em>'
    const values = id ? [...toRoom(id, offsetOf(id)), ...rotationOf(id), ...scaleOf(id)] : []
    fields.forEach((f, k) => {
      f.disabled = !id || (isGroup(id) && (k === 3 || k === 5))
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
    if (state.on && !typing) {
      const k = e.key.toLowerCase()
      // (X, Y, Z choose the axis the + and - keys scale along (again, all three together); + and - scale the chosen piece)
      if (k === 'x' || k === 'y' || k === 'z') { e.preventDefault(); setScaleAxis(({ x: 0, y: 1, z: 2 } as const)[k]); return }
      if (k === '+' || k === '=') { e.preventDefault(); nudgeScale(1); return }
      if (k === '-' || k === '_') { e.preventDefault(); nudgeScale(-1); return }
      const t: Tool | null = k === 'w' ? 'move' : k === 'r' ? 'rotate' : k === 's' ? 'scale' : null
      if (t) { e.preventDefault(); setTool(t); return }
    }
    if (e.key !== 'g' && e.key !== 'G') return
    const t = e.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return
    toggleEdit()
  })
  if (import.meta.env?.DEV) (window as unknown as { __edit?: unknown }).__edit = { get: getEdit, moveTo, select, toggle: toggleEdit, confirm: confirmEdit, cancel: cancelEdit, setLocked, undo, redo, setTool, frame: (id: string) => frames.get(id) }
}
