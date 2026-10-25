import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ToastProvider } from './components/ui.jsx'
import './styles.css'

// iOS Safari only applies :active while a touch listener exists; press feedback depends on it.
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter basename={import.meta.env.BASE_URL}><ToastProvider><App /></ToastProvider></BrowserRouter></StrictMode>
)
