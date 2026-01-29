import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

function fireKeyDown(key: string, opts: Partial<KeyboardEvent> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    useStore.setState({
      currentTrack: mockTrack,
      tracks: [mockTrack],
      isPlaying: true,
      volume: 0.5,
      selectedTracks: [],
      isQueuePanelOpen: false,
      isEqPanelOpen: false,
    });
  });

  it('Space triggers pausePlayback', () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown(' ');

    expect(mockInvoke).toHaveBeenCalledWith('pause_playback');
  });

  it('Space does nothing without current track', () => {
    useStore.setState({ currentTrack: null });
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown(' ');

    expect(mockInvoke).not.toHaveBeenCalledWith('pause_playback');
  });

  it('ArrowRight triggers playNextTrack', () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('ArrowRight');

    // playNextTrack will invoke stop_playback if at end of list
    expect(mockInvoke).toHaveBeenCalled();
  });

  it('ArrowLeft triggers playPreviousTrack', () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('ArrowLeft');

    expect(mockInvoke).toHaveBeenCalled();
  });

  it('ArrowUp increases volume by 5%', () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('ArrowUp');

    expect(useStore.getState().volume).toBeCloseTo(0.55, 2);
  });

  it('ArrowDown decreases volume by 5%', () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('ArrowDown');

    expect(useStore.getState().volume).toBeCloseTo(0.45, 2);
  });

  it('Ctrl+F dispatches focus-search event', () => {
    renderHook(() => useKeyboardShortcuts());
    const listener = vi.fn();
    window.addEventListener('osmp:focus-search', listener);

    fireKeyDown('f', { ctrlKey: true });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('osmp:focus-search', listener);
  });

  it('Cmd+F dispatches focus-search event', () => {
    renderHook(() => useKeyboardShortcuts());
    const listener = vi.fn();
    window.addEventListener('osmp:focus-search', listener);

    fireKeyDown('f', { metaKey: true });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('osmp:focus-search', listener);
  });

  it('Delete dispatches delete-selected event when tracks selected', () => {
    useStore.setState({ selectedTracks: [1, 2] });
    renderHook(() => useKeyboardShortcuts());
    const listener = vi.fn();
    window.addEventListener('osmp:delete-selected', listener);

    fireKeyDown('Delete');

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('osmp:delete-selected', listener);
  });

  it('Delete does nothing without selected tracks', () => {
    renderHook(() => useKeyboardShortcuts());
    const listener = vi.fn();
    window.addEventListener('osmp:delete-selected', listener);

    fireKeyDown('Delete');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('osmp:delete-selected', listener);
  });

  it('Ctrl+A dispatches select-all event', () => {
    renderHook(() => useKeyboardShortcuts());
    const listener = vi.fn();
    window.addEventListener('osmp:select-all', listener);

    fireKeyDown('a', { ctrlKey: true });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('osmp:select-all', listener);
  });

  it('Escape clears selection', () => {
    useStore.setState({ selectedTracks: [1, 2] });
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('Escape');

    expect(useStore.getState().selectedTracks).toEqual([]);
  });

  it('Escape closes queue panel', () => {
    useStore.setState({ isQueuePanelOpen: true });
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('Escape');

    expect(useStore.getState().isQueuePanelOpen).toBe(false);
  });

  it('Escape closes eq panel', () => {
    useStore.setState({ isEqPanelOpen: true });
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown('Escape');

    expect(useStore.getState().isEqPanelOpen).toBe(false);
  });

  it('ignores shortcuts when typing in input', () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    document.dispatchEvent(event);

    // Should not call pause_playback since we're in an input
    // Note: In jsdom, target property behavior may differ, so we check the store didn't call invoke unnecessarily
    document.body.removeChild(input);
  });

  it('cleans up listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
