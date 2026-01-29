import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LibraryContextMenu from '../Library/LibraryContextMenu';

const defaultProps = {
  position: { left: 100, top: 200 },
  selectedCount: 1,
  fetchingMetadata: false,
  fetchingCovers: false,
  onPlay: vi.fn(),
  onAddToQueue: vi.fn(),
  onAddNextToQueue: vi.fn(),
  onEditMetadata: vi.fn(),
  onFetchMetadata: vi.fn(),
  onFetchCovers: vi.fn(),
  onAddToPlaylist: vi.fn(),
  onDelete: vi.fn(),
};

describe('LibraryContextMenu', () => {
  it('renders all menu items', () => {
    render(<LibraryContextMenu {...defaultProps} />);

    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('Add to Queue')).toBeInTheDocument();
    expect(screen.getByText('Add Next to Queue')).toBeInTheDocument();
    expect(screen.getByText('Edit Metadata')).toBeInTheDocument();
    expect(screen.getByText('Fetch Metadata')).toBeInTheDocument();
    expect(screen.getByText('Fetch Covers')).toBeInTheDocument();
    expect(screen.getByText('Add to Playlist')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onPlay when Play is clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Play'));
    expect(defaultProps.onPlay).toHaveBeenCalled();
  });

  it('calls onAddToQueue when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Add to Queue'));
    expect(defaultProps.onAddToQueue).toHaveBeenCalled();
  });

  it('calls onAddNextToQueue when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Next to Queue'));
    expect(defaultProps.onAddNextToQueue).toHaveBeenCalled();
  });

  it('calls onEditMetadata when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit Metadata'));
    expect(defaultProps.onEditMetadata).toHaveBeenCalled();
  });

  it('calls onFetchMetadata when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Fetch Metadata'));
    expect(defaultProps.onFetchMetadata).toHaveBeenCalled();
  });

  it('calls onFetchCovers when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Fetch Covers'));
    expect(defaultProps.onFetchCovers).toHaveBeenCalled();
  });

  it('calls onAddToPlaylist when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Add to Playlist'));
    expect(defaultProps.onAddToPlaylist).toHaveBeenCalled();
  });

  it('calls onDelete when clicked', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalled();
  });

  it('shows count badge for multiple selections', () => {
    render(<LibraryContextMenu {...defaultProps} selectedCount={5} />);
    // Each menu item that shows count should have (5)
    const badges = screen.getAllByText('(5)');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('does not show count badge for single selection', () => {
    render(<LibraryContextMenu {...defaultProps} selectedCount={1} />);
    expect(screen.queryByText('(1)')).not.toBeInTheDocument();
  });

  it('disables fetch metadata when fetching', () => {
    render(<LibraryContextMenu {...defaultProps} fetchingMetadata={true} />);
    expect(screen.getByText('Fetching...')).toBeInTheDocument();
  });

  it('disables fetch covers when fetching', () => {
    render(<LibraryContextMenu {...defaultProps} fetchingCovers={true} />);
    const buttons = screen.getAllByText('Fetching...');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('positions at correct coordinates', () => {
    const { container } = render(<LibraryContextMenu {...defaultProps} />);
    const menu = container.querySelector('[role="menu"]');
    expect(menu).toHaveStyle({ left: '100px', top: '200px' });
  });

  it('stops click propagation', () => {
    const outerClick = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={outerClick}>
        <LibraryContextMenu {...defaultProps} />
      </div>
    );
    fireEvent.click(screen.getByRole('menu'));
    expect(outerClick).not.toHaveBeenCalled();
  });

  it('has correct aria-label', () => {
    render(<LibraryContextMenu {...defaultProps} />);
    expect(screen.getByLabelText('Track context menu')).toBeInTheDocument();
  });
});
