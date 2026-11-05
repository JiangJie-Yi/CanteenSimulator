// The nightly push (the owner's: after midnight, if there's anything new, it goes up by itself): run by a Windows scheduled task each night
// at 00:05 (scripts/nightly-push-task.ps1 sets it up). If this machine's main has commits GitHub's hasn't, the tests are run and, only if
// they pass, main is pushed (which deploys the site, its version up 0.01). Nothing new, or a test failing: nothing's pushed. Uncommitted
// changes are never committed by it. Each run leaves a line in logs/nightly-push.log.
import { execSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const log = (line) => {
  mkdirSync(join(root, 'logs'), { recursive: true })
  appendFileSync(join(root, 'logs', 'nightly-push.log'), `${new Date().toISOString()} ${line}\n`)
  console.log(line)
}
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()

try {
  sh('git fetch origin')
  const ahead = Number(sh('git rev-list --count origin/main..main'))
  const behind = Number(sh('git rev-list --count main..origin/main'))
  if (behind > 0) { log(`skipped: GitHub's main has ${behind} commit(s) this machine hasn't (pull first)`); process.exit(0) }
  if (ahead === 0) { log('nothing new to push'); process.exit(0) }
  try {
    sh('npm test')
  } catch (e) {
    log(`skipped: npm test failed (${ahead} commit(s) waiting): ${String(e.stdout ?? e.message).split('\n').filter((l) => /FAIL|Error/.test(l)).slice(0, 3).join(' | ')}`)
    process.exit(1)
  }
  // (DRY=1: everything but the push, to try it)
  if (process.env.DRY) { log(`dry run: would push ${ahead} commit(s)`); process.exit(0) }
  sh('git push origin main')
  log(`pushed ${ahead} commit(s): ${sh('git log -1 --format=%h')}`)
} catch (e) {
  log(`failed: ${String(e.stderr ?? e.message).split('\n')[0]}`)
  process.exit(1)
}
