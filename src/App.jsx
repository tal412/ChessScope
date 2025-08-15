import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/contexts/AuthContext"
import { useEffect } from 'react'
import { autoBackupService } from '@/services/AutoBackupService.js'

function App() {
  useEffect(() => {
    // Initialize auto backup service on app mount
    console.log('🚀 App: Initializing auto backup service...');
    autoBackupService.initialize().then(() => {
      console.log('🚀 App: Auto backup service initialized, performing visit backup...');
      // Perform backup on every app visit
      autoBackupService.performVisitBackup();
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
    </AuthProvider>
  )
}

export default App 