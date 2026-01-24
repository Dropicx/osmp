import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../useStore';
import { invoke } from '@tauri-apps/api/core';
import type { Track, Playlist } from '../../types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve({})),
}));

const mockInvoke = vi.mocked(invoke);

describe('useStore', () => {
  const mockTrack: Track = {
    id: 1,
    file_path: '/path/to/track.mp3',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 180,
    year: 2023,
    genre: 'Rock',
    track_number: 1,
    file_size: 5000000,
    file_format: 'mp3',
    last_modified: Date.now(),
    metadata_fetched: true,
    release_mbid: null,
    created_at: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useStore.setState({
      currentTrack: null,
      isPlaying: false,
      volume: 1.0,
      position: 0,
      shuffleEnabled: false,
      repeatMode: 'off',
      shuffledQueue: [],
      tracks: [],
      loading: false,
      selectedTracks: [],
      playlists: [],
      currentPlaylist: null,
      playlistTracks: [],
      queue: [],
    });
  });

  describe('Player state', () => {
    it('sets current track', () => {
      useStore.getState().setCurrentTrack(mockTrack);

      expect(useStore.getState().currentTrack).toEqual(mockTrack);
    });

    it('sets playing state', () => {
      useStore.getState().setIsPlaying(true);

      expect(useStore.getState().isPlaying).toBe(true);
    });

    it('sets volume and calls invoke', async () => {
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().setVolume(0.5);

      expect(useStore.getState().volume).toBe(0.5);
      expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.5 });
    });

    it('sets position', () => {
      useStore.getState().setPosition(90);

      expect(useStore.getState().position).toBe(90);
    });
  });

  describe('Library state', () => {
    it('sets tracks', () => {
      const tracks = [mockTrack];
      useStore.getState().setTracks(tracks);

      expect(useStore.getState().tracks).toEqual(tracks);
    });

    it('toggles track selection', () => {
      useStore.getState().toggleTrackSelection(1);

      expect(useStore.getState().selectedTracks).toContain(1);

      useStore.getState().toggleTrackSelection(1);

      expect(useStore.getState().selectedTracks).not.toContain(1);
    });

    it('clears selection', () => {
      useStore.getState().toggleTrackSelection(1);
      useStore.getState().toggleTrackSelection(2);
      useStore.getState().clearSelection();

      expect(useStore.getState().selectedTracks).toEqual([]);
    });

    it('loads tracks', async () => {
      const tracks = [mockTrack];
      mockInvoke.mockResolvedValue(tracks);

      await useStore.getState().loadTracks();

      expect(useStore.getState().tracks).toEqual(tracks);
      expect(useStore.getState().loading).toBe(false);
    });

    it('searches tracks', async () => {
      const tracks = [mockTrack];
      mockInvoke.mockResolvedValue(tracks);

      await useStore.getState().searchTracks('test');

      expect(mockInvoke).toHaveBeenCalledWith('search_tracks', { query: 'test' });
      expect(useStore.getState().tracks).toEqual(tracks);
    });
  });

  describe('Shuffle and Repeat', () => {
    it('toggles shuffle', () => {
      useStore.setState({ tracks: [mockTrack] });

      expect(useStore.getState().shuffleEnabled).toBe(false);

      useStore.getState().toggleShuffle();

      expect(useStore.getState().shuffleEnabled).toBe(true);
      expect(useStore.getState().shuffledQueue.length).toBeGreaterThan(0);
    });

    it('cycles repeat mode', () => {
      expect(useStore.getState().repeatMode).toBe('off');

      useStore.getState().cycleRepeatMode();
      expect(useStore.getState().repeatMode).toBe('list');

      useStore.getState().cycleRepeatMode();
      expect(useStore.getState().repeatMode).toBe('track');

      useStore.getState().cycleRepeatMode();
      expect(useStore.getState().repeatMode).toBe('off');
    });
  });

  describe('Queue', () => {
    it('adds track to queue', async () => {
      useStore.setState({ tracks: [mockTrack] });

      await useStore.getState().addToQueue([1], 'end');

      expect(useStore.getState().queue.length).toBe(1);
      expect(useStore.getState().queue[0].track.id).toBe(1);
    });

    it('adds track to next position in queue', async () => {
      useStore.setState({ tracks: [mockTrack] });

      await useStore.getState().addToQueue([1], 'next');

      expect(useStore.getState().queue.length).toBe(1);
    });

    it('removes track from queue', async () => {
      useStore.setState({ tracks: [mockTrack] });

      await useStore.getState().addToQueue([1], 'end');
      const queueId = useStore.getState().queue[0].queueId;

      useStore.getState().removeFromQueue(queueId);

      expect(useStore.getState().queue.length).toBe(0);
    });

    it('clears queue', async () => {
      useStore.setState({ tracks: [mockTrack] });

      await useStore.getState().addToQueue([1], 'end');
      useStore.getState().clearQueue();

      expect(useStore.getState().queue.length).toBe(0);
    });
  });

  describe('Playlists', () => {
    it('loads playlists', async () => {
      const playlists: Playlist[] = [
        {
          id: 1,
          name: 'Test Playlist',
          created_at: Date.now(),
          track_count: 5,
          total_duration: 900,
        },
      ];
      mockInvoke.mockResolvedValue(playlists);

      await useStore.getState().loadPlaylists();

      expect(useStore.getState().playlists).toEqual(playlists);
    });

    it('creates playlist', async () => {
      mockInvoke.mockResolvedValueOnce(1); // create_playlist returns id
      mockInvoke.mockResolvedValueOnce([]); // loadPlaylists call

      const id = await useStore.getState().createPlaylist('New Playlist');

      expect(id).toBe(1);
      expect(mockInvoke).toHaveBeenCalledWith('create_playlist', { name: 'New Playlist' });
    });
  });
});
