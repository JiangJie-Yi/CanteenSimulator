// A small Given / When / Then layer over Vitest, so a behaviour reads as a story and fails with the step that broke:
//
//   feature('炭堆', () => {
//     scenario('炭疊太高會被擋下', ({ given, when, then }) => {
//       given('一個空的炭堆', (w) => { w.pile = [] })
//       when('連續放入 100 根炭', (w) => { ... })
//       then('最後一根被拒絕', (w) => { expect(...) })
//     })
//   })
//
// Steps run in the order written, sharing one world object `w`; `and` / `but` add a step to the one before.
import { describe, it } from 'vitest'

type World = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Step = (w: World) => void | Promise<void>
type Kind = 'Given' | 'When' | 'Then'
type Add = (text: string, fn: Step) => void
type Steps = { given: Add; when: Add; then: Add; and: Add; but: Add }

export function feature(name: string, body: () => void) {
  describe(`Feature: ${name}`, body)
}

export function scenario(name: string, body: (s: Steps) => void) {
  const steps: { label: string; fn: Step }[] = []
  const add = (kind: Kind | null) => (text: string, fn: Step) => {
    steps.push({ label: `${kind ?? 'And'} ${text}`, fn })
  }
  body({ given: add('Given'), when: add('When'), then: add('Then'), and: add(null), but: add(null) })
  it(`Scenario: ${name}`, async () => {
    const w: World = {}
    for (const s of steps) {
      try { await s.fn(w) } catch (e) {
        if (e instanceof Error) e.message = `[${s.label}]\n${e.message}`
        throw e
      }
    }
  })
}
