import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack, mockTrack2, mockAlbum, mockAlbum2 } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tracks') return [];
      if (cmd === 'get_albums') return [];
      return undefined;
    });
    useStore.setState({
      tracks: [],
      albums: [],
      albumTracks: [],
      albumLoading: false,
      loading: false,
    });
  });

  it('shows greeting based on time of day', () => {
    render(<Dashboard />);
    // Should show one of the greetings
    const greetings = ['Good morning', 'Good afternoon', 'Good evening'];
    const found = greetings.some((g) => screen.queryByText(g) !== null);
    expect(found).toBe(true);
  });

  it('shows welcome message', () => {
    render(<Dashboard />);
    expect(screen.getByText('Welcome back to OSMP')).toBeInTheDocument();
  });

  it('shows empty state when no tracks', () => {
    render(<Dashboard />);
    expect(screen.getByText('No music found')).toBeInTheDocument();
    expect(screen.getByText('Add scan folders in Settings to get started')).toBeInTheDocument();
  });

  it('shows Recently Added section with albums', () => {
    useStore.setState({
      tracks: [mockTrack, mockTrack2],
      albums: [mockAlbum, mockAlbum2],
    });

    render(<Dashboard />);

    expect(screen.getByText('Recently Added')).toBeInTheDocument();
  });

  it('shows album cards in Recently Added', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tracks') return [mockTrack];
      if (cmd === 'get_albums') return [mockAlbum];
      return undefined;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recently Added')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Test Album').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test Artist').length).toBeGreaterThan(0);
  });

  it('shows Your Library section with tracks', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tracks') return [mockTrack, mockTrack2];
      if (cmd === 'get_albums') return [];
      return undefined;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Your Library')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Test Song').length).toBeGreaterThan(0);
  });

  it('shows Unknown Artist for null artist in albums', () => {
    useStore.setState({
      tracks: [mockTrack],
      albums: [{ ...mockAlbum, artist: null }],
    });

    render(<Dashboard />);
    expect(screen.getAllByText('Unknown Artist').length).toBeGreaterThan(0);
  });

  it('shows track table with headers', () => {
    useStore.setState({
      tracks: [mockTrack],
      albums: [],
    });

    render(<Dashboard />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.getByText('Album')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('navigates to album detail on album click', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tracks') return [mockTrack];
      if (cmd === 'get_albums') return [mockAlbum];
      if (cmd === 'get_album_tracks') return [mockTrack];
      return undefined;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recently Added')).toBeInTheDocument();
    });

    const albumElements = screen.getAllByText('Test Album');
    fireEvent.click(albumElements[0]);

    await waitFor(() => {
      expect(screen.getByText('← Back to Dashboard')).toBeInTheDocument();
    });
  });

  it('navigates back from album detail', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tracks') return [mockTrack];
      if (cmd === 'get_albums') return [mockAlbum];
      if (cmd === 'get_album_tracks') return [mockTrack];
      return undefined;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recently Added')).toBeInTheDocument();
    });

    const albumElements = screen.getAllByText('Test Album');
    fireEvent.click(albumElements[0]);

    await waitFor(() => {
      expect(screen.getByText('← Back to Dashboard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('← Back to Dashboard'));

    expect(screen.getByText('Recently Added')).toBeInTheDocument();
  });

  it('shows Recommended section when tracks have genres', () => {
    const tracksWithGenre = [
      { ...mockTrack, genre: 'Rock', artist: 'Artist1' },
      { ...mockTrack2, genre: 'Rock', artist: 'Artist1' },
    ];
    useStore.setState({
      tracks: tracksWithGenre,
      albums: [],
    });

    render(<Dashboard />);

    expect(screen.getByText('Recommended for You')).toBeInTheDocument();
  });

  it('loads tracks and albums on mount', () => {
    mockInvoke.mockResolvedValue([]);
    render(<Dashboard />);
    // Should call get_tracks and get_albums
    expect(mockInvoke).toHaveBeenCalledWith('get_tracks', { filters: null });
    expect(mockInvoke).toHaveBeenCalledWith('get_albums');
  });

  it('limits library table to 20 tracks', async () => {
    const manyTracks = Array.from({ length: 30 }, (_, i) => ({
      ...mockTrack,
      id: i + 1,
      title: `Track ${i + 1}`,
    }));
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tracks') return manyTracks;
      if (cmd === 'get_albums') return [];
      return undefined;
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Your Library')).toBeInTheDocument();
    });

    // Should show Track 1 through Track 20
    expect(screen.getAllByText('Track 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Track 20').length).toBeGreaterThan(0);
    expect(screen.queryByText('Track 21')).not.toBeInTheDocument();
  });
});
