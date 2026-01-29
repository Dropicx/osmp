# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.2] - 2025-05-30

### Fixed
- Playlist delete confirmation modal on Linux (browser `confirm()` was non-blocking in WebKitGTK)
- Auto-download updates immediately when detected instead of waiting for user click

## [0.2.0] - 2025-05-30

### Added
- Rust quality checks in CI (clippy with `-D warnings`, rustfmt)
- SHA256 checksums file included in GitHub releases
- CHANGELOG.md with full version history

### Changed
- Consolidated macOS and Linux build jobs into a single matrix-based job
- Release notes now extracted from CHANGELOG.md instead of auto-generated
- Added concurrency control to prevent duplicate release pipeline runs

### Removed
- Debug "List bundle outputs" steps from build pipeline

## [0.1.8] - 2025-05-29

### Fixed
- Linux updater artifacts in release pipeline

## [0.1.7] - 2025-05-29

### Changed
- Hardened backend with input validation and sanitized error messages
- Improved security with CSP headers and path traversal prevention

### Fixed
- UI polish and minor frontend fixes

## [0.1.5] - 2025-05-28

### Added
- Updater bundle artifacts for signed in-app updates
- Tauri updater plugin integration with signing keys

## [0.1.4] - 2025-05-28

### Fixed
- Playlist checkbox column width
- Drag overlay flicker
- Settings dropdown styling

## [0.1.3] - 2025-05-28

### Fixed
- Release workflow annotations for missing updater artifacts
- Graceful handling of missing updater artifacts in release pipeline

## [0.1.2] - 2025-05-27

### Added
- Drag-and-drop support for adding tracks to playlists
- Background scanning on startup and periodic intervals
- In-app auto-update support
- Playlist management (create, rename, delete, duplicate, reorder)

### Fixed
- Various UI improvements and bug fixes

## [0.1.1] - 2025-05-27

### Fixed
- Scanned music not showing until app restart
- ESLint warnings across 18 component files
- MPRIS module compatibility with mpris-server 0.9 API

## [0.1.0] - 2025-05-26

### Added
- Initial release
- Music library scanning with incremental updates
- Audio playback with gapless preloading
- MusicBrainz metadata fetching
- Cover art from Cover Art Archive
- 5-band equalizer with presets
- Playlist management with M3U import/export
- Album view with cover art
- Media controls integration (macOS, Linux MPRIS, Windows)
- Play history tracking
- Duplicate track detection
- Playback speed control
- Search across tracks
