import { StateCreator } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Track, Playlist } from '../types';
import type { AppState, PlaylistSlice, QueueItem } from './types';

let nextQueueId = 2000;

export const createPlaylistSlice: StateCreator<AppState, [], [], PlaylistSlice> = (set, get) => ({
  playlists: [],
  currentPlaylist: null,
  playlistTracks: [],
  playlistLoading: false,

  setCurrentPlaylist: (playlist) => set({ currentPlaylist: playlist }),

  loadPlaylists: async () => {
    try {
      const playlists = await invoke<Playlist[]>('get_playlists');
      set({ playlists });
    } catch {
      /* silently handled */
    }
  },

  createPlaylist: async (name: string) => {
    const id = await invoke<number>('create_playlist', { name });
    await get().loadPlaylists();
    return id;
  },

  deletePlaylist: async (id: number) => {
    await invoke('delete_playlist', { id });
    const { currentPlaylist } = get();
    if (currentPlaylist?.id === id) {
      set({ currentPlaylist: null, playlistTracks: [] });
    }
    await get().loadPlaylists();
  },

  renamePlaylist: async (id: number, newName: string) => {
    await invoke('rename_playlist', { id, newName });
    const { currentPlaylist } = get();
    if (currentPlaylist?.id === id) {
      set({ currentPlaylist: { ...currentPlaylist, name: newName } });
    }
    await get().loadPlaylists();
  },

  loadPlaylistTracks: async (playlistId: number) => {
    set({ playlistLoading: true });
    try {
      const tracks = await invoke<Track[]>('get_playlist_tracks', { playlistId });
      set({ playlistTracks: tracks, playlistLoading: false });
    } catch (error) {
      set({ playlistLoading: false });
      throw error;
    }
  },

  addTrackToPlaylist: async (playlistId: number, trackId: number, position?: number) => {
    await invoke('add_track_to_playlist', { playlistId, trackId, position: position ?? null });
    const { currentPlaylist } = get();
    if (currentPlaylist?.id === playlistId) {
      await get().loadPlaylistTracks(playlistId);
    }
    await get().loadPlaylists();
  },

  addTracksToPlaylist: async (playlistId: number, trackIds: number[]) => {
    await invoke('add_tracks_to_playlist', { playlistId, trackIds });
    const { currentPlaylist } = get();
    if (currentPlaylist?.id === playlistId) {
      await get().loadPlaylistTracks(playlistId);
    }
    await get().loadPlaylists();
  },

  removeTrackFromPlaylist: async (playlistId: number, trackId: number) => {
    await invoke('remove_track_from_playlist', { playlistId, trackId });
    const { currentPlaylist } = get();
    if (currentPlaylist?.id === playlistId) {
      await get().loadPlaylistTracks(playlistId);
    }
    await get().loadPlaylists();
  },

  reorderPlaylistTracks: async (
    playlistId: number,
    trackPositions: Array<{ trackId: number; position: number }>
  ) => {
    const positions: [number, number][] = trackPositions.map((tp) => [tp.trackId, tp.position]);
    await invoke('reorder_playlist_tracks', { playlistId, trackPositions: positions });
    await get().loadPlaylistTracks(playlistId);
  },

  duplicatePlaylist: async (playlistId: number, newName: string) => {
    await invoke('duplicate_playlist', { playlistId, newName });
    await get().loadPlaylists();
  },

  playPlaylist: async (playlistId: number) => {
    await invoke('play_playlist', { playlistId });
    await get().loadPlaylistTracks(playlistId);
    const tracks = get().playlistTracks;
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
        const cover = await invoke<string | null>('get_track_cover', { trackId: firstTrack.id });
        set({ currentCoverArt: cover });
      } catch {
        set({ currentCoverArt: null });
      }

      const playlist = get().playlists.find((p) => p.id === playlistId);
      if (playlist) {
        set({ currentPlaylist: playlist });
      }
    }
  },
});
