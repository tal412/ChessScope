import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.authStateCallbacks = [];
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      
      // Notify all callbacks
      this.authStateCallbacks.forEach(callback => {
        try {
          callback(user);
        } catch (error) {
          console.error('Error in auth state callback:', error);
        }
      });
    });
  }

  // Subscribe to auth state changes
  onAuthStateChange(callback) {
    this.authStateCallbacks.push(callback);
    
    // Call immediately with current state
    if (this.currentUser !== null) {
      callback(this.currentUser);
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateCallbacks.indexOf(callback);
      if (index > -1) {
        this.authStateCallbacks.splice(index, 1);
      }
    };
  }

  // Sign in with Google
  async signInWithGoogle() {
    try {
      // Configure popup settings for better UX
      googleProvider.setCustomParameters({
        prompt: 'select_account',
        hd: undefined // Allow any domain
      });

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Extract user information
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime
      };

      console.log('Successfully signed in with Google:', userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      // Handle specific error codes
      if (error.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Sign-in was cancelled. Please try again.' };
      } else if (error.code === 'auth/popup-blocked') {
        return { success: false, error: 'Popup was blocked. Please allow popups for this site and try again.' };
      } else if (error.code === 'auth/network-request-failed') {
        return { success: false, error: 'Network error. Please check your connection and try again.' };
      } else if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many failed attempts. Please try again later.' };
      }
      
      return { success: false, error: error.message || 'Failed to sign in with Google' };
    }
  }

  // Sign out
  async signOut() {
    try {
      await firebaseSignOut(auth);
      console.log('Successfully signed out');
      return { success: true };
    } catch (error) {
      console.error('Sign-out error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Get user token (for API calls)
  async getUserToken() {
    if (!this.currentUser) {
      throw new Error('No user is currently signed in');
    }
    
    try {
      const token = await this.currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting user token:', error);
      throw error;
    }
  }

  // Refresh user token
  async refreshToken() {
    if (!this.currentUser) {
      throw new Error('No user is currently signed in');
    }
    
    try {
      const token = await this.currentUser.getIdToken(true); // Force refresh
      return token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  // Get user profile data
  getUserProfile() {
    if (!this.currentUser) {
      return null;
    }

    return {
      uid: this.currentUser.uid,
      email: this.currentUser.email,
      displayName: this.currentUser.displayName,
      photoURL: this.currentUser.photoURL,
      emailVerified: this.currentUser.emailVerified,
      createdAt: this.currentUser.metadata.creationTime,
      lastSignIn: this.currentUser.metadata.lastSignInTime
    };
  }
}

// Create and export singleton instance
export const firebaseAuth = new FirebaseAuthService();
export default firebaseAuth;