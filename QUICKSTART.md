# OSMP Quick Start Guide

OSMP runs on **macOS and Linux only** (Windows is not supported). The SQLite database and app data are stored in the platform data directory (e.g. `~/.local/share/osmp/` on Linux, `~/Library/Application Support/osmp/` on macOS).

## Getting Started

### 1. Run the Application

**Development Mode:**
```bash
# Build the frontend first (if not already built)
npm run build

# Start the development server
npm run tauri dev
```

**Production Build:**
```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

### 2. First Steps

1. **Add Music Folders**
   - Open the app
   - Click on "Settings" in the sidebar
   - Enter a folder path containing your music files (e.g., `/Users/username/Music`)
   - Click "Add Folder"
   - Repeat for any additional music folders

2. **Scan for Music**
   - In Settings, click "Scan Now"
   - Wait for the scan to complete
   - Your music files will be indexed in the database

3. **View Your Library**
   - Click "Library" in the sidebar
   - Browse all your scanned tracks
   - Use checkboxes to select tracks for bulk operations

4. **Play Music**
   - Click any track to start playback
   - Use the player controls at the bottom:
     - Play/Pause button
     - Previous/Next track buttons
     - Volume slider

5. **Search**
   - Click "Search" in the sidebar
   - Type to search across tracks, artists, and albums

6. **Fetch Metadata**
   - Select tracks in the Library view
   - Click "Fetch Metadata" to enhance track information from MusicBrainz
   - This will update titles, artists, albums, and years

7. **Dashboard**
   - View recently added tracks
   - See recommendations based on your library
   - Quick access to your music

## Supported Audio Formats

- MP3
- FLAC
- OGG
- M4A
- WAV
- AAC
- OPUS
- WMA

## Troubleshooting

### App won't start
- Make sure you've run `npm install` first
- Ensure Rust is installed: `rustc --version`
- Build the frontend: `npm run build`

### No music found after scanning
- Check that the folder path is correct
- Verify the folder contains audio files in supported formats
- Check the console for error messages

### Metadata not fetching
- Ensure you have an internet connection
- MusicBrainz API may be rate-limited - wait a moment and try again
- Some tracks may not have matches in MusicBrainz

### Audio playback issues
- Check that your system audio is working
- Verify the audio file isn't corrupted
- Try a different audio file format

## Development Tips

### Project Structure
- `src/` - React frontend (TypeScript)
- `src-tauri/src/` - Rust backend
- `src-tauri/src/database.rs` - Database operations
- `src-tauri/src/scanner.rs` - File scanning
- `src-tauri/src/metadata.rs` - Metadata fetching
- `src-tauri/src/audio.rs` - Audio playback

### Making Changes

1. **Frontend Changes:**
   ```bash
   npm run dev  # Start Vite dev server (frontend only)
   ```

2. **Backend Changes:**
   - Edit Rust files in `src-tauri/src/`
   - Changes will be picked up automatically in `tauri dev`

3. **Full Rebuild:**
   ```bash
   npm run build
   npm run tauri dev
   ```

### Database Location
The SQLite database is stored as `osmp.db` in the project root directory.

### Next Steps for Enhancement

1. **Improve Audio Player**
   - Add progress bar functionality
   - Implement seek functionality
   - Add shuffle and repeat modes
   - Store player state in Tauri app state

2. **Enhanced Metadata**
   - Add album artwork fetching
   - Support more metadata sources
   - Cache metadata locally

3. **Playlists**
   - Create and manage playlists
   - Save playlists to database
   - Import/export playlists

4. **UI Improvements**
   - Add album art display
   - Improve recommendations algorithm
   - Add keyboard shortcuts
   - Dark/light theme toggle

5. **Performance**
   - Optimize database queries
   - Add pagination for large libraries
   - Cache album artwork

## Useful Commands

```bash
# Install dependencies
npm install

# Run frontend dev server only
npm run dev

# Build frontend
npm run build

# Run Tauri dev (full app)
npm run tauri dev

# Build for production
npm run tauri build

# Check Rust code
cd src-tauri && cargo check

# Format Rust code
cd src-tauri && cargo fmt

# Lint TypeScript
npm run lint  # (if configured)
```

## Getting Help

- Check the main README.md for more details
- Review Tauri documentation: https://tauri.app/
- Check Rust documentation: https://doc.rust-lang.org/
- React documentation: https://react.dev/
