import { MusicPlayerProvider } from './providers/musicPlayerProvider'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.scss'

ReactDOM.createRoot(document.getElementById('kershner-music-player')!).render(
  <React.StrictMode>
    <MusicPlayerProvider>
      <App />
    </MusicPlayerProvider>
  </React.StrictMode>,
)
