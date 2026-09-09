import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { Capacitor } from '@capacitor/core'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  // APK assets are versioned by Android, not by a browser worker. Preserve sessions and drafts.
  void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.filter(registration =>
    [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === `${location.origin}/sw.js`)
  ).map(registration => registration.unregister()))).catch(() => undefined)
  void caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('department-steward-')).map(key => caches.delete(key)))).catch(() => undefined)
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
