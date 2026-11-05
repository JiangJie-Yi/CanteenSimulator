import { execSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const LIVE_STATE = fileURLToPath(new URL('./blender/live_state.json', import.meta.url))

/**
 * Dev-only bridge to Blender: the page POSTs what's on screen (dish, ordered items) and we write it to
 * blender/live_state.json, which blender/open_live.py polls to mirror the scene.
 */
function blenderBridge(): Plugin {
  return {
    name: 'canteen-blender-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__canteen/state', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            JSON.parse(body)
            await writeFile(LIVE_STATE, body)
            res.statusCode = 204
          } catch {
            res.statusCode = 400
          }
          res.end()
        })
      })
    },
  }
}

/** the version the game shows (the owner's: v0.01 to start, up 0.01 with every push to main): on GitHub, the deploy's run number (it goes
 * up one with each push, deploy.yml's GAME_RUN) counted from the push that was v0.01 (run 256); here, where nothing's been pushed yet,
 * "dev" and the commit it's built from */
const FIRST_RUN = 255
function gameVersion() {
  const run = Number(process.env.GAME_RUN)
  if (run > FIRST_RUN) {
    const n = run - FIRST_RUN
    return `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`
  }
  try {
    return `dev (${execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()})`
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
// GitHub Pages serves the site from https://<user>.github.io/<repo>/: built on GitHub, the repo's own name (so the site
// works whatever the repo's called); built here, and in `vite preview`, JapaneseGrillSimulator
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'JapaneseGrillSimulator'
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? `/${REPO}/` : '/',
  plugins: [react(), blenderBridge()],
  // (the game's version, shown on the about tab: up 0.01 with every push to main, gameVersion above)
  define: { __GAME_VERSION__: JSON.stringify(gameVersion()) },
  // (the same alias as tsconfig.app.json's paths)
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // the bridge rewrites this file constantly; don't reload the page for it
    watch: { ignored: ['**/blender/**'] },
  },
}))
