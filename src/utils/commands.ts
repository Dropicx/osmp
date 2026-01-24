import { invoke } from '@tauri-apps/api/core';
import type {
  Track,
  TrackFilters,
  ScanFolder,
  ScanResult,
  MetadataResult,
  CoverFetchResult,
  Playlist,
  PlayHistoryEntry,
  Album,
} from '../types';
import type { EqualizerSettings, EqPreset } from '../types';

/**
 * Typed command wrappers for all Tauri backend commands.
 * Single source of truth for command names and argument types.
 */
export const commands = {
  // Scan operations
  getScanFolders: () => invoke<ScanFolder[]>('get_scan_folders'),
  addScanFolder: (path: string) => invoke<void>('add_scan_folder', { path }),
  removeScanFolder: (id: number) => invoke<void>('remove_scan_folder', { id }),
  scanFolders: () => invoke<ScanResult>('scan_folders'),
  cancelScan: () => invoke<void>('cancel_scan'),

  // Track operations
  getTracks: (filters?: TrackFilters | null) =>
    invoke<Track[]>('get_tracks', { filters: filters ?? null }),
  searchTracks: (query: string) => invoke<Track[]>('search_tracks', { query }),
  deleteTrack: (trackId: number) => invoke<void>('delete_track', { trackId }),
  deleteTracks: (trackIds: number[]) => invoke<void>('delete_tracks', { trackIds }),

  // Playback
  playTrack: (trackId: number) => invoke<void>('play_track', { trackId }),
  pausePlayback: () => invoke<void>('pause_playback'),
  stopPlayback: () => invoke<void>('stop_playback'),
  setVolume: (volume: number) =>
    invoke<void>('set_volume', { volume: Math.max(0, Math.min(1, volume)) }),
  getPlaybackPosition: () => invoke<number>('get_playback_position'),
  seekToPosition: (position: number) =>
    invoke<void>('seek_to_position', { position: Math.max(0, position) }),
  setPlaybackSpeed: (speed: number) => invoke<void>('set_playback_speed', { speed }),
  preloadNextTrack: (trackId: number) => invoke<void>('preload_next_track', { trackId }),

  // Metadata
  fetchMetadata: (trackIds: number[], force: boolean = false) =>
    invoke<MetadataResult[]>('fetch_metadata', { trackIds, force }),
  updateTrackMetadataManual: (
    trackId: number,
    title?: string | null,
    artist?: string | null,
    album?: string | null,
    year?: number | null,
    genre?: string | null,
    trackNumber?: number | null
  ) =>
    invoke<void>('update_track_metadata_manual', {
      trackId,
      title,
      artist,
      album,
      year,
      genre,
      trackNumber,
    }),
  writeMetadataToFile: (
    trackId: number,
    title?: string | null,
    artist?: string | null,
    album?: string | null,
    year?: number | null,
    genre?: string | null,
    trackNumber?: number | null
  ) =>
    invoke<void>('write_metadata_to_file', {
      trackId,
      title,
      artist,
      album,
      year,
      genre,
      trackNumber,
    }),

  // Cover art
  getTrackCover: (trackId: number) => invoke<string | null>('get_track_cover', { trackId }),
  fetchCovers: (trackIds: number[]) => invoke<CoverFetchResult[]>('fetch_covers', { trackIds }),
  getAlbumCover: (albumName: string, artist?: string | null) =>
    invoke<string | null>('get_album_cover', { albumName, artist }),

  // Albums
  getAlbums: () => invoke<Album[]>('get_albums'),
  getAlbumTracks: (albumName: string, artist?: string | null) =>
    invoke<Track[]>('get_album_tracks', { albumName, artist }),
  playAlbum: (albumName: string, artist?: string | null) =>
    invoke<void>('play_album', { albumName, artist }),

  // Playlists
  createPlaylist: (name: string) => invoke<number>('create_playlist', { name }),
  deletePlaylist: (id: number) => invoke<void>('delete_playlist', { id }),
  renamePlaylist: (id: number, newName: string) => invoke<void>('rename_playlist', { id, newName }),
  getPlaylists: () => invoke<Playlist[]>('get_playlists'),
  getPlaylist: (id: number) => invoke<Playlist>('get_playlist', { id }),
  getPlaylistTracks: (playlistId: number) => invoke<Track[]>('get_playlist_tracks', { playlistId }),
  addTrackToPlaylist: (playlistId: number, trackId: number, position?: number | null) =>
    invoke<void>('add_track_to_playlist', { playlistId, trackId, position }),
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) =>
    invoke<void>('add_tracks_to_playlist', { playlistId, trackIds }),
  removeTrackFromPlaylist: (playlistId: number, trackId: number) =>
    invoke<void>('remove_track_from_playlist', { playlistId, trackId }),
  reorderPlaylistTracks: (playlistId: number, trackPositions: Array<[number, number]>) =>
    invoke<void>('reorder_playlist_tracks', { playlistId, trackPositions }),
  duplicatePlaylist: (playlistId: number, newName: string) =>
    invoke<number>('duplicate_playlist', { playlistId, newName }),
  playPlaylist: (playlistId: number) => invoke<void>('play_playlist', { playlistId }),

  // M3U Import/Export
  exportPlaylistM3u: (playlistId: number, outputPath: string) =>
    invoke<void>('export_playlist_m3u', { playlistId, outputPath }),
  importPlaylistM3u: (filePath: string, playlistName?: string | null) =>
    invoke<number>('import_playlist_m3u', { filePath, playlistName }),

  // Equalizer
  getEqSettings: () => invoke<EqualizerSettings>('get_eq_settings'),
  setEqBand: (band: number, gainDb: number) => invoke<void>('set_eq_band', { band, gainDb }),
  setEqEnabled: (enabled: boolean) => invoke<void>('set_eq_enabled', { enabled }),
  setEqPreset: (presetName: string) => invoke<void>('set_eq_preset', { presetName }),
  setEqPreamp: (preampDb: number) => invoke<void>('set_eq_preamp', { preampDb }),
  getEqPresets: () => invoke<EqPreset[]>('get_eq_presets'),
  saveEqSettings: () => invoke<void>('save_eq_settings'),
  getVisualizerData: () => invoke<number[]>('get_visualizer_data'),

  // Play History
  recordPlayHistory: (trackId: number, durationListened: number) =>
    invoke<void>('record_play_history', { trackId, durationListened }),
  getPlayHistory: (limit?: number) => invoke<PlayHistoryEntry[]>('get_play_history', { limit }),

  // Duplicate Detection
  getDuplicates: () => invoke<Track[][]>('get_duplicates'),
};
