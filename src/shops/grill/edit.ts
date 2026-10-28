// The shop's edit mode: press G while the shop is shut and its furnishings can be moved about by hand (see Movable). Each moved piece's
// offset is kept in the browser. While the shop is open it can't be switched on (and is switched off if the shop opens), since customers and
// staff are walking about. Here: the state, the key, the panel at the screen's corner, and the list of what can be moved.

import { useSyncExternalStore } from 'react'
import { EDIT_TEXT, pieceName } from '@/data/editText'
import type { Lang } from '@/data/i18n'
import { glowOnly, HOVER } from '@/scene/hoverGlow'
import { setTip } from '@/scene/hoverTip'

export type V3 = [number, number, number]
/** the panel's language (the game's: App sets it) */
let lang: Lang = 'zh'
const T = () => EDIT_TEXT[lang]
export function setEditLang(l: Lang) {
  if (lang === l) return
  lang = l
  built = ''
  panel()
}
// (the keys count up whenever more places are settled into the defaults below: what was kept under the old ones isn't carried over, or it would count twice)
const KEY = 'jgs-edit-offsets-12'
const KEY_R = 'jgs-edit-rotations-9'
const KEY_S = 'jgs-edit-scales-8'
const KEY_G = 'jgs-edit-groups-2'
const KEY_P = 'jgs-edit-pivots-2'
const load = (key: string): Record<string, V3> => {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') } catch { return {} }
}
/** offsets: where a piece is moved to (from its base); rotations: degrees turned about X, Y, Z; scales: how much larger or smaller on X, Y, Z (1 = as it is) */
export type Tool = 'select' | 'move' | 'rotate' | 'scale'
/**
 * A group of pieces the owner has put together by hand: moved, turned about the vertical and sized as one. `pivot` is where it turns and grows
 * from (the middle of its members, in the world, as it was when made); `t` is how far it's moved (in the room's frame), `yaw` how far it's turned about the vertical (and `r`, when set, its turn about all three of the room's axes)
 * (degrees) and `s` how much larger (one number for all three axes). Each member still keeps its own place inside it.
 */
export type Group = { name: string; members: string[]; pivot: V3; t: V3; yaw: number; s: number; r?: V3 }
/** groups the shop comes with (the owner's own are added to them): the door's cat stand with its four cats; their pivot is found the first time
 * edit mode opens, once the pieces have been measured */
const DEFAULT_GROUPS: Record<string, { zh: string; ja: string; members: string[] }> = {
  'grp-doorcats': { zh: '門口招財貓組', ja: '玄関の招き猫', members: ['doorcats', 'doorcat0', 'doorcat1', 'doorcat2', 'doorcat3'] },
  // (the shrine's shelf and everything on it: the shrine, the Ebisu, the vases, the cups, the sutra, the flask and the oranges ride on its fittings)
  'grp-altar': { zh: '小神龕組', ja: '神棚', members: ['altar', 'altarfittings'] },
}
const unsettled = new Set<string>()
/** the default groups the owner has broken up: not made again */
const KEY_GD = 'jgs-edit-groups-dropped'
const dropped = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY_GD) ?? '[]') } catch { return [] } }
const loadGroups = (): Record<string, Group> => {
  let g: Record<string, Group> = {}
  try { g = JSON.parse(localStorage.getItem(KEY_G) ?? '{}') } catch { /* storage blocked */ }
  for (const [id, d] of Object.entries(DEFAULT_GROUPS)) {
    // (not when the owner has already put any of its pieces in a group of their own, or broken it up)
    const taken = Object.values(g).some((x) => x.members.some((m) => d.members.includes(m)))
    if (g[id] || taken || dropped().includes(id)) continue
    g[id] = { name: d.zh, members: d.members, pivot: [0, 0, 0], t: [0, 0, 0], yaw: 0, s: 1 }
    unsettled.add(id)
  }
  return g
}
/** a default group's pivot: the middle of its members, once they've all been measured */
function settleGroups() {
  for (const id of [...unsettled]) {
    const g = state.groups[id]
    if (!g) { unsettled.delete(id); continue }
    const pts = g.members.map((m) => registry.get(m)?.center?.() ?? null)
    if (pts.some((v) => !v)) continue
    const pivot = [0, 1, 2].map((k) => pts.reduce((a, v) => a + v![k], 0) / pts.length) as V3
    state.groups = { ...state.groups, [id]: { ...g, pivot } }
    unsettled.delete(id)
  }
}
/** the axes the arrows, rings and fields go by: the room's (world), or the piece's own (local: its parent's frame, as it stands on its wall) */
export type Space = 'world' | 'local'
type State = { on: boolean; locked: boolean; tool: Tool; offsets: Record<string, V3>; rotations: Record<string, V3>; scales: Record<string, V3>; selected: string | null; groups: Record<string, Group>; picked: string[]
  /** each piece's pivot, moved from its middle by hand (in its own frame), what it turns and grows about; and whether the arrows move the pivot (D) */
  pivots: Record<string, V3>; pivotMode: boolean; space: Space
  /** the scene drawn as its wireframe (Maya's 4), to see each model's topology; off is shaded (5) */
  wire: boolean }
let state: State = { on: false, locked: false, tool: 'move', offsets: load(KEY), rotations: load(KEY_R), scales: load(KEY_S), selected: null, groups: loadGroups(), picked: [],
  pivots: load(KEY_P), pivotMode: false, space: 'world', wire: false }
const subs = new Set<() => void>()
const emit = () => {
  // (in edit mode the room's own pointing (lit things, name tags, the hand) is paused: what's lit now is put out)
  if (HOVER.paused !== state.on) { HOVER.paused = state.on; if (state.on) { glowOnly(null); setTip(null); POINTER_RESET() } }
  state = { ...state }; subs.forEach((f) => f()); panel()
}
/** (the cursor back to the arrow, wherever a hover had set it) */
const POINTER_RESET = () => { if (typeof document === 'undefined') return; document.body.style.cursor = ''; document.querySelectorAll('canvas').forEach((c) => { c.style.cursor = '' }) }
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
  // (moved on by [0, 0, 0.341] in the room's frame, taken into this parent's units)
  freezer: [-0.9694, 0.19, 1.3355],
  // (moved on by X 0.215 in the room's frame, taken into this parent's units)
  willow: [0.2534, 0, 0.0272],
  // (the speaker set at X -0.285 Y 0.518 Z 0.169, the red lantern raised 0.25, in the room's frame)
  speaker: [0.3044, 0.518, 0.1309],
  chochin: [0, 0.25, 0],
  sake: [0.084, 0, 0.118],
  sake2: [0.084, 0, 0.118],
  // (the charcoal basket: moved by [0.273, 0.125, 0.082] in the room's frame, taken into the parent's units; its 1.75 size and 44° turn are Decor's)
  crate: [-0.0941, 0.125, -0.2691],
  // (the lantern: moved by [-0.083, 0, -0.651] in the room's frame, taken into this parent's units; its 12° turn is Decor's)
  lantern: [-0.478, 0, 0.4497],
  // (the dish rack: moved by [-0.871, 0, -2.135] in the room's frame, taken into this parent's units; its 1.03 size is Decor's)
  platerack: [-1.2158, 0, 1.9593],
  // (the till's things, where the owner set them in the edit panel (the room's frame: register X 0.025 Z 0.28, tablet Z -0.641, pens X 0.159
  // Z 0.512, printer X 0.03, bell X 0.286, cat X 0.06 Z -0.014), taken into each one's parent's own units; the tablet, pens, printer and
  // card reader raised 0.15 onto the hinoki stand)
  'till-register': [0.2116, 0, -0.1851],
  'till-ipad': [-0.5181, 0.15, 0.3774],
  'till-pens': [0.3202, 0.15, -0.43],
  'till-printer': [-0.0059, 0.15, -0.008],
  'till-card': [0, 0.15, 0],
  // (the bell moved on by X 0.012 Z -0.031, the printer by X -0.02, in the room's frame)
  'till-bell': [-0.2005, 0, -0.2226],
  'till-cat': [-0.0466, 0, -0.0403],
  'till-tray': [-0.2353, 0, 0.6064],
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
/** where a piece's pivot is moved to from its middle (its own frame) */
export const pivotOf = (id: string): V3 => state.pivots[id] ?? [0, 0, 0]
/** the pivot moved to v, and the piece's place moved by `shift` with it (so the piece itself stays where it is, turned or sized as it is) */
export function setPivot(id: string, v: V3, shift: V3 = [0, 0, 0]) {
  state.pivots = { ...state.pivots, [id]: v }
  const o = state.offsets[id] ?? [0, 0, 0]
  state.offsets = { ...state.offsets, [id]: [o[0] + shift[0], o[1] + shift[1], o[2] + shift[2]] }
  emit()
}
/** D: the arrows move the pivot instead of the piece (as Maya's D), again to move the piece */
export function togglePivotMode() { state.pivotMode = !state.pivotMode; emit() }
/** the axes gone by: the room's or the piece's own */
/** world or object axes; said so whenever it changes (the badge in the panel says which it is all the while) */
export function setSpace(s: Space) { if (state.space === s) return; state.space = s; emit(); toast(s === 'world' ? T().spaceNowWorld : T().spaceNowLocal, 'edit') }
// ---- frozen zeros (Maya's Freeze Transformations): a piece's place, turn and size as they stand taken for its new 0, 0, 0 / 1, 1, 1. The piece
// doesn't move: only what the panel reads and takes is counted from there (kept in the browser, with the rest of the edits)
const KEY_F = 'jgs-edit-frozen-1'
type Frozen = { o: Record<string, V3>; r: Record<string, V3>; s: Record<string, V3> }
let frozen: Frozen = (() => { try { return { o: {}, r: {}, s: {}, ...JSON.parse(localStorage.getItem(KEY_F) ?? '{}') } } catch { return { o: {}, r: {}, s: {} } } })()
const saveFrozen = () => { try { localStorage.setItem(KEY_F, JSON.stringify(frozen)) } catch { /* storage blocked */ } }
/** the zero a piece's readings are counted from */
export const zeroOf = (id: string) => ({ o: frozen.o[id] ?? [0, 0, 0] as V3, r: frozen.r[id] ?? [0, 0, 0] as V3, s: frozen.s[id] ?? [1, 1, 1] as V3 })
/** the selected piece's (or group's) place, turn and size as they stand made its zero */
export function freezeSelected(id: string | null = state.selected) {
  if (!id) return
  frozen = { o: { ...frozen.o, [id]: offsetOf(id) }, r: { ...frozen.r, [id]: rotationOf(id) }, s: { ...frozen.s, [id]: scaleOf(id) } }
  saveFrozen(); emit()
  toast(T().frozen, 'edit')
}
export const rotationOf = (id: string): V3 => state.groups[id] ? state.groups[id].r ?? [0, state.groups[id].yaw, 0] : state.rotations[id] ?? [0, 0, 0]
export const scaleOf = (id: string): V3 => state.groups[id] ? [state.groups[id].s, state.groups[id].s, state.groups[id].s] : state.scales[id] ?? [1, 1, 1]
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.offsets))
    localStorage.setItem(KEY_R, JSON.stringify(state.rotations))
    localStorage.setItem(KEY_S, JSON.stringify(state.scales))
    localStorage.setItem(KEY_G, JSON.stringify(state.groups))
    localStorage.setItem(KEY_P, JSON.stringify(state.pivots))
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
  if (!prev) { toast(T().noUndo); return }
  future.push(take())
  put(prev)
  save()
  emit()
}
export function redo() {
  const next = future.pop()
  if (!next) { toast(T().noRedo); return }
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
  if (state.groups[id]) state.groups = { ...state.groups, [id]: { ...state.groups[id], yaw: v[1], r: v } }
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
  frozen = { o: {}, r: {}, s: {} }
  saveFrozen()
  beginChange(); state.offsets = {}; state.rotations = {}; state.scales = {}
  state.groups = Object.fromEntries(Object.entries(state.groups).map(([k, g]) => [k, { ...g, t: [0, 0, 0] as V3, yaw: 0, s: 1, r: [0, 0, 0] as V3 }]))
  save(); emit()
}
export const select = (id: string | null) => { state.selected = id; emit() }
/** which handles the selected piece shows: arrows to move it, rings to turn it, boxes to scale it */
export function setTool(t: Tool) {
  if (!state.on || state.tool === t) return
  state.tool = t
  emit()
  toast(T().tools[t], 'edit')
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
  toast(scaleAxis === null ? T().scaleAll : T().scaleOne('XYZ'[scaleAxis]), 'edit')
}

/** what can be moved: each piece says what it's called and how to bring the camera to it */
const registry = new Map<string, { label: string; focus: () => void; center?: () => V3 | null; parent?: string | null }>()
/** `center`: where the piece's middle is in the world (what a group of it turns and grows about); a piece without one can't be grouped.
 * `parent`: the piece it sits inside (a Movable within another), which the outliner lists it under, as Maya's does */
export function registerMovable(id: string, label: string, focus: () => void, center?: () => V3 | null, parent?: string | null) {
  registry.set(id, { label, focus, center, parent })
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
  if (ids.length < 2) { toast(T().needTwo); return }
  const pts = ids.map((id) => registry.get(id)!.center!()).filter((v): v is V3 => !!v)
  const pivot = (pts.length ? [0, 1, 2].map((k) => pts.reduce((a, v) => a + v[k], 0) / pts.length) : [0, 0, 0]) as V3
  beginChange()
  let n = ++groupSeq
  while (state.groups[`grp${n}`]) n = ++groupSeq
  const id = `grp${n}`
  state.groups = { ...state.groups, [id]: { name: T().groupName(n), members: ids, pivot, t: [0, 0, 0], yaw: 0, s: 1 } }
  state.picked = []
  state.selected = id
  save(); emit()
  toast(T().grouped(ids.length, state.groups[id].name), 'edit')
}
export function dissolveGroup(id: string | null = state.selected) {
  if (!id || !state.groups[id]) return
  beginChange()
  const { [id]: _g, ...rest } = state.groups
  state.groups = rest
  if (DEFAULT_GROUPS[id]) try { localStorage.setItem(KEY_GD, JSON.stringify([...dropped(), id])) } catch { /* storage blocked */ }
  state.selected = null
  save(); emit()
  toast(T().ungrouped, 'edit')
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
  leave(T().confirmed)
}
/** 取消: back to how it all was before editing began */
export function cancelEdit() {
  if (!state.on) return
  const changed = baseline ? JSON.stringify(baseline) !== snap() : false
  revert()
  leave(changed ? T().cancelled : T().left)
}
export function toggleEdit() {
  if (state.locked) { toast(T().locked); return }
  if (state.on) { cancelEdit(); return }
  settleGroups()
  state.wire = false
  baseline = take()
  state.on = true
  state.selected = null
  state.picked = []
  state.tool = 'move'
  emit()
  toast(T().entered, 'edit')
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
/** and the piece's own frame (its parent's, turned by its own turn about the vertical): what the object axes go by */
const framesObj = new Map<string, number>()
export const setFrame = (id: string, theta: number, own?: number) => { frames.set(id, theta); if (own !== undefined) framesObj.set(id, own) }
const turnY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
/** the turn (about the vertical) the panel's place goes by: the world's (world space) or the piece's own (object space), into its parent's frame */
const frameFor = (id: string) => (state.space === 'local' ? framesObj.get(id) ?? 0 : frames.get(id) ?? 0)
export const toRoom = (id: string, v: V3): V3 => turnY(v, -frameFor(id))
/** what the panel shows: the place, turn and size counted from the piece's zero */
const readLoc = (id: string): V3 => { const o = offsetOf(id), z = zeroOf(id).o; return toRoom(id, [o[0] - z[0], o[1] - z[1], o[2] - z[2]]) }
const readRot = (id: string): V3 => { const r = rotationOf(id), z = zeroOf(id).r; return [r[0] - z[0], r[1] - z[1], r[2] - z[2]] }
const readScale = (id: string): V3 => { const sc = scaleOf(id), z = zeroOf(id).s; return [sc[0] / (z[0] || 1), sc[1] / (z[1] || 1), sc[2] / (z[2] || 1)] }
export const fromRoom = (id: string, v: V3): V3 => turnY(v, frameFor(id))
/** wireframe (Maya's 4) or shaded (5) */
export function setWire(on: boolean) { if (state.wire === on) return; state.wire = on; emit(); toast(on ? T().wireOn : T().wireOff, 'edit') }
/** what a piece is made of (its triangles, vertices and meshes), told by the piece once edit mode opens: for the panel */
const stats = new Map<string, { tris: number; verts: number; meshes: number }>()
export const setStats = (id: string, st: { tris: number; verts: number; meshes: number }) => { stats.set(id, st); panel() }
export const statsOf = (id: string) => {
  const g = state.groups[id]
  if (!g) return stats.get(id) ?? null
  const ms = g.members.map((m) => stats.get(m)).filter((x): x is { tris: number; verts: number; meshes: number } => !!x)
  return ms.length ? ms.reduce((a, b) => ({ tris: a.tris + b.tris, verts: a.verts + b.verts, meshes: a.meshes + b.meshes })) : null
}
let el: HTMLDivElement | null = null
let spaceBadge: HTMLButtonElement | null = null
let info: HTMLDivElement | null = null
let fields: HTMLInputElement[] = []
let toolButtons: HTMLButtonElement[] = []
let spaceButton: HTMLButtonElement | null = null, pivotButton: HTMLButtonElement | null = null
let rows = new Map<string, HTMLDivElement>()
let summary: HTMLDivElement | null = null
let built = ''

/** the panel's look: after Blender's dark interface (grey panels, a darker header bar, blue for what's active, red/green/blue axis stripes) */
const PANEL_CSS = `
.be { position:fixed; left:12px; bottom:92px; z-index:9999; width:292px; max-height:70vh; display:flex; background:#303030; color:#d6d6d6;
  font:11.5px/1.35 "Inter","Segoe UI","Noto Sans TC",sans-serif; border:1px solid #1a1a1a; border-radius:6px; box-shadow:0 6px 22px rgba(0,0,0,.55); overflow:hidden; user-select:none }
.be * { box-sizing:border-box }
.be-space { display:block; width:100%; margin:0 0 6px; padding:5px 8px; border:0; border-radius:4px; text-align:left; cursor:pointer;
  font:600 12px/1.3 inherit; color:#fff; background:#2f6fb0 }
.be-space.local { background:#c27a1e }
.be-space:hover { filter:brightness(1.12) }
.be-tool-text { background:#2f6fb0 !important; color:#fff !important }
.be-tool-text.local { background:#c27a1e !important }
.be-stats { margin-top:3px; font:11px monospace; color:#9ab }
.be-tools { display:flex; flex-direction:column; gap:3px; padding:6px 4px; background:#262626; border-right:1px solid #1a1a1a }
.be-tool { width:30px; height:30px; display:grid; place-items:center; background:#3c3c3c; border:0; border-radius:4px; color:#d6d6d6; cursor:pointer; padding:0 }
.be-tool svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round }
.be-tool:hover { background:#4d4d4d }
.be-tool.on { background:#4772b3; color:#fff }
.be-tool-text { font:700 13px/1 system-ui, sans-serif }
.be-tool-gap { height:8px; border-bottom:1px solid #4a4a4a; margin-bottom:4px }
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
  select: '<svg viewBox="0 0 24 24"><path d="M6 3l12 9-5.5 1.2L16 20l-2.6 1.2-3.2-6.9L6 18z"/></svg>',
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
  const sig = [...registry].map(([k, r]) => `${k}<${r.parent ?? ''}`).join('|') + '#' + Object.entries(state.groups).map(([k, g]) => `${k}:${g.name}:${g.members.join(',')}`).join(';')
  if (!el || built !== sig) {
    el?.remove()
    el = document.createElement('div')
    el.className = 'be'
    const h = (tag: string, cls?: string, text?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
    // the tool bar down the left edge: Move (W), Rotate (R), Scale (S)
    const bar = h('div', 'be-tools')
    toolButtons = (['select', 'move', 'rotate', 'scale'] as Tool[]).map((t) => {
      const b = h('button', 'be-tool') as HTMLButtonElement
      b.innerHTML = TOOL_ICONS[t]
      b.title = T().tools[t]
      b.onclick = () => setTool(t)
      bar.appendChild(b)
      return b
    })
    // (and below the tools: the axes gone by (the room's or the piece's own), and the pivot mode)
    bar.appendChild(h('div', 'be-tool-gap'))
    spaceButton = h('button', 'be-tool be-tool-text') as HTMLButtonElement
    spaceButton.onclick = () => setSpace(state.space === 'local' ? 'world' : 'local')
    pivotButton = h('button', 'be-tool be-tool-text') as HTMLButtonElement
    pivotButton.onclick = togglePivotMode
    bar.append(spaceButton, pivotButton)
    const main = h('div', 'be-main')
    const head = h('div', 'be-head', T().title)
    head.appendChild(h('small', '', T().keys))
    const body = h('div', 'be-body')
    const section = (title: string) => {
      const sec = h('div', 'be-sec'), st = h('div', 'be-st', title), sc = h('div', 'be-sc')
      st.onclick = () => sec.classList.toggle('shut')
      sec.append(st, sc)
      body.appendChild(sec)
      return sc
    }
    // Outliner: every piece that can be taken hold of, a search above, the chosen one lit
    const out = section(T().outliner)
    summary = h('div', 'be-sum') as HTMLDivElement
    out.appendChild(summary)
    const find = h('input', 'be-find') as HTMLInputElement
    find.placeholder = T().find
    const list = h('div', 'be-list')
    rows = new Map()
    // (the groups first, each with its members under it; then every piece not in one)
    const addRow = (id: string, label: string, depth: number, group: boolean) => {
      const row = h('div', `be-row${group ? ' be-grow' : ''}`, (depth > 0 && !group ? '└ ' : '') + label)
      if (depth) row.style.paddingLeft = `${12 + depth * 16}px`
      row.title = group ? T().rowGroup : T().rowPiece
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
    // (each piece followed by the pieces inside it, a step further in, as an outliner's hierarchy)
    const childrenOf = (id: string) => [...registry].filter(([, r]) => r.parent === id).map(([k]) => k)
    const addTree = (id: string, depth: number) => {
      addRow(id, pieceName(registry.get(id)!.label, lang), depth, false)
      for (const k of childrenOf(id)) if (!groupOf(k)) addTree(k, depth + 1)
    }
    for (const [gid, g] of Object.entries(state.groups)) {
      addRow(gid, `${g.name}（${g.members.length}）`, 0, true)
      for (const m of g.members) if (registry.has(m)) addTree(m, 1)
    }
    for (const [id, r] of registry) if (!groupOf(id) && !(r.parent && registry.has(r.parent))) addTree(id, 0)
    find.oninput = () => { const q = find.value.trim().toLowerCase(); for (const [id, row] of rows) row.style.display = !q || (rows.get(id)?.textContent ?? id).toLowerCase().includes(q) ? '' : 'none' }
    out.append(find, list)
    // Transform: what's chosen, then Location, Rotation, Scale each as X / Y / Z stacked, a reset beside each
    const tr = section(T().transform)
    // (which axes the handles and the place fields go by, always in sight, a click switches them)
    spaceBadge = h('button', 'be-space') as HTMLButtonElement
    spaceBadge.onclick = () => setSpace(state.space === 'local' ? 'world' : 'local')
    tr.appendChild(spaceBadge)
    info = h('div', 'be-name') as HTMLDivElement
    tr.appendChild(info)
    fields = []
    const group = (label: string, step: string, get: (id: string) => V3, set: (id: string, v: V3) => void, rest: V3, stepper = false) => {
      const g = h('div', 'be-grp'), gl = h('div', 'be-gl', label)
      const back = h('button', '', '↺') as HTMLButtonElement
      back.title = T().resetRow(label)
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
          minus.title = T().shrink(axis); plus.title = T().grow(axis)
          minus.onclick = () => nudgeScale(-1, k as 0 | 1 | 2); plus.onclick = () => nudgeScale(1, k as 0 | 1 | 2)
          f.append(minus, plus)
          f.firstElementChild!.addEventListener('click', () => setScaleAxis(k as 0 | 1 | 2))
          ;(f.firstElementChild as HTMLElement).style.cursor = 'pointer'
          ;(f.firstElementChild as HTMLElement).title = T().pickAxis(axis)
        }
        g.appendChild(f)
        fields.push(inp)
      })
      tr.appendChild(g)
    }
    // (each read from the piece's zero (its frozen place, turn and size, if it has one) and written back onto it)
    group(T().location, '0.01', readLoc, (id, v) => { const z = zeroOf(id).o, w = fromRoom(id, v); moveTo(id, [w[0] + z[0], w[1] + z[1], w[2] + z[2]]) }, [0, 0, 0])
    group(T().rotation, '5', readRot, (id, v) => { const z = zeroOf(id).r; turnTo(id, [v[0] + z[0], v[1] + z[1], v[2] + z[2]]) }, [0, 0, 0])
    group(T().scale, '0.05', readScale, (id, v) => { const z = zeroOf(id).s; scaleTo(id, [v[0] * z[0], v[1] * z[1], v[2] * z[2]]) }, [1, 1, 1], true)
    const foot = h('div', 'be-foot')
    const mk = (text: string, title: string, fn: () => void, cls = '') => {
      const b = h('button', cls, text) as HTMLButtonElement
      b.title = title
      b.onclick = fn
      return b
    }
    foot.append(
      mk(T().freeze, T().freezeTip, () => freezeSelected()),
      mk(T().group, T().groupTip, makeGroup),
      mk(T().ungroup, T().ungroupTip, () => dissolveGroup()),
      mk(T().rename, T().renameTip, () => { const g = state.selected ? state.groups[state.selected] : null; if (g) { const n = window.prompt(T().renamePrompt, g.name); if (n) renameGroup(state.selected!, n) } }),
      mk(T().undo, 'Ctrl+Z', undo), mk(T().redo, 'Ctrl+Y', redo),
      mk(T().resetAll, T().resetAllTip, () => { if (window.confirm(T().resetAllAsk)) resetAll() }, 'warn'),
      mk(T().cancel, T().cancelTip, () => cancelEdit()),
      mk(T().confirm, T().confirmTip, () => confirmEdit(), 'ok'),
    )
    main.append(head, body, foot)
    el.append(bar, main)
    document.body.appendChild(el)
    built = sig
  }
  ;(['select', 'move', 'rotate', 'scale'] as Tool[]).forEach((t, k) => toolButtons[k]?.classList.toggle('on', state.tool === t))
  if (spaceBadge) {
    spaceBadge.textContent = state.space === 'world' ? T().spaceBadgeWorld : T().spaceBadgeLocal
    spaceBadge.title = T().spaceBadgeTip
    spaceBadge.classList.toggle('local', state.space === 'local')
  }
  if (spaceButton) spaceButton.classList.toggle('local', state.space === 'local')
  if (spaceButton) { spaceButton.textContent = state.space === 'local' ? T().spaceLocalShort : T().spaceWorldShort; spaceButton.title = state.space === 'local' ? T().spaceLocal : T().spaceWorld }
  if (pivotButton) { pivotButton.textContent = 'D'; pivotButton.title = T().pivot; pivotButton.classList.toggle('on', state.pivotMode) }
  for (const [id, row] of rows) { row.classList.toggle('on', state.selected === id); row.classList.toggle('multi', state.picked.includes(id)) }
  if (summary) {
    // (how much furniture there is: every piece that can be taken hold of, how many have been moved, turned or sized from where they began, and the groups)
    const pieces = [...registry.keys()]
    const moved = pieces.filter((id) => offsetOf(id).some((v) => Math.abs(v) > 1e-6) || rotationOf(id).some((v) => Math.abs(v) > 1e-6) || scaleOf(id).some((v) => Math.abs(v - 1) > 1e-6)).length
    summary.textContent = T().summary(pieces.length, moved, Object.keys(state.groups).length)
  }
  el?.querySelectorAll('.be-grp:last-of-type .be-f').forEach((f, k) => f.classList.toggle('axon', scaleAxis === k))
  if (info) {
    const id = state.selected
    const r = id ? registry.get(id) : null
    info.innerHTML = id ? `${state.groups[id] ? '▣ ' + state.groups[id].name + T().groupMark : r ? pieceName(r.label, lang) : id}` : `<em>${T().nothing}</em>`
    const st = id ? statsOf(id) : null
    if (st) info.innerHTML += `<div class="be-stats">${T().stats(st.tris, st.verts, st.meshes)}</div>`
    const values = id ? [...readLoc(id), ...readRot(id), ...readScale(id)] : []
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
    if (state.on && !typing) {
      const k = e.key.toLowerCase()
      // (X, Y, Z choose the axis the + and - keys scale along (again, all three together); + and - scale the chosen piece)
      if (k === 'x' || k === 'y' || k === 'z') { e.preventDefault(); setScaleAxis(({ x: 0, y: 1, z: 2 } as const)[k]); return }
      if (k === '+' || k === '=') { e.preventDefault(); nudgeScale(1); return }
      if (k === '-' || k === '_') { e.preventDefault(); nudgeScale(-1); return }
      if (k === 'd') { e.preventDefault(); togglePivotMode(); return }
      // (as in Maya: Q select, W move, E rotate, R scale; the tool's key pressed again while it's on flips its axes between the world's and the
      // object's own, as Maya's W/E held for its marking menu does; 4 the wireframe, 5 shaded)
      const t: Tool | null = k === 'q' ? 'select' : k === 'w' ? 'move' : k === 'e' ? 'rotate' : k === 'r' ? 'scale' : null
      if (t) {
        e.preventDefault()
        if (t === state.tool && t !== 'select') setSpace(state.space === 'local' ? 'world' : 'local')
        else setTool(t)
        return
      }
      if (k === '4') { e.preventDefault(); setWire(true); return }
      if (k === '5') { e.preventDefault(); setWire(false); return }
    }
    if (e.key !== 'g' && e.key !== 'G') return
    const t = e.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return
    toggleEdit()
  })
  if (import.meta.env?.DEV) (window as unknown as { __edit?: unknown }).__edit = { get: getEdit, moveTo, select, toggle: toggleEdit, confirm: confirmEdit, cancel: cancelEdit, setLocked, undo, redo, setTool, frame: (id: string) => frames.get(id) }
}
