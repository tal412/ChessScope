import { useState, useEffect } from 'react';
import { useChessPlatform } from '@/contexts/ChessPlatformContext';

/**
 * Custom hook to validate if user has required data (username and games)
 * Returns validation state and redirect logic for protecting routes
 */
export function useDataValidation() {
  const { isAuthenticated, isImporting } = useChessPlatform();
  const [hasValidData, setHasValidData] = useState(null); // null = checking, true = valid, false = invalid
  
  useEffect(() => {
    const checkUserData = () => {
      // If not authenticated or currently importing, skip validation
      if (!isAuthenticated || isImporting) {
        setHasValidData(null);
        return;
      }
      
      // Check for username in localStorage (indicates games have been imported)
      const username = localStorage.getItem('chesscope_username');
      const hasUsername = !!username;
      
      setHasValidData(hasUsername);
    };
    
    checkUserData();
    
    // Listen for potential username changes (like after import)
    const handleStorageChange = () => {
      checkUserData();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for when username is set programmatically
    window.addEventListener('usernameChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('usernameChanged', handleStorageChange);
    };
  }, [isAuthenticated, isImporting]);
  
  return {
    hasValidData,
    isChecking: hasValidData === null,
    needsDataImport: hasValidData === false && isAuthenticated && !isImporting
  };
}