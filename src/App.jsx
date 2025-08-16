import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/contexts/AuthContext"
import { useEffect } from 'react'
import { cloudSyncManager } from '@/services/CloudSyncManager.js'

function App() {
  useEffect(() => {
    // Initialize cloud sync manager on app mount
    cloudSyncManager.initialize().catch(error => {
      console.error('🚀 App: Failed to initialize cloud sync manager:', error);
    });
  }, []);

  return (
    <AuthProvider>
      <Pages />
      <Toaster />
    </AuthProvider>
  )
}

export default App 