import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const LIVE_STATE = fileURLToPath(new URL('./blender/live_state.json', import.meta.url))
const EDIT_DEFAULTS = fileURLToPath(new URL('./src/shops/grill/editDefaults.json', import.meta.url))

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
      // edit mode's 「設為預設」: the furnishings' settled places, turns and sizes, written into the project (src/shops/grill/editDefaults.json)
      server.middlewares.use('/__canteen/edit-defaults', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            const d = JSON.parse(body)
            const ok = (rec: unknown) => !!rec && typeof rec === 'object' && Object.values(rec as object).every((v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x)))
            if (!ok(d.positions) || !ok(d.turns) || !ok(d.scales)) throw new Error('bad defaults')
            await writeFile(EDIT_DEFAULTS, JSON.stringify({ positions: d.positions, turns: d.turns, scales: d.scales }, null, 2) + '\n')
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

// https://vite.dev/config/
// GitHub Pages serves the site from https://<user>.github.io/<repo>/: built on GitHub, the repo's own name (so the site
// works whatever the repo's called); built here, and in `vite preview`, JapaneseGrillSimulator
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'JapaneseGrillSimulator'
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? `/${REPO}/` : '/',
  plugins: [react(), blenderBridge()],
  // (the same alias as tsconfig.app.json's paths)
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // the bridge rewrites this file constantly; don't reload the page for it
    watch: { ignored: ['**/blender/**'] },
  },
}))
