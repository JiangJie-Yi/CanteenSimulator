// (first of all, in development: every texture and shape noted as it's made, to let go of what a hot update leaves behind)
import './scene/gpuSweep'
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
