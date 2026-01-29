import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateBanner from '../UpdateBanner';

// Mock the useAutoUpdate hook
const mockUseAutoUpdate = vi.fn();
vi.mock('../../hooks/useAutoUpdate', () => ({
  useAutoUpdate: () => mockUseAutoUpdate(),
}));

describe('UpdateBanner', () => {
  const baseState = {
    status: 'idle' as const,
    version: null,
    progress: 0,
    error: null,
    dismissed: false,
    checkForUpdate: vi.fn(),
    downloadAndInstall: vi.fn(),
    restartApp: vi.fn(),
    dismiss: vi.fn(),
  };

  it('renders nothing when idle', () => {
    mockUseAutoUpdate.mockReturnValue({ ...baseState, status: 'idle' });
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when checking', () => {
    mockUseAutoUpdate.mockReturnValue({ ...baseState, status: 'checking' });
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when error', () => {
    mockUseAutoUpdate.mockReturnValue({ ...baseState, status: 'error' });
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when dismissed', () => {
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'available',
      dismissed: true,
    });
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows update available with version', () => {
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'available',
      version: '2.0.0',
    });

    render(<UpdateBanner />);

    expect(screen.getByText('Update available:')).toBeInTheDocument();
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('calls downloadAndInstall when Update clicked', () => {
    const downloadAndInstall = vi.fn();
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'available',
      version: '2.0.0',
      downloadAndInstall,
    });

    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('Update'));

    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it('calls dismiss when X clicked', () => {
    const dismiss = vi.fn();
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'available',
      version: '2.0.0',
      dismiss,
    });

    render(<UpdateBanner />);
    fireEvent.click(screen.getByTitle('Dismiss'));

    expect(dismiss).toHaveBeenCalled();
  });

  it('shows download progress', () => {
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'downloading',
      progress: 45,
    });

    render(<UpdateBanner />);

    expect(screen.getByText('Downloading update... 45%')).toBeInTheDocument();
  });

  it('shows ready state with restart button', () => {
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'ready',
      version: '2.0.0',
    });

    render(<UpdateBanner />);

    expect(screen.getByText(/Update ready/)).toBeInTheDocument();
    expect(screen.getByText('Restart')).toBeInTheDocument();
  });

  it('calls restartApp when Restart clicked', () => {
    const restartApp = vi.fn();
    mockUseAutoUpdate.mockReturnValue({
      ...baseState,
      status: 'ready',
      version: '2.0.0',
      restartApp,
    });

    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('Restart'));

    expect(restartApp).toHaveBeenCalled();
  });
});
