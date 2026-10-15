import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { APP_VERSION } from './lib/version'

// Auto-update PWA: skipWaiting + clientsClaim in workbox; reload when new SW activates
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true).catch(() => {})
  },
  onOfflineReady() {
    /* ok */
  },
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    // Poll for updates while the app is open (helps iOS Safari PWA)
    setInterval(() => {
      registration.update().catch(() => {})
    }, 60_000)
    registration.addEventListener('updatefound', () => {
      const nw = registration.installing
      if (!nw) return
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          // New content available — activate & reload
          updateSW(true).catch(() => location.reload())
        }
      })
    })
  },
})

// When controlling SW changes (after skipWaiting), reload once
let refreshing = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (refreshing) return
  refreshing = true
  location.reload()
})

console.info(`[語音筆記] ${APP_VERSION}`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
