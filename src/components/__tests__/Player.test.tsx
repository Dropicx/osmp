import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import Player from '../Player';
import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../../types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve({})),
}));

const mockInvoke = vi.mocked(invoke);

describe('Player', () => {
  const mockTrack: Track = {
    id: 1,
    file_path: '/path/to/track.mp3',
    title: 'Test Song',
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useStore.setState({
      currentTrack: null,
      isPlaying: false,
      volume: 1.0,
      position: 0,
      shuffleEnabled: false,
      repeatMode: 'off',
    });
  });

  it('renders nothing when no track is playing', () => {
    const { container } = render(<Player />);
    expect(container.firstChild).toBeNull();
  });

  it('renders player controls when track is playing', () => {
    useStore.setState({ currentTrack: mockTrack, isPlaying: true });

    render(<Player />);

    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('displays play button when paused', () => {
    useStore.setState({ currentTrack: mockTrack, isPlaying: false });

    render(<Player />);

    const playButton = screen.getByTitle('Play');
    expect(playButton).toBeInTheDocument();
  });

  it('displays pause button when playing', () => {
    useStore.setState({ currentTrack: mockTrack, isPlaying: true });

    render(<Player />);

    const pauseButton = screen.getByTitle('Pause');
    expect(pauseButton).toBeInTheDocument();
  });

  it('calls pausePlayback when play/pause button is clicked', async () => {
    useStore.setState({ currentTrack: mockTrack, isPlaying: true });
    mockInvoke.mockResolvedValue(undefined);

    render(<Player />);

    const pauseButton = screen.getByTitle('Pause');
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('pause_playback');
    });
  });

  it('displays volume slider with correct value', () => {
    useStore.setState({ currentTrack: mockTrack, volume: 0.5 });

    render(<Player />);

    const volumeSlider = screen.getByLabelText('Volume');
    expect(volumeSlider).toHaveValue('0.5');
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('updates volume when slider is moved', async () => {
    useStore.setState({ currentTrack: mockTrack, volume: 0.5 });
    mockInvoke.mockResolvedValue(undefined);

    render(<Player />);

    const volumeSlider = screen.getByLabelText('Volume');
    fireEvent.change(volumeSlider, { target: { value: '0.75' } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.75 });
    });
  });

  it('displays correct progress percentage', () => {
    useStore.setState({
      currentTrack: mockTrack,
      position: 90, // 90 seconds out of 180 seconds = 50%
    });

    render(<Player />);

    const progressBar = screen.getByText('1:30');
    expect(progressBar).toBeInTheDocument();
  });

  it('calls playNextTrack when next button is clicked', () => {
    useStore.setState({ currentTrack: mockTrack });
    const playNextTrack = vi.spyOn(useStore.getState(), 'playNextTrack');

    render(<Player />);

    const nextButton = screen.getByTitle('Next track');
    fireEvent.click(nextButton);

    expect(playNextTrack).toHaveBeenCalled();
  });

  it('calls playPreviousTrack when previous button is clicked', () => {
    useStore.setState({ currentTrack: mockTrack });
    const playPreviousTrack = vi.spyOn(useStore.getState(), 'playPreviousTrack');

    render(<Player />);

    const prevButton = screen.getByTitle('Previous track');
    fireEvent.click(prevButton);

    expect(playPreviousTrack).toHaveBeenCalled();
  });

  it('toggles shuffle when shuffle button is clicked', () => {
    useStore.setState({ currentTrack: mockTrack, shuffleEnabled: false });
    const toggleShuffle = vi.spyOn(useStore.getState(), 'toggleShuffle');

    render(<Player />);

    const shuffleButton = screen.getByTitle('Shuffle: Off');
    fireEvent.click(shuffleButton);

    expect(toggleShuffle).toHaveBeenCalled();
  });

  it('cycles repeat mode when repeat button is clicked', () => {
    useStore.setState({ currentTrack: mockTrack, repeatMode: 'off' });
    const cycleRepeatMode = vi.spyOn(useStore.getState(), 'cycleRepeatMode');

    render(<Player />);

    const repeatButton = screen.getByTitle('Repeat: Off');
    fireEvent.click(repeatButton);

    expect(cycleRepeatMode).toHaveBeenCalled();
  });
});
