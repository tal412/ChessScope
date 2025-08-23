import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useDataValidation } from '@/hooks/useDataValidation';
import { useChessPlatform } from '@/contexts/ChessPlatformContext';
import { useAuth } from '@/contexts/FirebaseAuthContext';
import { performCompleteLogout } from '@/utils/logoutUtils';

/**
 * ProtectedRoute component that redirects users to main page if they haven't imported games
 * Also forces logout and clears all stored data when no valid data is found
 */
export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { hasValidData, isChecking, needsDataImport } = useDataValidation();
  const { logout: logoutChess, isAuthenticated } = useChessPlatform();
  const { signOutGoogle, firebaseUser } = useAuth();
  
  // Force logout and clear data when user has no valid data but is still authenticated
  useEffect(() => {
    if (!isChecking && (needsDataImport || !hasValidData) && isAuthenticated) {
      console.log('ProtectedRoute: No valid data found, forcing complete logout');
      
      // Use the shared logout utility
      performCompleteLogout(logoutChess, signOutGoogle, firebaseUser, null, false)
        .catch(error => {
          console.error('ProtectedRoute: Error during logout:', error);
        });
    }
  }, [isChecking, needsDataImport, hasValidData, isAuthenticated, logoutChess, firebaseUser, signOutGoogle]);
  
  // Still checking - don't show anything yet, just wait
  if (isChecking) {
    return null;
  }
  
  // No data - redirect to main page immediately
  if (needsDataImport || !hasValidData) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  
  // User has valid data, render the protected content
  return children;
}