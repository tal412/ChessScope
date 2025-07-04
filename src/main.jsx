import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initGraphDB } from '@/api/graphStorage.js'
import '@/utils/cleanup.js' // Auto-cleanup old localStorage data

// Initialize graph database before rendering the app
initGraphDB().then(() => {
  console.log('Graph database initialized successfully');
  ReactDOM.createRoot(document.getElementById('root')).render(
      <App />
  )
}).catch(error => {
  console.error('Failed to initialize graph database:', error)
  // Still render the app but with error handling
  ReactDOM.createRoot(document.getElementById('root')).render(
      <App />
  )
}) 