import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createPlayerSlice } from './playerSlice';
import { createLibrarySlice } from './librarySlice';
import { createPlaylistSlice } from './playlistSlice';
import { createEqualizerSlice } from './equalizerSlice';
import { createQueueSlice } from './queueSlice';
import { createColumnSlice } from './columnSlice';
import type { AppState } from './types';

export type { QueueItem, AppState } from './types';

// State: UI-only state (modals, hover, loading) stays in components.
// All persistent/async state goes through this store.

export const useStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createPlayerSlice(...a),
      ...createLibrarySlice(...a),
      ...createPlaylistSlice(...a),
      ...createEqualizerSlice(...a),
      ...createQueueSlice(...a),
      ...createColumnSlice(...a),
    }),
    {
      name: 'osmp-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist only session-relevant fields
        volume: state.volume,
        shuffleEnabled: state.shuffleEnabled,
        repeatMode: state.repeatMode,
        queue: state.queue,
        currentTrack: state.currentTrack,
        position: state.position,
        playbackSpeed: state.playbackSpeed,
      }),
    }
  )
);

// Set up media control event listeners (returns cleanup function)
export function setupMediaControlListeners(): () => void {
  const unlisteners: Promise<() => void>[] = [];

  unlisteners.push(
    listen<boolean>('playback-state-changed', (event) => {
      const newIsPlaying = event.payload;
      const state = useStore.getState();
      useStore.setState({ isPlaying: newIsPlaying });
      if (newIsPlaying) {
        state.startPositionTracking();
      } else {
        state.stopPositionTracking();
      }
    })
  );

  unlisteners.push(
    listen('media-control-next', () => {
      useStore.getState().playNextTrack();
    })
  );

  unlisteners.push(
    listen('media-control-previous', () => {
      useStore.getState().playPreviousTrack();
    })
  );

  unlisteners.push(
    listen<number>('media-control-seek', (event) => {
      const position = event.payload;
      invoke('seek_to_position', { position }).catch(() => {});
    })
  );

  unlisteners.push(
    listen('media-control-stop', () => {
      useStore.getState().stopPlayback();
    })
  );

  return () => {
    unlisteners.forEach((p) => p.then((fn) => fn()).catch(() => {}));
  };
}
