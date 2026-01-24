import { useShallow } from 'zustand/react/shallow';
import { useStore } from './index';

// Individual selectors for frequently-updated values (prevent re-renders of unrelated components)
export const usePosition = () => useStore((s) => s.position);
export const useIsPlaying = () => useStore((s) => s.isPlaying);
export const useVolume = () => useStore((s) => s.volume);
export const useCurrentTrack = () => useStore((s) => s.currentTrack);
export const useCurrentCoverArt = () => useStore((s) => s.currentCoverArt);

// Grouped selectors using useShallow (only re-render when selected values change)
export const usePlayerControls = () =>
  useStore(
    useShallow((s) => ({
      pausePlayback: s.pausePlayback,
      playNextTrack: s.playNextTrack,
      playPreviousTrack: s.playPreviousTrack,
      setVolume: s.setVolume,
      toggleShuffle: s.toggleShuffle,
      cycleRepeatMode: s.cycleRepeatMode,
    }))
  );

export const usePlayerState = () =>
  useStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      volume: s.volume,
      shuffleEnabled: s.shuffleEnabled,
      repeatMode: s.repeatMode,
    }))
  );

export const useLibraryData = () =>
  useStore(
    useShallow((s) => ({
      tracks: s.tracks,
      loading: s.loading,
      albums: s.albums,
    }))
  );

export const useLibraryActions = () =>
  useStore(
    useShallow((s) => ({
      loadTracks: s.loadTracks,
      loadAlbums: s.loadAlbums,
      searchTracks: s.searchTracks,
      playTrack: s.playTrack,
      playAlbum: s.playAlbum,
    }))
  );

export const useQueueState = () =>
  useStore(
    useShallow((s) => ({
      queue: s.queue,
      isQueuePanelOpen: s.isQueuePanelOpen,
      toggleQueuePanel: s.toggleQueuePanel,
    }))
  );

export const useVisualizerState = () =>
  useStore(
    useShallow((s) => ({
      visualizerEnabled: s.visualizerEnabled,
      visualizerOpacity: s.visualizerOpacity,
      isPlaying: s.isPlaying,
    }))
  );

export const useEqState = () =>
  useStore(
    useShallow((s) => ({
      isEqPanelOpen: s.isEqPanelOpen,
      toggleEqPanel: s.toggleEqPanel,
    }))
  );
