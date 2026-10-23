// Keeps this checkout level with GitHub's main while you work: every so often it looks, and if main has moved on and your own tree is clean
// (nothing uncommitted, nothing of yours ahead of it) it pulls, fast-forward only. The dev server picks the changed files up by itself.
// It never touches your own work: with uncommitted changes, or local commits GitHub doesn't have, or a different branch checked out, it says so
// once and leaves things as they are.
//
//   npm run sync          (only the pulling)
//   npm run dev:sync      (the dev server and the pulling together)
//   node scripts/auto-pull.mjs --once      (look once and stop)
//   SYNC_SECONDS=60 npm run dev:sync       (how often, default 20)

import { execFileSync } from 'node:child_process'

const EVERY = Math.max(5, Number(process.env.SYNC_SECONDS ?? 20)) * 1000
const BRANCH = process.env.SYNC_BRANCH ?? 'main'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const stamp = () => new Date().toLocaleTimeString()
const log = (m) => console.log(`[sync ${stamp()}] ${m}`)
let told = ''
// (say a thing once, not every time round)
const say = (key, m) => { if (told !== key) { told = key; log(m) } }

function check() {
  try {
    if (git('rev-parse', '--abbrev-ref', 'HEAD') !== BRANCH) return say('branch', `on another branch than ${BRANCH}: not pulling`)
    git('fetch', '--quiet', 'origin', BRANCH)
    const mine = git('rev-parse', 'HEAD'), theirs = git('rev-parse', `origin/${BRANCH}`)
    if (mine === theirs) return (told = '')
    // (behind only: theirs has everything of mine; otherwise mine has something of its own)
    try { git('merge-base', '--is-ancestor', mine, theirs) } catch { return say('ahead', `you have commits GitHub doesn't: not pulling (push them, or pull by hand)`) }
    if (git('status', '--porcelain', '--untracked-files=no')) return say('dirty', 'main has news, but you have uncommitted changes: not pulling until they are committed or put away')
    const before = git('rev-parse', 'HEAD')
    git('pull', '--ff-only', '--quiet', 'origin', BRANCH)
    const files = git('diff', '--name-only', before, 'HEAD').split('\n').filter(Boolean)
    told = ''
    log(`pulled ${before.slice(0, 7)}..${git('rev-parse', '--short', 'HEAD')} (${files.length} files): ${git('log', '-1', '--format=%s').slice(0, 80)}`)
    if (files.some((f) => f === 'package.json' || f === 'package-lock.json')) log('package.json changed: run `npm install`')
  } catch (e) {
    say('error', `couldn't check (${String(e.stderr ?? e.message).split('\n')[0].slice(0, 120)}): will try again`)
  }
}

check()
if (!process.argv.includes('--once')) {
  log(`watching origin/${BRANCH} every ${EVERY / 1000}s (Ctrl+C to stop)`)
  setInterval(check, EVERY)
}
