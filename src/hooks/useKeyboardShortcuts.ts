import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * Global keyboard shortcuts for the music player.
 * - Space: Play/Pause
 * - ArrowRight: Next track
 * - ArrowLeft: Previous track
 * - ArrowUp: Volume up (5%)
 * - ArrowDown: Volume down (5%)
 * - Ctrl/Cmd+F: Focus search (dispatches custom event)
 * - Delete/Backspace: Delete selected tracks
 * - Ctrl/Cmd+A: Select all tracks
 * - Escape: Clear selection / close panels
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+F: Focus search (works even in inputs)
      if (isMod && e.key === 'f') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('osmp:focus-search'));
        return;
      }

      // Don't handle shortcuts when typing in inputs (except Escape)
      if (isInput && e.key !== 'Escape') return;

      const state = useStore.getState();

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (state.currentTrack) {
            state.pausePlayback();
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          state.playNextTrack();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          state.playPreviousTrack();
          break;

        case 'ArrowUp':
          e.preventDefault();
          state.setVolume(Math.min(1, state.volume + 0.05));
          break;

        case 'ArrowDown':
          e.preventDefault();
          state.setVolume(Math.max(0, state.volume - 0.05));
          break;

        case 'Delete':
        case 'Backspace':
          if (!isInput && state.selectedTracks.length > 0) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('osmp:delete-selected'));
          }
          break;

        case 'a':
          if (isMod) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('osmp:select-all'));
          }
          break;

        case 'Escape':
          state.clearSelection();
          if (state.isQueuePanelOpen) {
            state.toggleQueuePanel();
          }
          if (state.isEqPanelOpen) {
            state.toggleEqPanel();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
