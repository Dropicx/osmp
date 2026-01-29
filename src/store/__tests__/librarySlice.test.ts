import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../index';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack, mockTrack2, mockAlbum } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('librarySlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      tracks: [],
      loading: false,
      selectedTracks: [],
      albums: [],
      albumTracks: [],
      albumLoading: false,
      currentTrack: null,
      isPlaying: false,
      queue: [],
    });
  });

  it('setTracks sets tracks', () => {
    useStore.getState().setTracks([mockTrack]);
    expect(useStore.getState().tracks).toEqual([mockTrack]);
  });

  it('setLoading sets loading', () => {
    useStore.getState().setLoading(true);
    expect(useStore.getState().loading).toBe(true);
  });

  it('toggleTrackSelection adds then removes', () => {
    useStore.getState().toggleTrackSelection(1);
    expect(useStore.getState().selectedTracks).toContain(1);

    useStore.getState().toggleTrackSelection(1);
    expect(useStore.getState().selectedTracks).not.toContain(1);
  });

  it('toggleTrackSelection handles multiple tracks', () => {
    useStore.getState().toggleTrackSelection(1);
    useStore.getState().toggleTrackSelection(2);
    expect(useStore.getState().selectedTracks).toEqual([1, 2]);
  });

  it('clearSelection empties selectedTracks', () => {
    useStore.setState({ selectedTracks: [1, 2, 3] });
    useStore.getState().clearSelection();
    expect(useStore.getState().selectedTracks).toEqual([]);
  });

  it('loadTracks fetches tracks on first call', async () => {
    mockInvoke.mockResolvedValue([mockTrack]);

    await useStore.getState().loadTracks();

    expect(mockInvoke).toHaveBeenCalledWith('get_tracks', { filters: null });
    expect(useStore.getState().tracks).toEqual([mockTrack]);
    expect(useStore.getState().loading).toBe(false);
  });

  it('loadTracks skips if tracks already loaded and not forced', async () => {
    useStore.setState({ tracks: [mockTrack] });

    await useStore.getState().loadTracks();

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('loadTracks force reloads even with existing tracks', async () => {
    useStore.setState({ tracks: [mockTrack] });
    mockInvoke.mockResolvedValue([mockTrack, mockTrack2]);

    await useStore.getState().loadTracks(true);

    expect(mockInvoke).toHaveBeenCalled();
    expect(useStore.getState().tracks).toHaveLength(2);
  });

  it('loadTracks handles errors', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    await useStore.getState().loadTracks();

    expect(useStore.getState().loading).toBe(false);
  });

  it('searchTracks calls search and sets results', async () => {
    mockInvoke.mockResolvedValue([mockTrack]);

    await useStore.getState().searchTracks('test');

    expect(mockInvoke).toHaveBeenCalledWith('search_tracks', { query: 'test' });
    expect(useStore.getState().tracks).toEqual([mockTrack]);
    expect(useStore.getState().loading).toBe(false);
  });

  it('searchTracks handles null result', async () => {
    mockInvoke.mockResolvedValue(null);

    await useStore.getState().searchTracks('nothing');

    expect(useStore.getState().tracks).toEqual([]);
  });

  it('loadAlbums fetches albums', async () => {
    mockInvoke.mockResolvedValue([mockAlbum]);

    await useStore.getState().loadAlbums();

    expect(mockInvoke).toHaveBeenCalledWith('get_albums');
    expect(useStore.getState().albums).toEqual([mockAlbum]);
  });

  it('loadAlbums skips if already loaded', async () => {
    useStore.setState({ albums: [mockAlbum] });

    await useStore.getState().loadAlbums();

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('loadAlbums force reloads', async () => {
    useStore.setState({ albums: [mockAlbum] });
    mockInvoke.mockResolvedValue([mockAlbum]);

    await useStore.getState().loadAlbums(true);

    expect(mockInvoke).toHaveBeenCalled();
  });

  it('loadAlbumTracks fetches tracks for album', async () => {
    mockInvoke.mockResolvedValue([mockTrack]);

    await useStore.getState().loadAlbumTracks('Test Album', 'Test Artist');

    expect(mockInvoke).toHaveBeenCalledWith('get_album_tracks', {
      albumName: 'Test Album',
      artist: 'Test Artist',
    });
    expect(useStore.getState().albumTracks).toEqual([mockTrack]);
    expect(useStore.getState().albumLoading).toBe(false);
  });

  it('loadAlbumTracks passes null for empty artist', async () => {
    mockInvoke.mockResolvedValue([]);

    await useStore.getState().loadAlbumTracks('Album', null);

    expect(mockInvoke).toHaveBeenCalledWith('get_album_tracks', {
      albumName: 'Album',
      artist: null,
    });
  });

  it('playAlbum sets current track and queues rest', async () => {
    const tracks = [mockTrack, mockTrack2];
    mockInvoke.mockResolvedValueOnce(undefined); // play_album
    mockInvoke.mockResolvedValueOnce(tracks); // get_album_tracks
    mockInvoke.mockResolvedValueOnce(null); // get_album_cover

    await useStore.getState().playAlbum('Test Album', 'Test Artist');

    expect(useStore.getState().currentTrack).toEqual(mockTrack);
    expect(useStore.getState().isPlaying).toBe(true);
    expect(useStore.getState().queue.length).toBe(1);
  });
});
