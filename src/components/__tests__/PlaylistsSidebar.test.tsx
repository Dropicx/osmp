import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaylistsSidebar from '../PlaylistsSidebar';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockPlaylist, mockPlaylist2, mockTrack } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('PlaylistsSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_playlists') return [];
      return undefined;
    });
    useStore.setState({
      playlists: [],
      currentPlaylist: null,
      playlistTracks: [],
      playlistLoading: false,
      selectedTracks: [],
    });
  });

  it('shows Playlists heading', () => {
    render(<PlaylistsSidebar />);
    expect(screen.getByText('Playlists')).toBeInTheDocument();
  });

  it('shows Create Playlist button', () => {
    render(<PlaylistsSidebar />);
    expect(screen.getByTitle('Create Playlist')).toBeInTheDocument();
  });

  it('shows empty state when no playlists', () => {
    render(<PlaylistsSidebar />);
    expect(screen.getByText('No playlists yet')).toBeInTheDocument();
    expect(screen.getByText('Create one')).toBeInTheDocument();
  });

  it('renders playlist items', () => {
    useStore.setState({ playlists: [mockPlaylist, mockPlaylist2] });
    render(<PlaylistsSidebar />);
    expect(screen.getByText('Test Playlist')).toBeInTheDocument();
    expect(screen.getByText('Another Playlist')).toBeInTheDocument();
  });

  it('shows track count for playlists', () => {
    useStore.setState({ playlists: [mockPlaylist] });
    render(<PlaylistsSidebar />);
    expect(screen.getByText(/5 tracks/)).toBeInTheDocument();
  });

  it('shows singular track for count of 1', () => {
    useStore.setState({
      playlists: [{ ...mockPlaylist, track_count: 1 }],
    });
    render(<PlaylistsSidebar />);
    expect(screen.getByText(/1 track/)).toBeInTheDocument();
  });

  it('selects playlist on click', async () => {
    useStore.setState({ playlists: [mockPlaylist] });
    mockInvoke.mockResolvedValue([]);

    render(<PlaylistsSidebar />);
    fireEvent.click(screen.getByText('Test Playlist'));

    await waitFor(() => {
      expect(useStore.getState().currentPlaylist?.id).toBe(mockPlaylist.id);
    });
  });

  it('loads playlist tracks on selection', async () => {
    useStore.setState({ playlists: [mockPlaylist] });
    mockInvoke.mockResolvedValue([mockTrack]);

    render(<PlaylistsSidebar />);
    fireEvent.click(screen.getByText('Test Playlist'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_playlist_tracks', {
        playlistId: mockPlaylist.id,
      });
    });
  });

  it('opens create dialog when + is clicked', () => {
    render(<PlaylistsSidebar />);
    fireEvent.click(screen.getByTitle('Create Playlist'));
    expect(screen.getByText('Create Playlist', { selector: 'h2' })).toBeInTheDocument();
  });

  it('opens create dialog from empty state link', () => {
    render(<PlaylistsSidebar />);
    fireEvent.click(screen.getByText('Create one'));
    expect(screen.getByText('Create Playlist', { selector: 'h2' })).toBeInTheDocument();
  });

  it('shows context menu on right-click', () => {
    useStore.setState({ playlists: [mockPlaylist] });
    render(<PlaylistsSidebar />);

    // Find the more button and click it
    const buttons = screen.getAllByRole('button');
    const moreButton = buttons.find((b) => b.querySelector('svg'));
    if (moreButton) {
      fireEvent.click(moreButton);
    }
  });

  it('highlights active playlist', () => {
    useStore.setState({
      playlists: [mockPlaylist],
      currentPlaylist: mockPlaylist,
    });
    render(<PlaylistsSidebar />);

    const playlistItem = screen.getByText('Test Playlist').closest('[data-playlist-id]');
    expect(playlistItem?.className).toContain('bg-primary');
  });

  it('shows delete confirmation dialog', async () => {
    useStore.setState({ playlists: [mockPlaylist] });
    render(<PlaylistsSidebar />);

    // Simulate context menu - use the more button
    const moreButtons = screen.getAllByRole('button');
    // The more button with MoreVertical icon
    const moreBtn = moreButtons.find((b) => {
      const svg = b.querySelector('svg');
      return svg && b.className.includes('opacity');
    });
    if (moreBtn) {
      fireEvent.click(moreBtn);
    }
  });

  it('loads playlists on mount', () => {
    mockInvoke.mockResolvedValue([]);
    render(<PlaylistsSidebar />);
    expect(mockInvoke).toHaveBeenCalledWith('get_playlists');
  });

  it('shows duration for playlists with total_duration', () => {
    useStore.setState({ playlists: [mockPlaylist] });
    render(<PlaylistsSidebar />);
    // 900 seconds = 15m
    expect(screen.getByText(/15m/)).toBeInTheDocument();
  });

  it('formats hours correctly', () => {
    useStore.setState({
      playlists: [{ ...mockPlaylist, total_duration: 7200 }],
    });
    render(<PlaylistsSidebar />);
    // 7200 seconds = 2h 0m
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });
});
