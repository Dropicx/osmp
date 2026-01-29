import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Albums from '../Albums';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockAlbum, mockAlbum2, mockTrack, mockTrack2 } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('../../utils/formatting', () => ({
  formatDuration: (s: number | null) => {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  },
}));

const mockInvoke = vi.mocked(invoke);

describe('Albums', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_albums') return [];
      return undefined;
    });
    useStore.setState({
      albums: [],
      albumTracks: [],
      albumLoading: false,
    });
  });

  it('shows loading state', () => {
    useStore.setState({ albumLoading: true });
    render(<Albums />);
    expect(screen.getByText('Loading albums...')).toBeInTheDocument();
  });

  it('shows empty state when no albums', async () => {
    render(<Albums />);
    await waitFor(() => {
      expect(screen.getByText('No albums found')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Albums will appear here once you scan your music')
    ).toBeInTheDocument();
  });

  it('renders album cards', () => {
    useStore.setState({ albums: [mockAlbum, mockAlbum2] });
    render(<Albums />);
    expect(screen.getByText('Test Album')).toBeInTheDocument();
    expect(screen.getByText('Another Album')).toBeInTheDocument();
  });

  it('shows artist names', () => {
    useStore.setState({ albums: [mockAlbum] });
    render(<Albums />);
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('shows Unknown Artist for null artist', () => {
    useStore.setState({ albums: [{ ...mockAlbum, artist: null }] });
    render(<Albums />);
    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
  });

  it('shows year when available', () => {
    useStore.setState({ albums: [mockAlbum] });
    render(<Albums />);
    expect(screen.getByText('2023')).toBeInTheDocument();
  });

  it('renders Albums heading', () => {
    useStore.setState({ albums: [mockAlbum] });
    render(<Albums />);
    expect(screen.getByText('Albums')).toBeInTheDocument();
  });

  it('navigates to album detail on click', async () => {
    useStore.setState({ albums: [mockAlbum] });
    mockInvoke.mockResolvedValue([mockTrack]);

    render(<Albums />);
    fireEvent.click(screen.getByText('Test Album'));

    await waitFor(() => {
      expect(screen.getByText('← Back to Albums')).toBeInTheDocument();
    });
  });

  it('navigates to album detail on keyboard Enter', async () => {
    useStore.setState({ albums: [mockAlbum] });
    mockInvoke.mockResolvedValue([mockTrack]);

    render(<Albums />);
    const card = screen.getByText('Test Album').closest('[role="button"]')!;
    fireEvent.keyDown(card, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('← Back to Albums')).toBeInTheDocument();
    });
  });

  it('shows album cover art when available', async () => {
    mockInvoke.mockResolvedValue([mockAlbum2]);
    render(<Albums />);
    await waitFor(() => {
      const img = screen.getByAltText('Another Album');
      expect(img).toBeInTheDocument();
    });
  });

  describe('Album Detail View', () => {
    beforeEach(() => {
      useStore.setState({
        albums: [mockAlbum],
        albumTracks: [mockTrack, mockTrack2],
        albumLoading: false,
      });
      mockInvoke.mockResolvedValue([mockTrack, mockTrack2]);
    });

    it('shows album name and artist', async () => {
      render(<Albums />);
      fireEvent.click(screen.getByText('Test Album'));

      await waitFor(() => {
        expect(screen.getByText('Test Album')).toBeInTheDocument();
        expect(screen.getByText('Test Artist')).toBeInTheDocument();
      });
    });

    it('shows track count and duration', async () => {
      render(<Albums />);
      fireEvent.click(screen.getByText('Test Album'));

      await waitFor(() => {
        expect(screen.getByText(/2 tracks/)).toBeInTheDocument();
      });
    });

    it('shows Play Album button', async () => {
      render(<Albums />);
      fireEvent.click(screen.getByText('Test Album'));

      await waitFor(() => {
        expect(screen.getByText('Play Album')).toBeInTheDocument();
      });
    });

    it('shows back button and navigates back', async () => {
      render(<Albums />);
      fireEvent.click(screen.getByText('Test Album'));

      await waitFor(() => {
        expect(screen.getByText('← Back to Albums')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('← Back to Albums'));

      expect(screen.getByText('Albums')).toBeInTheDocument();
    });

    it('renders track table', async () => {
      render(<Albums />);
      fireEvent.click(screen.getByText('Test Album'));

      await waitFor(() => {
        expect(screen.getByText('Test Song')).toBeInTheDocument();
        expect(screen.getByText('Second Song')).toBeInTheDocument();
      });
    });
  });

  it('loads albums on mount', () => {
    mockInvoke.mockResolvedValue([]);
    render(<Albums />);
    expect(mockInvoke).toHaveBeenCalledWith('get_albums');
  });
});
