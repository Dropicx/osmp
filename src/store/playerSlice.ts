import { StateCreator } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { PREVIOUS_TRACK_THRESHOLD } from '../constants';
import { coverCache } from '../utils/coverCache';
import type { AppState, PlayerSlice, RepeatMode } from './types';

const GAPLESS_PRELOAD_THRESHOLD = 5; // seconds before end to preload
const PLAY_HISTORY_THRESHOLD = 30; // seconds before recording play history

export const createPlayerSlice: StateCreator<AppState, [], [], PlayerSlice> = (set, get) => ({
  currentTrack: null,
  isPlaying: false,
  audioLoaded: false,
  volume: 1.0,
  position: 0,
  shuffleEnabled: false,
  repeatMode: 'off' as RepeatMode,
  shuffledQueue: [],
  currentCoverArt: null,
  playbackSpeed: 1.0,
  _positionInterval: null,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped });
    invoke('set_volume', { volume: clamped }).catch(() => {});
  },
  setPosition: (position) => set({ position }),
  setPlaybackSpeed: (speed) => {
    const clamped = Math.max(0.25, Math.min(4.0, speed));
    set({ playbackSpeed: clamped });
    invoke('set_playback_speed', { speed: clamped }).catch(() => {});
  },

  startPositionTracking: () => {
    const existing = get()._positionInterval;
    if (existing) {
      return;
    }

    let preloaded = false;
    let historyRecorded = false;

    // Listen for push-based position updates from Rust
    const unlistenPromise = listen<number>('position-update', (event) => {
      const position = event.payload;
      const { currentTrack, isPlaying } = get();

      set({ position });

      if (!currentTrack?.duration || !isPlaying) return;

      // Record play history after 30s of listening
      if (!historyRecorded && position >= PLAY_HISTORY_THRESHOLD) {
        historyRecorded = true;
        invoke('record_play_history', {
          trackId: currentTrack.id,
          durationListened: Math.floor(position),
        }).catch(() => {});
      }

      // Preload next track for gapless playback (5s before end)
      if (!preloaded && position >= currentTrack.duration - GAPLESS_PRELOAD_THRESHOLD) {
        preloaded = true;
        const nextTrackId = get().getNextTrackId();
        if (nextTrackId !== null) {
          invoke('preload_next_track', { trackId: nextTrackId }).catch(() => {});
        }
      }

      // Track ended - advance to next
      if (position >= currentTrack.duration - 0.3) {
        get().stopPositionTracking();
        get().playNextTrack();
      }
    });

    const cleanup = { unlisten: null as UnlistenFn | null };
    unlistenPromise
      .then((fn) => {
        cleanup.unlisten = fn;
      })
      .catch(() => {});

    set({ _positionInterval: cleanup as unknown as ReturnType<typeof setInterval> });
  },

  stopPositionTracking: () => {
    const cleanup = get()._positionInterval as unknown as { unlisten: UnlistenFn | null } | null;
    if (cleanup && typeof cleanup === 'object' && 'unlisten' in cleanup) {
      if (cleanup.unlisten) cleanup.unlisten();
    }
    set({ _positionInterval: null });
  },

  generateShuffledQueue: () => {
    const { tracks, currentTrack } = get();
    const trackIds = tracks.map((t) => t.id);

    const shuffled = [...trackIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    if (currentTrack) {
      const currentIndex = shuffled.indexOf(currentTrack.id);
      if (currentIndex > 0) {
        shuffled.splice(currentIndex, 1);
        shuffled.unshift(currentTrack.id);
      }
    }

    set({ shuffledQueue: shuffled });
  },

  toggleShuffle: () => {
    const { shuffleEnabled } = get();
    const newState = !shuffleEnabled;
    set({ shuffleEnabled: newState });

    if (newState) {
      get().generateShuffledQueue();
    }
  },

  cycleRepeatMode: () => {
    const { repeatMode } = get();
    const modes: RepeatMode[] = ['off', 'list', 'track'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  playNextTrack: () => {
    const {
      currentTrack,
      tracks,
      playlistTracks,
      currentPlaylist,
      shuffleEnabled,
      shuffledQueue,
      repeatMode,
      queue,
    } = get();
    if (!currentTrack) return;

    if (repeatMode === 'track') {
      get().playTrack(currentTrack.id);
      return;
    }

    if (queue.length > 0) {
      const nextItem = queue[0];
      set({ queue: queue.slice(1) });
      get().playTrack(nextItem.track.id);
      return;
    }

    const sourceTracks = currentPlaylist ? playlistTracks : tracks;
    if (sourceTracks.length === 0) return;

    let nextTrackId: number | null = null;

    if (shuffleEnabled && shuffledQueue.length > 0) {
      const currentIndex = shuffledQueue.indexOf(currentTrack.id);
      if (currentIndex < shuffledQueue.length - 1) {
        nextTrackId = shuffledQueue[currentIndex + 1];
      } else if (repeatMode === 'list') {
        nextTrackId = shuffledQueue[0];
      }
    } else {
      const currentIndex = sourceTracks.findIndex((t) => t.id === currentTrack.id);
      if (currentIndex < sourceTracks.length - 1) {
        nextTrackId = sourceTracks[currentIndex + 1].id;
      } else if (repeatMode === 'list') {
        nextTrackId = sourceTracks[0].id;
      }
    }

    if (nextTrackId !== null) {
      get().playTrack(nextTrackId);
    } else {
      get().stopPlayback();
    }
  },

  playPreviousTrack: () => {
    const {
      currentTrack,
      tracks,
      playlistTracks,
      currentPlaylist,
      shuffleEnabled,
      shuffledQueue,
      position,
    } = get();
    if (!currentTrack) return;

    const sourceTracks = currentPlaylist ? playlistTracks : tracks;
    if (sourceTracks.length === 0) return;

    if (position > PREVIOUS_TRACK_THRESHOLD) {
      get().playTrack(currentTrack.id);
      return;
    }

    let prevTrackId: number | null = null;

    if (shuffleEnabled && shuffledQueue.length > 0) {
      const currentIndex = shuffledQueue.indexOf(currentTrack.id);
      if (currentIndex > 0) {
        prevTrackId = shuffledQueue[currentIndex - 1];
      }
    } else {
      const currentIndex = sourceTracks.findIndex((t) => t.id === currentTrack.id);
      if (currentIndex > 0) {
        prevTrackId = sourceTracks[currentIndex - 1].id;
      }
    }

    if (prevTrackId !== null) {
      get().playTrack(prevTrackId);
    } else {
      get().playTrack(currentTrack.id);
    }
  },

  getNextTrackId: () => {
    const {
      currentTrack,
      tracks,
      playlistTracks,
      currentPlaylist,
      shuffleEnabled,
      shuffledQueue,
      repeatMode,
      queue,
    } = get();
    if (!currentTrack) return null;

    if (repeatMode === 'track') return currentTrack.id;

    if (queue.length > 0) return queue[0].track.id;

    const sourceTracks = currentPlaylist ? playlistTracks : tracks;
    if (sourceTracks.length === 0) return null;

    if (shuffleEnabled && shuffledQueue.length > 0) {
      const currentIndex = shuffledQueue.indexOf(currentTrack.id);
      if (currentIndex < shuffledQueue.length - 1) return shuffledQueue[currentIndex + 1];
      if (repeatMode === 'list') return shuffledQueue[0];
    } else {
      const currentIndex = sourceTracks.findIndex((t) => t.id === currentTrack.id);
      if (currentIndex < sourceTracks.length - 1) return sourceTracks[currentIndex + 1].id;
      if (repeatMode === 'list') return sourceTracks[0].id;
    }

    return null;
  },

  playTrack: async (trackId: number) => {
    try {
      await invoke('play_track', { trackId });
      const track = get().tracks.find((t) => t.id === trackId);
      if (track) {
        set({ currentTrack: track, isPlaying: true, audioLoaded: true, position: 0 });
        get().startPositionTracking();

        // Check cover cache first
        const cacheKey = `track-${trackId}`;
        const cached = coverCache.get(cacheKey);
        if (cached !== undefined) {
          set({ currentCoverArt: cached });
        } else {
          try {
            const cover = await invoke<string | null>('get_track_cover', { trackId });
            if (cover) coverCache.set(cacheKey, cover);
            set({ currentCoverArt: cover });
          } catch {
            set({ currentCoverArt: null });
          }
        }
      }
    } catch {
      // Play track error handled by error boundary
    }
  },

  pausePlayback: async () => {
    try {
      const { isPlaying, audioLoaded, currentTrack, position } = get();

      // After restart the UI still shows the last track, but the backend
      // has no audio loaded.  Redirect to playTrack so the file is actually
      // opened, then seek to the persisted position.
      if (!isPlaying && !audioLoaded && currentTrack) {
        await get().playTrack(currentTrack.id);
        if (position > 0) {
          await invoke('seek_to_position', { position });
        }
        return;
      }

      await invoke('pause_playback');
      set({ isPlaying: !isPlaying });

      if (isPlaying) {
        get().stopPositionTracking();
      } else {
        get().startPositionTracking();
      }
    } catch {
      // Pause error handled by error boundary
    }
  },

  stopPlayback: async () => {
    try {
      await invoke('stop_playback');
      get().stopPositionTracking();
      set({ isPlaying: false, audioLoaded: false, currentTrack: null, position: 0 });
    } catch {
      // Stop error handled by error boundary
    }
  },

  refreshCurrentTrack: async () => {
    const { currentTrack } = get();
    if (!currentTrack) return;

    try {
      const tracks = await invoke<import('../types').Track[]>('get_tracks', { filters: null });
      const updatedTrack = tracks.find((t) => t.id === currentTrack.id);

      if (updatedTrack) {
        set({ currentTrack: updatedTrack, tracks });

        try {
          const cover = await invoke<string | null>('get_track_cover', {
            trackId: currentTrack.id,
          });
          set({ currentCoverArt: cover });
        } catch {
          // Keep existing cover if fetch fails
        }
      }
    } catch {
      // Refresh error handled by error boundary
    }
  },
});
