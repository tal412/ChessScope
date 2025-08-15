import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/contexts/AuthContext"
import { useEffect } from 'react'
import { autoBackupService } from '@/services/AutoBackupService.js'
import SyncStatusIndicator from '@/components/SyncStatusIndicator.jsx'

function App() {
  useEffect(() => {
    // Initialize auto backup service on app mount
    console.log('🚀 App: Initializing auto backup service...');
    autoBackupService.initialize().then(() => {
      console.log('🚀 App: Auto backup service initialized');
      // Don't perform automatic backup on visit - let user choose to backup or restore
    }).catch(error => {
      console.error('🚀 App: Failed to initialize auto backup service:', error);
    });

    return () => {
      autoBackupService.destroy();
    };
  }, []);

  return (
    <AuthProvider>
      <Pages />
      <Toaster />
      <SyncStatusIndicator />
    </AuthProvider>
  )
}

export default App 