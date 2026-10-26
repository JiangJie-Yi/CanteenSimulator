// Which folder may use which (see CLAUDE.md). Keeping the imports one way is what lets a change to one shop not
// break another: data <- game <- scene <- shops / ui <- App.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
const all = files(SRC).map((f) => ({ path: relative(SRC, f).replace(/\\/g, '/'), text: readFileSync(f, 'utf8') }))
const importsOf = (text: string) => [...text.matchAll(/from '(@\/[^']+|\.{1,2}\/[^']+)'/g)].map((m) => m[1])

/** what each folder may import from (besides itself and packages) */
const ALLOWED: Record<string, string[]> = {
  data: [],
  game: ['data'],
  scene: ['data', 'game'],
  ui: ['data', 'game', 'scene'],
  'shops/grill': ['data', 'game', 'scene', 'ui'],
}
const folderOf = (path: string) => Object.keys(ALLOWED).sort((a, b) => b.length - a.length).find((k) => path.startsWith(k + '/'))

describe('architecture', () => {
  it('puts every source file in a folder (only App and main at the top)', () => {
    for (const f of all) {
      if (f.path === 'App.tsx' || f.path === 'main.tsx') continue
      expect(folderOf(f.path), f.path).toBeDefined()
    }
  })
  it('imports other folders through the @/ alias, never ../', () => {
    for (const f of all) for (const spec of importsOf(f.text)) expect(spec.startsWith('../'), `${f.path}: ${spec}`).toBe(false)
  })
  it('only imports the folders it may', () => {
    for (const f of all) {
      const own = folderOf(f.path)
      if (!own) continue
      for (const spec of importsOf(f.text)) {
        if (!spec.startsWith('@/')) continue
        const target = folderOf(spec.slice(2) + '/x')
        if (target === own) continue
        expect(ALLOWED[own].includes(target ?? '?'), `${f.path} imports ${spec}`).toBe(true)
      }
    }
  })
})
