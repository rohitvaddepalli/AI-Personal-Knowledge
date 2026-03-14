import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { DesktopRuntimeProvider } from './context/DesktopRuntimeContext.tsx'
import { installApiFetchShim } from './lib/api.ts'
import './index.css'

installApiFetchShim()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DesktopRuntimeProvider>
      <App />
    </DesktopRuntimeProvider>
  </React.StrictMode>,
)
