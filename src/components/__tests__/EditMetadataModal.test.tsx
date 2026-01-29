import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditMetadataModal from '../EditMetadataModal';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack, mockTrack3 } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('EditMetadataModal', () => {
  const defaultProps = {
    track: mockTrack,
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('renders with track data pre-filled', () => {
    render(<EditMetadataModal {...defaultProps} />);

    expect(screen.getByText('Edit Metadata')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Test Song');
    expect(screen.getByLabelText('Artist')).toHaveValue('Test Artist');
    expect(screen.getByLabelText('Album')).toHaveValue('Test Album');
    expect(screen.getByLabelText('Year')).toHaveValue(2023);
    expect(screen.getByLabelText('Genre')).toHaveValue('Rock');
    expect(screen.getByLabelText('Track #')).toHaveValue(1);
  });

  it('renders empty fields for track with null metadata', () => {
    render(<EditMetadataModal {...defaultProps} track={mockTrack3} />);

    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Artist')).toHaveValue('');
    expect(screen.getByLabelText('Album')).toHaveValue('');
    expect(screen.getByLabelText('Year')).toHaveValue(null);
    expect(screen.getByLabelText('Genre')).toHaveValue('');
    expect(screen.getByLabelText('Track #')).toHaveValue(null);
  });

  it('displays filename from path', () => {
    render(<EditMetadataModal {...defaultProps} />);
    expect(screen.getByText('song.mp3')).toBeInTheDocument();
  });

  it('allows editing fields', () => {
    render(<EditMetadataModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'New Title' },
    });
    expect(screen.getByLabelText('Title')).toHaveValue('New Title');
  });

  it('saves to database on Save', async () => {
    render(<EditMetadataModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_track_metadata_manual', {
        trackId: mockTrack.id,
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        year: 2023,
        genre: 'Rock',
        trackNumber: 1,
      });
    });
  });

  it('calls onSaved and onClose after successful save', async () => {
    render(<EditMetadataModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('writes to file when checkbox is checked', async () => {
    render(<EditMetadataModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /write to file/i }));
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_track_metadata_manual', expect.any(Object));
      expect(mockInvoke).toHaveBeenCalledWith('write_metadata_to_file', expect.any(Object));
    });
  });

  it('does not write to file by default', async () => {
    render(<EditMetadataModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_track_metadata_manual', expect.any(Object));
      expect(mockInvoke).not.toHaveBeenCalledWith('write_metadata_to_file', expect.any(Object));
    });
  });

  it('displays error on save failure', async () => {
    mockInvoke.mockRejectedValue('Save failed');

    render(<EditMetadataModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('shows Saving... text while saving', async () => {
    let resolveInvoke: () => void;
    mockInvoke.mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolveInvoke = r;
        })
    );

    render(<EditMetadataModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.getByText('Saving...')).toBeInTheDocument();

    await waitFor(() => {
      resolveInvoke!();
    });
  });

  it('closes on Cancel click', () => {
    render(<EditMetadataModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click', () => {
    render(<EditMetadataModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    render(<EditMetadataModal {...defaultProps} />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('sends null for empty string fields', async () => {
    render(<EditMetadataModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Artist'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'update_track_metadata_manual',
        expect.objectContaining({
          title: null,
          artist: null,
        })
      );
    });
  });
});
