# OSMP - Open Source Music Player

OSMP is a modern, local-first music player for **macOS and Linux**. It features a Spotify-like interface, local music library management, metadata enhancement from MusicBrainz, playlists, queue, equalizer, and in-app updates. **Windows is not currently supported.**

## Supported Platforms

- **macOS**: Apple Silicon (aarch64) and Intel (x86_64). Distributed as a DMG; in-app updater available.
- **Linux**: x86_64, distributed as an AppImage; in-app updater available.
- **Windows**: Not supported. No installers or updater are provided.

## Features

- **Local Music Library**: Add scan folders, run full or background scans, browse and filter tracks
- **Smart Search**: Full-text search across tracks, artists, and albums
- **Modern UI**: Spotify-inspired interface with dark theme
- **Metadata Enhancement**: Fetch missing metadata and cover art from MusicBrainz and Cover Art Archive; edit metadata and write to files
- **Playlists**: Create, rename, delete, reorder, and duplicate playlists; add/remove tracks; M3U import/export
- **Queue**: Play next, play later, reorder, clear
- **Audio Playback**: High-quality playback with volume, seek, and playback speed; preload next track
- **Equalizer & Visualizer**: Multi-band equalizer with presets; optional visualizer
- **Dashboard**: Recently added tracks and recommendations based on your library
- **Media Controls**: macOS (Control Center / lock screen); Linux (MPRIS — media keys, system tray)
- **Keyboard Shortcuts**: Play/pause, next/previous, volume, search, and more
- **Auto-updater**: Check for and install updates from GitHub Releases inside the app

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Rust (Tauri 2), SQLite (rusqlite), Rodio (audio), Lofty (metadata)
- **Metadata**: MusicBrainz API, Cover Art Archive
- **Media Controls**: MPRIS (Linux), macOS Media Remote

## Installation

### Linux

Download and run the latest AppImage in one command:

```bash
curl -sL "$(curl -s https://api.github.com/repos/Dropicx/osmp/releases/latest \
  | grep -o 'https://[^"]*\.AppImage')" -o OSMP.AppImage && chmod +x OSMP.AppImage && ./OSMP.AppImage
```

Or manually: download the `.AppImage` from the latest [GitHub Releases](https://github.com/Dropicx/osmp/releases), make it executable (`chmod +x OSMP-*.AppImage`), and run it.

### macOS

Download the `.dmg` from the latest [GitHub Releases](https://github.com/Dropicx/osmp/releases), open it, and drag OSMP to Applications. See [macOS Gatekeeper notice](#macos-gatekeeper-notice) below.

#### macOS Gatekeeper notice

OSMP is not currently code-signed with an Apple Developer certificate. macOS Gatekeeper will block the app the first time you try to open it. **You are running this at your own risk.** To open the app, use one of these methods:

**Option 1 — Remove the quarantine attribute (terminal):**

```bash
xattr -cr /Applications/OSMP.app
```

**Option 2 — Right-click to open:**

1. Right-click (or Control-click) the app in Finder
2. Select **Open** from the context menu
3. Click **Open** in the confirmation dialog

You only need to do this once. After the first launch, macOS will remember your choice.

**Option 3 — System Settings:**

1. Try to open the app normally (it will be blocked)
2. Go to **System Settings > Privacy & Security**
3. Scroll down and click **Open Anyway** next to the OSMP message

### Updates

The app can update itself via the in-app updater when new releases are published.

## Building from Source

### Prerequisites

**All platforms:**

- Node.js v18 or higher
- Rust (latest stable)
- npm or yarn

**macOS:** Xcode Command Line Tools. Install with: `xcode-select --install` if needed.

**Linux:** System packages required for Tauri/WebKit. On Ubuntu or Debian:

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libasound2-dev \
  patchelf
```

### Development

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

For a step-by-step first-time guide and troubleshooting, see [QUICKSTART.md](QUICKSTART.md).

### Production Build

```bash
npm run build
npx tauri build
```

- **macOS**: Installer is in `src-tauri/target/release/bundle/dmg/*.dmg` (and app bundle in `bundle/macos/`).
- **Linux**: AppImage is in `src-tauri/target/release/bundle/appimage/*.AppImage`.

Builds are only produced for macOS and Linux; there is no Windows target.

## Usage

1. **Settings**: Add music folders, optionally configure scan settings (min duration, exclude paths), then run **Scan Now**. Background scanning can index new files automatically.
2. **Library**: Browse all scanned tracks; select tracks for bulk actions (fetch metadata, add to playlist, delete, etc.).
3. **Albums**: Browse by album with cover art.
4. **Playlists**: Create, rename, or delete playlists; add/remove/reorder tracks; import/export M3U.
5. **Queue**: Use “Play next” / “Play later” and reorder or clear the queue.
6. **Player**: Click a track to play; use the bottom bar for play/pause, seek, volume, and playback speed; open the equalizer/visualizer from the player area.
7. **Search**: Use the Search page or **Ctrl/Cmd+F** to search tracks, artists, and albums.
8. **Dashboard**: View recently added tracks and recommendations.

### Keyboard Shortcuts

- **Space**: Play/Pause
- **Arrow Right**: Next track
- **Arrow Left**: Previous track
- **Arrow Up / Down**: Volume up/down (5%)
- **Ctrl/Cmd+F**: Focus search
- **Delete / Backspace**: Delete selected tracks (when not in an input)
- **Ctrl/Cmd+A**: Select all tracks
- **Escape**: Clear selection, close queue or equalizer panel

### Media Controls

- **macOS**: Playback appears in Control Center and on the lock screen.
- **Linux**: MPRIS integration — use media keys and system tray player controls.

## Data and Database

The SQLite database (`osmp.db`) and app data are stored in the platform data directory:

- **Linux**: `~/.local/share/osmp/`
- **macOS**: `~/Library/Application Support/osmp/`

## Supported Audio Formats

- MP3, FLAC, OGG, M4A, WAV, AAC, OPUS, WMA

## Development

### Useful Commands

```bash
npm run dev          # Frontend dev server only
npm run build        # Build frontend
npm run tauri dev    # Full app in development mode
npm run tauri build  # Production build
npm run test         # Run tests
npm run type-check   # TypeScript check
npm run lint         # ESLint
npm run format       # Prettier format
npm run format:check # Prettier check
```

### Project Structure

```
osmp/
├── src/                      # React frontend
│   ├── App.tsx
│   ├── components/           # Dashboard, Library, Albums, Search, Settings,
│   │                         # Player, PlaylistsSidebar, PlaylistDetail,
│   │                         # QueuePanel, EqualizerPanel, Visualizer,
│   │                         # UpdateBanner, TrackTable, etc.
│   ├── store/                # Zustand slices (library, player, playlist,
│   │                         # queue, equalizer, column)
│   ├── hooks/
│   ├── utils/
│   ├── types.ts
│   └── constants.ts
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── lib.rs            # Tauri setup, app state
│   │   ├── commands.rs       # Tauri commands
│   │   ├── database.rs       # SQLite operations
│   │   ├── scanner.rs        # File scanning
│   │   ├── background_scan.rs
│   │   ├── metadata.rs       # MusicBrainz / Cover Art
│   │   ├── audio.rs          # Rodio playback
│   │   ├── equalizer.rs
│   │   ├── models.rs
│   │   ├── playlist_io.rs     # M3U import/export
│   │   ├── media_controls.rs
│   │   ├── media_controls_macos.rs
│   │   ├── media_controls_mpris.rs
│   │   └── error.rs
│   └── Cargo.toml
└── package.json
```

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Support

If you enjoy using OSMP, consider supporting the development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/la7)

## Acknowledgments

- Built with the assistance of [Claude Code](https://claude.ai/claude-code) by Anthropic
- [Tauri](https://tauri.app/) for the app framework
- [MusicBrainz](https://musicbrainz.org/) and [Cover Art Archive](https://coverartarchive.org/) for metadata and artwork
- [Lucide](https://lucide.dev/) for icons
- MPRIS (Linux) and macOS Media Remote for system media integration
