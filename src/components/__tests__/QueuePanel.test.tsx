import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueuePanel from '../QueuePanel';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockTrack, mockTrack2 } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock @dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

const mockInvoke = vi.mocked(invoke);

describe('QueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    useStore.setState({
      isQueuePanelOpen: true,
      queue: [],
      currentTrack: null,
    });
  });

  it('renders nothing when panel is closed', () => {
    useStore.setState({ isQueuePanelOpen: false });
    const { container } = render(<QueuePanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Queue heading', () => {
    render(<QueuePanel />);
    expect(screen.getByText('Queue')).toBeInTheDocument();
  });

  it('shows empty state when queue is empty', () => {
    render(<QueuePanel />);
    expect(screen.getByText('Queue is empty')).toBeInTheDocument();
    expect(screen.getByText('Add tracks to see them here')).toBeInTheDocument();
  });

  it('shows queue items', () => {
    useStore.setState({
      queue: [
        { queueId: 1, track: mockTrack },
        { queueId: 2, track: mockTrack2 },
      ],
    });

    render(<QueuePanel />);

    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Second Song')).toBeInTheDocument();
  });

  it('shows track count', () => {
    useStore.setState({
      queue: [{ queueId: 1, track: mockTrack }],
    });

    render(<QueuePanel />);

    expect(screen.getByText('1 track')).toBeInTheDocument();
  });

  it('pluralizes track count', () => {
    useStore.setState({
      queue: [
        { queueId: 1, track: mockTrack },
        { queueId: 2, track: mockTrack2 },
      ],
    });

    render(<QueuePanel />);

    expect(screen.getByText('2 tracks')).toBeInTheDocument();
  });

  it('shows current track with Now Playing badge', () => {
    useStore.setState({ currentTrack: mockTrack });

    render(<QueuePanel />);

    expect(screen.getByText('Now Playing')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
  });

  it('shows Clear button when queue has items', () => {
    useStore.setState({
      queue: [{ queueId: 1, track: mockTrack }],
    });

    render(<QueuePanel />);

    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('clears queue when Clear is clicked', () => {
    useStore.setState({
      queue: [{ queueId: 1, track: mockTrack }],
    });

    render(<QueuePanel />);
    fireEvent.click(screen.getByText('Clear'));

    expect(useStore.getState().queue).toHaveLength(0);
  });

  it('does not show Clear button for empty queue', () => {
    render(<QueuePanel />);
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('closes panel when close button clicked', () => {
    render(<QueuePanel />);
    fireEvent.click(screen.getByTitle('Close queue'));
    expect(useStore.getState().isQueuePanelOpen).toBe(false);
  });

  it('closes panel when backdrop is clicked', () => {
    render(<QueuePanel />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(useStore.getState().isQueuePanelOpen).toBe(false);
  });

  it('shows Unknown Title for tracks without title', () => {
    useStore.setState({
      queue: [{ queueId: 1, track: { ...mockTrack, title: null } }],
    });

    render(<QueuePanel />);

    expect(screen.getByText('Unknown Title')).toBeInTheDocument();
  });

  it('shows Unknown Artist for tracks without artist', () => {
    useStore.setState({
      queue: [{ queueId: 1, track: { ...mockTrack, artist: null } }],
    });

    render(<QueuePanel />);

    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
  });

  it('formats duration correctly', () => {
    useStore.setState({
      queue: [{ queueId: 1, track: { ...mockTrack, duration: 185 } }],
    });

    render(<QueuePanel />);

    expect(screen.getByText('3:05')).toBeInTheDocument();
  });
});
