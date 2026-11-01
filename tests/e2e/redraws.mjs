// Who redraws while the shop is open, and why: the shop opened with every job filled, at x2, the overview; after WARM ms every React commit
// for SPAN ms is walked (through a stand-in for the devtools' hook), and each function component that rendered in it is put down to what
// changed: its props (which ones; "a new object, same values" is a parent's redraw carrying it along, nothing of its own changed: a memo
// would spare it) or one of its own state hooks (named by the line that declares it, read from the module as the dev server serves it).
//   node tests/e2e/redraws.mjs     (WARM=<ms> default 45000, SPAN=<ms> default 30000, TOP=<n> default 30; needs the dev server, for names)
import { chromium } from 'playwright-core'

const WARM = +(process.env.WARM ?? 45000), SPAN = +(process.env.SPAN ?? 30000)
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
// every useState/useReducer's setter remembered with the stack that made it (the line declaring the state)
await ctx.route(/\/node_modules\/\.vite\/deps\/react\.js/, async (route) => {
  const res = await route.fetch()
  const body = (await res.text()).replace('export default require_react();',
    'const __R = require_react(); (globalThis.__whyPatch || (() => {}))(__R); export default __R;')
  await route.fulfill({ response: res, body })
})
await ctx.addInitScript(() => {
  const DECL = new WeakMap()
  window.__whyPatch = (R) => {
    for (const k of ['useState', 'useReducer']) {
      const orig = R[k]
      R[k] = function () {
        const r = orig.apply(this, arguments)
        if (r && typeof r[1] === 'function' && !DECL.has(r[1])) DECL.set(r[1], new Error().stack)
        return r
      }
    }
  }
  const W = window.__why = { on: false, commits: new Map(), comps: new Map(), err: null }
  const nameOf = (f) => {
    const t = f.type
    if (typeof t === 'function') return t.displayName || t.name || 'anon'
    if (t && typeof t === 'object') {
      const inner = t.type || t.render
      return t.displayName || inner?.displayName || inner?.name || 'anon'
    }
    return null
  }
  const FN = new Set([0, 11, 15])
  const site = (stack) => {
    const ls = (stack ?? '').split('\n')
    for (let i = 2; i < ls.length; i++) if (/\/src\//.test(ls[i])) return ls[i].trim()
    return '?'
  }
  const rec = (n, p) => {
    const nm = nameOf(n)
    if (!nm) return
    let c = W.comps.get(nm)
    if (!c) W.comps.set(nm, (c = { n: 0, causes: new Map() }))
    c.n++
    const bump = (k) => c.causes.set(k, (c.causes.get(k) ?? 0) + 1)
    let any = false
    if (n.memoizedProps !== p.memoizedProps) {
      const a = p.memoizedProps || {}, bb = n.memoizedProps || {}
      const ch = []
      for (const k of new Set([...Object.keys(a), ...Object.keys(bb)])) if (!Object.is(a[k], bb[k])) ch.push(k)
      bump('props: ' + (ch.length ? ch.slice(0, 8).join(',') + (ch.length > 8 ? ',…' : '') : '(a new object, same values)'))
      any = true
    }
    let h = n.memoizedState, ph = p.memoizedState
    while (h && ph && typeof h === 'object' && 'next' in h) {
      if (h.queue && typeof h.queue.dispatch === 'function' && !Object.is(h.memoizedState, ph.memoizedState)) {
        bump('state: ' + site(DECL.get(h.queue.dispatch)))
        any = true
      }
      h = h.next
      ph = ph.next
    }
    if (!any) bump('(nothing of its own: context or a store)')
  }
  const walk = (root) => {
    const st = [root.current]
    while (st.length) {
      const n = st.pop()
      const p = n.alternate
      if (FN.has(n.tag) && p && (n.flags & 1)) rec(n, p)
      if (!p || n.child !== p.child) for (let c = n.child; c; c = c.sibling) st.push(c)
    }
  }
  const hook = (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(), supportsFiber: true, n: 0,
    inject(r) { const id = ++hook.n; hook.renderers.set(id, r); return id },
    onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
    onCommitFiberRoot(id, root) {
      if (!W.on) return
      W.commits.set(id, (W.commits.get(id) ?? 0) + 1)
      try { walk(root) } catch (e) { W.err = String(e) }
    },
  })
})
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`${process.env.BASE ?? 'http://localhost:5173'}/JapaneseGrillSimulator/?pace=0`, { timeout: 60000 })
await p.waitForTimeout(5000)
if (await p.locator('.welcome-go').count()) await p.locator('.welcome-go').click()
await p.waitForTimeout(2500)
await p.locator('.view-reset').click({ timeout: 45000 })
await p.locator('.view-menu button', { hasText: '火烤灶台' }).first().click()
await p.locator('.fridge-toggle').waitFor({ timeout: 45000 })
await p.locator('.fridge-toggle').click({ timeout: 60000 })
await p.waitForTimeout(500)
await p.locator('.tally-restock.is-full').click()
await p.locator('.fridge-toggle').click()
await p.locator('.money-chip').click()
await p.waitForTimeout(300)
await p.locator('.ofc-tabs button').nth(1).click()
await p.waitForTimeout(200)
await p.locator('.ofc-hireall').click()
await p.waitForTimeout(300)
await p.locator('.ofc-tabs button').nth(2).click()
await p.waitForTimeout(200)
await p.locator('.nb-views button').nth(2).click()
await p.locator('.nb-chef-acts button').nth(0).click()
await p.waitForTimeout(900)
await p.locator('.nb-views button').nth(0).click()
const publish = p.locator('.nb-embedded .nb-publish button:not(.nb-off)')
for (let guard = 0; guard < 60 && (await publish.count()); guard++) { await publish.first().click(); await p.waitForTimeout(50) }
await p.locator('.office .panel-x').click()
await p.locator('.ai-toggle').click()
await p.locator('.speed-toggle').click()
await p.locator('.view-reset').click()
await p.locator('.view-menu button', { hasText: '自由' }).first().click()
await p.waitForTimeout(WARM)
await p.evaluate(() => { window.__why.on = true })
await p.waitForTimeout(SPAN)
const out = await p.evaluate((top) => {
  const W = window.__why
  W.on = false
  return {
    err: W.err,
    commits: [...W.commits],
    comps: [...W.comps].map(([k, v]) => [k, v.n, [...v.causes].sort((x, y) => y[1] - x[1]).slice(0, 8)]).sort((x, y) => y[1] - x[1]).slice(0, top),
  }
}, +(process.env.TOP ?? 30))
const sec = SPAN / 1000
console.log('commits per renderer (a second):', out.commits.map(([id, n]) => `#${id} ${(n / sec).toFixed(1)}`).join('  '), out.err ? `ERR ${out.err}` : '')
// the declaring line, read from the module as the dev server serves it
const src = new Map()
const lineAt = async (s) => {
  const m = /(https?:\/\/[^\s)]+?):(\d+):(\d+)\)?$/.exec(s)
  if (!m) return s
  if (!src.has(m[1])) src.set(m[1], (await (await fetch(m[1])).text()).split('\n'))
  const file = m[1].replace(/^.*\/src\//, '').replace(/\?.*$/, '')
  return `${file}: ${(src.get(m[1])[+m[2] - 1] ?? '').trim().slice(0, 110)}`
}
for (const [name, n, causes] of out.comps) {
  console.log(`${(n / sec).toFixed(1).padStart(6)}/s  ${name}`)
  for (const [k, c] of causes) console.log(`          ${(c / sec).toFixed(1).padStart(5)}/s  ${k.startsWith('state: ') ? 'state ' + (await lineAt(k.slice(7))) : k}`)
}
await b.close()
