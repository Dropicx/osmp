import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../index';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack, mockTrack2, mockPlaylist } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('playlistSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      playlists: [],
      currentPlaylist: null,
      playlistTracks: [],
      playlistLoading: false,
      currentTrack: null,
      isPlaying: false,
      queue: [],
      tracks: [mockTrack, mockTrack2],
    });
  });

  it('setCurrentPlaylist sets the playlist', () => {
    useStore.getState().setCurrentPlaylist(mockPlaylist);
    expect(useStore.getState().currentPlaylist).toEqual(mockPlaylist);
  });

  it('setCurrentPlaylist can clear to null', () => {
    useStore.setState({ currentPlaylist: mockPlaylist });
    useStore.getState().setCurrentPlaylist(null);
    expect(useStore.getState().currentPlaylist).toBeNull();
  });

  it('loadPlaylists fetches playlists', async () => {
    mockInvoke.mockResolvedValue([mockPlaylist]);
    await useStore.getState().loadPlaylists();
    expect(mockInvoke).toHaveBeenCalledWith('get_playlists');
    expect(useStore.getState().playlists).toEqual([mockPlaylist]);
  });

  it('loadPlaylists handles errors silently', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    await useStore.getState().loadPlaylists();
    expect(useStore.getState().playlists).toEqual([]);
  });

  it('createPlaylist invokes and reloads playlists', async () => {
    mockInvoke.mockResolvedValueOnce(10); // create_playlist
    mockInvoke.mockResolvedValueOnce([]); // get_playlists (loadPlaylists)
    const id = await useStore.getState().createPlaylist('New PL');
    expect(id).toBe(10);
    expect(mockInvoke).toHaveBeenCalledWith('create_playlist', { name: 'New PL' });
  });

  it('deletePlaylist removes current playlist if matching', async () => {
    useStore.setState({
      currentPlaylist: mockPlaylist,
      playlistTracks: [mockTrack],
    });
    mockInvoke.mockResolvedValue(undefined);
    // Second call is loadPlaylists
    mockInvoke.mockResolvedValueOnce(undefined); // delete_playlist
    mockInvoke.mockResolvedValueOnce([]); // get_playlists

    await useStore.getState().deletePlaylist(mockPlaylist.id);

    expect(useStore.getState().currentPlaylist).toBeNull();
    expect(useStore.getState().playlistTracks).toEqual([]);
  });

  it('deletePlaylist keeps current playlist if different', async () => {
    useStore.setState({ currentPlaylist: { ...mockPlaylist, id: 99 } });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().deletePlaylist(1);

    expect(useStore.getState().currentPlaylist?.id).toBe(99);
  });

  it('renamePlaylist updates current playlist name if matching', async () => {
    useStore.setState({ currentPlaylist: mockPlaylist });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().renamePlaylist(mockPlaylist.id, 'Renamed');

    expect(useStore.getState().currentPlaylist?.name).toBe('Renamed');
  });

  it('loadPlaylistTracks sets tracks and loading state', async () => {
    const tracks = [mockTrack, mockTrack2];
    mockInvoke.mockResolvedValue(tracks);

    await useStore.getState().loadPlaylistTracks(1);

    expect(useStore.getState().playlistTracks).toEqual(tracks);
    expect(useStore.getState().playlistLoading).toBe(false);
  });

  it('loadPlaylistTracks handles errors', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    await expect(useStore.getState().loadPlaylistTracks(1)).rejects.toThrow();
    expect(useStore.getState().playlistLoading).toBe(false);
  });

  it('addTrackToPlaylist reloads playlist tracks if current', async () => {
    useStore.setState({ currentPlaylist: mockPlaylist });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().addTrackToPlaylist(mockPlaylist.id, 1);

    expect(mockInvoke).toHaveBeenCalledWith('add_track_to_playlist', {
      playlistId: mockPlaylist.id,
      trackId: 1,
      position: null,
    });
  });

  it('addTrackToPlaylist passes position', async () => {
    useStore.setState({ currentPlaylist: mockPlaylist });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().addTrackToPlaylist(mockPlaylist.id, 1, 3);

    expect(mockInvoke).toHaveBeenCalledWith('add_track_to_playlist', {
      playlistId: mockPlaylist.id,
      trackId: 1,
      position: 3,
    });
  });

  it('addTracksToPlaylist invokes with track ids', async () => {
    useStore.setState({ currentPlaylist: mockPlaylist });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().addTracksToPlaylist(mockPlaylist.id, [1, 2]);

    expect(mockInvoke).toHaveBeenCalledWith('add_tracks_to_playlist', {
      playlistId: mockPlaylist.id,
      trackIds: [1, 2],
    });
  });

  it('removeTrackFromPlaylist invokes and reloads', async () => {
    useStore.setState({ currentPlaylist: mockPlaylist });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().removeTrackFromPlaylist(mockPlaylist.id, 1);

    expect(mockInvoke).toHaveBeenCalledWith('remove_track_from_playlist', {
      playlistId: mockPlaylist.id,
      trackId: 1,
    });
  });

  it('reorderPlaylistTracks converts to tuples', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().reorderPlaylistTracks(1, [
      { trackId: 5, position: 0 },
      { trackId: 3, position: 1 },
    ]);

    expect(mockInvoke).toHaveBeenCalledWith('reorder_playlist_tracks', {
      playlistId: 1,
      trackPositions: [
        [5, 0],
        [3, 1],
      ],
    });
  });

  it('duplicatePlaylist invokes and reloads', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().duplicatePlaylist(1, 'Copy');

    expect(mockInvoke).toHaveBeenCalledWith('duplicate_playlist', {
      playlistId: 1,
      newName: 'Copy',
    });
  });

  it('playPlaylist sets current track and queues remaining', async () => {
    const tracks = [mockTrack, mockTrack2];
    useStore.setState({ playlists: [mockPlaylist] });
    mockInvoke.mockResolvedValueOnce(undefined); // play_playlist
    mockInvoke.mockResolvedValueOnce(tracks); // get_playlist_tracks
    mockInvoke.mockResolvedValueOnce(null); // get_track_cover

    await useStore.getState().playPlaylist(mockPlaylist.id);

    expect(useStore.getState().currentTrack).toEqual(mockTrack);
    expect(useStore.getState().isPlaying).toBe(true);
    expect(useStore.getState().queue.length).toBe(1);
    expect(useStore.getState().queue[0].track.id).toBe(mockTrack2.id);
  });
});
