import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'
// No-op under Electron (preload already exposed window.api); installs the
// fetch transport when the renderer is served by the Bun build.
import './lib/http-api'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')



createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
