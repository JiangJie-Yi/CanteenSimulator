// The game's version up by 0.01 (the owner's): package.json's "gameVersion" ("0.01" -> "0.02"), counted in hundredths so no float creeps in.
// (Kept apart from "version", which npm wants as x.y.z: "0.01" isn't one.) Run: npm run bump
import fs from 'node:fs'
import path from 'node:path'
const file = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
const now = String(pkg.gameVersion ?? '0.00')
const [a, b = '0'] = now.split('.')
const hundredths = Number(a) * 100 + Number(b.padEnd(2, '0').slice(0, 2)) + 1
pkg.gameVersion = `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
console.log(`gameVersion ${now} -> ${pkg.gameVersion}`)
