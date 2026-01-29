import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../index';
import { mockTrack, mockTrack2 } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('queueSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      queue: [],
      isQueuePanelOpen: false,
      tracks: [mockTrack, mockTrack2],
      playlistTracks: [],
      albumTracks: [],
    });
  });

  describe('addToQueue', () => {
    it('adds tracks to end of queue', async () => {
      await useStore.getState().addToQueue([mockTrack.id], 'end');
      expect(useStore.getState().queue).toHaveLength(1);
      expect(useStore.getState().queue[0].track.id).toBe(mockTrack.id);
    });

    it('adds tracks to next position', async () => {
      await useStore.getState().addToQueue([mockTrack.id], 'end');
      await useStore.getState().addToQueue([mockTrack2.id], 'next');

      expect(useStore.getState().queue[0].track.id).toBe(mockTrack2.id);
      expect(useStore.getState().queue[1].track.id).toBe(mockTrack.id);
    });

    it('defaults to end position', async () => {
      await useStore.getState().addToQueue([mockTrack.id]);
      expect(useStore.getState().queue).toHaveLength(1);
    });

    it('looks up tracks from playlistTracks first', async () => {
      useStore.setState({ playlistTracks: [mockTrack], tracks: [] });
      await useStore.getState().addToQueue([mockTrack.id]);
      expect(useStore.getState().queue[0].track.id).toBe(mockTrack.id);
    });

    it('looks up tracks from albumTracks second', async () => {
      useStore.setState({ albumTracks: [mockTrack], tracks: [], playlistTracks: [] });
      await useStore.getState().addToQueue([mockTrack.id]);
      expect(useStore.getState().queue[0].track.id).toBe(mockTrack.id);
    });

    it('does nothing for unknown track ids', async () => {
      await useStore.getState().addToQueue([999]);
      expect(useStore.getState().queue).toHaveLength(0);
    });

    it('adds multiple tracks at once', async () => {
      await useStore.getState().addToQueue([mockTrack.id, mockTrack2.id]);
      expect(useStore.getState().queue).toHaveLength(2);
    });
  });

  describe('removeFromQueue', () => {
    it('removes item by queueId', async () => {
      await useStore.getState().addToQueue([mockTrack.id]);
      const queueId = useStore.getState().queue[0].queueId;

      useStore.getState().removeFromQueue(queueId);

      expect(useStore.getState().queue).toHaveLength(0);
    });

    it('does nothing for non-existent queueId', async () => {
      await useStore.getState().addToQueue([mockTrack.id]);
      useStore.getState().removeFromQueue(999999);
      expect(useStore.getState().queue).toHaveLength(1);
    });
  });

  describe('reorderQueue', () => {
    it('moves item from one position to another', async () => {
      await useStore.getState().addToQueue([mockTrack.id, mockTrack2.id]);

      useStore.getState().reorderQueue(0, 1);

      expect(useStore.getState().queue[0].track.id).toBe(mockTrack2.id);
      expect(useStore.getState().queue[1].track.id).toBe(mockTrack.id);
    });

    it('does nothing for same index', async () => {
      await useStore.getState().addToQueue([mockTrack.id, mockTrack2.id]);
      const before = [...useStore.getState().queue];

      useStore.getState().reorderQueue(0, 0);

      expect(useStore.getState().queue.map((q) => q.track.id)).toEqual(
        before.map((q) => q.track.id)
      );
    });

    it('does nothing for out of bounds indices', async () => {
      await useStore.getState().addToQueue([mockTrack.id]);
      const before = [...useStore.getState().queue];

      useStore.getState().reorderQueue(-1, 0);
      useStore.getState().reorderQueue(0, 5);

      expect(useStore.getState().queue).toEqual(before);
    });
  });

  describe('clearQueue', () => {
    it('empties the queue', async () => {
      await useStore.getState().addToQueue([mockTrack.id, mockTrack2.id]);
      useStore.getState().clearQueue();
      expect(useStore.getState().queue).toHaveLength(0);
    });
  });

  describe('toggleQueuePanel', () => {
    it('toggles isQueuePanelOpen', () => {
      expect(useStore.getState().isQueuePanelOpen).toBe(false);

      useStore.getState().toggleQueuePanel();
      expect(useStore.getState().isQueuePanelOpen).toBe(true);

      useStore.getState().toggleQueuePanel();
      expect(useStore.getState().isQueuePanelOpen).toBe(false);
    });
  });
});
