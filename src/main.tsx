import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Crash } from './components/Crash'

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
