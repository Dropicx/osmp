import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreatePlaylistDialog from '../CreatePlaylistDialog';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockPlaylist } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('CreatePlaylistDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ playlists: [mockPlaylist] });
  });

  it('renders nothing when not open', () => {
    const { container } = render(<CreatePlaylistDialog isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(<CreatePlaylistDialog {...defaultProps} />);
    expect(screen.getByText('Create Playlist')).toBeInTheDocument();
    expect(screen.getByLabelText('Playlist Name')).toBeInTheDocument();
  });

  it('shows error for empty name', async () => {
    render(<CreatePlaylistDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Create'));

    expect(screen.getByText('Playlist name cannot be empty')).toBeInTheDocument();
  });

  it('shows error for duplicate name', async () => {
    render(<CreatePlaylistDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Playlist Name'), {
      target: { value: 'Test Playlist' },
    });
    fireEvent.click(screen.getByText('Create'));

    expect(screen.getByText('A playlist with this name already exists')).toBeInTheDocument();
  });

  it('shows error for duplicate name case-insensitive', async () => {
    render(<CreatePlaylistDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Playlist Name'), {
      target: { value: 'test playlist' },
    });
    fireEvent.click(screen.getByText('Create'));

    expect(screen.getByText('A playlist with this name already exists')).toBeInTheDocument();
  });

  it('creates playlist and calls callbacks on success', async () => {
    mockInvoke.mockResolvedValueOnce(5); // create_playlist
    mockInvoke.mockResolvedValueOnce([]); // loadPlaylists

    render(<CreatePlaylistDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Playlist Name'), {
      target: { value: 'New Playlist' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(defaultProps.onCreated).toHaveBeenCalledWith(5);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles creation error', async () => {
    mockInvoke.mockRejectedValue(new Error('Server error'));

    render(<CreatePlaylistDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Playlist Name'), {
      target: { value: 'New Playlist' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('closes when Cancel is clicked', () => {
    render(<CreatePlaylistDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes when backdrop is clicked', () => {
    render(<CreatePlaylistDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    render(<CreatePlaylistDialog {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('clears error when typing', () => {
    render(<CreatePlaylistDialog {...defaultProps} />);

    // Trigger error
    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText('Playlist name cannot be empty')).toBeInTheDocument();

    // Start typing
    fireEvent.change(screen.getByLabelText('Playlist Name'), {
      target: { value: 'a' },
    });

    expect(screen.queryByText('Playlist name cannot be empty')).not.toBeInTheDocument();
  });

  it('trims whitespace from name', async () => {
    mockInvoke.mockResolvedValueOnce(1);
    mockInvoke.mockResolvedValueOnce([]);

    render(<CreatePlaylistDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Playlist Name'), {
      target: { value: '  Trimmed Name  ' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_playlist', { name: 'Trimmed Name' });
    });
  });
});
