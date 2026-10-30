// The customers' ways through the shop, checked in a browser: the shop is set up and opened as in flow.mjs, then every few tenths of a
// second each customer who's walking (in, out, to the toilet or the fridge, back) is tested where they are: nothing solid round them at
// knee and at chest height (rays out to their body's reach), and nothing under their feet but the floor. Each clash is reported once per
// customer and place, with what they walked into.
//
//   npm run dev          (in another terminal)
//   node tests/e2e/paths.mjs [url]        (WATCH=<ms> how long to watch, default 120000; SHOT=<dir> pictures of each clash)
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:5173/JapaneseGrillSimulator/'
const WATCH = Number(process.env.WATCH ?? 120000)
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
const page = await ctx.newPage()
page.setDefaultTimeout(8000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(URL, { timeout: 60000 })
await page.waitForTimeout(5000)
if (await page.locator('.welcome-go').count()) await page.locator('.welcome-go').click()
await page.waitForTimeout(2500)
await page.locator('.fridge-toggle').waitFor({ timeout: 45000 })
await page.locator('.fridge-toggle').click({ timeout: 60000 })
await page.waitForTimeout(500)
await page.locator('.tally-restock.is-full').click()
await page.locator('.fridge-toggle').click()
await page.locator('.office-toggle').click()
await page.waitForTimeout(200)
await page.locator('.ofc-tabs button').nth(1).click()
await page.waitForTimeout(200)
const hire = page.locator('.ofc-role').nth(0).locator('.ofc-person:not(.is-hired) button').first()
if (await hire.count()) await hire.click()
await page.locator('.ofc-tabs button').nth(0).click()
await page.waitForTimeout(200)
await page.locator('.nb-views button').nth(2).click()
await page.locator('.nb-chef-acts button').nth(0).click()
await page.waitForTimeout(900)
await page.locator('.nb-views button').nth(0).click()
const publish = page.locator('.nb-embedded .nb-publish button:not(.nb-off)')
for (let guard = 0; guard < 60 && (await publish.count()); guard++) { await publish.first().click(); await page.waitForTimeout(50) }
await page.locator('.ofc-close').click()
await page.locator('.ai-toggle').click()
// (thirstier and readier for the toilet than usual, so the side trips are walked while we watch)
await page.evaluate(() => { window.__drinkRate = 0.08 })

const clashes = new Map()
let samples = 0
/** where each customer sat: their own stool, which they're meant to touch getting on and off */
const sitAt = new Map()
for (let t = 0; t < WATCH; t += 300) {
  await page.waitForTimeout(300)
  const found = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const groups = window.__guestGroups?.current, shown = window.__shown?.current
    if (!groups || !shown) return { list: [], walking: 0 }
    const scene = window.__scene
    // (batched meshes don't take rays in the game; for the test they do, and every face counts from either side)
    const restore = []
    scene.traverse((o) => {
      if (!o.isMesh) return
      if (o.raycast !== THREE.Mesh.prototype.raycast && !o.isInstancedMesh && !o.isSkinnedMesh) { restore.push([o, 'raycast', o.raycast]); o.raycast = THREE.Mesh.prototype.raycast }
      const m = o.material
      if (m && !Array.isArray(m) && m.side !== THREE.DoubleSide) { restore.push([m, 'side', m.side]); m.side = THREE.DoubleSide }
    })
    const people = new Set([...groups.values()])
    const isPerson = (o) => { for (let p = o; p; p = p.parent) if (people.has(p) || /^(Boss|guest|staff)/i.test(p.name)) return true; return false }
    const ignore = (o) => {
      const m = o.material
      if (!o.visible || !m || m.visible === false || (m.transparent && m.opacity < 0.3) || m.colorWrite === false) return true
      for (let p = o; p; p = p.parent) { if (!p.visible) return true; if (p.userData?.editHandle || p.userData?.fade || /noren|curtain|edit-gizmo|look-/i.test(p.name)) return true }
      return isPerson(o) || o.isSprite || o.isLine || o.isPoints || /outline|Shadow|shadow/.test(o.name) || m.type === 'ShadowMaterial'
    }
    const ray = new THREE.Raycaster()
    ray.camera = window.__cam
    const out = []
    let walking = 0
    const seats = []
    for (const s of shown) {
      if (s.phase === 'sit') { const g = groups.get(s.id); if (g) seats.push([s.id, g.getWorldPosition(new THREE.Vector3()).toArray()]) }
      if (s.phase === 'sit' || s.phase === 'wcIn') continue
      walking++
      const g = groups.get(s.id)
      if (!g || !g.visible) continue
      const p = g.getWorldPosition(new THREE.Vector3())
      // (their own size: the body's height and its girth, measured; the rays reach out to the body's edge)
      const bb = new THREE.Box3().setFromObject(g), bs = bb.getSize(new THREE.Vector3())
      const reach = Math.min(bs.x, bs.z) * 0.32
      for (const h of [0.3, 0.6]) {
        const from = new THREE.Vector3(p.x, bb.min.y + bs.y * h, p.z)
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          ray.set(from, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))
          ray.far = reach
          const hit = ray.intersectObjects(scene.children, true).find((x) => !ignore(x.object))
          if (hit) {
            let o = hit.object, names = []
            for (let i = 0; i < 4 && o; i++) { if (o.name) names.push(o.name); o = o.parent }
            const b = new THREE.Box3().setFromObject(hit.object), sz = b.getSize(new THREE.Vector3())
            const col = hit.object.material?.color ? '#' + hit.object.material.color.getHexString() : ''
            const mid = b.getCenter(new THREE.Vector3())
            out.push({ id: s.id, phase: s.phase, at: p.toArray().map((x) => +x.toFixed(2)), h, dist: +hit.distance.toFixed(3), mid: [mid.x, mid.z],
              what: (names.join('<') || hit.object.type) + ` ${col} ${hit.object.material?.map ? 'tex' : ''} [${sz.toArray().map((x) => x.toFixed(2))}]` })
            break
          }
        }
      }
    }
    for (const [o, k, v] of restore) o[k] = v
    return { list: out, walking, seats }
  })
  samples += found.walking ?? 0
  for (const [id, at] of found.seats ?? []) sitAt.set(id, at)
  for (const c of found.list) {
    const key = `${c.id}|${c.what}|${Math.round(c.at[0] * 2)},${Math.round(c.at[2] * 2)}`
    if (!clashes.has(key)) clashes.set(key, c)
  }
}
await browser.close()
const list = [...clashes.values()].filter((c) => {
  const at = sitAt.get(c.id)
  return !(at && c.mid && Math.hypot(at[0] - c.mid[0], at[2] - c.mid[1]) < 0.35)
})
// (grouped by what was walked into)
const by = new Map()
for (const c of list) { const k = c.what; by.set(k, [...(by.get(k) ?? []), c]) }
for (const [what, cs] of by) console.log(`✗ ${cs.length}× into ${what}: e.g. guest ${cs[0].id} (${cs[0].phase}) at ${cs[0].at.join(', ')}, height ${cs[0].h}, sat ${JSON.stringify(sitAt.get(cs[0].id)?.map((x) => +x.toFixed(2)))}`)
for (const e of errors) console.log('page error: ' + e)
console.log(list.length ? `\n${list.length} clashes` : '\nno clashes')
