import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ChessPlatformProvider } from "@/contexts/ChessPlatformContext"
import { FirebaseAuthProvider } from "@/contexts/FirebaseAuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"

function App() {
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