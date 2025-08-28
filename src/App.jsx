import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ChessPlatformProvider } from "@/contexts/ChessPlatformContext"
import { FirebaseAuthProvider } from "@/contexts/FirebaseAuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { MobileRedirect } from "@/components/MobileRedirect"
import { useState, useEffect } from 'react'

function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user is on mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webOS|iPhone|iPad|iPod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      
      setIsMobile(isMobileDevice || (isTouchDevice && isSmallScreen));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Show mobile redirect page if on mobile
  if (isMobile) {
    return (
      <ThemeProvider>
        <MobileRedirect />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ChessPlatformProvider>
        <FirebaseAuthProvider>
          <Pages />
          <Toaster />
        </FirebaseAuthProvider>
      </ChessPlatformProvider>
    </ThemeProvider>
  )
}

export default App 