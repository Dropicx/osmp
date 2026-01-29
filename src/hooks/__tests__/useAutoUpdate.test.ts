import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoUpdate } from '../useAutoUpdate';

// Mock Tauri plugins
const mockCheck = vi.fn();
const mockRelaunch = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

describe('useAutoUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockCheck.mockResolvedValue(null);
    mockRelaunch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with idle status', () => {
    const { result, unmount } = renderHook(() => useAutoUpdate());
    expect(result.current.status).toBe('idle');
    expect(result.current.version).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.dismissed).toBe(false);
    unmount();
  });

  it('auto-checks for updates after 5 seconds', async () => {
    mockCheck.mockResolvedValue(null);

    const { result, unmount } = renderHook(() => useAutoUpdate());

    expect(result.current.status).toBe('idle');

    // Advance timers to trigger auto-check
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Wait for check promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCheck).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    unmount();
  });

  it('sets status to available when update found', async () => {
    let resolveDownload: () => void;
    const mockUpdate = {
      version: '1.0.0',
      downloadAndInstall: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDownload = resolve;
          })
      ),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    await act(async () => {
      await result.current.checkForUpdate();
    });

    // Wait for auto-download effect to trigger
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('downloading');
    expect(result.current.version).toBe('1.0.0');

    // Cleanup
    act(() => {
      resolveDownload!();
    });
    unmount();
  });

  it('stays idle when no update available', async () => {
    mockCheck.mockResolvedValue(null);

    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.status).toBe('idle');
    unmount();
  });

  it('handles check errors silently', async () => {
    mockCheck.mockRejectedValue(new Error('Network error'));

    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.status).toBe('idle');
    unmount();
  });

  it('downloadAndInstall tracks progress', async () => {
    const mockUpdate = {
      version: '1.0.0',
      downloadAndInstall: vi
        .fn()
        .mockImplementation(
          async (cb: (event: { event: string; data: Record<string, number> }) => void) => {
            cb({ event: 'Started', data: { contentLength: 1000 } });
            cb({ event: 'Progress', data: { chunkLength: 500 } });
            cb({ event: 'Progress', data: { chunkLength: 500 } });
            cb({ event: 'Finished', data: {} });
          }
        ),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    // Manually trigger check which will trigger auto-download
    await act(async () => {
      await result.current.checkForUpdate();
      // Give time for the auto-download effect to run
      await vi.runAllTimersAsync();
    });

    // The downloadAndInstall should have completed
    expect(result.current.status).toBe('ready');
    expect(result.current.progress).toBe(100);
    unmount();
  });

  it('handles download errors', async () => {
    const mockUpdate = {
      version: '1.0.0',
      downloadAndInstall: vi.fn().mockRejectedValue(new Error('Download failed')),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    // Manually trigger check which will trigger auto-download
    await act(async () => {
      await result.current.checkForUpdate();
      // Give time for the auto-download effect to run
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Download failed');
    unmount();
  });

  it('restartApp calls relaunch', async () => {
    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    await act(async () => {
      await result.current.restartApp();
    });

    expect(mockRelaunch).toHaveBeenCalled();
    unmount();
  });

  it('dismiss sets dismissed to true', () => {
    const { result, unmount } = renderHook(() => useAutoUpdate());

    // Clear auto-check timer
    act(() => {
      vi.clearAllTimers();
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.dismissed).toBe(true);
    unmount();
  });
});
