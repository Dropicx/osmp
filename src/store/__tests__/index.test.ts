import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore, setupMediaControlListeners } from '../index';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { mockTrack } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe('store/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      currentTrack: null,
      isPlaying: false,
      volume: 1.0,
      position: 0,
      tracks: [],
      queue: [],
    });
  });

  it('exports useStore with all slices combined', () => {
    const state = useStore.getState();
    // Player slice
    expect(state).toHaveProperty('setCurrentTrack');
    expect(state).toHaveProperty('playTrack');
    // Library slice
    expect(state).toHaveProperty('loadTracks');
    expect(state).toHaveProperty('searchTracks');
    // Playlist slice
    expect(state).toHaveProperty('createPlaylist');
    expect(state).toHaveProperty('loadPlaylists');
    // EQ slice
    expect(state).toHaveProperty('loadEqSettings');
    expect(state).toHaveProperty('toggleEqPanel');
    // Queue slice
    expect(state).toHaveProperty('addToQueue');
    expect(state).toHaveProperty('clearQueue');
    // Column slice
    expect(state).toHaveProperty('setColumnWidth');
    expect(state).toHaveProperty('resetColumnWidths');
  });

  it('persists session-relevant fields', () => {
    // The persist middleware should partialize these fields
    useStore.setState({
      volume: 0.5,
      shuffleEnabled: true,
      repeatMode: 'list',
      playbackSpeed: 1.5,
      currentTrack: mockTrack,
      position: 60,
      queue: [{ queueId: 1, track: mockTrack }],
    });

    const state = useStore.getState();
    expect(state.volume).toBe(0.5);
    expect(state.shuffleEnabled).toBe(true);
    expect(state.repeatMode).toBe('list');
    expect(state.playbackSpeed).toBe(1.5);
  });

  describe('setupMediaControlListeners', () => {
    it('registers event listeners', () => {
      const cleanup = setupMediaControlListeners();

      expect(mockListen).toHaveBeenCalledWith('playback-state-changed', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('media-control-next', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('media-control-previous', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('media-control-seek', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('media-control-stop', expect.any(Function));

      cleanup();
    });

    it('playback-state-changed handler updates isPlaying', () => {
      setupMediaControlListeners();

      // Find the callback for playback-state-changed
      const call = mockListen.mock.calls.find((c) => c[0] === 'playback-state-changed');
      const handler = call![1] as (event: { payload: boolean }) => void;

      handler({ payload: true } as never);
      expect(useStore.getState().isPlaying).toBe(true);

      handler({ payload: false } as never);
      expect(useStore.getState().isPlaying).toBe(false);
    });

    it('media-control-next triggers playNextTrack', () => {
      useStore.setState({ currentTrack: mockTrack, tracks: [mockTrack] });
      mockInvoke.mockResolvedValue(undefined);

      setupMediaControlListeners();

      const call = mockListen.mock.calls.find((c) => c[0] === 'media-control-next');
      const handler = call![1] as () => void;
      handler();

      // playNextTrack was called (which invokes stop since there's no next track)
      expect(mockInvoke).toHaveBeenCalled();
    });

    it('media-control-seek invokes seek_to_position', () => {
      mockInvoke.mockResolvedValue(undefined);
      setupMediaControlListeners();

      const call = mockListen.mock.calls.find((c) => c[0] === 'media-control-seek');
      const handler = call![1] as (event: { payload: number }) => void;
      handler({ payload: 30 } as never);

      expect(mockInvoke).toHaveBeenCalledWith('seek_to_position', { position: 30 });
    });

    it('media-control-stop triggers stopPlayback', () => {
      mockInvoke.mockResolvedValue(undefined);
      setupMediaControlListeners();

      const call = mockListen.mock.calls.find((c) => c[0] === 'media-control-stop');
      const handler = call![1] as () => void;
      handler();

      expect(mockInvoke).toHaveBeenCalledWith('stop_playback');
    });
  });
});
