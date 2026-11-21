// The beckoning cats' coats written into their models' pictures (item 429): src/shops/grill/catCoat.ts works a coat out on a cat's picture
// as the cat loads, a tenth of a second a picture on the page's own thread (nine of them, nearly a second as the shop came up). Run once with
// the dev server up, with the game working them out (LuckyCat's and OwnLuckyCat's coatPicture calls on): each picture's coat is taken from
// the page (window.__coats, dev only, worked out only with ?bakecoats), matched to the model's own image it was made from (their sizes, and
// a few hundred points compared),
// and written back into that model in its place as a JPEG; the rest of each model's file byte for byte, its binary chunk repacked (as
// blender/shrink_textures.py does). Then the game loads them coated and works nothing out.
//
//   node scripts/bake-cat-coats.mjs [url]       (default http://localhost:5173/GrilledFishBusiness/?pace=0)
//
// (Item 465, the owner's 「這些貓咪的斑紋怎回事? 請回朔」: the coats taken off again, the four models back to before item 429; nothing
// carries a coat now.) The models carry their coats once it's run: run again on them and the coat goes on twice. To change a coat, take the four models back to
// before it was run (git: the commit before item 429's) and run it; after remaking ownluckycat.glb (blender/ownluckycat.py), run it on that.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://localhost:5173/GrilledFishBusiness/?pace=0&bakecoats=1'
const MODELS = ['luckycat1.glb', 'luckycat2.glb', 'luckycat3.glb', 'ownluckycat.glb']

/** a .glb's two chunks: its JSON and its binary */
function readGlb(buf) {
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
  const binStart = 20 + jsonLen
  const binLen = buf.readUInt32LE(binStart)
  return { json, bin: buf.subarray(binStart + 8, binStart + 8 + binLen) }
}
/** the .glb again, its images' bytes in `replace` (image index -> bytes, a JPEG) in their places, every buffer view laid out afresh */
function writeGlb({ json, bin }, replace) {
  const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength))
  for (const [i, bytes] of replace) {
    const img = json.images[i]
    views[img.bufferView] = bytes
    img.mimeType = 'image/jpeg'
  }
  const parts = []
  let off = 0
  json.bufferViews.forEach((v, k) => {
    const pad = (4 - (off % 4)) % 4
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad }
    v.byteOffset = off
    v.byteLength = views[k].length
    parts.push(Buffer.from(views[k]))
    off += views[k].length
  })
  const tail = (4 - (off % 4)) % 4
  if (tail) parts.push(Buffer.alloc(tail))
  const binOut = Buffer.concat(parts)
  json.buffers[0].byteLength = binOut.length
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  const jpad = (4 - (jsonBuf.length % 4)) % 4
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)])
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binOut.length, 8)
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4)
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binOut.length, 0); bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jh, jsonBuf, bh, binOut])
}

const files = MODELS.map((f) => ({ f, path: `public/models/${f}`, glb: readGlb(readFileSync(`public/models/${f}`)) }))
// (each model's images, as data URLs, for the page to decode and compare)
const images = files.flatMap(({ f, glb }) => (glb.json.images ?? []).map((img, i) => {
  const v = glb.json.bufferViews[img.bufferView]
  const bytes = glb.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)
  return { f, i, url: `data:${img.mimeType};base64,${Buffer.from(bytes).toString('base64')}` }
}))
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
await page.goto(URL, { timeout: 60000 })
await page.waitForFunction(() => (window.__coats?.size ?? 0) >= 7, null, { timeout: 120000 })
await page.waitForTimeout(1500)
const found = await page.evaluate(async (images) => {
  // (a picture's few hundred points, small, for comparing)
  const sample = (src) => {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24
    const g = c.getContext('2d'); g.drawImage(src, 0, 0, 24, 24)
    return g.getImageData(0, 0, 24, 24).data
  }
  const decoded = await Promise.all(images.map(async (m) => {
    const bmp = await createImageBitmap(await (await fetch(m.url)).blob())
    return { ...m, w: bmp.width, h: bmp.height, s: sample(bmp) }
  }))
  const out = []
  for (const t of window.__coats.values()) {
    const src = t.userData?.coatOf?.image, coat = t.image
    if (!src || !coat) continue
    // (made from a cleaned copy (LuckyCat's paw pads): its source's source then)
    const orig = t.userData.coatOf.userData?.cleanOf?.image ?? src
    const s = sample(orig)
    let best = null, bestD = Infinity
    for (const d of decoded) {
      if (d.w !== orig.width || d.h !== orig.height) continue
      let diff = 0
      for (let k = 0; k < s.length; k += 4) diff += Math.abs(s[k] - d.s[k]) + Math.abs(s[k + 1] - d.s[k + 1]) + Math.abs(s[k + 2] - d.s[k + 2])
      if (diff < bestD) { bestD = diff; best = d }
    }
    if (best) out.push({ f: best.f, i: best.i, d: bestD / (s.length / 4), jpeg: coat.toDataURL('image/jpeg', 0.92) })
  }
  return out
}, images)
await browser.close()
const byFile = new Map()
for (const r of found) {
  console.log(`${r.f} image ${r.i}: matched (mean difference ${r.d.toFixed(1)} of 765)`)
  if (r.d > 30) { console.log('  too far from it: left'); continue }
  if (!byFile.has(r.f)) byFile.set(r.f, new Map())
  byFile.get(r.f).set(r.i, Buffer.from(r.jpeg.split(',')[1], 'base64'))
}
for (const { f, path, glb } of files) {
  const rep = byFile.get(f)
  if (!rep) continue
  const before = readFileSync(path).length
  const out = writeGlb(glb, rep)
  writeFileSync(path, out)
  console.log(`${f}: ${rep.size} picture(s) coated, ${(before / 1024).toFixed(0)} -> ${(out.length / 1024).toFixed(0)} KB`)
}
