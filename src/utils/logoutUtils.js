/**
 * Complete logout utility that handles both Firebase and Chess platform logout
 * Can be used from anywhere in the app for consistent logout behavior
 */
export const performCompleteLogout = async (logoutChess, signOutGoogle, firebaseUser, navigate = null, silent = false) => {
  try {
    if (!silent) {
      console.log('Starting complete logout...');
    }
    
    // Sign out from Firebase if user is signed in
    if (firebaseUser) {
      try {
        await signOutGoogle();
        if (!silent) {
          console.log('Successfully signed out from Firebase');
        }
      } catch (firebaseError) {
        console.error('Firebase sign out failed:', firebaseError);
        // Continue with chess platform logout even if Firebase logout fails
      }
    }
    
    // Clear chess platform auth
    logoutChess();
    
    // Navigate if needed (used by Layout's logout)
    if (navigate) {
      navigate('/', { 
        state: { 
          fromLogout: true,
          returning: true 
        } 
      });
    }
    
    if (!silent) {
      console.log('Complete logout successful');
    }
    
  } catch (error) {
    console.error('Complete logout failed:', error);
    throw error;
  }
};