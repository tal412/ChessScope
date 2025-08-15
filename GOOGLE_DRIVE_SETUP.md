# Google Drive Backup Setup Guide

This guide will help you set up Google Drive integration for automatic backup of your ChessScope study data.

## Overview

The Google Drive backup feature provides:
- **Automatic backup**: Your study database is automatically synced to Google Drive every 30 seconds when changes are detected
- **Data safety**: Never lose your study progress, even if you clear browser data or switch devices
- **Easy restore**: Restore your data from Google Drive with one click
- **Cross-device sync**: Access your studies from any device where you're signed in

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.developers.google.com/)
2. Click "Create Project" or select an existing project
3. Give your project a name (e.g., "ChessScope Backup")

### 2. Enable Google Drive API

1. In your Google Cloud project, go to **APIs & Services > Library**
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in the required fields:
     - App name: "ChessScope"
     - User support email: your email
     - Developer contact email: your email
   - Add scopes: `../auth/drive.file` (allows access to files created by the app)
   - Add test users if in testing mode

4. Create OAuth 2.0 Client ID:
   - Application type: "Web application"
   - Name: "ChessScope Web Client"
   - Authorized origins: Add your domain(s)
     - For development: `http://localhost:5173`
     - For production: `https://yourdomain.com`

### 4. Get API Key (Optional but Recommended)

1. In **APIs & Services > Credentials**
2. Click "Create Credentials" > "API Key"
3. Restrict the API key (recommended):
   - Go to the API key settings
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Drive API"
   - Under "Website restrictions", add your domain(s)

### 5. Configure ChessScope

1. Copy `.env.example` to `.env` in your ChessScope root directory:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder values with your actual credentials:
   ```bash
   # Google API Key from step 4
   VITE_GOOGLE_API_KEY=AIzaSyYourApiKeyHere...
   
   # OAuth 2.0 Client ID from step 3
   VITE_GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
   ```

3. Restart your development server for the changes to take effect:
   ```bash
   npm run dev
   ```

### 6. Test the Setup

1. Start your ChessScope application
2. Go to Settings (gear icon in sidebar)
3. Look for the "Google Drive Backup" section
4. If configured correctly, you should see a "Sign in to Google" button
5. If there are configuration errors, detailed instructions will be shown

## Usage

### Enabling Backup

1. Click "Sign in to Google" in the backup section
2. Complete the Google OAuth flow
3. Click "Enable" to start automatic backups
4. Your data will be backed up to a "ChessScope" folder in your Google Drive

### Features

- **Automatic sync**: Changes are backed up every 30 seconds
- **Manual backup**: Click "Backup Now" to force an immediate backup
- **Restore**: Click "Restore" to replace your current data with the cloud backup
- **Status indicators**: See backup status, last backup time, and file size
- **Error handling**: Clear error messages if something goes wrong

### File Location

Your backup file will be stored at:
```
Google Drive > ChessScope > chesscope-backup.db
```

### Security

- Only ChessScope can access files it creates in your Google Drive
- Your data is stored securely using Google's encryption
- You can revoke access anytime in your Google Account settings

## Troubleshooting

### "Google API key not configured"
- Make sure you've created a `.env` file from `.env.example`
- Verify you've set `VITE_GOOGLE_API_KEY` in your `.env` file
- Ensure your API key is unrestricted or restricted to the Google Drive API
- Restart your development server after adding environment variables

### "Google Client ID not configured" 
- Make sure you've created a `.env` file from `.env.example`
- Verify you've set `VITE_GOOGLE_CLIENT_ID` in your `.env` file
- Verify the Client ID format ends with `.apps.googleusercontent.com`
- Restart your development server after adding environment variables

### "Sign in failed"
- Check that your domain is added to authorized origins in Google Cloud Console
- Make sure you're using the correct OAuth 2.0 Client ID

### "Backup failed"
- Check your internet connection
- Verify you haven't exceeded Google Drive storage limits
- Try signing out and signing back in

### "Restore failed"
- Ensure you have at least one backup file in Google Drive
- Check that the backup file isn't corrupted
- Try creating a new backup and then restoring

## Development Notes

### File Structure
```
.env.example                       # Template for environment variables
.env                              # Your actual credentials (gitignored)
src/
├── components/
│   └── GoogleBackupManager.jsx    # UI component for backup management
├── services/
│   ├── GoogleAuth.js              # Google authentication service
│   └── GoogleDriveBackup.js       # Backup/restore functionality
├── config/
│   └── google.js                  # Loads config from environment variables
└── api/
    └── database.js                # Modified to integrate with backup
```

### Key Features
- Lazy loading to avoid circular dependencies
- Automatic restore attempt on app startup for new devices
- Comprehensive error handling and user feedback
- Configurable backup frequency
- Status tracking and progress indicators

## FAQ

**Q: Is my data safe?**
A: Yes, your data is stored in your personal Google Drive with strong encryption and access controls.

**Q: Can I use this without Google Drive?**
A: Yes, ChessScope works perfectly without Google Drive. Backup is optional.

**Q: How much storage does it use?**
A: The backup file is typically very small (usually under 1MB) containing only your study data.

**Q: Can I access backups from multiple devices?**
A: Yes, sign in with the same Google account on any device to access your backups.

**Q: What happens if I delete the backup file?**
A: The next automatic backup will create a new backup file. Your local data remains unchanged.

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify your Google Cloud Console configuration
3. Ensure you're using the latest version of ChessScope
4. Create an issue on the GitHub repository with details about the problem