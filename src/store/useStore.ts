import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Track, Album, Playlist, EqualizerSettings, EqPreset } from '../types';

type RepeatMode = 'off' | 'list' | 'track';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  position: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  shuffledQueue: number[];
  currentCoverArt: string | null;
}

interface LibraryState {
  tracks: Track[];
  loading: boolean;
  selectedTracks: number[];
  albums: Album[];
  albumTracks: Track[];
  albumLoading: boolean;
}

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  playlistTracks: Track[];
  playlistLoading: boolean;
}

interface EqualizerState {
  eqSettings: EqualizerSettings | null;
  eqPresets: EqPreset[];
  isEqPanelOpen: boolean;
  visualizerEnabled: boolean;
  visualizerOpacity: number;
}

interface AppState extends PlayerState, LibraryState, PlaylistState, EqualizerState {
  // Player actions
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setPosition: (position: number) => void;

  // Library actions
  setTracks: (tracks: Track[]) => void;
  setLoading: (loading: boolean) => void;
  toggleTrackSelection: (trackId: number) => void;
  clearSelection: () => void;

  // Actions
  playTrack: (trackId: number) => Promise<void>;
  pausePlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  loadTracks: () => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  
  // Album actions
  loadAlbums: () => Promise<void>;
  loadAlbumTracks: (albumName: string, artist: string | null) => Promise<void>;
  playAlbum: (albumName: string, artist: string | null) => Promise<void>;

  // Playlist actions
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<number>;
  deletePlaylist: (id: number) => Promise<void>;
  renamePlaylist: (id: number, newName: string) => Promise<void>;
  loadPlaylistTracks: (playlistId: number) => Promise<void>;
  addTrackToPlaylist: (playlistId: number, trackId: number, position?: number) => Promise<void>;
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  reorderPlaylistTracks: (playlistId: number, trackPositions: Array<{trackId: number, position: number}>) => Promise<void>;
  duplicatePlaylist: (playlistId: number, newName: string) => Promise<void>;
  playPlaylist: (playlistId: number) => Promise<void>;
  setCurrentPlaylist: (playlist: Playlist | null) => void;

  // Shuffle/Repeat actions
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  generateShuffledQueue: () => void;

  // Position tracking
  _positionInterval: ReturnType<typeof setInterval> | null;
  startPositionTracking: () => void;
  stopPositionTracking: () => void;

  // Refresh current track (for live updates after metadata/cover fetch)
  refreshCurrentTrack: () => Promise<void>;

  // Equalizer actions
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

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  volume: 1.0,
  position: 0,
  shuffleEnabled: false,
  repeatMode: 'off' as RepeatMode,
  shuffledQueue: [],
  currentCoverArt: null,
  tracks: [],
  loading: false,
  selectedTracks: [],
  albums: [],
  albumTracks: [],
  albumLoading: false,
  playlists: [],
  currentPlaylist: null,
  playlistTracks: [],
  playlistLoading: false,
  eqSettings: null,
  eqPresets: [],
  isEqPanelOpen: false,
  visualizerEnabled: localStorage.getItem('visualizerEnabled') !== 'false',
  visualizerOpacity: Number(localStorage.getItem('visualizerOpacity')) || 80,
  _positionInterval: null,

  // Player actions
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => {
    set({ volume });
    invoke('set_volume', { volume }).catch(console.error);
  },
  setPosition: (position) => set({ position }),

  // Library actions
  setTracks: (tracks) => set({ tracks }),
  setLoading: (loading) => set({ loading }),
  toggleTrackSelection: (trackId) => set((state) => ({
    selectedTracks: state.selectedTracks.includes(trackId)
      ? state.selectedTracks.filter(id => id !== trackId)
      : [...state.selectedTracks, trackId]
  })),
  clearSelection: () => set({ selectedTracks: [] }),

  // Position tracking
  startPositionTracking: () => {
    const existingInterval = get()._positionInterval;
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setInterval(async () => {
      try {
        const position = await invoke<number>('get_playback_position');
        const { currentTrack, isPlaying } = get();

        set({ position });

        // Check if track ended (position >= duration - small buffer)
        if (currentTrack?.duration && isPlaying && position >= currentTrack.duration - 0.5) {
          get().stopPositionTracking();
          get().playNextTrack();
        }
      } catch (error) {
        console.error('Failed to get playback position:', error);
      }
    }, 500); // Update every 500ms

    set({ _positionInterval: interval });
  },

  stopPositionTracking: () => {
    const interval = get()._positionInterval;
    if (interval) {
      clearInterval(interval);
      set({ _positionInterval: null });
    }
  },

  // Shuffle/Repeat actions
  generateShuffledQueue: () => {
    const { tracks, currentTrack } = get();
    const trackIds = tracks.map(t => t.id);

    // Fisher-Yates shuffle
    const shuffled = [...trackIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // If there's a current track, move it to the front
    if (currentTrack) {
      const currentIndex = shuffled.indexOf(currentTrack.id);
      if (currentIndex > 0) {
        shuffled.splice(currentIndex, 1);
        shuffled.unshift(currentTrack.id);
      }
    }

    set({ shuffledQueue: shuffled });
  },

  toggleShuffle: () => {
    const { shuffleEnabled } = get();
    const newState = !shuffleEnabled;
    set({ shuffleEnabled: newState });

    if (newState) {
      get().generateShuffledQueue();
    }
  },

  cycleRepeatMode: () => {
    const { repeatMode } = get();
    const modes: RepeatMode[] = ['off', 'list', 'track'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  playNextTrack: () => {
    const { currentTrack, tracks, playlistTracks, currentPlaylist, shuffleEnabled, shuffledQueue, repeatMode } = get();
    if (!currentTrack) return;

    // Use playlist tracks if we're playing from a playlist, otherwise use library tracks
    const sourceTracks = currentPlaylist ? playlistTracks : tracks;
    if (sourceTracks.length === 0) return;

    // Repeat track mode
    if (repeatMode === 'track') {
      get().playTrack(currentTrack.id);
      return;
    }

    let nextTrackId: number | null = null;

    if (shuffleEnabled && shuffledQueue.length > 0) {
      const currentIndex = shuffledQueue.indexOf(currentTrack.id);
      if (currentIndex < shuffledQueue.length - 1) {
        nextTrackId = shuffledQueue[currentIndex + 1];
      } else if (repeatMode === 'list') {
        nextTrackId = shuffledQueue[0];
      }
    } else {
      const currentIndex = sourceTracks.findIndex(t => t.id === currentTrack.id);
      if (currentIndex < sourceTracks.length - 1) {
        nextTrackId = sourceTracks[currentIndex + 1].id;
      } else if (repeatMode === 'list') {
        nextTrackId = sourceTracks[0].id;
      }
    }

    if (nextTrackId !== null) {
      get().playTrack(nextTrackId);
    } else {
      // End of queue, stop playback
      get().stopPlayback();
    }
  },

  playPreviousTrack: () => {
    const { currentTrack, tracks, playlistTracks, currentPlaylist, shuffleEnabled, shuffledQueue, position } = get();
    if (!currentTrack) return;

    // Use playlist tracks if we're playing from a playlist, otherwise use library tracks
    const sourceTracks = currentPlaylist ? playlistTracks : tracks;
    if (sourceTracks.length === 0) return;

    // If we're more than 3 seconds into the track, restart it
    if (position > 3) {
      get().playTrack(currentTrack.id);
      return;
    }

    let prevTrackId: number | null = null;

    if (shuffleEnabled && shuffledQueue.length > 0) {
      const currentIndex = shuffledQueue.indexOf(currentTrack.id);
      if (currentIndex > 0) {
        prevTrackId = shuffledQueue[currentIndex - 1];
      }
    } else {
      const currentIndex = sourceTracks.findIndex(t => t.id === currentTrack.id);
      if (currentIndex > 0) {
        prevTrackId = sourceTracks[currentIndex - 1].id;
      }
    }

    if (prevTrackId !== null) {
      get().playTrack(prevTrackId);
    } else {
      // At the beginning, restart current track
      get().playTrack(currentTrack.id);
    }
  },

  // Actions
  playTrack: async (trackId: number) => {
    try {
      await invoke('play_track', { trackId });
      const track = get().tracks.find(t => t.id === trackId);
      if (track) {
        set({ currentTrack: track, isPlaying: true, position: 0 });
        get().startPositionTracking();

        // Fetch cover art
        try {
          const cover = await invoke<string | null>('get_track_cover', { trackId });
          set({ currentCoverArt: cover });
        } catch {
          set({ currentCoverArt: null });
        }
      }
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  },

  pausePlayback: async () => {
    try {
      await invoke('pause_playback');
      const isPlaying = get().isPlaying;
      set({ isPlaying: !isPlaying });

      if (isPlaying) {
        get().stopPositionTracking();
      } else {
        get().startPositionTracking();
      }
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  },

  stopPlayback: async () => {
    try {
      await invoke('stop_playback');
      get().stopPositionTracking();
      set({ isPlaying: false, currentTrack: null, position: 0 });
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  },

  loadTracks: async () => {
    set({ loading: true });
    try {
      const tracks = await invoke<Track[]>('get_tracks', { filters: null });
      set({ tracks, loading: false });
    } catch (error) {
      console.error('Failed to load tracks:', error);
      set({ loading: false });
    }
  },

  searchTracks: async (query: string) => {
    set({ loading: true });
    try {
      const tracks = await invoke<Track[]>('search_tracks', { query });
      set({ tracks, loading: false });
    } catch (error) {
      console.error('Failed to search tracks:', error);
      set({ loading: false });
    }
  },

  // Album actions
  loadAlbums: async () => {
    set({ albumLoading: true });
    try {
      const albums = await invoke<Album[]>('get_albums');
      set({ albums, albumLoading: false });
    } catch (error) {
      console.error('Failed to load albums:', error);
      set({ albumLoading: false });
    }
  },

  loadAlbumTracks: async (albumName: string, artist: string | null) => {
    set({ albumLoading: true });
    try {
      const tracks = await invoke<Track[]>('get_album_tracks', { 
        albumName, 
        artist: artist || null 
      });
      set({ albumTracks: tracks, albumLoading: false });
    } catch (error) {
      console.error('Failed to load album tracks:', error);
      set({ albumLoading: false });
    }
  },

  playAlbum: async (albumName: string, artist: string | null) => {
    try {
      await invoke('play_album', { albumName, artist: artist || null });
      // Load the album tracks to update UI
      await get().loadAlbumTracks(albumName, artist);
      const tracks = get().albumTracks;
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        set({ currentTrack: firstTrack, isPlaying: true, position: 0 });
        get().startPositionTracking();

        // Fetch cover art
        try {
          const cover = await invoke<string | null>('get_album_cover', {
            albumName,
            artist: artist || null
          });
          set({ currentCoverArt: cover });
        } catch {
          set({ currentCoverArt: null });
        }
      }
    } catch (error) {
      console.error('Failed to play album:', error);
    }
  },

  refreshCurrentTrack: async () => {
    const { currentTrack } = get();
    if (!currentTrack) return;

    try {
      // Re-fetch the track data from the database
      const tracks = await invoke<Track[]>('get_tracks', { filters: null });
      const updatedTrack = tracks.find(t => t.id === currentTrack.id);

      if (updatedTrack) {
        // Update the track in the store
        set({ currentTrack: updatedTrack, tracks });

        // Re-fetch cover art
        try {
          const cover = await invoke<string | null>('get_track_cover', { trackId: currentTrack.id });
          set({ currentCoverArt: cover });
        } catch {
          // Keep existing cover if fetch fails
        }
      }
    } catch (error) {
      console.error('Failed to refresh current track:', error);
    }
  },

  // Playlist actions
  setCurrentPlaylist: (playlist) => set({ currentPlaylist: playlist }),

  loadPlaylists: async () => {
    try {
      const playlists = await invoke<Playlist[]>('get_playlists');
      set({ playlists });
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  },

  createPlaylist: async (name: string) => {
    try {
      const id = await invoke<number>('create_playlist', { name });
      await get().loadPlaylists();
      return id;
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  },

  deletePlaylist: async (id: number) => {
    try {
      await invoke('delete_playlist', { id });
      const { currentPlaylist } = get();
      if (currentPlaylist?.id === id) {
        set({ currentPlaylist: null, playlistTracks: [] });
      }
      await get().loadPlaylists();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      throw error;
    }
  },

  renamePlaylist: async (id: number, newName: string) => {
    try {
      await invoke('rename_playlist', { id, newName });
      const { currentPlaylist } = get();
      if (currentPlaylist?.id === id) {
        set({ currentPlaylist: { ...currentPlaylist, name: newName } });
      }
      await get().loadPlaylists();
    } catch (error) {
      console.error('Failed to rename playlist:', error);
      throw error;
    }
  },

  loadPlaylistTracks: async (playlistId: number) => {
    set({ playlistLoading: true });
    try {
      const tracks = await invoke<Track[]>('get_playlist_tracks', { playlistId });
      set({ playlistTracks: tracks, playlistLoading: false });
    } catch (error) {
      console.error('Failed to load playlist tracks:', error);
      set({ playlistLoading: false });
      throw error;
    }
  },

  addTrackToPlaylist: async (playlistId: number, trackId: number, position?: number) => {
    try {
      await invoke('add_track_to_playlist', { playlistId, trackId, position: position ?? null });
      // Reload playlist tracks if this is the current playlist
      const { currentPlaylist } = get();
      if (currentPlaylist?.id === playlistId) {
        await get().loadPlaylistTracks(playlistId);
      }
      await get().loadPlaylists();
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
      throw error;
    }
  },

  addTracksToPlaylist: async (playlistId: number, trackIds: number[]) => {
    try {
      await invoke('add_tracks_to_playlist', { playlistId, trackIds });
      // Reload playlist tracks if this is the current playlist
      const { currentPlaylist } = get();
      if (currentPlaylist?.id === playlistId) {
        await get().loadPlaylistTracks(playlistId);
      }
      await get().loadPlaylists();
    } catch (error) {
      console.error('Failed to add tracks to playlist:', error);
      throw error;
    }
  },

  removeTrackFromPlaylist: async (playlistId: number, trackId: number) => {
    try {
      await invoke('remove_track_from_playlist', { playlistId, trackId });
      // Reload playlist tracks if this is the current playlist
      const { currentPlaylist } = get();
      if (currentPlaylist?.id === playlistId) {
        await get().loadPlaylistTracks(playlistId);
      }
      await get().loadPlaylists();
    } catch (error) {
      console.error('Failed to remove track from playlist:', error);
      throw error;
    }
  },

  reorderPlaylistTracks: async (playlistId: number, trackPositions: Array<{trackId: number, position: number}>) => {
    try {
      const positions: [number, number][] = trackPositions.map(tp => [tp.trackId, tp.position]);
      await invoke('reorder_playlist_tracks', { playlistId, trackPositions: positions });
      // Reload playlist tracks
      await get().loadPlaylistTracks(playlistId);
    } catch (error) {
      console.error('Failed to reorder playlist tracks:', error);
      throw error;
    }
  },

  duplicatePlaylist: async (playlistId: number, newName: string) => {
    try {
      await invoke('duplicate_playlist', { playlistId, newName });
      await get().loadPlaylists();
    } catch (error) {
      console.error('Failed to duplicate playlist:', error);
      throw error;
    }
  },

  playPlaylist: async (playlistId: number) => {
    try {
      await invoke('play_playlist', { playlistId });
      // Load the playlist tracks to update UI
      await get().loadPlaylistTracks(playlistId);
      const tracks = get().playlistTracks;
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        set({ currentTrack: firstTrack, isPlaying: true, position: 0 });
        get().startPositionTracking();

        // Fetch cover art
        try {
          const cover = await invoke<string | null>('get_track_cover', { trackId: firstTrack.id });
          set({ currentCoverArt: cover });
        } catch {
          set({ currentCoverArt: null });
        }

        // Set current playlist
        const playlist = get().playlists.find(p => p.id === playlistId);
        if (playlist) {
          set({ currentPlaylist: playlist });
        }
      }
    } catch (error) {
      console.error('Failed to play playlist:', error);
      throw error;
    }
  },

  // Equalizer actions
  loadEqSettings: async () => {
    try {
      const settings = await invoke<EqualizerSettings>('get_eq_settings');
      set({ eqSettings: settings });
    } catch (error) {
      console.error('Failed to load EQ settings:', error);
    }
  },

  loadEqPresets: async () => {
    try {
      const presets = await invoke<EqPreset[]>('get_eq_presets');
      set({ eqPresets: presets });
    } catch (error) {
      console.error('Failed to load EQ presets:', error);
    }
  },

  setEqBand: async (band: number, gainDb: number) => {
    try {
      await invoke('set_eq_band', { band, gainDb });
      // Update local state
      const { eqSettings } = get();
      if (eqSettings) {
        const newBands = [...eqSettings.bands];
        newBands[band] = { ...newBands[band], gain_db: gainDb };
        set({ eqSettings: { ...eqSettings, bands: newBands, preset_name: 'Custom' } });
      }
    } catch (error) {
      console.error('Failed to set EQ band:', error);
    }
  },

  setEqEnabled: async (enabled: boolean) => {
    try {
      await invoke('set_eq_enabled', { enabled });
      const { eqSettings } = get();
      if (eqSettings) {
        set({ eqSettings: { ...eqSettings, enabled } });
      }
    } catch (error) {
      console.error('Failed to set EQ enabled:', error);
    }
  },

  setEqPreamp: async (preampDb: number) => {
    try {
      await invoke('set_eq_preamp', { preampDb });
      const { eqSettings } = get();
      if (eqSettings) {
        set({ eqSettings: { ...eqSettings, preamp_db: preampDb } });
      }
    } catch (error) {
      console.error('Failed to set EQ preamp:', error);
    }
  },

  applyEqPreset: async (presetName: string) => {
    try {
      await invoke('set_eq_preset', { presetName });
      // Reload settings to get updated values
      await get().loadEqSettings();
    } catch (error) {
      console.error('Failed to apply EQ preset:', error);
    }
  },

  saveEqSettings: async () => {
    try {
      await invoke('save_eq_settings');
    } catch (error) {
      console.error('Failed to save EQ settings:', error);
    }
  },

  toggleEqPanel: () => {
    set((state) => ({ isEqPanelOpen: !state.isEqPanelOpen }));
  },

  setVisualizerEnabled: (enabled: boolean) => {
    localStorage.setItem('visualizerEnabled', String(enabled));
    set({ visualizerEnabled: enabled });
  },

  setVisualizerOpacity: (opacity: number) => {
    localStorage.setItem('visualizerOpacity', String(opacity));
    set({ visualizerOpacity: opacity });
  },
}));

// Set up media control event listeners
export function setupMediaControlListeners() {
  // Listen for authoritative playback state changes from the backend
  listen<boolean>('playback-state-changed', (event) => {
    const newIsPlaying = event.payload;
    const state = useStore.getState();
    useStore.setState({ isPlaying: newIsPlaying });
    if (newIsPlaying) {
      state.startPositionTracking();
    } else {
      state.stopPositionTracking();
    }
  }).catch(console.error);

  // Listen for next track event
  listen('media-control-next', () => {
    useStore.getState().playNextTrack();
  }).catch(console.error);

  // Listen for previous track event
  listen('media-control-previous', () => {
    useStore.getState().playPreviousTrack();
  }).catch(console.error);

  // Listen for seek event
  listen<number>('media-control-seek', (event) => {
    const position = event.payload;
    invoke('seek_to_position', { position }).catch(console.error);
  }).catch(console.error);

  // Listen for stop event
  listen('media-control-stop', () => {
    useStore.getState().stopPlayback();
  }).catch(console.error);
}
