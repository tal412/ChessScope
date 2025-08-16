import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { firebaseConfig } from '../config/firebaseConfig.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Analytics - will be initialized after user signs in
let analytics = null;

// Function to initialize analytics after user authentication
export const initializeAnalytics = async () => {
  if (analytics) return analytics; // Already initialized
  
  try {
    const supported = await isSupported();
    if (supported && typeof window !== 'undefined') {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized');
      return analytics;
    } else {
      console.log('Firebase Analytics not supported in this environment');
      return null;
    }
  } catch (error) {
    console.error('Error initializing Firebase Analytics:', error);
    return null;
  }
};

// Export analytics getter
export const getAnalyticsInstance = () => analytics;

// Connect to emulators in development (optional)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Only connect to emulators if they're not already connected
  if (!auth.config.emulator) {
    try {
      // Uncomment these lines if you want to use Firebase emulators in development
      // connectAuthEmulator(auth, 'http://localhost:9099');
      // connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (error) {
      // Emulators are already connected or not available
    }
  }
}

export default app;