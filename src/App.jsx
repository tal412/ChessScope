import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/contexts/AuthContext"
import { useEffect } from 'react'
import { cloudSyncManager } from '@/services/CloudSyncManager.js'

function App() {
  useEffect(() => {
    // Initialize cloud sync manager on app mount
    console.log('🚀 App: Initializing cloud sync manager...');
    cloudSyncManager.initialize().then(() => {
      console.log('🚀 App: Cloud sync manager initialized');
    }).catch(error => {
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