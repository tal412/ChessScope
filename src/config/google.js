// Google Drive API Configuration
// Loads credentials from environment variables for security

export const GOOGLE_API_CONFIG = {
  // API Key from environment variable (prefixed with VITE_ for Vite)
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  
  // OAuth 2.0 Client ID from environment variable
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  
  // These are the correct values for Google Drive API - DO NOT CHANGE
  discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  scopes: 'https://www.googleapis.com/auth/drive.file'
};

// Validation function
export const validateGoogleConfig = () => {
  const { apiKey, clientId } = GOOGLE_API_CONFIG;
  
  if (!apiKey) {
    return { 
      valid: false, 
      error: 'Google API key not configured. Please set VITE_GOOGLE_API_KEY in your .env file' 
    };
  }
  
  if (!clientId) {
    return { 
      valid: false, 
      error: 'Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file' 
    };
  }
  
  // Basic validation for API key format (should start with AIza)
  if (!apiKey.startsWith('AIza')) {
    return { 
      valid: false, 
      error: 'Invalid Google API key format. Please check your VITE_GOOGLE_API_KEY in .env file' 
    };
  }
  
  // Basic validation for Client ID format
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return { 
      valid: false, 
      error: 'Invalid Google Client ID format. It should end with .apps.googleusercontent.com' 
    };
  }
  
  return { valid: true };
};