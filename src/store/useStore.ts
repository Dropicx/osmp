import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../types';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  position: number;
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
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  volume: 1.0,
  position: 0,
  tracks: [],
  loading: false,
  selectedTracks: [],

  // Player actions
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => {
    set({ volume });
    invoke('set_volume', { volume });
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

  // Actions
  playTrack: async (trackId: number) => {
    try {
      await invoke('play_track', { trackId });
      const track = get().tracks.find(t => t.id === trackId);
      if (track) {
        set({ currentTrack: track, isPlaying: true });
      }
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  },

  pausePlayback: async () => {
    try {
      await invoke('pause_playback');
      set((state) => ({ isPlaying: !state.isPlaying }));
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  },

  stopPlayback: async () => {
    try {
      await invoke('stop_playback');
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
