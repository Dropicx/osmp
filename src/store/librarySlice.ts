import { StateCreator } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Track, Album } from '../types';
import type { AppState, LibrarySlice, QueueItem } from './types';

let nextQueueId = 1000;

export const createLibrarySlice: StateCreator<AppState, [], [], LibrarySlice> = (set, get) => ({
  tracks: [],
  loading: false,
  selectedTracks: [],
  albums: [],
  albumTracks: [],
  albumLoading: false,

  setTracks: (tracks) => set({ tracks }),
  setLoading: (loading) => set({ loading }),
  toggleTrackSelection: (trackId) =>
    set((state) => ({
      selectedTracks: state.selectedTracks.includes(trackId)
        ? state.selectedTracks.filter((id) => id !== trackId)
        : [...state.selectedTracks, trackId],
    })),
  clearSelection: () => set({ selectedTracks: [] }),

  loadTracks: async (force?: boolean) => {
    const { tracks } = get();
    if (!force && tracks.length > 0) return;
    set({ loading: true });
    try {
      const loaded = await invoke<Track[]>('get_tracks', { filters: null });
      set({ tracks: loaded, loading: false });
    } catch {
      /* silently handled */
      set({ loading: false });
    }
  },

  searchTracks: async (query: string) => {
    set({ loading: true });
    try {
      const tracks = await invoke<Track[]>('search_tracks', { query });
      set({ tracks: tracks ?? [], loading: false });
    } catch {
      /* silently handled */
      set({ loading: false });
    }
  },

  loadAlbums: async (force?: boolean) => {
    const { albums } = get();
    if (!force && albums.length > 0) return;
    set({ albumLoading: true });
    try {
      const loaded = await invoke<Album[]>('get_albums');
      set({ albums: loaded, albumLoading: false });
    } catch {
      /* silently handled */
      set({ albumLoading: false });
    }
  },

  loadAlbumTracks: async (albumName: string, artist: string | null) => {
    set({ albumLoading: true });
    try {
      const tracks = await invoke<Track[]>('get_album_tracks', {
        albumName,
        artist: artist || null,
      });
      set({ albumTracks: tracks, albumLoading: false });
    } catch {
      /* silently handled */
      set({ albumLoading: false });
    }
  },

  playAlbum: async (albumName: string, artist: string | null) => {
    try {
      await invoke('play_album', { albumName, artist: artist || null });
      await get().loadAlbumTracks(albumName, artist);
      const tracks = get().albumTracks;
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        const remainingTracks = tracks.slice(1);

        set({ currentTrack: firstTrack, isPlaying: true, position: 0 });
        get().startPositionTracking();

        if (remainingTracks.length > 0) {
          const { queue } = get();
          const newItems: QueueItem[] = remainingTracks.map((t) => ({
            queueId: nextQueueId++,
            track: t,
          }));
          set({ queue: [...queue, ...newItems] });
        }

        try {
          const cover = await invoke<string | null>('get_album_cover', {
            albumName,
            artist: artist || null,
          });
          set({ currentCoverArt: cover });
        } catch {
          set({ currentCoverArt: null });
        }
      }
    } catch {
      /* silently handled */
    }
  },
});
