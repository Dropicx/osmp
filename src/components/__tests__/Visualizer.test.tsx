import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Visualizer from '../Visualizer';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock canvas context
const mockCtx = {
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  fillStyle: '',
};

const mockInvoke = vi.mocked(invoke);

describe('Visualizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(new Array(10).fill(0));

    // Mock HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    // Mock getBoundingClientRect
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 200,
      top: 0,
      left: 0,
      right: 200,
      bottom: 200,
    });

    // Mock requestAnimationFrame - execute the first callback once asynchronously
    let cancelled = false;
    let firstCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      if (!firstCallback) {
        firstCallback = cb;
        setTimeout(() => {
          if (!cancelled && firstCallback) {
            firstCallback(0);
          }
        }, 0);
      }
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      cancelled = true;
      firstCallback = null;
    });

    useStore.setState({
      isPlaying: true,
      visualizerOpacity: 80,
    });
  });

  afterEach(() => {
    // Cleanup any intervals
    vi.clearAllTimers();
  });

  it('renders a canvas element', () => {
    render(<Visualizer onClick={vi.fn()} />);
    const canvas = screen.getByTitle('Open Equalizer');
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Visualizer onClick={onClick} />);
    fireEvent.click(screen.getByTitle('Open Equalizer'));
    expect(onClick).toHaveBeenCalled();
  });

  it('sets canvas resolution from bounding rect', () => {
    render(<Visualizer onClick={vi.fn()} />);
    expect(HTMLCanvasElement.prototype.getBoundingClientRect).toHaveBeenCalled();
  });

  it('starts animation frame', () => {
    render(<Visualizer onClick={vi.fn()} />);
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it('polls backend for visualizer data when playing', async () => {
    render(<Visualizer onClick={vi.fn()} />);

    // Wait for the interval to fire
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(mockInvoke).toHaveBeenCalledWith('get_visualizer_data');
  });

  it('does not poll when not playing', async () => {
    useStore.setState({ isPlaying: false });
    render(<Visualizer onClick={vi.fn()} />);

    // Wait longer than the interval
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(mockInvoke).not.toHaveBeenCalledWith('get_visualizer_data');
  });

  it('applies opacity from store', () => {
    useStore.setState({ visualizerOpacity: 50 });
    render(<Visualizer onClick={vi.fn()} />);

    const canvas = screen.getByTitle('Open Equalizer');
    expect(canvas.style.opacity).toBe('0.5');
  });

  it('sets full opacity on hover', () => {
    render(<Visualizer onClick={vi.fn()} />);
    const canvas = screen.getByTitle('Open Equalizer');

    fireEvent.mouseEnter(canvas);
    expect(canvas.style.opacity).toBe('1');

    fireEvent.mouseLeave(canvas);
    expect(canvas.style.opacity).toBe('0.8');
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<Visualizer onClick={vi.fn()} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('cancels animation frame on unmount', () => {
    const { unmount } = render(<Visualizer onClick={vi.fn()} />);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('gets 2D context from canvas', async () => {
    render(<Visualizer onClick={vi.fn()} />);
    // Wait for RAF callback to execute
    await new Promise((resolve) => setTimeout(resolve, 10));
    // getContext is called in the animate callback which is triggered by requestAnimationFrame
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });
});
