// Google OAuth2 Authentication Service using new Google Identity Services (GIS)
class GoogleAuthService {
  constructor() {
    this.isSignedIn = false;
    this.currentUser = null;
    this.tokenClient = null;
    this.accessToken = null;
    this.apiKey = null;
    this.clientId = null;
    this.scopes = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    this.initialized = false;
    this.initPromise = null;
    
    // Event listeners for auth state changes
    this.listeners = {
      signIn: [],
      signOut: []
    };
  }

  async initialize(config) {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize(config);
    return this.initPromise;
  }

  async _initialize({ apiKey, clientId }) {
    if (this.initialized) {
      return true;
    }

    try {
      this.apiKey = apiKey;
      this.clientId = clientId;
      
      // Starting initialization with new GIS library

      // Load the Google API client library
      if (!window.gapi) {
        await this.loadGoogleAPI();
      }

      // Load the Google Identity Services library
      if (!window.google?.accounts) {
        await this.loadGoogleGIS();
      }

      // Initialize the Google API client (minimal setup for auth only)
      // We're using direct REST API calls for Drive, so we don't need the discovery doc
      await new Promise((resolve, reject) => {
        window.gapi.load('client', async () => {
          try {
            // Initialize without discovery doc - we use direct REST API calls
            await window.gapi.client.init({
              apiKey: this.apiKey
            });
            // API client initialized
            
            // Set the API key for any potential REST calls through gapi
            window.gapi.client.setApiKey(this.apiKey);
            resolve();
          } catch (error) {
            console.warn('Google API client init error (non-critical):', error);
            // Even if this fails, we can still use direct REST calls
            resolve();
          }
        });
      });

      // Initialize the token client for OAuth 2.0
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.scopes,
        callback: async (response) => {
          if (response.error) {
            console.error('Token request error:', response);
            this.isSignedIn = false;
            this.accessToken = null;
            return;
          }
          
          console.log('Google Auth: Access token received', {
            tokenLength: response.access_token?.length,
            tokenPrefix: response.access_token?.substring(0, 20),
            scope: response.scope,
            expires_in: response.expires_in
          });
          this.accessToken = response.access_token;
          
          // Verify token is valid before marking as signed in
          try {
            const profile = await this.getUserProfile();
            if (profile) {
              this.currentUser = profile;
              this.isSignedIn = true;
              localStorage.setItem('google_was_signed_in', 'true');
              this.notifyListeners('signIn', this.getUserInfo());
            } else {
              console.error('Failed to get user profile with token');
              this.isSignedIn = false;
              this.accessToken = null;
            }
          } catch (error) {
            console.error('Error during sign in:', error);
            this.isSignedIn = false;
            this.accessToken = null;
          }
        },
        error_callback: (error) => {
          console.error('Token client error:', error);
          this.isSignedIn = false;
          this.accessToken = null;
        }
      });

      // Check if we have a stored token
      const storedToken = sessionStorage.getItem('google_access_token');
      if (storedToken) {
        this.accessToken = storedToken;
        this.isSignedIn = true;
        const profile = await this.getUserProfile();
        
        // If profile fetch failed (token expired), clear auth state
        if (!profile) {
          this.isSignedIn = false;
          this.accessToken = null;
          this.currentUser = null;
          sessionStorage.removeItem('google_access_token');
        }
      }

      this.initialized = true;
      // Initialization complete
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Auth:', error);
      throw error;
    }
  }

  loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  loadGoogleGIS() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  async signIn() {
    if (!this.initialized) {
      throw new Error('Google Auth not initialized');
    }

    try {
      // Request access token
      console.log('Google Auth: Requesting access token...');
      this.tokenClient.requestAccessToken({ prompt: '' });
      
      // The callback will handle the rest
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isSignedIn) {
            clearInterval(checkInterval);
            resolve(this.getUserInfo());
          }
        }, 100);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 30000);
      });
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  async signOut() {
    if (!this.initialized) {
      throw new Error('Google Auth not initialized');
    }

    try {
      // Revoke the access token
      if (this.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      }
      
      this.accessToken = null;
      this.currentUser = null;
      this.isSignedIn = false;
      sessionStorage.removeItem('google_access_token');
      localStorage.removeItem('google_was_signed_in');
      
      this.notifyListeners('signOut');
      console.log('Google Auth: Signed out successfully');
      return true;
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  async getUserProfile() {
    if (!this.accessToken) {
      console.log('No access token available');
      return null;
    }

    try {
      console.log('Fetching user profile with token:', this.accessToken.substring(0, 10) + '...');
      
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('User profile fetch failed:', response.status, response.statusText, errorText);
        
        // If token is invalid, clear it
        if (response.status === 401) {
          this.accessToken = null;
          sessionStorage.removeItem('google_access_token');
        }
        
        throw new Error(`Failed to get user profile: ${response.status} ${response.statusText}`);
      }

      const profile = await response.json();
      console.log('User profile received:', profile.email);
      this.currentUser = profile;
      
      // Store token for session persistence
      sessionStorage.setItem('google_access_token', this.accessToken);
      
      return profile;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  getUserInfo() {
    if (!this.isSignedIn || !this.currentUser) {
      return null;
    }

    return {
      id: this.currentUser.id,
      name: this.currentUser.name,
      email: this.currentUser.email,
      imageUrl: this.currentUser.picture,
      accessToken: this.accessToken
    };
  }

  getAccessToken() {
    return this.accessToken;
  }

  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  notifyListeners(event, data = null) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// Create singleton instance
export const googleAuth = new GoogleAuthService();
export default googleAuth;