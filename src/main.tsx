// (first of all, in development: every texture and shape noted as it's made, to let go of what a hot update leaves behind)
import './scene/gpuSweep'
// (and a phone fetches none of the 3D shop: it draws it flat)
import './scene/flatGate'
// (the pictures the game paints, kept off the graphics card: they survive its resets)
import './scene/canvasKeep'
import './scene/triProfiler'
// (every sound effect through one switch: muted together from the clock, top right)
import './scene/sfx'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { Crash } from '@/ui/Crash'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
)

// started fine: a later failed load (after another deploy) may retry again
try {
  sessionStorage.removeItem('canteen-boot-retry')
} catch {
  // storage blocked
}
