import { 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
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

  // Sign up with email and password
  async signUpWithEmailPassword(email, password, displayName = null) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update display name if provided
      if (displayName) {
        await updateProfile(user, {
          displayName: displayName
        });
      }
      
      // Extract user information
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime
      };

      console.log('Successfully signed up with email/password:', userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Email/password sign-up error:', error);
      
      // Handle specific error codes
      if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'This email is already registered. Please use the "Sign In" tab to log in with your existing account.' };
      } else if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address. Please check and try again.' };
      } else if (error.code === 'auth/weak-password') {
        return { success: false, error: 'Password is too weak. Please use at least 6 characters.' };
      } else if (error.code === 'auth/operation-not-allowed') {
        return { success: false, error: 'Email/password accounts are not enabled. Please contact support.' };
      }
      
      return { success: false, error: error.message || 'Failed to sign up' };
    }
  }

  // Sign in with email and password
  async signInWithEmailPassword(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
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

      console.log('Successfully signed in with email/password:', userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Email/password sign-in error:', error);
      
      // Handle specific error codes
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address. Please check and try again.' };
      } else if (error.code === 'auth/user-disabled') {
        return { success: false, error: 'This account has been disabled. Please contact support.' };
      } else if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'No account found with this email. Please sign up first.' };
      } else if (error.code === 'auth/wrong-password') {
        return { success: false, error: 'Incorrect password. Please try again.' };
      } else if (error.code === 'auth/invalid-credential') {
        return { success: false, error: 'Invalid email or password. Please check and try again.' };
      } else if (error.code === 'auth/operation-not-allowed') {
        return { success: false, error: 'Email/password authentication is not enabled. Please contact support.' };
      } else if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many failed attempts. Please try again later.' };
      }
      
      return { success: false, error: error.message || 'Failed to sign in' };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('Password reset email sent successfully');
      return { success: true, message: 'Password reset email sent. Please check your inbox.' };
    } catch (error) {
      console.error('Password reset error:', error);
      
      // Handle specific error codes
      if (error.code === 'auth/invalid-email') {
        return { success: false, error: 'Invalid email address. Please check and try again.' };
      } else if (error.code === 'auth/user-not-found') {
        return { success: false, error: 'No account found with this email address.' };
      } else if (error.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many requests. Please try again later.' };
      }
      
      return { success: false, error: error.message || 'Failed to send password reset email' };
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