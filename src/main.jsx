import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import { initPwa } from './lib/pwa.js'
import './index.css'

initPwa()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <OfflineBanner />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
