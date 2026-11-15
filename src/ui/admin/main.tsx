// The back office's page (item 184, admin.html): its own light app, no 3D and none of the game's stylesheet
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './admin.css'
import '@/ui/pressFeel'
import { AdminApp } from './AdminApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
