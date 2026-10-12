// What a customer says is shown over their head a short line at a time, so a long line says itself in turn rather
// than standing in a tall thin column.

/** at most this many characters to a line, each shown this many seconds */
export const SAY_CHUNK = 10
export const SAY_EACH = 1.8

/** the line cut into pieces of up to SAY_CHUNK characters, at its commas and stops where it can */
export function sayChunks(text: string) {
  const out: string[] = []
  let line = ''
  for (const part of text.split(/(?<=[，、。！？,.!?])/)) {
    for (const ch of [...part]) {
      line += ch
      if ([...line].length >= SAY_CHUNK) { out.push(line); line = '' }
    }
    if ([...line].length >= SAY_CHUNK * 0.6) { out.push(line); line = '' }
  }
  if (line) out.push(line)
  return out
}
