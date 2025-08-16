import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ChessPlatformProvider } from "@/contexts/ChessPlatformContext"
import { FirebaseAuthProvider } from "@/contexts/FirebaseAuthContext"

function App() {
  return (
    <ChessPlatformProvider>
      <FirebaseAuthProvider>
        <Pages />
        <Toaster />
      </FirebaseAuthProvider>
    </ChessPlatformProvider>
  )
}

export default App 