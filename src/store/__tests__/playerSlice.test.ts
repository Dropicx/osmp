import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../index';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack, mockTrack2 } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('playerSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      currentTrack: null,
      isPlaying: false,
      audioLoaded: false,
      volume: 1.0,
      position: 0,
      shuffleEnabled: false,
      repeatMode: 'off',
      shuffledQueue: [],
      currentCoverArt: null,
      playbackSpeed: 1.0,
      _positionInterval: null,
      tracks: [mockTrack, mockTrack2],
      queue: [],
      playlistTracks: [],
      currentPlaylist: null,
    });
  });

  describe('basic setters', () => {
    it('setCurrentTrack updates track', () => {
      useStore.getState().setCurrentTrack(mockTrack);
      expect(useStore.getState().currentTrack).toEqual(mockTrack);
    });

    it('setCurrentTrack can set null', () => {
      useStore.setState({ currentTrack: mockTrack });
      useStore.getState().setCurrentTrack(null);
      expect(useStore.getState().currentTrack).toBeNull();
    });

    it('setIsPlaying updates state', () => {
      useStore.getState().setIsPlaying(true);
      expect(useStore.getState().isPlaying).toBe(true);
    });

    it('setVolume clamps and invokes', () => {
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().setVolume(0.5);
      expect(useStore.getState().volume).toBe(0.5);
      expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.5 });
    });

    it('setVolume clamps to 0', () => {
      mockInvoke.mockResolvedValue(undefined);
      useStore.getState().setVolume(-0.5);
      expect(useStore.getState().volume).toBe(0);
    });

    it('setVolume clamps to 1', () => {
      mockInvoke.mockResolvedValue(undefined);
      useStore.getState().setVolume(1.5);
      expect(useStore.getState().volume).toBe(1);
    });

    it('setPosition updates position', () => {
      useStore.getState().setPosition(60);
      expect(useStore.getState().position).toBe(60);
    });

    it('setPlaybackSpeed clamps and invokes', () => {
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().setPlaybackSpeed(2.0);
      expect(useStore.getState().playbackSpeed).toBe(2.0);
      expect(mockInvoke).toHaveBeenCalledWith('set_playback_speed', { speed: 2.0 });
    });

    it('setPlaybackSpeed clamps min to 0.25', () => {
      mockInvoke.mockResolvedValue(undefined);
      useStore.getState().setPlaybackSpeed(0.1);
      expect(useStore.getState().playbackSpeed).toBe(0.25);
    });

    it('setPlaybackSpeed clamps max to 4.0', () => {
      mockInvoke.mockResolvedValue(undefined);
      useStore.getState().setPlaybackSpeed(5.0);
      expect(useStore.getState().playbackSpeed).toBe(4.0);
    });
  });

  describe('shuffle and repeat', () => {
    it('toggleShuffle enables and generates queue', () => {
      useStore.getState().toggleShuffle();
      expect(useStore.getState().shuffleEnabled).toBe(true);
      expect(useStore.getState().shuffledQueue.length).toBeGreaterThan(0);
    });

    it('toggleShuffle disables', () => {
      useStore.setState({ shuffleEnabled: true });
      useStore.getState().toggleShuffle();
      expect(useStore.getState().shuffleEnabled).toBe(false);
    });

    it('generateShuffledQueue creates shuffled order', () => {
      useStore.setState({ currentTrack: mockTrack });
      useStore.getState().generateShuffledQueue();

      const queue = useStore.getState().shuffledQueue;
      expect(queue).toContain(mockTrack.id);
      expect(queue).toContain(mockTrack2.id);
      // Current track should be first
      expect(queue[0]).toBe(mockTrack.id);
    });

    it('cycleRepeatMode cycles through modes', () => {
      expect(useStore.getState().repeatMode).toBe('off');

      useStore.getState().cycleRepeatMode();
      expect(useStore.getState().repeatMode).toBe('list');

      useStore.getState().cycleRepeatMode();
      expect(useStore.getState().repeatMode).toBe('track');

      useStore.getState().cycleRepeatMode();
      expect(useStore.getState().repeatMode).toBe('off');
    });
  });

  describe('playTrack', () => {
    it('plays track and sets state', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await useStore.getState().playTrack(mockTrack.id);

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack.id });
      expect(useStore.getState().currentTrack).toEqual(mockTrack);
      expect(useStore.getState().isPlaying).toBe(true);
      expect(useStore.getState().position).toBe(0);
    });

    it('fetches cover art after playing', async () => {
      mockInvoke.mockResolvedValueOnce(undefined); // play_track
      mockInvoke.mockResolvedValueOnce('cover-data'); // get_track_cover

      await useStore.getState().playTrack(mockTrack.id);

      expect(mockInvoke).toHaveBeenCalledWith('get_track_cover', { trackId: mockTrack.id });
    });
  });

  describe('pausePlayback', () => {
    it('pauses when playing', async () => {
      useStore.setState({ isPlaying: true, audioLoaded: true, currentTrack: mockTrack });
      mockInvoke.mockResolvedValue(undefined);

      await useStore.getState().pausePlayback();

      expect(mockInvoke).toHaveBeenCalledWith('pause_playback');
      expect(useStore.getState().isPlaying).toBe(false);
    });

    it('resumes track after restart with no audio loaded', async () => {
      useStore.setState({
        isPlaying: false,
        audioLoaded: false,
        currentTrack: mockTrack,
        position: 60,
      });
      mockInvoke.mockResolvedValue(undefined);

      await useStore.getState().pausePlayback();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack.id });
      expect(mockInvoke).toHaveBeenCalledWith('seek_to_position', { position: 60 });
    });
  });

  describe('stopPlayback', () => {
    it('stops and resets state', async () => {
      useStore.setState({ isPlaying: true, currentTrack: mockTrack, position: 60 });
      mockInvoke.mockResolvedValue(undefined);

      await useStore.getState().stopPlayback();

      expect(mockInvoke).toHaveBeenCalledWith('stop_playback');
      expect(useStore.getState().isPlaying).toBe(false);
      expect(useStore.getState().currentTrack).toBeNull();
      expect(useStore.getState().position).toBe(0);
    });
  });

  describe('playNextTrack', () => {
    it('plays next track in list', () => {
      useStore.setState({ currentTrack: mockTrack });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playNextTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack2.id });
    });

    it('repeats same track in track repeat mode', () => {
      useStore.setState({ currentTrack: mockTrack, repeatMode: 'track' });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playNextTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack.id });
    });

    it('plays from queue first', () => {
      useStore.setState({
        currentTrack: mockTrack,
        queue: [{ queueId: 1, track: mockTrack2 }],
      });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playNextTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack2.id });
      expect(useStore.getState().queue).toHaveLength(0);
    });

    it('wraps around in list repeat mode', () => {
      useStore.setState({ currentTrack: mockTrack2, repeatMode: 'list' });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playNextTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack.id });
    });

    it('stops at end without repeat', () => {
      useStore.setState({ currentTrack: mockTrack2 });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playNextTrack();

      expect(mockInvoke).toHaveBeenCalledWith('stop_playback');
    });

    it('does nothing without current track', () => {
      useStore.getState().playNextTrack();
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('playPreviousTrack', () => {
    it('restarts track if position > threshold', () => {
      useStore.setState({
        currentTrack: mockTrack2,
        position: 10,
        tracks: [mockTrack, mockTrack2],
      });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playPreviousTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack2.id });
    });

    it('goes to previous track if position <= threshold', () => {
      useStore.setState({ currentTrack: mockTrack2, position: 1, tracks: [mockTrack, mockTrack2] });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playPreviousTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack.id });
    });

    it('restarts first track if at beginning', () => {
      useStore.setState({ currentTrack: mockTrack, position: 1, tracks: [mockTrack, mockTrack2] });
      mockInvoke.mockResolvedValue(undefined);

      useStore.getState().playPreviousTrack();

      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: mockTrack.id });
    });
  });

  describe('getNextTrackId', () => {
    it('returns current track id in track repeat mode', () => {
      useStore.setState({ currentTrack: mockTrack, repeatMode: 'track' });
      expect(useStore.getState().getNextTrackId()).toBe(mockTrack.id);
    });

    it('returns queue head if queue has items', () => {
      useStore.setState({
        currentTrack: mockTrack,
        queue: [{ queueId: 1, track: mockTrack2 }],
      });
      expect(useStore.getState().getNextTrackId()).toBe(mockTrack2.id);
    });

    it('returns next track in list', () => {
      useStore.setState({ currentTrack: mockTrack });
      expect(useStore.getState().getNextTrackId()).toBe(mockTrack2.id);
    });

    it('returns first track in list repeat mode at end', () => {
      useStore.setState({ currentTrack: mockTrack2, repeatMode: 'list' });
      expect(useStore.getState().getNextTrackId()).toBe(mockTrack.id);
    });

    it('returns null at end without repeat', () => {
      useStore.setState({ currentTrack: mockTrack2 });
      expect(useStore.getState().getNextTrackId()).toBeNull();
    });

    it('returns null without current track', () => {
      expect(useStore.getState().getNextTrackId()).toBeNull();
    });
  });

  describe('refreshCurrentTrack', () => {
    it('updates current track from fresh data', async () => {
      const updated = { ...mockTrack, title: 'Updated Title' };
      useStore.setState({ currentTrack: mockTrack });
      mockInvoke.mockResolvedValueOnce([updated]); // get_tracks
      mockInvoke.mockResolvedValueOnce('new-cover'); // get_track_cover

      await useStore.getState().refreshCurrentTrack();

      expect(useStore.getState().currentTrack?.title).toBe('Updated Title');
    });

    it('does nothing without current track', async () => {
      await useStore.getState().refreshCurrentTrack();
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
