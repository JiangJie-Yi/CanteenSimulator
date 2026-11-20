// The genkan's step, one at a time (item 414, found by the crowd audit, 2026-11-20: two customers who'd come in together, or got up and gone
// together, stood at the step in each other as they changed their shoes; and those on their way in to the bench walked into whoever stood
// there putting theirs on. The crowd's stepping aside was no help: no room abreast in the genkan's narrow way, the shoe cupboard one side and
// the stools the other, and two standing still aren't put one behind the other as two walking the same way are). As at a real genkan's
// narrow step: one there changing their shoes, the rest in line, a body's length apart, each moving up as the one ahead steps on. Pure: the
// shop gives each customer's walk (how far along their way, where their stop at the step is on it, how far on they let it go) and holds them
// while this says they wait.

/** who has the step (a customer's id, -1 no one) and the frame they were last seen with it; this frame; those waiting for it in turn, and
 * the frame each was last seen (one not walked a frame, gone from the shop's list, is out of it) */
export type StepTurn = { by: number; tick: number; now: number; line: number[]; seen: Map<number, number> }

export const newStepTurn = (): StepTurn => ({ by: -1, tick: 0, now: 0, line: [], seen: new Map() })

/** a new frame (before the customers are walked in it): one who had the step, or was waiting for it, and wasn't walked the frame before (gone
 * from the shop's list: sent away, out of the door, the shop shut) no longer has it, or their place in the line */
export function stepFrame(t: StepTurn) {
  t.now++
  if (t.by >= 0 && t.tick < t.now - 1) t.by = -1
  for (let i = t.line.length - 1; i >= 0; i--) {
    const id = t.line[i]
    if ((t.seen.get(id) ?? -1) < t.now - 1) { t.seen.delete(id); t.line.splice(i, 1) }
  }
}

/**
 * Whether customer `id`, `d` along their way (their walk as it stands, any stops before the step taken out), their stop at the step `at`
 * along it, waits this frame. The first within `gap` of it with no one on it and no one ahead of them in line takes it, and has it till
 * they're `until` along (past their stop: up into the room, or on their way out), or gone back out of the way to it. Anyone else coming up to
 * it joins the line and waits a body's length (`gap`) back from it for each one ahead of them, along their own way: the first `gap` back,
 * the next twice that, moving up as the line does.
 */
export function waitsForStep(t: StepTurn, id: number, d: number, at: number, until: number, gap: number): boolean {
  if (t.by === id && (d >= until || d < at - gap - 0.05)) t.by = -1
  if (t.by === id) { t.tick = t.now; return false }
  let k = t.line.indexOf(id)
  // (past it, or not yet up to the back of the line: not waiting, and out of the line if they were in it)
  if (d >= until || (k < 0 && d < at - gap * (t.line.length + 1))) {
    if (k >= 0) { t.line.splice(k, 1); t.seen.delete(id) }
    return false
  }
  // (no one on it, and no one ahead of them: theirs once they're within a body's length of it)
  if (t.by < 0 && (k === 0 || (k < 0 && t.line.length === 0))) {
    if (d < at - gap) { if (k === 0) t.seen.set(id, t.now); return false }
    if (k === 0) t.line.shift()
    t.seen.delete(id)
    t.by = id; t.tick = t.now
    return false
  }
  if (k < 0) { t.line.push(id); k = t.line.length - 1 }
  t.seen.set(id, t.now)
  return d >= at - gap * (k + 1)
}
