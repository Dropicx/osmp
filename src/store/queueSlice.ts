import { StateCreator } from 'zustand';
import type { Track } from '../types';
import type { AppState, QueueSlice, QueueItem } from './types';

let nextQueueId = 3000;

export const createQueueSlice: StateCreator<AppState, [], [], QueueSlice> = (set, get) => ({
  queue: [],
  isQueuePanelOpen: false,

  addToQueue: async (trackIds: number[], position: 'next' | 'end' = 'end') => {
    const { tracks, playlistTracks, albumTracks, queue } = get();

    const tracksToAdd: Track[] = [];

    for (const id of trackIds) {
      let found = playlistTracks.find((t) => t.id === id);
      if (found) {
        tracksToAdd.push(found);
        continue;
      }

      found = albumTracks.find((t) => t.id === id);
      if (found) {
        tracksToAdd.push(found);
        continue;
      }

      found = tracks.find((t) => t.id === id);
      if (found) {
        tracksToAdd.push(found);
      }
    }

    if (tracksToAdd.length === 0) return;

    const newItems: QueueItem[] = tracksToAdd.map((t) => ({ queueId: nextQueueId++, track: t }));

    if (position === 'next') {
      set({ queue: [...newItems, ...queue] });
    } else {
      set({ queue: [...queue, ...newItems] });
    }
  },

  removeFromQueue: (queueId: number) => {
    const { queue } = get();
    set({ queue: queue.filter((item) => item.queueId !== queueId) });
  },

  reorderQueue: (fromIndex: number, toIndex: number) => {
    const { queue } = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= queue.length ||
      toIndex >= queue.length
    ) {
      return;
    }
    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);
    set({ queue: newQueue });
  },

  clearQueue: () => {
    set({ queue: [] });
  },

  toggleQueuePanel: () => {
    set((state) => ({ isQueuePanelOpen: !state.isQueuePanelOpen }));
  },
});
