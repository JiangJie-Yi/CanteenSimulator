// Keeps this checkout and GitHub level, with this machine in charge: the cloud chat's work arrives on the `cloud-work` branch, never on
// `main`; main only moves from here, after it's been tried here. Every so often:
//
//   1. GitHub's main has moved on (a push from another machine): pull it, fast-forward only.
//   2. `cloud-work` has commits main doesn't: merge them into main here, run the checks (tsc and the tests), and only if they pass push main
//      (which is what deploys). If the merge conflicts or a check fails, it goes back as it was and says so.
//   3. Commits of your own on main that GitHub doesn't have: check them the same way, then push.
//
// It never touches uncommitted work (with any, it waits and says so once), only works on `main`, and pushes only what has passed the checks.
//
//   npm run sync          (only this)
//   npm run dev:sync      (the dev server and this together)
//   node scripts/auto-pull.mjs --once       (look once and stop)
//   SYNC_SECONDS=60       how often, default 20
//   SYNC_PUSH=1           also push main once checked (that deploys the site); default: off, merge and check here only
//   SYNC_VERIFY="cmd"     the checks, default `npx tsc -b && npm test`

import { execFileSync, execSync } from 'node:child_process'

const EVERY = Math.max(5, Number(process.env.SYNC_SECONDS ?? 20)) * 1000
const BRANCH = process.env.SYNC_BRANCH ?? 'main'
const CLOUD = process.env.SYNC_CLOUD ?? 'cloud-work'
// (pushing main is what deploys the site: off unless asked for with SYNC_PUSH=1, so the cloud chat's work shows on this machine's localhost and stays off the website)
const PUSH = process.env.SYNC_PUSH === '1'
const VERIFY = process.env.SYNC_VERIFY ?? 'npx tsc -b && npm test'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const ok = (...args) => { try { git(...args); return true } catch { return false } }
const log = (m) => console.log(`[sync ${new Date().toLocaleTimeString()}] ${m}`)
let told = ''
// (say a thing once, not every time round)
const say = (key, m) => { if (told !== key) { told = key; log(m) } }
const short = (ref = 'HEAD') => git('rev-parse', '--short', ref)
const isAncestor = (a, b) => ok('merge-base', '--is-ancestor', a, b)
let busy = false
// (what's been tried and failed or clashed, as `cloud-work's commit | main's commit`: not tried again until one of them moves)
const tried = new Set()

function verify() {
  log('checking (tsc and tests)…')
  try {
    execSync(VERIFY, { stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}
function push() {
  if (!PUSH) return log('checked and in your main here (not pushed: that is what deploys the site)')
  git('push', 'origin', BRANCH)
  log(`pushed main (${short()}): GitHub deploys it`)
}

function check() {
  if (busy) return
  busy = true
  try {
    if (git('rev-parse', '--abbrev-ref', 'HEAD') !== BRANCH) return say('branch', `on another branch than ${BRANCH}: leaving things alone`)
    git('fetch', '--quiet', 'origin')
    const remoteMain = `origin/${BRANCH}`
    const dirty = !!git('status', '--porcelain', '--untracked-files=no')
    const cloudRef = `origin/${CLOUD}`
    const hasCloud = ok('rev-parse', '--verify', '--quiet', cloudRef)
    const mainBehind = !isAncestor(remoteMain, 'HEAD')           // GitHub's main has something this one hasn't
    const cloudNews = hasCloud && !isAncestor(cloudRef, 'HEAD')   // the cloud chat's work not in main yet
    const mainAhead = PUSH && !isAncestor('HEAD', remoteMain)    // this main has commits GitHub doesn't, and pushing is on
    if (!mainBehind && !cloudNews && !mainAhead) return (told = '')
    if (dirty) return say('dirty', 'there is news (or something of yours to push), but you have uncommitted changes: waiting until they are committed or put away')
    const before = git('rev-parse', 'HEAD')

    // 1. a push from another machine: bring it in
    if (mainBehind) {
      if (mainAhead) return say('diverged', `GitHub's ${BRANCH} and yours have each moved on: merge them by hand (git pull origin ${BRANCH})`)
      git('pull', '--ff-only', '--quiet', 'origin', BRANCH)
      log(`pulled ${before.slice(0, 7)}..${short()}: ${git('log', '-1', '--format=%s').slice(0, 80)}`)
    }
    // 2. the cloud's work: merged here, tried here
    const pair = hasCloud ? `${git('rev-parse', cloudRef)}|${git('rev-parse', 'HEAD')}` : ''
    if (cloudNews && !tried.has(pair)) {
      const from = git('rev-parse', 'HEAD')
      try {
        git('merge', '--no-edit', '-m', `Merge ${CLOUD} (the cloud chat's work), checked here`, cloudRef)
      } catch {
        ok('merge', '--abort')
        tried.add(pair)
        return say('conflict', `${CLOUD} has news but merging it clashes with your changes: left alone; merge by hand (git merge origin/${CLOUD})`)
      }
      log(`merged ${CLOUD}: ${git('log', '--format=%s', `${from}..${cloudRef}`).split('\n').slice(0, 3).join(' | ').slice(0, 120)}`)
      if (!verify()) {
        git('reset', '--hard', from)
        tried.add(pair)
        return say('failed', `${CLOUD}'s work failed the checks, so it's been taken back out of main (see above); nothing was pushed`)
      }
      told = ''
      push()
      return
    }
    // 3. only your own commits
    if (mainAhead && !mainBehind) {
      if (!verify()) return say('own-failed', 'your commits failed the checks (see above): not pushing')
      told = ''
      push()
    }
    const files = git('diff', '--name-only', before, 'HEAD').split('\n').filter(Boolean)
    if (files.some((f) => f === 'package.json' || f === 'package-lock.json')) log('package.json changed: run `npm install`')
  } catch (e) {
    say('error', `couldn't carry on (${String(e.stderr ?? e.message).split('\n')[0].slice(0, 140)}): will try again`)
  } finally {
    busy = false
  }
}

check()
if (!process.argv.includes('--once')) {
  log(`watching origin/${BRANCH} and origin/${CLOUD} every ${EVERY / 1000}s${PUSH ? ' (pushing main once checked)' : ' (merging and checking here only, never pushing)'} (Ctrl+C to stop)`)
  setInterval(check, EVERY)
}
