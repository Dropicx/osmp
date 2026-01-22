import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../types';

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
}

interface AppState extends PlayerState, LibraryState {
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
    const { currentTrack, tracks, shuffleEnabled, shuffledQueue, repeatMode } = get();
    if (!currentTrack || tracks.length === 0) return;

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
      const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
      if (currentIndex < tracks.length - 1) {
        nextTrackId = tracks[currentIndex + 1].id;
      } else if (repeatMode === 'list') {
        nextTrackId = tracks[0].id;
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
    const { currentTrack, tracks, shuffleEnabled, shuffledQueue, position } = get();
    if (!currentTrack || tracks.length === 0) return;

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
      const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
      if (currentIndex > 0) {
        prevTrackId = tracks[currentIndex - 1].id;
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
}));
