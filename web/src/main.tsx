import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './components/theme-provider'
import './globals.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider defaultTheme="dark" enableSystem>
    <App />
  </ThemeProvider>
)

