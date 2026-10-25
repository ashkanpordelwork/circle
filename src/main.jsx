import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ToastProvider } from './components/ui.jsx'
import './styles.css'
import { installGlass } from './lib/glass.js'

// iOS Safari only applies :active while a touch listener exists; press feedback depends on it.
document.addEventListener('touchstart', () => {}, { passive: true })
// Liquid Glass reacts to touch: swell, wobble back, a sheen under the finger.
installGlass()

createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter basename={import.meta.env.BASE_URL}><ToastProvider><App /></ToastProvider></BrowserRouter></StrictMode>
)
