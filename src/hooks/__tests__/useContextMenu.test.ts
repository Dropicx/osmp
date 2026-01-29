import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenu } from '../useContextMenu';

describe('useContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set viewport dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  it('initializes with null contextMenu', () => {
    const { result } = renderHook(() => useContextMenu());
    expect(result.current.contextMenu).toBeNull();
  });

  it('openContextMenu sets position and trackId', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      result.current.openContextMenu(mockEvent, 5);
    });

    expect(result.current.contextMenu).toEqual({
      x: 100,
      y: 200,
      trackId: 5,
    });
  });

  it('openContextMenu prevents default', () => {
    const { result } = renderHook(() => useContextMenu());
    const preventDefault = vi.fn();

    act(() => {
      result.current.openContextMenu(
        { preventDefault, clientX: 0, clientY: 0 } as unknown as React.MouseEvent,
        1
      );
    });

    expect(preventDefault).toHaveBeenCalled();
  });

  it('closeContextMenu sets contextMenu to null', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 100, clientY: 100 } as unknown as React.MouseEvent,
        1
      );
    });

    expect(result.current.contextMenu).not.toBeNull();

    act(() => {
      result.current.closeContextMenu();
    });

    expect(result.current.contextMenu).toBeNull();
  });

  it('getMenuPosition returns {left:0, top:0} when no menu', () => {
    const { result } = renderHook(() => useContextMenu());
    expect(result.current.getMenuPosition()).toEqual({ left: 0, top: 0 });
  });

  it('getMenuPosition returns position when within viewport', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 100, clientY: 200 } as unknown as React.MouseEvent,
        1
      );
    });

    const pos = result.current.getMenuPosition();
    expect(pos.left).toBe(100);
    expect(pos.top).toBe(200);
  });

  it('getMenuPosition clamps x when overflowing right', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 1000, clientY: 100 } as unknown as React.MouseEvent,
        1
      );
    });

    const pos = result.current.getMenuPosition();
    // Should be clamped: innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_PADDING
    expect(pos.left).toBeLessThan(1000);
  });

  it('getMenuPosition clamps y when overflowing bottom', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 100, clientY: 700 } as unknown as React.MouseEvent,
        1
      );
    });

    const pos = result.current.getMenuPosition();
    expect(pos.top).toBeLessThan(700);
  });

  it('closes on document click', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 100, clientY: 100 } as unknown as React.MouseEvent,
        1
      );
    });

    expect(result.current.contextMenu).not.toBeNull();

    act(() => {
      document.dispatchEvent(new Event('click'));
    });

    expect(result.current.contextMenu).toBeNull();
  });

  it('closes on Escape key', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 100, clientY: 100 } as unknown as React.MouseEvent,
        1
      );
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.contextMenu).toBeNull();
  });

  it('closes on scroll', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.openContextMenu(
        { preventDefault: vi.fn(), clientX: 100, clientY: 100 } as unknown as React.MouseEvent,
        1
      );
    });

    act(() => {
      document.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.contextMenu).toBeNull();
  });
});
