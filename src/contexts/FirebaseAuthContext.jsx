// Firebase Authentication Context - ONLY for Google Sign-In for Studies
// Chess platform authentication is handled separately in ChessPlatformContext

import { createContext, useContext, useState, useEffect } from 'react';
import { firebaseAuth } from '../services/FirebaseAuth.js';
import { firestoreService } from '../services/FirestoreService.js';
import { initializeAnalytics } from '../services/firebase.js';

const FirebaseAuthContext = createContext();

export const useAuth = () => {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    // In development, provide safe defaults during HMR to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      console.warn('useAuth called outside FirebaseAuthProvider context - providing defaults for development');
      return {
        isGoogleSignedIn: false,
        firebaseUser: null,
        isLoading: false,
        signInWithGoogle: async () => console.warn('signInWithGoogle called outside provider context'),
        signOutGoogle: async () => console.warn('signOutGoogle called outside provider context')
      };
    }
    throw new Error('useAuth must be used within a FirebaseAuthProvider');
  }
  return context;
};

export const FirebaseAuthProvider = ({ children }) => {
  // Firebase authentication state
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Firebase auth listener
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChange(async (user) => {
      if (user) {
        setIsGoogleSignedIn(true);
        setFirebaseUser(user);
        
        // Initialize Firebase Analytics after successful authentication
        try {
          await initializeAnalytics();
        } catch (error) {
          console.error('Error initializing Firebase Analytics:', error);
        }
        
        try {
          // Initialize user profile in Firestore if needed
          let profile = await firestoreService.getUserProfile();
          if (!profile) {
            // Create initial profile for new user
            const initialProfile = {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            };
            profile = await firestoreService.createUserProfile(initialProfile);
            
            // Initialize default tags for new user (method is idempotent)
            await firestoreService.initializeDefaultTags();
          } else {
            // For existing users, ensure default tags exist (method is idempotent)
            await firestoreService.initializeDefaultTags();
          }
        } catch (error) {
          console.error('Error loading Firestore profile:', error);
        }
      } else {
        setIsGoogleSignedIn(false);
        setFirebaseUser(null);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in with Google (for Studies cloud sync)
  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const result = await firebaseAuth.signInWithGoogle();
      
      if (result.success) {
        // User state will be updated by the auth listener
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out from Google
  const signOutGoogle = async () => {
    try {
      setIsLoading(true);
      const result = await firebaseAuth.signOut();
      
      if (result.success) {
        setIsGoogleSignedIn(false);
        setFirebaseUser(null);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    // Firebase auth state
    isGoogleSignedIn,
    firebaseUser,
    isLoading,
    
    // Firebase auth actions
    signInWithGoogle,
    signOutGoogle,
    
    // Firestore service access
    firestoreService,
    
    // For Studies pages that need to check if user can sync
    canSyncToCloud: isGoogleSignedIn
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
};