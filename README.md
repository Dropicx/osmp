# OSMP - Open Source Music Player

OSMP is a modern, cross-platform music player built with open source technologies. It features a Spotify-like interface, local music library management, metadata enhancement, and intelligent recommendations.

## Features

- 🎵 **Local Music Library**: Scan and index your music folders
- 🔍 **Smart Search**: Full-text search across tracks, artists, and albums
- 🎨 **Modern UI**: Beautiful, Spotify-inspired interface with dark theme
- 📊 **Metadata Enhancement**: Automatically fetch missing metadata from MusicBrainz
- 🎯 **Recommendations**: Get personalized music recommendations based on your library
- 🎮 **Flexible Metadata Fetching**: Fetch metadata for individual tracks, selected tracks, or globally
- 🎧 **Audio Playback**: High-quality audio playback with volume control
- 📱 **Cross-Platform**: Works on Windows, Linux, and macOS

## Technology Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri)
- **Database**: SQLite
- **Audio**: Rodio
- **Metadata**: MusicBrainz API

## Prerequisites

- Node.js (v18 or higher)
- Rust (latest stable)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Dropicx/osmp.git
cd osmp
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run tauri dev
```

## Building

To build the application:

```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/` (or `src-tauri/target/release/bundle/` for installers).

## Usage

1. **Add Scan Folders**: Go to Settings and add folders containing your music files
2. **Scan for Music**: Click "Scan Now" to index all audio files in your folders
3. **Play Music**: Click on any track to start playback
4. **Fetch Metadata**: Select tracks and click "Fetch Metadata" to enhance track information
5. **Search**: Use the Search page to find specific tracks, artists, or albums
6. **Explore**: Check the Dashboard for recommendations and recently added music

## Supported Audio Formats

- MP3
- FLAC
- OGG
- M4A
- WAV
- AAC
- OPUS
- WMA

## Development

### Project Structure

```
osmp/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── store/             # State management
│   └── types.ts           # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Tauri setup
│   │   ├── commands.rs    # Tauri commands
│   │   ├── database.rs    # SQLite operations
│   │   ├── scanner.rs     # File scanning
│   │   ├── metadata.rs    # Metadata fetching
│   │   ├── audio.rs       # Audio playback
│   │   └── models.rs      # Data structures
│   └── Cargo.toml         # Rust dependencies
└── package.json           # Node dependencies
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under an open source license.

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Metadata provided by [MusicBrainz](https://musicbrainz.org/)
- Icons by [Lucide](https://lucide.dev/)
