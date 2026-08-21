import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

console.info('[RENDERER] Starting React app...')

const container = document.getElementById('root')

if (!container) {
  console.error('[RENDERER] Root container not found!')
  document.body.innerHTML = '<div style="color:white;background:#0d0d1a;height:100vh;display:flex;align-items:center;justify-content:center;">Error: Root container not found</div>'
} else {
  try {
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    console.info('[RENDERER] React app mounted')
  } catch (error) {
    console.error('[RENDERER] Error mounting app:', error)
    container.innerHTML = `
      <div style="color:white;background:#0d0d1a;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;">
        <h1 style="color:#ef4444;">Error</h1>
        <p>${error}</p>
      </div>
    `
  }
}

// Catch any uncaught errors
window.addEventListener('error', (event) => {
  console.error('[RENDERER] Uncaught error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[RENDERER] Unhandled promise rejection:', event.reason)
})
