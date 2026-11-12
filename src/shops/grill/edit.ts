// The shop's edit mode: press G while the shop is shut and its furnishings can be moved about by hand (see Movable). Each moved piece's
// offset is kept in the browser. While the shop is open it can't be switched on (and is switched off if the shop opens), since customers and
// staff are walking about. Here: the state, the key, the panel at the screen's corner, and the list of what can be moved.

import { isMac } from '@/game/navInput'
import { useSyncExternalStore } from 'react'
import { clearAllRenderPrefs, clearRenderPref, onRenderPrefs, renderPrefOf, setRenderPref } from './renderPrefs'
import { RENDER_DEFAULT, type RenderPref } from '@/game/renderPrefs'
import { EDIT_TEXT, pieceName } from '@/data/editText'
import type { Lang } from '@/data/i18n'
import { VIEW_SPOTS } from '@/data/views'
import { applyGroup, areasOf, chainOf, isStill, leavesOf, parentOf, ROOM_TURN, undoGroup, within, type ViewCam } from '@/game/editGroups'
import { glowOnly, HOVER } from '@/scene/hoverGlow'
import { setTip } from '@/scene/hoverTip'
import { GRILL_SEATS } from './bar'
import { replaces } from '@/scene/hot'
import { glyphSvg, type GlyphId } from '@/ui/glyphs'
/** a drawn icon (ui/glyphs) put in front of a button's or label's words, never an emoji or a symbol (the owner's) */
const withGlyph = (el: HTMLElement, id: GlyphId, text = '', size = 12) => { el.innerHTML = glyphSvg(id, size); if (text) el.append(' ' + text) }

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
const KEY = 'jgs-edit-offsets-14'
const KEY_R = 'jgs-edit-rotations-11'
const KEY_S = 'jgs-edit-scales-11'
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
/** a metre further along the wall, the same way as the 3.4 before it (unit (-0.8085, 0, 0.5891)) */
const CATS_SHIFT_3: V3 = [-0.8085, 0, 0.5891]
/** groups the shop comes with (the owner's own are added to them): the door's cat stand with its four cats; their pivot is found the first time
 * edit mode opens, once the pieces have been measured. `spans`: it runs across the room, in no one view's area (see groupByViews) */
const DEFAULT_GROUPS: Record<string, { zh: string; ja: string; members: string[]; spans?: boolean; t?: V3 }> = {
  // (it and the shrine moved 3.4 along the wall toward the round window (the owner's, 2026-11-11), the waiting bench in their place: GENKAN_SHIFT;
  // the stand a metre further along the same way (the owner's, 2026-11-12, room for a second bench): CATS_SHIFT_3)
  'grp-doorcats': { zh: '門口招財貓組', ja: '玄関の招き猫', members: ['doorcats', 'doorcat0', 'doorcat1', 'doorcat2', 'doorcat3', 'koban'], t: [-2.749 + CATS_SHIFT_3[0], 0, 2.003 + CATS_SHIFT_3[2]] },
  // (the shrine's shelf and everything on it: the shrine, the Ebisu, the vases, the cups, the sutra, the flask and the oranges ride on its fittings)
  // (the samurai helmet on its own little stand by the staff's door (the owner's, 2026-11-12): moved together)
  'grp-kabuto': { zh: '頭盔與木台', ja: '兜と飾り台', members: ['kabutostand', 'kabuto'] },
  'grp-altar': { zh: '小神龕組', ja: '神棚', members: ['altar', 'altarfittings'], t: [-2.749, 0, 2.003] },
  // (the till and all of it: the counter, what stands on it and in it, its two seats, to be moved, turned and sized as one)
  'grp-till': { zh: '收銀櫃組', ja: 'レジ一式', members: ['till-counter', 'till-register', 'till-card', 'till-printer', 'till-tray', 'till-pens', 'till-bell',
    'till-mat', 'till-ingot', 'till-tree', 'till-cat', 'till-manual', 'till-ipad', 'till-stool-hi', 'till-stool-lo'] },
  // (the customers' stools, the length of the bars: the views' cameras each see a few of them, so left out of their areas and kept together)
  'grp-stools': { zh: '吧台座椅', ja: 'カウンター席', members: Array.from({ length: GRILL_SEATS.length }, (_, n) => `stool${n}`), spans: true },
  // (each part of the shop kept together, as the owner asked (2026-11-11: every piece in its area's group, the warmer and the rice ball
  // counter as one): the warmer with its miso pot and the rice ball counter with its cooker, side by side between the cook table and the till)
  'grp-ricestation': { zh: '料理台組', ja: '調理台一式', members: ['warmer', 'misopot', 'prepcounter', 'denkinabe'] },
  // (the sink and all that's on it and by it)
  'grp-sink': { zh: '流理台組', ja: '流し一式', members: ['sink', 'sink-basket', 'sink-scrub', 'sink-soap', 'sink-towel', 'sink-bin', 'sink-detergent', 'sink-sponge'] },
  'grp-racks': { zh: '碗盤架組', ja: '食器棚', members: ['platerack', 'platerack2'] },
  // (the rice sacks in the kitchen's corner, and the old rice tub and stove set aside by them)
  // (the old rice tub gone from it: it's the warming tub on the takeaway table now)
  'grp-ricecorner': { zh: '米袋與舊飯桶', ja: '米袋と飯桶', members: ['ricesacks', 'hagama'] },
  'grp-wc-m': { zh: '男廁組', ja: '男子トイレ一式', members: ['wc2-m-noren', 'wc2-m-basin', 'wc2-m-moss', 'wc2-m-dryer', 'wc2-m-towelbox', 'wc2-m-duck', 'wc2-m-lamp', 'wc2-m-toilet', 'wc2-m-remote3', 'wc2-m-paper', 'wc2-m-brush', 'wc2-m-lamp2', 'wc-m-slippers'] },
  'grp-wc-f': { zh: '女廁組', ja: '女子トイレ一式', members: ['wc2-f-noren', 'wc2-f-basin', 'wc2-f-vase', 'wc2-f-dryer', 'wc2-f-towelbox', 'wc2-f-duck', 'wc2-f-lamp', 'wc2-f-toilet', 'wc2-f-remote3', 'wc2-f-oto', 'wc2-f-brush', 'wc2-f-paper', 'wc2-f-bin', 'wc2-f-pads', 'wc2-f-lamp2', 'wc-f-slippers'] },
}
const unsettled = new Set<string>()
/** the groups the owner has broken up (the shop's own, and the views' areas): not made again (kept here too, for when storage is blocked) */
const KEY_GD = 'jgs-edit-groups-dropped'
const droppedNow = new Set<string>()
const dropped = (): string[] => { try { return [...new Set([...JSON.parse(localStorage.getItem(KEY_GD) ?? '[]'), ...droppedNow])] } catch { return [...droppedNow] } }
const drop = (id: string) => { droppedNow.add(id); try { localStorage.setItem(KEY_GD, JSON.stringify(dropped())) } catch { /* storage blocked */ } }
/** the views' areas: a group each, made by groupByViews */
export const AREA = 'grp-view-'
export const isArea = (id: string | null) => !!id && id.startsWith(AREA)
/** pieces taken out of the shop (the owner's): the till's plain cash box, the string of bulbs, the strings of banners and the banners on the
 * walls; and the light switch by the round window (it's by the way in now, with others: new pieces), and the toilets' wide switches by their
 * doors' outer sides (slim ones on the post between the doors now: new pieces); any group kept in the browser lets them go */
const RETIRED = (id: string) => id === 'till-cashbox' || id === 'lightswitch' || /^lightswitch-wc-/.test(id) || /^wcswitch-[mf]$/.test(id) || /^(festoon|banners|nobori)/.test(id)
const loadGroups = (): Record<string, Group> => {
  let g: Record<string, Group> = {}
  try { g = JSON.parse(localStorage.getItem(KEY_G) ?? '{}') } catch { /* storage blocked */ }
  for (const [k, x] of Object.entries(g)) if (x.members.some(RETIRED)) g[k] = { ...x, members: x.members.filter((m) => !RETIRED(m)) }
  // (the helmet off the cats' stand, onto its own stand by the staff's door (the owner's, 2026-11-12): out of whatever kept group held it, once;
  // it and its stand are a group of their own then (DEFAULT_GROUPS' grp-kabuto))
  try {
    if (!localStorage.getItem('jgs-edit-kabuto-out-1')) {
      for (const [k, x] of Object.entries(g)) if (k !== 'grp-kabuto' && x.members.includes('kabuto')) g[k] = { ...x, members: x.members.filter((m) => m !== 'kabuto') }
      localStorage.setItem('jgs-edit-kabuto-out-1', '1')
    }
  } catch { /* storage blocked */ }
  // (the views' areas planned again from where everything is now, once (the owner's, 2026-11-12: after the pieces were moved about): the old
  // areas broken up (their pieces and groups loose again, nothing else changed) and what they'd been made with forgotten, so the next time edit
  // mode opens each view's area is made afresh (groupByViews))
  try {
    // (the keys by name: this runs as the module loads, before KEY_AK's line below)
    if (!localStorage.getItem('jgs-edit-areas-replan-1')) {
      for (const k of Object.keys(g)) if (k.startsWith('grp-view-')) delete g[k]
      localStorage.removeItem('jgs-edit-area-known-1')
      localStorage.setItem('jgs-edit-areas-replan-1', '1')
      localStorage.setItem(KEY_G, JSON.stringify(g))
    }
  } catch { /* storage blocked */ }
  // (the old rice tub's id left in a kept group: it's gone)
  for (const [k, x] of Object.entries(g)) if (x.members.includes('ricetub')) g[k] = { ...x, members: x.members.filter((m) => m !== 'ricetub') }
  for (const [id, d] of Object.entries(DEFAULT_GROUPS)) {
    // (not when the owner has already put any of its pieces in a group of their own, or broken it up; a view's area holding them gives them up
    // to it, and holds it in their place)
    const taken = Object.entries(g).some(([k, x]) => !isArea(k) && x.members.some((m) => d.members.includes(m)))
    if (g[id] || taken || dropped().includes(id)) continue
    let home: string | null = null
    for (const [k, x] of Object.entries(g)) {
      if (!isArea(k) || !x.members.some((m) => d.members.includes(m))) continue
      g[k] = { ...x, members: x.members.filter((m) => !d.members.includes(m)) }
      home ??= k
    }
    if (home) g[home] = { ...g[home], members: [...g[home].members, id] }
    g[id] = { name: d.zh, members: d.members, pivot: [0, 0, 0], t: d.t ?? [0, 0, 0], yaw: 0, s: 1 }
    unsettled.add(id)
    made.add(id)
  }
  // (groups a browser kept from before their default place was moved: moved on by as much, once (its key marks it done))
  for (const [key, id] of GENKAN_SHIFT) {
    try { if (localStorage.getItem(key)) continue } catch { continue }
    const d = DEFAULT_GROUPS[id].t
    if (g[id] && d && !made.has(id)) g[id] = { ...g[id], t: [0, 1, 2].map((k) => g[id].t[k] + d[k]) as V3 }
    try { localStorage.setItem(key, '1'); localStorage.setItem(KEY_G, JSON.stringify(g)) } catch { /* storage blocked */ }
  }
  // (a kept cat stand moved on a metre more, once)
  try {
    if (!localStorage.getItem('jgs-edit-groupshift-3')) {
      if (g['grp-doorcats'] && !made.has('grp-doorcats')) g['grp-doorcats'] = { ...g['grp-doorcats'], t: [0, 1, 2].map((k) => g['grp-doorcats'].t[k] + CATS_SHIFT_3[k]) as V3 }
      localStorage.setItem('jgs-edit-groupshift-3', '1'); localStorage.setItem(KEY_G, JSON.stringify(g))
    }
  } catch { /* storage blocked */ }
  // (a kept cat stand from before the coin and the helmet were set on it: they join it, out of whatever else held them, so they go where it goes
  // (the owner's, 2026-11-11: left behind when the stand moved for the bench))
  const cats = g['grp-doorcats']
  if (cats && !dropped().includes('grp-doorcats')) {
    const join = ['koban'].filter((m) => !cats.members.includes(m))
    if (join.length) {
      for (const [k, x] of Object.entries(g)) if (x.members.some((m) => join.includes(m))) g[k] = { ...x, members: x.members.filter((m) => !join.includes(m)) }
      g['grp-doorcats'] = { ...g['grp-doorcats'], members: [...g['grp-doorcats'].members, ...join] }
      try { localStorage.setItem(KEY_G, JSON.stringify(g)) } catch { /* storage blocked */ }
    }
  }
  return g
}
const made = new Set<string>()
/** the default groups whose place was moved since a browser may have kept them (DEFAULT_GROUPS' t): the door's cat stand and the shrine,
 * along the wall to make room for the waiting bench (2026-11-11) */
const GENKAN_SHIFT: [string, string][] = [['jgs-edit-groupshift-1', 'grp-doorcats'], ['jgs-edit-groupshift-2', 'grp-altar']]
/** a point in the world, where it stands inside a group as that group's own pivot is kept (the groups it's in undone, outermost first) */
const intoGroup = (gid: string | null, v: V3): V3 => {
  if (!gid) return v
  return [gid, ...chainOf(state.groups, gid)].reverse().reduce((p, k) => undoGroup(state.groups[k], p), v)
}
const middle = (pts: V3[]): V3 => [0, 1, 2].map((k) => pts.reduce((a, v) => a + v[k], 0) / pts.length) as V3
/** a default group's pivot: the middle of its members, once they've all been measured */
function settleGroups() {
  for (const id of [...unsettled]) {
    const g = state.groups[id]
    if (!g) { unsettled.delete(id); continue }
    const pts = leavesOf(state.groups, id).map((m) => registry.get(m)?.center?.() ?? null)
    if (pts.some((v) => !v)) continue
    // (in the group's own frame, before its own move: taken in its parent's, a group made with a place of its own (the cats' stand, the
    // shrine) had its pivot that far off its pieces, and its handles stood metres away)
    state.groups = { ...state.groups, [id]: { ...g, pivot: intoGroup(id, middle(pts as V3[])) } }
    unsettled.delete(id)
  }
}
/** the axes the arrows, rings and fields go by: the room's (world), or the piece's own (local: its parent's frame, as it stands on its wall) */
export type Space = 'world' | 'local'
type State = { on: boolean; locked: boolean; tool: Tool; offsets: Record<string, V3>; rotations: Record<string, V3>; scales: Record<string, V3>; selected: string | null; groups: Record<string, Group>; picked: string[]
  /** each piece's pivot, moved from its middle by hand (in its own frame), what it turns and grows about; and whether the arrows move the pivot (D) */
  pivots: Record<string, V3>; pivotMode: boolean; space: Space
  /** the scene drawn as its wireframe (Maya's 4), to see each model's topology; off is shaded (5) */
  wire: boolean
  /** pieces hidden by hand for now (H), to reach and see what's behind them: not drawn, not picked; Alt+H or leaving the mode shows them */
  hidden: string[] }
/** offsets made defaults (BASES) since they were set by hand: a browser still holding just that offset drops it, so it isn't counted twice
 * (the rest it holds are kept, as a new KEY would lose them) */
const SETTLED: Record<string, V3> = { oranges: [0.0275, 0, 0], shrinecups: [0.0502, 0, 0], willow: [-0.465, 0, -0.367] }
/** offsets made defaults by how far they went, whichever way the panel's axes ran when they were set (the way-in switches moved 0.54 along
 * their wall by the owner, then made so) */
const SETTLED_BY: Record<string, number> = { 'lightswitch-room': 0.54, 'lightswitch-door': 0.54 }
/** pieces laid out afresh, or put back, since a browser may have moved them by hand: what it held for them (where, how turned, how big) is
 * dropped, once each (its key marks it done): the rice tub, the miso pot, the rice pot and the cooker put up on the warming counter
 * (2026-11-09); the till's beckoning cat, flown off its corner of the till (the owner's: put it back, 2026-11-10) */
const RELAIDS: [string, string[]][] = [
  ['jgs-edit-relaid-2', ['ricetub', 'misopot', 'hagama', 'denkinabe', 'warmer']],
  ['jgs-edit-relaid-3', ['till-cat']],
  // (the shoe cupboard and the waiting bench, laid out afresh about the genkan (2026-11-11))
  ['jgs-edit-relaid-4', ['shoecab', 'bench']],
  // (the warming counter moved up by the till, the rice-ball counter and the cooker where it stood, the tub and the old rice pot put by
  // (2026-11-11))
  ['jgs-edit-relaid-5', ['warmer', 'misopot', 'denkinabe', 'ricetub', 'hagama']],
  // (the warmer cut to half, the rice-ball counter and its cooker pushed up against it (2026-11-11))
  ['jgs-edit-relaid-6', ['warmer', 'misopot', 'prepcounter', 'denkinabe']],
  // (the binchotan sack moved to the corner under the charcoal crate (2026-11-11))
  ['jgs-edit-relaid-7', ['coalsack']],
  // (the binchotan sack's place moved 0.4 along as the owner set it by hand: what's held for it dropped, it stands there now)
  ['jgs-edit-relaid-8', ['coalsack']],
  // (the shrine's lanterns forward, in and smaller, beside the cups' shortened stand (2026-11-11))
  ['jgs-edit-relaid-9', ['shrinelamp-1', 'shrinelamp1']],
  // (the oranges two plates in by the cups, the lanterns out a little, the table shallower (2026-11-11))
  ['jgs-edit-relaid-10', ['oranges', 'oranges2', 'shrinelamp-1', 'shrinelamp1', 'shrinecups']],
  // (the cups' stand 5 cm along as the owner set it, the offerings on their stands (2026-11-11))
  ['jgs-edit-relaid-11', ['shrinecups', 'oranges', 'oranges2']],
  // (the cups' stand where the owner set it by hand, 5.5 cm along and 6.6 cm in (2026-11-11))
  ['jgs-edit-relaid-12', ['shrinecups']],
  // (the speaker 5 cm along its width as the owner set it (2026-11-12))
  ['jgs-edit-relaid-13', ['speaker']],
  // (the cats' stand a step higher, the koban on top, the big cats forward of the step (2026-11-12))
  ['jgs-edit-relaid-14', ['doorcat0', 'doorcat1', 'koban']],
  // (the tissues and cleaning things set at X -0.2, Z -0.095 in the room's frame as the owner said, made the default and the held one dropped (2026-11-12))
  ['jgs-edit-relaid-15', ['supplies']],
  // (and on to X -0.38 (the owner's, 2026-11-12), made the default and the held one dropped again)
  ['jgs-edit-relaid-16', ['supplies']],
  // (the helmet off the cats' stand onto its own by the staff's door (the owner's, 2026-11-12): its place as kept was in the stand's frame)
  ['jgs-edit-relaid-17', ['kabuto']],
  // (the cats' stand's top step deeper and shorter, the big cats either side of it, the koban in its middle (the owner's, 2026-11-12))
  ['jgs-edit-relaid-18', ['doorcat0', 'doorcat1', 'koban']],
]
const relaidDue = RELAIDS.filter(([k]) => { try { return !localStorage.getItem(k) } catch { return false } })
const relaid = !relaidDue.length
const dropRelaid = (o: Record<string, V3>) => { for (const [, ids] of relaidDue) for (const id of ids) delete o[id]; return o }
const loadOffsets = () => {
  const o = dropRelaid(load(KEY))
  for (const [id, v] of Object.entries(SETTLED)) if (o[id]?.every((x, i) => Math.abs(x - v[i]) < 0.002)) delete o[id]
  for (const [id, d] of Object.entries(SETTLED_BY)) if (o[id] && Math.abs(Math.hypot(...o[id]) - d) < 0.01 && Math.abs(o[id][1]) < 0.002) delete o[id]
  return o
}
/** and turns made defaults (a Movable's baseTurn) since they were set by hand: the fish lantern's quarter turn (the owner's) */
const SETTLED_R: Record<string, V3> = { fishlantern: [0, -90, 0] }
/** and sizes made defaults (a Movable's baseScale) since they were set by hand: the fish lantern 1.3 times as big (the owner's) */
const SETTLED_S: Record<string, V3> = { fishlantern: [1.3, 1.3, 1.3] }
const loadScales = () => {
  const o = dropRelaid(load(KEY_S))
  for (const [id, v] of Object.entries(SETTLED_S)) if (o[id]?.every((x, i) => Math.abs(x - v[i]) < 0.01)) delete o[id]
  return o
}
const loadRotations = () => {
  const o = dropRelaid(load(KEY_R))
  for (const [id, v] of Object.entries(SETTLED_R)) if (o[id]?.every((x, i) => Math.abs(x - v[i]) < 0.5)) delete o[id]
  return o
}
// (written back at once, so the next load doesn't find them again)
if (!relaid) try {
  localStorage.setItem(KEY, JSON.stringify(dropRelaid(load(KEY))))
  localStorage.setItem(KEY_R, JSON.stringify(dropRelaid(load(KEY_R))))
  localStorage.setItem(KEY_S, JSON.stringify(dropRelaid(load(KEY_S))))
  // (and its pivot, if it was moved: turning about where it was put)
  localStorage.setItem(KEY_P, JSON.stringify(dropRelaid(load(KEY_P))))
  for (const [k] of relaidDue) localStorage.setItem(k, '1')
} catch { /* private window */ }
let state: State = { on: false, locked: false, tool: 'move', offsets: loadOffsets(), rotations: loadRotations(), scales: loadScales(), selected: null, groups: loadGroups(), picked: [],
  pivots: dropRelaid(load(KEY_P)), pivotMode: false, space: 'local', wire: false, hidden: [] }
const subs = new Set<() => void>()
/** what was selected last time round: a newly picked piece starts in its own (object) axes */
let lastSelected: string | null = null
/** the mode the dock was last shown for */
let dockOn = false
const emit = () => {
  if (state.selected !== lastSelected) {
    lastSelected = state.selected
    if (state.selected) state.space = 'local'
  }
  // (in edit mode the room's own pointing (lit things, name tags, the hand) is paused: what's lit now is put out)
  if (HOVER.paused !== state.on) { HOVER.paused = state.on; if (state.on) { glowOnly(null); setTip(null); POINTER_RESET() } }
  // (the dock follows the mode in and out: the character viewer kept minimised from before came back with no pill to bring it out (it
  // was only shown on pressing − or a pill), and the viewer seemed gone)
  if (dockOn !== state.on) { dockOn = state.on; showDock() }
  state = { ...state }; subs.forEach((f) => f()); panel()
}
/** (the cursor back to the arrow, wherever a hover had set it) */
const POINTER_RESET = () => { if (typeof document === 'undefined') return; document.body.style.cursor = ''; document.querySelectorAll('canvas').forEach((c) => { c.style.cursor = '' }) }
export const getEdit = () => state
export const useEdit = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)
/** the piece (or group) whose row in the list the pointer is over: lit in the scene as it would be pointed at there (each piece listens for its own
 * yes or no, so only the one or two that change are drawn again) */
let listHot: string | null = null
const hotSubs = new Set<() => void>()
export function setListHot(id: string | null) { if (listHot === id) return; listHot = id; hotSubs.forEach((f) => f()) }
const hotSub = (f: () => void) => { hotSubs.add(f); return () => { hotSubs.delete(f) } }
export const useListHot = (id: string) =>
  useSyncExternalStore(hotSub, () => !!listHot && (listHot === id || (listHot in state.groups && within(state.groups, id, listHot))))
/**
 * Where each piece stands to begin with: the places the owner has settled on by hand (as X, Y, Z in the piece's parent's own units). The
 * offset shown and typed in edit mode is from here, so every piece starts at 0, 0, 0, its own centre.
 */
export const BASES: Record<string, V3> = {
  // (the shrine's oranges and its cups' stand set by hand at X 0.027 and X 0.050 in the room's frame)
  oranges: [0.0275, 0, 0],
  shrinecups: [0.0502, 0, 0],
  // (the sutra moved Z -0.030 and both vases X 0.07 along their own axes (the shelf's: X back toward the wall, Z along it), as the owner set them)
  sutra: [0, 0, -0.03],
  'vase-1': [0.07, 0, 0],
  vase1: [0.07, 0, 0],
  gate1: [0, 0, 0.16],
  gate0: [0, 0, 0.17],
  // (the owner's settled spot: moved by [0.2, 0.19, 0.47] in the room's frame from [-1.508, 0, 1.974], taken into this parent's own units)
  // (moved on by [0, 0, 0.341] in the room's frame, taken into this parent's units)
  // (no lift: sized about its foot it stands on the dais (Movable's ground); the 0.19 made up for its sinking when it was sized about its middle)
  freezer: [-0.9694, 0, 1.3355],
  // (moved on by X 0.215 in the room's frame, taken into this parent's units)
  // (moved by the owner X -0.465, Z -0.367 (its object frame was the world's then), made so)
  willow: [0.2534 - 0.465, 0, 0.0272 - 0.367],
  // (the speaker set at X -0.285 Y 0.518 Z 0.169, in the room's frame: back in its corner (the owner's); the red lantern raised 0.25)
  // (then on 0.05 along its own width, as the owner set it (2026-11-12): [0.0039, 0, -0.0247] in this parent's units)
  speaker: [0.3083, 0.518, 0.1062],
  // (the tissues and cleaning things at X -0.38, Z -0.095 in the room's frame (the owner's, 2026-11-12: first X -0.2, then -0.38), taken into
  // this parent's units: its frame is turned 2.512)
  supplies: [0.2512, 0, 0.3005],
  chochin: [0, 0.25, 0],
  chochin2: [0, 0.25, 0],
  sake: [0.084, 0, 0.118],
  // (the charcoal basket: moved by [0.273, 0.125, 0.082] in the room's frame, taken into the parent's units; its 1.75 size and 44° turn are Decor's)
  crate: [-0.0941, 0.125, -0.2691],
  // (the lantern: moved by [-0.083, 0, -0.651] in the room's frame, taken into this parent's units; its 12° turn is Decor's)
  lantern: [-0.478, 0, 0.4497],
  // (the dish rack: moved by [-0.871, 0, -2.135] in the room's frame, taken into this parent's units; its 1.03 size is Decor's)
  platerack: [-1.2158, 0, 1.9593],
  // (the second of the two low racks: where the first is set, beside it)
  platerack2: [-1.2158, 0, 1.9593],
  // (the till's things, where the owner set them in the edit panel (the room's frame: register X 0.025 Z 0.28, tablet Z -0.641, pens X 0.159
  // Z 0.512, printer X 0.03, bell X 0.286, cat X 0.06 Z -0.014), taken into each one's parent's own units; the tablet, pens, printer and
  // card reader raised 0.15 onto the hinoki stand)
  'till-register': [0.2116, 0, -0.1851],
  'till-ipad': [-0.5181, 0.15, 0.3774],
  'till-pens': [0.3202, 0.15, -0.43],
  // (on the mat beside the pen cup, as the pens are)
  'till-omamori': [0.3202, 0.15, -0.43],
  'till-printer': [-0.0059, 0.15, -0.008],
  'till-card': [0, 0.15, 0],
  // (the bell moved on by X 0.012 Z -0.031, the printer by X -0.02, in the room's frame)
  'till-bell': [-0.2005, 0, -0.2226],
  'till-cat': [-0.0466, 0, -0.0403],
  'till-tray': [-0.2353, 0, 0.6064],
  // (the free view's camera: moved X -0.45 along its own axes (object space), taken into its parent's (the world's) units; its turn of
  // Y 15° Z 5° is App's VIEWCAM_TURN)
  'viewcam-free': [0.0478, 0, 0.4475],
  // (the shoe cupboard moved 0.5 along the wall toward the door (the owner's, 2026-11-11), taken into its parent's units)
  shoecab: [0, 0, 0.25],
}
export const isGroup = (id: string | null) => !!id && id in state.groups
/** the group a piece (or a group) is in, if any: the one holding it directly (that one may be in a view's area in its turn) */
export const groupOf = (piece: string): string | null => parentOf(state.groups, piece)
/** whether a piece is the selected one, or in the selected group (however deep) */
export const isPicked = (piece: string) => state.selected === piece || (isGroup(state.selected) && within(state.groups, piece, state.selected!))
/** a group that keeps things together in the list rather than making one thing of them (a view's area, the stools along the bars): a click in
 * the room picks the piece in it, not it */
const isGathering = (gid: string) => isArea(gid) || !!DEFAULT_GROUPS[gid]?.spans
/** what a click on a piece in the scene picks: the group it's in, as one (the till and all on it), but not a view's whole area or the like (that's
 * picked from the list, or its tag); or the piece alone */
export const clickPick = (piece: string) => chainOf(state.groups, piece).find((g) => !isGathering(g)) ?? piece
export const offsetOf = (id: string): V3 => state.groups[id] ? state.groups[id].t : state.offsets[id] ?? [0, 0, 0]
/** where the piece is: its settled place, and what's been moved by hand from it */
export const positionOf = (id: string): V3 => {
  const b = BASES[id] ?? [0, 0, 0], o = offsetOf(id)
  return [b[0] + o[0], b[1] + o[1], b[2] + o[2]]
}
/** where a piece's pivot is moved to from its middle (its own frame) */
export const pivotOf = (id: string): V3 => state.pivots[id] ?? [0, 0, 0]
/**
 * What hangs or is fixed to a wall, whose pivot stays at its middle: the lamps and lanterns, the noren, the switches and signs and pictures, the
 * speaker, the shrine's shelf on its brackets, the knives on the table's front, what's on the toilets' walls, the views' cameras. Everything
 * else stands on something (the floor, a table, a shelf) and has its pivot at the middle of its foot (the owner's, 2026-11-10: the handles
 * sat half way up each piece; a chair's, a counter's, a fridge's, a vase's, a sack's at the middle of its base, as Maya's are set): turned
 * about it, it turns where it stands; sized about it, it grows up from where it stands and doesn't sink into it. A new piece that hangs goes on here.
 */
export const HANGS = /^(barlamp|sidelamp|chochin|fishlantern|noren$|speaker$|exitsign$|lightswitch|wcswitch$|art-|knives$|altar$|viewcam-)|^wc2-[mf]-(lamp|noren|dryer|towelbox|remote|paper|oto|pads)/
// (each piece and each group whose pivot has been brought down to its foot, once: what was saved for it made up for then, so nothing moved)
const KEY_FOOT = 'jgs-edit-foot-1'
const KEY_GFOOT = 'jgs-edit-group-foot-2'
const footSets = (key: string) => { try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { return new Set<string>() } }
// (and each piece whose pivot was brought across to the middle of the box it's drawn with (KEY_FOOTXZ), and each whose kept turn was taken
// into the room's axes (KEY_ROOM): once each, as the foot was)
const KEY_FOOTXZ = 'jgs-edit-foot-xz-1'
const KEY_ROOM = 'jgs-edit-room-axes-1'
const footDone = footSets(KEY_FOOT), groupFootDone = footSets(KEY_GFOOT), footXzDone = footSets(KEY_FOOTXZ), roomDone = footSets(KEY_ROOM)
const keepFeet = () => { try { localStorage.setItem(KEY_FOOT, JSON.stringify([...footDone])); localStorage.setItem(KEY_GFOOT, JSON.stringify([...groupFootDone])); localStorage.setItem(KEY_FOOTXZ, JSON.stringify([...footXzDone])); localStorage.setItem(KEY_ROOM, JSON.stringify([...roomDone])) } catch { /* storage blocked */ } }
export const footSettled = (id: string) => footDone.has(id)
export const footXzSettled = (id: string) => footXzDone.has(id)
/**
 * A piece's pivot brought across (by `d`, in its own frame, level) from the middle of a box squared to the room to the middle of the box it's
 * drawn with (squared to its own axes, as the yellow box in developer mode is), once: as settleFoot does it, so nothing moves (the owner's,
 * 2026-11-12: every piece's handles at its middle; a turned piece's, the willow's or the speaker's, stood off its box)
 */
export function settleFootXz(id: string, d: V3, shift: V3) {
  if (footXzDone.has(id)) return
  footXzDone.add(id)
  const pv = state.pivots[id]
  if (pv) state.pivots = { ...state.pivots, [id]: [pv[0] - d[0], pv[1] - d[1], pv[2] - d[2]] }
  if (shift.some((v) => Math.abs(v) > 1e-7)) {
    const o = state.offsets[id] ?? [0, 0, 0]
    state.offsets = { ...state.offsets, [id]: [o[0] + shift[0], o[1] + shift[1], o[2] + shift[2]] }
  }
  keepFeet()
  if (pv || shift.some((v) => Math.abs(v) > 1e-7)) { save(); emit() }
}
/**
 * A piece's kept turn taken into the room's axes, once (`into`: its turn as it was kept, about the world's axes, as the same turn about the
 * room's; null when it's about the vertical alone, the same in both): the editor's world axes became the room's (2026-11-12), and a tilt
 * kept from before (a view's camera looking down) would have tipped another way
 */
export function settleRoomTurn(id: string, into: (r: V3) => V3 | null) {
  if (roomDone.has(id)) return
  roomDone.add(id)
  keepFeet()
  const r = into(state.rotations[id] ?? [0, 0, 0])
  if (!r) return
  state.rotations = { ...state.rotations, [id]: r }
  save(); emit()
}
/**
 * A standing piece's pivot brought down from its middle to its foot (by `d`, in its own frame), once: a pivot moved by hand (D) kept where it
 * was put (counted from the foot now); and `shift` added to its place, what was saved for it turned or sized about its middle made up for
 * (Movable works it out), so nothing moves
 */
export function settleFoot(id: string, d: V3, shift: V3) {
  if (footDone.has(id)) return
  footDone.add(id)
  const pv = state.pivots[id]
  if (pv) state.pivots = { ...state.pivots, [id]: [pv[0] - d[0], pv[1] - d[1], pv[2] - d[2]] }
  if (shift.some((v) => Math.abs(v) > 1e-7)) {
    const o = state.offsets[id] ?? [0, 0, 0]
    state.offsets = { ...state.offsets, [id]: [o[0] + shift[0], o[1] + shift[1], o[2] + shift[2]] }
  }
  keepFeet()
  if (pv || shift.some((v) => Math.abs(v) > 1e-7)) { save(); emit() }
}
/**
 * Each group's pivot brought to the middle of its pieces' foot as a piece's is (the middle of all their boxes, squared to the room, at their
 * lowest foot's height; before, the middle across stayed where it was made, and a group with a place of its own had its handles metres off
 * it: the owner's, 2026-11-12), once for each, its own move made up for, so nothing moves; a group with a piece not yet measured waits
 */
export function settleGroupFeet() {
  let changed = false
  for (const [gid, g] of Object.entries(state.groups)) {
    if (groupFootDone.has(gid) || unsettled.has(gid)) continue
    // (its pieces' boxes, every corner, in the group's own frame: the middle of all of them squared to the room, at their lowest foot)
    const boxes = leavesOf(state.groups, gid).map((m) => registry.get(m)?.corners?.() ?? null)
    if (!boxes.length || boxes.some((v) => !v)) continue
    const pts = (boxes as V3[][]).flat().map((v) => intoGroup(gid, v))
    const ra = ROOM_TURN * Math.PI / 180, ax = Math.cos(ra), az = -Math.sin(ra)
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity, y = Infinity
    for (const v of pts) {
      const u = v[0] * ax + v[2] * az, w = -v[0] * az + v[2] * ax
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); y = Math.min(y, v[1])
    }
    const um = (u0 + u1) / 2, wm = (w0 + w1) / 2
    const at: V3 = [um * ax - wm * az, y, um * az + wm * ax]
    const d: V3 = [at[0] - g.pivot[0], at[1] - g.pivot[1], at[2] - g.pivot[2]]
    // (turned and sized about the old pivot, now about the new: the difference made up for in its move)
    const ad = applyGroup({ ...g, pivot: [0, 0, 0], t: [0, 0, 0] }, d)
    state.groups = { ...state.groups, [gid]: { ...g, pivot: at, t: [g.t[0] + ad[0] - d[0], g.t[1] + ad[1] - d[1], g.t[2] + ad[2] - d[2]] } }
    groupFootDone.add(gid)
    changed = true
  }
  if (changed) { keepFeet(); save(); emit() }
}
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
/** pieces whose size isn't for changing by hand (the owner: he's as big as he is) */
export const FIXED_SIZE = new Set(['boss'])
export const scaleOf = (id: string): V3 => FIXED_SIZE.has(id) ? [1, 1, 1]
  : state.groups[id] ? [state.groups[id].s, state.groups[id].s, state.groups[id].s] : state.scales[id] ?? [1, 1, 1]
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
/** a piece's place put right to where it's ended up (the cook table's nudged things, pushed clear of what they'd go through): its box and handles
 * go with it, and what's selected stays as it was */
export function settleOffset(id: string, v: V3) { state.offsets = { ...state.offsets, [id]: v }; emit() }
export function turnTo(id: string, v: V3) {
  if (state.groups[id]) state.groups = { ...state.groups, [id]: { ...state.groups[id], yaw: v[1], r: v } }
  else state.rotations = { ...state.rotations, [id]: v }
  state.selected = id; emit()
}
export function scaleTo(id: string, v: V3) {
  if (FIXED_SIZE.has(id)) return
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
  // (and how every piece is drawn, back as made)
  clearAllRenderPrefs()
  save(); emit()
}
export const select = (id: string | null) => { state.selected = id; if (id && state.groups[id]) settleGroupFeet(); emit() }
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
/** how big the move / turn / scale handles are drawn (a factor of their usual size), kept in the browser */
const KEY_GZ = 'jgs-edit-gizmo-size'
/** how tall the panel's been dragged to */
const KEY_PH = 'jgs-edit-panel-h'
/** the backdrop behind the shop (index.css's --scene-bg): its colour, chosen in the panel, kept in the browser */
const KEY_BG = 'jgs-scene-bg'
export const BACKDROP_DEFAULT = '#26262c'
const backdropColor = () => { try { return localStorage.getItem(KEY_BG) ?? BACKDROP_DEFAULT } catch { return BACKDROP_DEFAULT } }
export function setBackdrop(c: string) {
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--scene-bg', c)
  try { if (c === BACKDROP_DEFAULT) localStorage.removeItem(KEY_BG); else localStorage.setItem(KEY_BG, c) } catch { /* (not kept) */ }
}
if (typeof document !== 'undefined') document.documentElement.style.setProperty('--scene-bg', backdropColor())
/** where the panel was dragged to (its left edge and its bottom's distance from the window's), kept for next time */
const KEY_PPOS = 'jgs-edit-panel-pos'
/** how tall the list is (dragged by the grip under it) */
const KEY_LH = 'jgs-edit-list-h'
export const GIZMO = { size: (() => { try { return Number(localStorage.getItem(KEY_GZ)) || 0.6 } catch { return 0.6 } })() }
export function setGizmoSize(dir: 1 | -1) {
  GIZMO.size = Math.max(0.25, Math.min(2, Math.round(GIZMO.size * (dir > 0 ? 1.15 : 1 / 1.15) * 100) / 100))
  try { localStorage.setItem(KEY_GZ, String(GIZMO.size)) } catch { /* storage blocked */ }
  toast(T().gizmoSize(Math.round(GIZMO.size * 100)), 'edit')
}
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
// (kept on the window, so a live code update in development (which loads this module afresh) doesn't lose the pieces that weren't remounted: the
// panel would list only some of them)
type Entry = { label: string; focus: () => void; center?: () => V3 | null; parent?: string | null; foot?: () => V3 | null; corners?: () => V3[] | null }
const registry: Map<string, Entry> = typeof window !== 'undefined'
  ? ((window as unknown as { __editRegistry?: Map<string, Entry> }).__editRegistry ??= new Map())
  : new Map()
/** `center`: where the piece's middle is in the world (what a group of it turns and grows about); a piece without one can't be grouped.
 * `parent`: the piece it sits inside (a Movable within another), which the outliner lists it under, as Maya's does */
/** the camera brought to what's picked (a group: to its first piece) */
export function frameSelected() {
  const id = state.selected
  if (!id) return
  const target = leavesOf(state.groups, id).find((m) => registry.has(m)) ?? id
  registry.get(target)?.focus()
}
export function registerMovable(id: string, label: string, focus: () => void, center?: () => V3 | null, parent?: string | null, foot?: () => V3 | null, corners?: () => V3[] | null) {
  registry.set(id, { label, focus, center, parent, foot, corners })
  panel()
  return () => { registry.delete(id); panel() }
}

// ---- groups
let groupSeq = 0
/** the pieces picked in the list (Ctrl- or Shift-click adds one), the selected one too, that can be grouped: in no group, or all in the same one
 * (a view's area: the new group is made inside it) */
export const groupable = () => {
  const ids = [...new Set([...state.picked, ...(state.selected && !isGroup(state.selected) ? [state.selected] : [])])].filter((id) => registry.get(id)?.center)
  const home = ids.length ? groupOf(ids[0]) : null
  return ids.filter((id) => groupOf(id) === home)
}
export function pickToggle(id: string) {
  state.picked = state.picked.includes(id) ? state.picked.filter((x) => x !== id) : [...state.picked, id]
  if (!state.selected || isGroup(state.selected)) state.selected = id
  emit()
}
export function makeGroup() {
  const ids = groupable()
  if (ids.length < 2) { toast(T().needTwo); return }
  const home = groupOf(ids[0])
  const pts = ids.map((id) => registry.get(id)!.center!()).filter((v): v is V3 => !!v)
  const pivot = pts.length ? intoGroup(home, middle(pts)) : [0, 0, 0] as V3
  beginChange()
  let n = ++groupSeq
  while (state.groups[`grp${n}`]) n = ++groupSeq
  const id = `grp${n}`
  state.groups = { ...state.groups, [id]: { name: T().groupName(n), members: ids, pivot, t: [0, 0, 0], yaw: 0, s: 1 } }
  // (made inside the group its pieces were in: it holds the new one where they stood in its list)
  if (home) {
    const was = state.groups[home].members
    const at = was.findIndex((m) => ids.includes(m))
    state.groups = { ...state.groups, [home]: { ...state.groups[home], members: [...was.slice(0, at), id, ...was.slice(at).filter((m) => !ids.includes(m))] } }
  }
  state.picked = []
  state.selected = id
  // (its pivot at its pieces' feet, as every group's (a name used before may have been a group's settled then))
  groupFootDone.delete(id)
  settleGroupFeet()
  save(); emit()
  toast(T().grouped(ids.length, state.groups[id].name), 'edit')
}
export function dissolveGroup(id: string | null = state.selected) {
  if (!id || !state.groups[id]) return
  beginChange()
  const { [id]: g, ...rest } = state.groups
  // (what was in it goes back into the group it was in, if any, where it stood)
  const home = parentOf(rest, id)
  if (home) rest[home] = { ...rest[home], members: rest[home].members.flatMap((m) => (m === id ? g.members : [m])) }
  state.groups = rest
  if (DEFAULT_GROUPS[id] || isArea(id)) drop(id)
  state.selected = null
  save(); emit()
  toast(T().ungrouped, 'edit')
}
export function renameGroup(id: string, name: string) {
  if (!state.groups[id]) return
  state.groups = { ...state.groups, [id]: { ...state.groups[id], name } }
  save(); emit()
}
/** the transforms of the groups a piece is in, to lay over it (the one holding it first, then the one that's in, out to a view's area): where
 * each turns from, how far it's moved (in the room's frame), turned and sized; none when none of them has been (they'd change nothing) */
export const groupTransformOf = (piece: string): Group[] | null => {
  const gs = chainOf(state.groups, piece).map((g) => state.groups[g])
  return gs.some((g) => !isStill(g)) ? gs : null
}
/** the transforms of the groups a group is in (the one holding it first): what its own handles stand in */
export const outerTransformOf = (gid: string): Group[] => chainOf(state.groups, gid).map((g) => state.groups[g])
// ---- the views' areas: each view's camera stands somewhere and looks at a part of the shop; what it has in sight, and is nearest the point it
// looks at, is its area, a group of its own (火烤灶台區, 玄關區…), made the first time edit mode opens. The groups the shop has (the till's, the
// shrine's…) go into an area whole; only pieces new to the shop are put in an area later, so whatever the owner takes out of one stays out.
/** where the views' cameras are and look (App knows: the views' own poses, or the cameras placed by hand); null while any is still loading */
let viewCams: (() => ViewCam[] | null) | null = null
export function setViewCams(fn: (() => ViewCam[] | null) | null) { viewCams = fn }
/** the pieces an area has been made with, or offered to: not offered again */
const KEY_AK = 'jgs-edit-area-known-1'
const knownNow = new Set<string>()
const known = (): Set<string> => { try { return new Set([...JSON.parse(localStorage.getItem(KEY_AK) ?? '[]'), ...knownNow]) } catch { return new Set(knownNow) } }
/** what the views' own words (views.ts's about) say they're of, where their cameras alone don't settle it: the entrance is framed a little into
 * the room, so its lanterns, its noren, the shoe rack (and the helmet on it) and the lucky cats' stand by the door are at the edge of its frame or
 * out of it, and nearer what the till's or the shrine's camera looks at */
const AREA_OF: Record<string, string> = { noren: 'genkan', chochin: 'genkan', chochin2: 'genkan', fishlantern: 'genkan', shoecab: 'genkan', 'grp-doorcats': 'genkan',
  koban: 'genkan', bench: 'genkan', bench2: 'genkan', takeoutstand: 'till', lowrack: 'back', produce: 'back', coalsack: 'back',
  // (the kitchen's back: the rice station between the cook table and the till was nearer the till's camera; the rice corner and the sake
  // barrel by it in no view's sight at all)
  'grp-ricestation': 'back', 'grp-sink': 'back', 'grp-racks': 'back', 'grp-ricecorner': 'back', sake: 'back', freezer: 'back',
  'grp-wc-m': 'toilet', 'grp-wc-f': 'toilet' }
/** an area's name: its view's, as an area (後台區 is one already) */
const areaName = (view: string) => { const n = VIEW_SPOTS.find((v) => v.id === view)?.zh ?? view; return n.endsWith('區') ? n : `${n}區` }
/** each view's area made a group, of the pieces (and the shop's groups, whole) loose at the top that are new to it */
export function groupByViews() {
  const cams = viewCams?.()
  if (!cams?.length) return
  const seen = known(), gone = dropped()
  const things: { id: string; at: V3 }[] = []
  const middleOf = (ids: string[]) => { const pts = ids.map((m) => registry.get(m)?.center?.() ?? null).filter((v): v is V3 => !!v); return pts.length ? middle(pts) : null }
  for (const [id, r] of registry) {
    if (id.startsWith('viewcam-') || id === 'boss' || (r.parent && registry.has(r.parent)) || groupOf(id) || seen.has(id)) continue
    const at = middleOf([id])
    if (at) things.push({ id, at })
  }
  for (const gid of Object.keys(state.groups)) {
    const leaves = leavesOf(state.groups, gid)
    if (isArea(gid) || groupOf(gid) || DEFAULT_GROUPS[gid]?.spans || leaves.some((m) => seen.has(m))) continue
    const at = middleOf(leaves)
    if (at) things.push({ id: gid, at })
  }
  let made = false
  for (const [view, ids] of Object.entries(areasOf(things, cams, undefined, AREA_OF))) {
    const gid = AREA + view, g = state.groups[gid]
    if (gone.includes(gid)) continue
    // (a piece new to the shop joins its area, unless the area's been moved, turned or sized: it'd be carried off with it)
    if (g && !isStill(g)) continue
    const all = [...(g?.members ?? []), ...ids]
    const pivot = middleOf(all.flatMap((m) => leavesOf(state.groups, m))) ?? [0, 0, 0]
    state.groups = { ...state.groups, [gid]: g ? { ...g, members: all, pivot } : { name: areaName(view), members: all, pivot, t: [0, 0, 0], yaw: 0, s: 1 } }
    // (its pivot at its pieces' middle again: brought down to their feet once more)
    groupFootDone.delete(gid)
    made = true
  }
  for (const id of registry.keys()) knownNow.add(id)
  try { localStorage.setItem(KEY_AK, JSON.stringify([...known()])) } catch { /* storage blocked */ }
  if (made) { save(); emit() }
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
  state.hidden = []
  state.tool = 'move'
  past.length = 0; future = []
  emit()
  toast(text, 'plain')
}
/** what a piece or a group is called, in the panel's language */
const nameOf = (id: string) => (state.groups[id] ? pieceName(state.groups[id].name, lang) : registry.get(id) ? pieceName(registry.get(id)!.label, lang) : id)
/**
 * Clicked again where the last click was (Movable; the owner's, 2026-11-10: a piece behind another was never reached, the one in front taken
 * every time): the next one back of what's under the pointer (`stack`, front to back), round to the front after the last; said which it is
 */
export function chooseNext(stack: string[], from: string) {
  const k = (stack.indexOf(from) + 1) % stack.length
  state.picked = []
  select(stack[k])
  toast(T().cycled(nameOf(stack[k]), k + 1, stack.length), 'plain')
}
/** H: what's chosen hidden for now (a piece, or each piece of a group), to reach and see what's behind it; let go of */
export function hideSelected() {
  const id = state.selected
  if (!id) { toast(T().hideNone, 'plain'); return }
  const ids = state.groups[id] ? leavesOf(state.groups, id) : [id]
  state.hidden = [...new Set([...state.hidden, ...ids])]
  state.selected = null
  state.picked = []
  emit()
  toast(T().hid(nameOf(id)), 'plain')
}
/** Alt+H: all that's hidden shown again */
export function showHidden() {
  const n = state.hidden.length
  if (!n) { toast(T().noneHidden, 'plain'); return }
  state.hidden = []
  emit()
  toast(T().shownAll(n), 'plain')
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
  if (state.on) { cancelEdit(); return }
  // (during business too: the game stands still while it's on (the owner's), and says so)
  if (state.locked) toast(T().paused)
  settleGroups()
  groupByViews()
  settleGroupFeet()
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
/** a group's own frame, for its object axes: its first piece's own (as that stands), turned by the group's own turn about the vertical (a
 * group's handles stood along the room's axes whichever the space: the shrine's, along its wall, didn't turn with object axes, the owner's) */
export function groupFrame(gid: string): number {
  const g = state.groups[gid]
  if (!g) return 0
  // (its piece's own turn is from that piece's parent's frame, which `frames` has turned from the room's: both, for the turn from the room's)
  const first = leavesOf(state.groups, gid).find((m) => framesObj.has(m))
  // (`frames` is the room's axes now (ROOM_TURN): the world's, which a group's frame is, that much the other way)
  return (first ? framesObj.get(first)! - (frames.get(first) ?? 0) : 0) + (ROOM_TURN * Math.PI) / 180 + ((g.r?.[1] ?? g.yaw) * Math.PI) / 180
}
/** the turn (about the vertical) the panel's place goes by: the world's (world space) or the piece's own (object space), into its parent's frame
 * (a group's parent's frame is the room's: its own in object space) */
const frameFor = (id: string) => (state.groups[id] ? (state.space === 'local' ? groupFrame(id) : (ROOM_TURN * Math.PI) / 180)
  : state.space === 'local' ? framesObj.get(id) ?? 0 : frames.get(id) ?? 0)
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
  const ms = leavesOf(state.groups, id).map((m) => stats.get(m)).filter((x): x is { tris: number; verts: number; meshes: number } => !!x)
  return ms.length ? ms.reduce((a, b) => ({ tris: a.tris + b.tris, verts: a.verts + b.verts, meshes: a.meshes + b.meshes })) : null
}
let el: HTMLDivElement | null = null
/**
 * Developer mode's two panels minimised into a dock at the bottom left, beside the axes (the owner's: − shrinks a panel down into it, a pill
 * there brings it back where it was; the side handles gone): the dev panel (its pick, gizmo and wireframe staying meanwhile) and the
 * character viewer, whose state is here for CharacterViewer to follow. × leaves the mode (the dev panel's) or puts the viewer away
 * (the viewer's), its pill left in the dock.
 */
let tucked = false
let dock: HTMLDivElement | null = null
let devPill: HTMLButtonElement | null = null, charPill: HTMLButtonElement | null = null, dockLang: Lang | null = null
let charHidden = (() => { try { return localStorage.getItem('jgs-char-view-hidden-1') === '1' } catch { return false } })()
const charSubs = new Set<() => void>()
export const getCharHidden = () => charHidden
export const onCharHidden = (f: () => void) => { charSubs.add(f); return () => { charSubs.delete(f) } }
export function setCharHidden(v: boolean) {
  if (charHidden === v) return
  charHidden = v
  try { localStorage.setItem('jgs-char-view-hidden-1', v ? '1' : '0') } catch { /* (not kept) */ }
  for (const f of charSubs) f()
  showDock()
}
function showDock() {
  if (typeof document === 'undefined') return
  if (!dock) {
    dock = document.createElement('div')
    dock.className = 'be-dock'
    const pill = (text: string, go: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'; b.className = 'be-pill'; b.textContent = text
      b.onclick = (e) => { e.stopPropagation(); go() }
      dock!.appendChild(b)
      return b
    }
    devPill = pill(T().devPill, () => setTucked(false))
    charPill = pill(T().charPill, () => setCharHidden(false))
    document.body.appendChild(dock)
  }
  // (their words in the panel's language, again whenever it changes)
  if (dockLang !== lang) {
    dockLang = lang
    withGlyph(devPill!, 'tools', T().devPill, 13)
    withGlyph(charPill!, 'person', T().charPill, 13)
  }
  const on = state.on
  devPill!.classList.toggle('on', on && tucked)
  charPill!.classList.toggle('on', on && charHidden)
  devPill!.title = T().unfold
  dock.classList.toggle('on', on && (tucked || charHidden))
}
function setTucked(v: boolean) {
  tucked = v
  if (el) {
    el.classList.toggle('be-tucked', v)
    el.inert = v
  }
  showDock()
}
let spaceBadge: HTMLButtonElement | null = null
let info: HTMLDivElement | null = null
let fields: HTMLInputElement[] = []
let toolButtons: HTMLButtonElement[] = []
let spaceButton: HTMLButtonElement | null = null, pivotButton: HTMLButtonElement | null = null
let rows = new Map<string, HTMLDivElement>()
/** the outliner's two tabs (the scene's pieces, the views' cameras): which one each row is in, the one shown, and the pick it last followed */
type ListTab = 'scene' | 'camera'
let rowTab = new Map<string, ListTab>()
/** the groups each row is listed under (folded away while any of them is), and the groups opened to show what's in them (kept for next time) */
let rowUnder = new Map<string, string[]>()
const KEY_OPEN = 'jgs-edit-open-1'
const open: Set<string> = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem(KEY_OPEN) ?? '[]')) } catch { return new Set<string>() } })()
const keepOpen = () => { try { localStorage.setItem(KEY_OPEN, JSON.stringify([...open])) } catch { /* (not kept) */ } }
let listTab: ListTab = 'scene'
let tabFollows: string | null = null
let showRows: (() => void) | null = null
/** the Render section brought up to date with what's chosen */
let renderView: (() => void) | null = null
let summary: HTMLDivElement | null = null
/** the whole scene's triangles, as SceneTally last counted them, and the line that shows them */
let sceneTris = 0
let trisLine: HTMLDivElement | null = null
export function setSceneTris(n: number) { if (n === sceneTris) return; sceneTris = n; if (trisLine) trisLine.textContent = T().sceneTris(n) }
let built = ''

/** the panel's look: after Blender's dark interface (grey panels, a darker header bar, blue for what's active, red/green/blue axis stripes) */
const PANEL_CSS = `
.be { position:fixed; left:12px; bottom:92px; z-index:9999; width:360px; box-sizing:border-box; max-height:calc(100vh - 110px); display:flex; background:#303030; color:#d6d6d6;
  font:11.5px/1.35 "Inter","Segoe UI","Noto Sans TC",sans-serif; border:1px solid #1a1a1a; border-radius:6px; box-shadow:0 6px 22px rgba(0,0,0,.55); overflow:hidden; user-select:none }
.be * { box-sizing:border-box }
.be-keys { display:flex; flex-wrap:wrap; gap:0 12px; margin:6px 0 2px; padding:5px 7px; border-radius:4px; background:#262626; color:#9a9a9a; font:10.5px/1.6 monospace }
.be-key { white-space:nowrap }
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
.be-head { display:flex; align-items:center; gap:8px; height:36px; padding:0 10px; background:#262626; border-bottom:1px solid #1a1a1a; font:600 13px/1 "Inter","Segoe UI","Noto Sans TC",sans-serif; letter-spacing:.02em; color:#f0f0f0; white-space:nowrap }
.be-head small { margin-left:auto; font-weight:400; color:#8a8a8a; white-space:nowrap }
.be-tabs { display:flex; gap:2px; border-bottom:2px solid #e0a040 }
.be-tab { flex:1; padding:4px 8px 3px; background:#1d1d1d; color:#8c8c8c; border:1px solid #333; border-bottom:none; border-radius:4px 4px 0 0; cursor:pointer; font:inherit; font-weight:700; letter-spacing:.08em }
.be-tab:hover { color:#d6d6d6; background:#2c2c2c }
.be-tab.on { background:#e0a040; border-color:#e0a040; color:#1d1d1d }
.be-tabs + .be-list { border-top-left-radius:0; border-top-right-radius:0 }
.be-win { display:inline-grid; place-items:center; width:22px; height:22px; padding:0; border:0; border-radius:4px; background:#3a3a3a; color:#ddd; font:600 14px/22px sans-serif; cursor:pointer; flex:none }
.be-win:hover { background:#4a4a4a } .be-close:hover { background:#b8433a; color:#fff }
.be { transform-origin:0 100%; transition:transform .28s cubic-bezier(.4,0,.2,1), opacity .22s ease }
.be.be-tucked { pointer-events:none; opacity:0; transform:translate(140px, 92px) scale(.15) }
.be-dock { position:fixed; left:164px; bottom:30px; z-index:9999; display:none; gap:8px }
.be-dock.on { display:flex }
.be-pill { display:none; padding:7px 14px; border:1px solid #1a1a1a; border-radius:999px; background:rgba(40,40,40,.9); color:#e6e6e6;
  font:600 12.5px/1 "Inter","Segoe UI","Noto Sans TC",sans-serif; white-space:nowrap; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.35) }
.be-pill.on { display:block } .be-pill:hover { background:#4772b3; color:#fff }
.be-body { overflow:auto; flex:1; scrollbar-width:thin; scrollbar-color:#555 #2a2a2a }
.be-grip { position:absolute; left:0; right:0; top:-5px; height:10px; cursor:ns-resize; z-index:3 }
.be-grip::after { content:''; position:absolute; left:50%; top:3px; width:44px; height:4px; margin-left:-22px; border-radius:2px; background:#5a5a5a }
.be-grip:hover::after { background:#e08a2c }
.be-sec { border-top:1px solid #1d1d1d }
.be-sec > .be-st { display:flex; align-items:center; gap:5px; padding:4px 8px; background:#3d3d3d; color:#e0e0e0; font-weight:600; cursor:pointer }
.be-sec > .be-st::before { content:''; width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:5px solid #9a9a9a }
.be-sec.shut > .be-st::before { border-top:4px solid transparent; border-bottom:4px solid transparent; border-left:5px solid #9a9a9a; border-right:0 }
.be-pill .game-icon, .be-space .game-icon { vertical-align:-0.15em } .be-fold .game-icon { display:block; margin:0 auto }
.be-sec.shut > .be-sc { display:none }
.be-sc { padding:6px 8px 8px; background:#2b2b2b }
.be-sum { color:#9ab0c8; font-size:11px; margin-bottom:5px }
.be-tris { margin-top:-3px; color:#e0b860 }
.be-find { width:100%; background:#1d1d1d; color:#d6d6d6; border:1px solid #3a3a3a; border-radius:4px; padding:3px 7px; font:inherit; margin-bottom:5px }
.be-list { height:320px; min-height:90px; overflow:auto; scrollbar-width:thin; scrollbar-color:#555 #2a2a2a; background:#242424; border-radius:4px; padding:2px }
.be-lgrip { position:relative; height:10px; cursor:ns-resize; margin-top:1px }
.be-lgrip::after { content:''; position:absolute; left:50%; top:3px; width:44px; height:4px; margin-left:-22px; border-radius:2px; background:#5a5a5a }
.be-lgrip:hover::after { background:#e08a2c }
.be-row { padding:2px 8px 2px 18px; border-radius:3px; cursor:pointer; white-space:nowrap; position:relative }
.be-row::before { content:''; position:absolute; left:7px; top:50%; width:6px; height:6px; margin-top:-3px; border:1px solid #e0a030; border-radius:1px }
.be-row:hover { background:#3a3a3a }
.be-grow { font-weight:600; color:#ffd37a }
.be-grow::before { border-radius:50%; }
.be-fold { display:inline-block; width:14px; margin-left:-4px; color:#bbb; text-align:center; cursor:pointer }
.be-fold:hover { color:#fff }
.be-num { display:inline-grid; place-items:center; min-width:15px; height:15px; margin-right:5px; padding:0 3px; border-radius:8px; background:#e0a040; color:#1d1d1d; font:700 10px/1 sans-serif; vertical-align:1px }
.be-area { color:#ffe3a8; border-top:1px solid #343434 }
.be-area::before { display:none }
.be-row.multi { background:#2f4a73; color:#fff }
.be-row.on { background:#4772b3; color:#fff }
.be-row.off { opacity:.42; font-style:italic }
.be-row.on::before { border-color:#fff; background:#ffd37a }
.be-name { padding:2px 0 6px; color:#f0f0f0; font-weight:600; min-height:20px }
.be-name em { font-style:normal; font-weight:400; color:#8a8a8a }
.be-grp { margin-bottom:7px }
.be-gl { display:flex; align-items:center; color:#a8a8a8; margin-bottom:2px }
.be-gl button { display:inline-grid; place-items:center; margin-left:auto; background:#3c3c3c; color:#cfcfcf; border:0; border-radius:3px; width:22px; height:17px; cursor:pointer; padding:0; font:12px sans-serif; line-height:1 }
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
.be-rrow { display:flex; align-items:center; gap:4px; padding:3px 8px; flex-wrap:wrap }
.be-rl { width:72px; color:#bdbdbd; flex:none }
.be-chip { padding:2px 7px; border:1px solid #555; background:#2c2c2c; color:#ddd; border-radius:3px; cursor:pointer; font:inherit }
.be-chip.on { background:#4772b3; border-color:#5a86c8; color:#fff }
.be-chip:disabled, .be-btn:disabled { opacity:.4; cursor:default }
.be-note { padding:4px 8px; color:#9a9a9a; font-size:11px }
.be-color { width:44px; height:24px; padding:0; border:1px solid #555; background:#2a2a2a; vertical-align:middle; margin-right:8px; cursor:pointer; }
.be-btn { background:#3d3d3d; color:#d6d6d6; border:1px solid #555; border-radius:3px; padding:3px 10px; font-size:12px; cursor:pointer; }
.be-btn:hover { background:#4a4a4a; }
`
const TOOL_ICONS: Record<Tool, string> = {
  select: '<svg viewBox="0 0 24 24"><path d="M6 3l12 9-5.5 1.2L16 20l-2.6 1.2-3.2-6.9L6 18z"/></svg>',
  move: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
  scale: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="10" height="10" rx="1"/><path d="M14 10l6-6M15 4h5v5"/></svg>',
}
function panel() {
  if (typeof document === 'undefined') return
  if (!state.on) { tucked = false; showDock(); el?.remove(); el = null; info = null; fields = []; toolButtons = []; rows = new Map(); built = ''; setListHot(null); return }
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
    if (tucked) requestAnimationFrame(() => setTucked(true))
    const h = (tag: string, cls?: string, text?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
    // (its top edge a grip: dragged up, the panel grows taller (it stands on the bottom); the height kept for next time)
    const grip = h('div', 'be-grip')
    grip.title = T().resize
    const panel = el
    const keptH = Number(localStorage.getItem(KEY_PH) ?? 0)
    const fit = (px: number) => Math.max(220, Math.min(window.innerHeight - 110, px))
    if (keptH > 0) { panel.style.height = `${fit(keptH)}px`; panel.style.maxHeight = 'none' }
    grip.onpointerdown = (e) => {
      e.preventDefault(); e.stopPropagation()
      const y0 = e.clientY, h0 = panel.offsetHeight
      grip.setPointerCapture(e.pointerId)
      grip.onpointermove = (m) => { panel.style.height = `${fit(h0 + (y0 - m.clientY))}px`; panel.style.maxHeight = 'none' }
      grip.onpointerup = () => {
        grip.onpointermove = null; grip.onpointerup = null
        try { localStorage.setItem(KEY_PH, String(panel.offsetHeight)) } catch { /* (not kept) */ }
      }
    }
    el.appendChild(grip)
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
    // (the panel folded down to its title bar, and shut (leaving the mode, as G or Esc))
    const minB = h('button', 'be-win') as HTMLButtonElement
    withGlyph(minB, 'minus', '', 12)
    minB.title = T().minimize
    minB.onclick = (e) => { e.stopPropagation(); setTucked(true) }
    const closeB = h('button', 'be-win be-close') as HTMLButtonElement
    withGlyph(closeB, 'close', '', 12)
    closeB.title = T().close
    closeB.onclick = (e) => { e.stopPropagation(); toggleEdit() }
    head.append(minB, closeB)
    // (the title bar drags the whole panel about the window, as a window's does; kept inside the window, and where it's left kept)
    const place = (x: number, b: number) => {
      const w = panel.offsetWidth || 292, hh = panel.offsetHeight || 200
      panel.style.left = `${Math.max(0, Math.min(window.innerWidth - w, x))}px`
      panel.style.bottom = `${Math.max(0, Math.min(window.innerHeight - Math.min(hh, 40), b))}px`
    }
    try {
      const kept = JSON.parse(localStorage.getItem(KEY_PPOS) ?? 'null')
      if (Array.isArray(kept) && kept.length === 2) requestAnimationFrame(() => place(kept[0], kept[1]))
    } catch { /* (none kept) */ }
    head.style.cursor = 'move'
    head.onpointerdown = (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault(); e.stopPropagation()
      const r = panel.getBoundingClientRect()
      const dx = e.clientX - r.left, db = (window.innerHeight - e.clientY) - (window.innerHeight - r.bottom)
      head.setPointerCapture(e.pointerId)
      head.onpointermove = (m) => place(m.clientX - dx, window.innerHeight - m.clientY - db)
      head.onpointerup = () => {
        head.onpointermove = null; head.onpointerup = null
        try { localStorage.setItem(KEY_PPOS, JSON.stringify([parseFloat(panel.style.left), parseFloat(panel.style.bottom)])) } catch { /* (not kept) */ }
      }
    }
    const body = h('div', 'be-body')
    const section = (title: string) => {
      const sec = h('div', 'be-sec'), st = h('div', 'be-st', title), sc = h('div', 'be-sc')
      st.onclick = () => sec.classList.toggle('shut')
      sec.append(st, sc)
      body.appendChild(sec)
      return sc
    }
    // Outliner: every piece that can be taken hold of, a search above, the chosen one lit
    // (the backdrop behind the shop: its colour picked here, the glow in its middle and the dark at its edges following it; kept in the browser)
    const bgRow = section(T().backdrop)
    const pick = h('input', 'be-color') as HTMLInputElement
    pick.type = 'color'
    pick.value = backdropColor()
    pick.oninput = () => setBackdrop(pick.value)
    const bgReset = h('button', 'be-btn', T().backdropReset) as HTMLButtonElement
    bgReset.onclick = () => { setBackdrop(BACKDROP_DEFAULT); pick.value = BACKDROP_DEFAULT }
    bgRow.append(pick, bgReset)
    const out = section(T().outliner)
    summary = h('div', 'be-sum') as HTMLDivElement
    out.appendChild(summary)
    trisLine = h('div', 'be-sum be-tris', T().sceneTris(sceneTris)) as HTMLDivElement
    trisLine.title = T().sceneTrisTip
    out.appendChild(trisLine)
    const find = h('input', 'be-find') as HTMLInputElement
    find.placeholder = T().find
    const list = h('div', 'be-list')
    rows = new Map()
    rowTab = new Map()
    rowUnder = new Map()
    let building: ListTab = 'scene'
    // (the views' areas first (each with its view's number, as the views' spots have it), the other groups, each with what's in it under it, folded
    // away until opened; then every piece in no group)
    const addRow = (id: string, label: string, depth: number, under: string[], kind: 'piece' | 'group' | 'area' = 'piece') => {
      const group = kind !== 'piece'
      const row = h('div', `be-row${group ? ' be-grow' : ''}${kind === 'area' ? ' be-area' : ''}`)
      if (group) {
        // (its arrow folds what's in it away, or opens it)
        const fold = h('span', 'be-fold')
        withGlyph(fold, open.has(id) ? 'caretD' : 'caretR', '', 10)
        fold.title = T().fold
        fold.onclick = (e) => {
          e.stopPropagation()
          if (open.has(id)) open.delete(id); else open.add(id)
          withGlyph(fold, open.has(id) ? 'caretD' : 'caretR', '', 10)
          keepOpen(); showRows?.()
        }
        row.appendChild(fold)
      }
      const num = kind === 'area' ? VIEW_SPOTS.findIndex((v) => AREA + v.id === id) : -1
      if (num >= 0) row.appendChild(h('b', 'be-num', String(num + 1)))
      row.appendChild(document.createTextNode((depth > 0 && !group ? '└ ' : '') + label))
      if (depth) row.style.paddingLeft = `${12 + depth * 16}px`
      row.title = kind === 'area' ? T().rowArea : group ? T().rowGroup : T().rowPiece
      row.onclick = (e) => {
        const ev = e as MouseEvent
        if (!group && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) { pickToggle(id); return }
        // (a piece hidden by hand (H), chosen from the list: shown again)
        if (state.hidden.includes(id)) state.hidden = state.hidden.filter((x) => x !== id)
        if (!group) registry.get(id)?.focus()
        state.picked = []
        select(id)
      }
      // (the row under the pointer lights its piece in the scene, or every piece of its group, to find it there before it's chosen)
      row.onmouseenter = () => setListHot(id)
      row.onmouseleave = () => setListHot(null)
      list.appendChild(row)
      rows.set(id, row as HTMLDivElement)
      rowTab.set(id, building)
      rowUnder.set(id, under)
    }
    // (each piece followed by the pieces inside it, a step further in, as an outliner's hierarchy)
    const childrenOf = (id: string) => [...registry].filter(([, r]) => r.parent === id).map(([k]) => k)
    const addTree = (id: string, depth: number, under: string[] = []) => {
      addRow(id, pieceName(registry.get(id)!.label, lang), depth, under)
      for (const k of childrenOf(id)) if (!groupOf(k)) addTree(k, depth + 1, under)
    }
    const addGroup = (gid: string, depth: number, under: string[] = []) => {
      const g = state.groups[gid]
      const n = leavesOf(state.groups, gid).filter((m) => registry.has(m)).length
      addRow(gid, `${pieceName(g.name, lang)}（${n}）`, depth, under, isArea(gid) ? 'area' : 'group')
      for (const m of g.members) {
        if (state.groups[m]) addGroup(m, depth + 1, [...under, gid])
        else if (registry.has(m)) addTree(m, depth + 1, [...under, gid])
      }
    }
    // (in two tabs: the scene's pieces, and the views' cameras)
    const isCam = (id: string) => id.startsWith('viewcam-')
    const tops = Object.keys(state.groups).filter((gid) => !groupOf(gid))
    const areaAt = (gid: string) => VIEW_SPOTS.findIndex((v) => AREA + v.id === gid)
    for (const gid of tops.filter(isArea).sort((a, b) => areaAt(a) - areaAt(b))) addGroup(gid, 0)
    for (const gid of tops.filter((g) => !isArea(g))) addGroup(gid, 0)
    for (const [id, r] of registry) if (!isCam(id) && !groupOf(id) && !(r.parent && registry.has(r.parent))) addTree(id, 0)
    building = 'camera'
    for (const [id, r] of registry) if (isCam(id) && !groupOf(id) && !(r.parent && registry.has(r.parent))) addTree(id, 0)
    const tabs = h('div', 'be-tabs')
    const tabButtons = (['scene', 'camera'] as const).map((t) => {
      const b = h('button', 'be-tab', t === 'scene' ? T().sceneHead : T().cameraHead) as HTMLButtonElement
      b.onclick = () => { listTab = t; showRows?.() }
      tabs.appendChild(b)
      return [t, b] as const
    })
    // (only the rows of the tab shown, and of those only what's not folded away in a group, or (searching) what the search finds, folded or not)
    showRows = () => {
      const q = find.value.trim().toLowerCase()
      for (const [id, row] of rows) {
        const shown = q ? (row.textContent ?? id).toLowerCase().includes(q) : (rowUnder.get(id) ?? []).every((g) => open.has(g))
        row.style.display = rowTab.get(id) === listTab && shown ? '' : 'none'
        const fold = row.querySelector<HTMLElement>('.be-fold')
        if (fold) withGlyph(fold, open.has(id) ? 'caretD' : 'caretR', '', 10)
      }
      for (const [t, b] of tabButtons) b.classList.toggle('on', t === listTab)
    }
    find.oninput = () => showRows?.()
    out.append(find, tabs, list)
    // (the list taller or shorter by the grip under it, to see more of it at once; the height kept for next time)
    const lgrip = h('div', 'be-lgrip')
    lgrip.title = T().resize
    const keptLH = Number(localStorage.getItem(KEY_LH) ?? 0)
    const fitL = (px: number) => Math.max(90, Math.min(window.innerHeight - 260, px))
    if (keptLH > 0) list.style.height = `${fitL(keptLH)}px`
    lgrip.onpointerdown = (e) => {
      e.preventDefault(); e.stopPropagation()
      const y0 = e.clientY, h0 = list.offsetHeight
      lgrip.setPointerCapture(e.pointerId)
      lgrip.onpointermove = (m) => { list.style.height = `${fitL(h0 + (m.clientY - y0))}px` }
      lgrip.onpointerup = () => {
        lgrip.onpointermove = null; lgrip.onpointerup = null
        try { localStorage.setItem(KEY_LH, String(list.offsetHeight)) } catch { /* (not kept) */ }
      }
    }
    out.appendChild(lgrip)
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
      const back = h('button') as HTMLButtonElement
      withGlyph(back, 'undo', '', 11)
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
    // (the keys, as in Maya, at a glance)
    // (each key and what it does a chip of its own, never broken across a line (the owner's: nothing on two lines); the chips flow on)
    const keys = h('div', 'be-keys')
    // (on a Mac, Ctrl is ⌘ (the owner's))
    const mac = isMac(navigator.platform, navigator.userAgent)
    for (const item of T().hotkeys.split(/\n|　|\s{3,}/).map((x) => x.trim()).filter(Boolean)) {
      keys.appendChild(h('span', 'be-key', mac ? item.replace(/Ctrl\+Z／Y|Ctrl\+Z \/ Y/, '⌘+Z／⌘+Shift+Z').replace(/Ctrl/g, '⌘') : item))
    }
    tr.appendChild(keys)
    // Render: how the chosen piece is drawn (its shading, its material, its outline, its shadows), for it alone (a group: each of its members)
    const rs = section(T().render)
    rs.title = T().renderTip
    const rsNote = h('div', 'be-note', T().renderNone)
    rs.appendChild(rsNote)
    const targets = () => { const id = state.selected; return !id ? [] : leavesOf(state.groups, id) }
    type Opt = { label: string; key: keyof RenderPref; choices: [string, RenderPref[keyof RenderPref]][] }
    const opts: Opt[] = [
      { label: T().shade, key: 'shade', choices: [[T().shadeSmooth, 'smooth'], [T().shadeFlat, 'flat']] },
      { label: T().look, key: 'look', choices: [[T().lookKeep, 'keep'], [T().lookToon, 'toon'], [T().lookReal, 'real'], [T().lookUnlit, 'unlit']] },
      { label: T().ink, key: 'ink', choices: [[T().on, true], [T().off, false]] },
      { label: T().cast, key: 'cast', choices: [[T().on, true], [T().off, false]] },
      { label: T().receive, key: 'receive', choices: [[T().on, true], [T().off, false]] },
    ]
    const chips: { key: keyof RenderPref; value: RenderPref[keyof RenderPref]; el: HTMLButtonElement }[] = []
    for (const o of opts) {
      const row = h('div', 'be-rrow')
      row.appendChild(h('span', 'be-rl', o.label))
      for (const [text, value] of o.choices) {
        const b = h('button', 'be-chip', text) as HTMLButtonElement
        b.onclick = () => { for (const id of targets()) setRenderPref(id, { [o.key]: value } as RenderPref) }
        row.appendChild(b)
        chips.push({ key: o.key, value, el: b })
      }
      rs.appendChild(row)
    }
    const rReset = h('button', 'be-btn', T().renderReset) as HTMLButtonElement
    rReset.onclick = () => { for (const id of targets()) clearRenderPref(id) }
    rs.appendChild(rReset)
    renderView = () => {
      const ids = targets()
      const p = ids.length ? renderPrefOf(ids[0]) : {}
      rsNote.style.display = ids.length ? 'none' : ''
      rReset.disabled = !ids.length
      for (const c of chips) {
        c.el.disabled = !ids.length
        c.el.classList.toggle('on', !!ids.length && (p[c.key] ?? RENDER_DEFAULT[c.key]) === c.value)
      }
    }
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
    withGlyph(spaceBadge, state.space === 'world' ? 'globe' : 'box', state.space === 'world' ? T().spaceBadgeWorld : T().spaceBadgeLocal, 12)
    spaceBadge.title = T().spaceBadgeTip
    spaceBadge.classList.toggle('local', state.space === 'local')
  }
  if (spaceButton) spaceButton.classList.toggle('local', state.space === 'local')
  if (spaceButton) { spaceButton.textContent = state.space === 'local' ? T().spaceLocalShort : T().spaceWorldShort; spaceButton.title = state.space === 'local' ? T().spaceLocal : T().spaceWorld }
  if (pivotButton) { pivotButton.textContent = 'D'; pivotButton.title = T().pivot; pivotButton.classList.toggle('on', state.pivotMode) }
  for (const [id, row] of rows) { row.classList.toggle('on', state.selected === id); row.classList.toggle('multi', state.picked.includes(id)); row.classList.toggle('off', state.hidden.includes(id)) }
  // (a new pick shows its own tab: a camera picked in the scene brings up the cameras)
  if (state.selected !== tabFollows) {
    tabFollows = state.selected
    const t = state.selected ? rowTab.get(state.selected) : undefined
    if (t) listTab = t
    // (and the groups it's in opened, so its row is there to see, scrolled to)
    const under = state.selected ? rowUnder.get(state.selected) ?? [] : []
    if (under.some((g) => !open.has(g))) { for (const g of under) open.add(g); keepOpen() }
    const row = state.selected ? rows.get(state.selected) : undefined
    if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'nearest' }))
  }
  showRows?.()
  if (summary) {
    // (how much furniture there is: every piece that can be taken hold of, how many have been moved, turned or sized from where they began, and the groups)
    const pieces = [...registry.keys()]
    const moved = pieces.filter((id) => offsetOf(id).some((v) => Math.abs(v) > 1e-6) || rotationOf(id).some((v) => Math.abs(v) > 1e-6) || scaleOf(id).some((v) => Math.abs(v - 1) > 1e-6)).length
    summary.textContent = T().summary(pieces.length, moved, Object.keys(state.groups).length)
  }
  el?.querySelectorAll('.be-grp:last-of-type .be-f').forEach((f, k) => f.classList.toggle('axon', scaleAxis === k))
  renderView?.()
  if (info) {
    const id = state.selected
    const r = id ? registry.get(id) : null
    info.innerHTML = id ? `${state.groups[id] ? glyphSvg('group', 11) + ' ' + pieceName(state.groups[id].name, lang) + T().groupMark : r ? pieceName(r.label, lang) : id}` : `<em>${T().nothing}</em>`
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

// (the Render section follows its settings as they change)
const offRenderPrefs = onRenderPrefs(() => { if (state.on) panel() })

// ---- the key (once, whichever pieces are mounted)
if (typeof window !== 'undefined') {
  const onKey = (e: KeyboardEvent) => {
    const t0 = e.target
    const typing = t0 instanceof HTMLInputElement || t0 instanceof HTMLTextAreaElement || (t0 instanceof HTMLElement && t0.isContentEditable)
    // (Ctrl+Z / Ctrl+Y in edit mode, unless it's text being typed into a field, which has its own)
    if ((e.ctrlKey || e.metaKey) && state.on && !typing) {
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (k === 'y') { e.preventDefault(); redo(); return }
    }
    // (H hides what's chosen, Alt+H shows all that's hidden: by the key's place, as Alt+H types another letter on a Mac)
    if (state.on && !typing && !e.repeat && !e.ctrlKey && !e.metaKey && e.code === 'KeyH') { e.preventDefault(); if (e.altKey) showHidden(); else hideSelected(); return }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (state.on && !typing) {
      const k = e.key.toLowerCase()
      // (X, Y, Z choose the axis the + and - keys scale along (again, all three together); + and - scale the chosen piece)
      if (k === 'x' || k === 'y' || k === 'z') { e.preventDefault(); setScaleAxis(({ x: 0, y: 1, z: 2 } as const)[k]); return }
      // (as Maya's + and -: the handles bigger or smaller on the screen, not the piece; the panel's − / + scale the piece)
      if (k === '+' || k === '=') { e.preventDefault(); setGizmoSize(1); return }
      if (k === '-' || k === '_') { e.preventDefault(); setGizmoSize(-1); return }
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
      // (as in Maya: F frames what's picked, A the whole shop, Esc lets go of it)
      if (k === 'f') { e.preventDefault(); frameSelected(); return }
      if (k === 'a') { e.preventDefault(); window.dispatchEvent(new CustomEvent('edit-frame-all')); return }
      // (Esc: lets go of what's picked; with nothing picked, leaves the developer mode, as G does)
      if (k === 'escape') { e.preventDefault(); if (state.selected || state.picked.length) { state.picked = []; select(null) } else toggleEdit(); return }
      if (k === '4') { e.preventDefault(); setWire(true); return }
      if (k === '5') { e.preventDefault(); setWire(false); return }
    }
    if (e.key !== 'g' && e.key !== 'G') return
    const t = e.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return
    toggleEdit()
  }
  window.addEventListener('keydown', onKey)
  // (a hot update swaps this module for a new copy: the old one's key let go of (or G was heard by every copy left behind, each with its own
  // developer mode, one more with every edit), its panel and notice taken away)
  replaces(import.meta.hot, () => { window.removeEventListener('keydown', onKey); offRenderPrefs(); el?.remove(); toastEl?.remove() })
  if (import.meta.env?.DEV) (window as unknown as { __edit?: unknown }).__edit = { groupFrame, framesOf: (id: string) => [frames.get(id), framesObj.get(id)], get: getEdit, moveTo, turnTo, select, toggle: toggleEdit, confirm: confirmEdit, cancel: cancelEdit, setLocked, undo, redo, setTool, frame: (id: string) => frames.get(id), cams: () => viewCams?.() }
}
