// Google OAuth2 Authentication Service
class GoogleAuthService {
  constructor() {
    this.isSignedIn = false;
    this.currentUser = null;
    this.auth2Instance = null;
    this.apiKey = null;
    this.clientId = null;
    this.discoveryDoc = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    this.scopes = 'https://www.googleapis.com/auth/drive.file';
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

      // Load the Google APIs client library
      if (!window.gapi) {
        await this.loadGoogleAPI();
      }

      // Initialize the API client
      await window.gapi.load('client:auth2', async () => {
        await window.gapi.client.init({
          apiKey: this.apiKey,
          clientId: this.clientId,
          discoveryDocs: [this.discoveryDoc],
          scope: this.scopes
        });

        this.auth2Instance = window.gapi.auth2.getAuthInstance();
        this.isSignedIn = this.auth2Instance.isSignedIn.get();
        
        if (this.isSignedIn) {
          this.currentUser = this.auth2Instance.currentUser.get();
          localStorage.setItem('google_was_signed_in', 'true');
        }

        // Listen for auth state changes
        this.auth2Instance.isSignedIn.listen((isSignedIn) => {
          this.isSignedIn = isSignedIn;
          if (isSignedIn) {
            this.currentUser = this.auth2Instance.currentUser.get();
            localStorage.setItem('google_was_signed_in', 'true');
            this.notifyListeners('signIn', this.getUserInfo());
          } else {
            this.currentUser = null;
            localStorage.removeItem('google_was_signed_in');
            this.notifyListeners('signOut');
          }
        });

        this.initialized = true;
      });

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

  async signIn() {
    if (!this.initialized) {
      throw new Error('Google Auth not initialized');
    }

    try {
      const user = await this.auth2Instance.signIn();
      this.currentUser = user;
      this.isSignedIn = true;
      localStorage.setItem('google_was_signed_in', 'true');
      return this.getUserInfo();
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
      await this.auth2Instance.signOut();
      this.currentUser = null;
      this.isSignedIn = false;
      localStorage.removeItem('google_was_signed_in');
      return true;
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  getUserInfo() {
    if (!this.isSignedIn || !this.currentUser) {
      return null;
    }

    const profile = this.currentUser.getBasicProfile();
    return {
      id: profile.getId(),
      name: profile.getName(),
      email: profile.getEmail(),
      imageUrl: profile.getImageUrl(),
      accessToken: this.currentUser.getAuthResponse().access_token
    };
  }

  getAccessToken() {
    if (!this.isSignedIn || !this.currentUser) {
      return null;
    }
    return this.currentUser.getAuthResponse().access_token;
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