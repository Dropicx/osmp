import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import Search from '../Search';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../../types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('../../hooks/useContextMenu', () => ({
  useContextMenu: () => ({
    contextMenu: null,
    getMenuPosition: () => ({}),
    openContextMenu: vi.fn(),
    closeContextMenu: vi.fn(),
  }),
}));
// Mock debounce to be immediate in tests
vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

const mockInvoke = vi.mocked(invoke);

describe('Search', () => {
  const mockTracks: Track[] = [
    {
      id: 1,
      file_path: '/path/to/track1.mp3',
      title: 'Test Song 1',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      year: 2023,
      genre: 'Rock',
      track_number: 1,
      file_size: 5000000,
      file_format: 'mp3',
      last_modified: Date.now(),
      metadata_fetched: true,
      release_mbid: null,
      created_at: Date.now(),
    },
    {
      id: 2,
      file_path: '/path/to/track2.mp3',
      title: 'Test Song 2',
      artist: 'Another Artist',
      album: 'Another Album',
      duration: 200,
      year: 2023,
      genre: 'Pop',
      track_number: 2,
      file_size: 6000000,
      file_format: 'mp3',
      last_modified: Date.now(),
      metadata_fetched: true,
      release_mbid: null,
      created_at: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
    useStore.setState({ tracks: [], loading: false });
  });

  it('renders search input', () => {
    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    expect(searchInput).toBeInTheDocument();
  });

  it('updates query when typing', () => {
    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });

    expect(searchInput).toHaveValue('test query');
  });

  it('calls searchTracks when form is submitted', async () => {
    const searchTracks = vi.spyOn(useStore.getState(), 'searchTracks');
    mockInvoke.mockResolvedValue(mockTracks);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    const form = searchInput.closest('form');

    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(searchTracks).toHaveBeenCalledWith('test');
    });
  });

  it('does not search with empty query', async () => {
    const searchTracks = vi.spyOn(useStore.getState(), 'searchTracks');

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    const form = searchInput.closest('form');

    fireEvent.change(searchInput, { target: { value: '   ' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(searchTracks).not.toHaveBeenCalled();
    });
  });

  it('displays search results when tracks are available', async () => {
    mockInvoke.mockResolvedValue(mockTracks);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Results')).toBeInTheDocument();
      expect(screen.getByText('Test Song 1')).toBeInTheDocument();
      expect(screen.getByText('Test Song 2')).toBeInTheDocument();
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(screen.getByText('Another Artist')).toBeInTheDocument();
    });
  });

  it('displays "No results found" when query exists but no tracks', async () => {
    mockInvoke.mockResolvedValue([]);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/No results found for "nonexistent"/)).toBeInTheDocument();
    });
  });

  it('calls playTrack when track is double-clicked', async () => {
    mockInvoke.mockResolvedValue(mockTracks);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Test Song 1')).toBeInTheDocument();
    });

    mockInvoke.mockResolvedValue(undefined);

    const trackRow = screen.getByText('Test Song 1').closest('tr');
    await act(async () => {
      fireEvent.doubleClick(trackRow!);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: 1 });
    });
  });

  it('calls addToQueue when add to queue button is clicked', async () => {
    mockInvoke.mockResolvedValue(mockTracks);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Test Song 1')).toBeInTheDocument();
    });

    const addToQueueButtons = screen.getAllByTitle('Add to Queue');
    await act(async () => {
      fireEvent.click(addToQueueButtons[0]);
    });

    await waitFor(() => {
      const queue = useStore.getState().queue;
      expect(queue.some((item) => item.track.id === 1)).toBe(true);
    });
  });

  it('displays track duration correctly', async () => {
    mockInvoke.mockResolvedValue(mockTracks);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(screen.getByText('3:00')).toBeInTheDocument(); // 180 seconds = 3:00
      expect(screen.getByText('3:20')).toBeInTheDocument(); // 200 seconds = 3:20
    });
  });

  it('displays default values for missing metadata', async () => {
    const trackWithMissingData: Track = {
      ...mockTracks[0],
      title: null,
      artist: null,
      album: null,
    };

    mockInvoke.mockResolvedValue([trackWithMissingData]);

    render(<Search />);

    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Unknown Title')).toBeInTheDocument();
      expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
      expect(screen.getByText('Unknown Album')).toBeInTheDocument();
    });
  });
});
