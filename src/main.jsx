import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PortalApp from './PortalApp.jsx'
import './styles.css'
import './conducteur/conducteur.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PortalApp />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
