import type { Track, Album, Playlist, EqualizerSettings, EqPreset } from '../types';
import type { ContentColumnId } from '../types/columns';

export type RepeatMode = 'off' | 'list' | 'track';

export interface QueueItem {
  queueId: number;
  track: Track;
}

export interface PlayerSlice {
  currentTrack: Track | null;
  isPlaying: boolean;
  audioLoaded: boolean;
  volume: number;
  position: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  shuffledQueue: number[];
  currentCoverArt: string | null;
  playbackSpeed: number;
  _positionInterval: ReturnType<typeof setInterval> | null;

  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setPosition: (position: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  playTrack: (trackId: number) => Promise<void>;
  pausePlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  startPositionTracking: () => void;
  stopPositionTracking: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  generateShuffledQueue: () => void;
  getNextTrackId: () => number | null;
  refreshCurrentTrack: () => Promise<void>;
}

export interface LibrarySlice {
  tracks: Track[];
  loading: boolean;
  selectedTracks: number[];
  albums: Album[];
  albumTracks: Track[];
  albumLoading: boolean;

  setTracks: (tracks: Track[]) => void;
  setLoading: (loading: boolean) => void;
  toggleTrackSelection: (trackId: number) => void;
  clearSelection: () => void;
  loadTracks: (force?: boolean) => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  loadAlbums: (force?: boolean) => Promise<void>;
  loadAlbumTracks: (albumName: string, artist: string | null) => Promise<void>;
  playAlbum: (albumName: string, artist: string | null) => Promise<void>;
}

export interface PlaylistSlice {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  playlistTracks: Track[];
  playlistLoading: boolean;

  setCurrentPlaylist: (playlist: Playlist | null) => void;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<number>;
  deletePlaylist: (id: number) => Promise<void>;
  renamePlaylist: (id: number, newName: string) => Promise<void>;
  loadPlaylistTracks: (playlistId: number) => Promise<void>;
  addTrackToPlaylist: (playlistId: number, trackId: number, position?: number) => Promise<void>;
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  reorderPlaylistTracks: (
    playlistId: number,
    trackPositions: Array<{ trackId: number; position: number }>
  ) => Promise<void>;
  duplicatePlaylist: (playlistId: number, newName: string) => Promise<void>;
  playPlaylist: (playlistId: number) => Promise<void>;
}

export interface EqualizerSlice {
  eqSettings: EqualizerSettings | null;
  eqPresets: EqPreset[];
  isEqPanelOpen: boolean;
  visualizerEnabled: boolean;
  visualizerOpacity: number;

  loadEqSettings: () => Promise<void>;
  loadEqPresets: () => Promise<void>;
  setEqBand: (band: number, gainDb: number) => Promise<void>;
  setEqEnabled: (enabled: boolean) => Promise<void>;
  setEqPreamp: (preampDb: number) => Promise<void>;
  applyEqPreset: (presetName: string) => Promise<void>;
  saveEqSettings: () => Promise<void>;
  toggleEqPanel: () => void;
  setVisualizerEnabled: (enabled: boolean) => void;
  setVisualizerOpacity: (opacity: number) => void;
}

export interface QueueSlice {
  queue: QueueItem[];
  isQueuePanelOpen: boolean;

  addToQueue: (trackIds: number[], position?: 'next' | 'end') => Promise<void>;
  removeFromQueue: (queueId: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  toggleQueuePanel: () => void;
}

export interface ColumnSlice {
  columnWidths: Record<ContentColumnId, number>;
  columnVisibility: Record<ContentColumnId, boolean>;
  setColumnWidth: (columnId: ContentColumnId, width: number) => void;
  setColumnVisibility: (columnId: ContentColumnId, visible: boolean) => void;
  resetColumnWidths: () => void;
  resetColumnVisibility: () => void;
}

export type AppState = PlayerSlice &
  LibrarySlice &
  PlaylistSlice &
  EqualizerSlice &
  QueueSlice &
  ColumnSlice;
