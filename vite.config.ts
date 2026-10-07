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

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site from https://<user>.github.io/CanteenSimulator/ (and `vite preview` mirrors it)
  base: command === 'build' || isPreview ? '/CanteenSimulator/' : '/',
  plugins: [react(), blenderBridge()],
  server: {
    // the bridge rewrites this file constantly; don't reload the page for it
    watch: { ignored: ['**/blender/**'] },
  },
}))
