// The dev server and the auto-pull together: `npm run dev:sync`. Stops both on Ctrl+C.
import { spawn } from 'node:child_process'

// (node runs vite's own script directly, no shell in between: stopping this stops it, on Windows too)
const dev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], { stdio: 'inherit' })
const sync = spawn(process.execPath, ['scripts/auto-pull.mjs'], { stdio: 'inherit', env: process.env })
const stop = () => { dev.kill(); sync.kill() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
dev.on('exit', (c) => { sync.kill(); process.exit(c ?? 0) })
