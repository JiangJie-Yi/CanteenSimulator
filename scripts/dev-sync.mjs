// The dev server and the sync (scripts/auto-pull.mjs: cloud-work in, checked, main out) together: `npm run dev:sync`. Stops both on Ctrl+C.
import { spawn } from 'node:child_process'

// (node runs vite's own script directly, no shell in between: stopping this stops it, on Windows too)
// (one port only: 5173, and if something else has it this stops with an error saying so, rather than quietly going to 5174 as vite would; pass --port to choose another)
const args = process.argv.slice(2)
if (!args.includes('--port')) args.push('--port', '5173')
if (!args.includes('--strictPort')) args.push('--strictPort')
const dev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...args], { stdio: 'inherit' })
const sync = spawn(process.execPath, ['scripts/auto-pull.mjs'], { stdio: 'inherit', env: process.env })
const stop = () => { dev.kill(); sync.kill() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
dev.on('exit', (c) => { sync.kill(); process.exit(c ?? 0) })
