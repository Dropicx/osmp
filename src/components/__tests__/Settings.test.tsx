import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../Settings';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';

import { open } from '@tauri-apps/plugin-dialog';
import { mockScanFolder, mockScanResult } from '../../test/fixtures';
import { DEFAULT_COLUMN_VISIBILITY } from '../../constants';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock app and updater
vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.2.5'),
}));

const mockCheck = vi.fn();
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    mockCheck.mockResolvedValue(null);
    useStore.setState({
      visualizerEnabled: true,
      visualizerOpacity: 80,
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
    });
    // Default: return empty folders and default scan settings
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_scan_folders') return [];
      if (cmd === 'get_scan_settings')
        return {
          scan_on_startup: true,
          periodic_scan_enabled: true,
          periodic_scan_interval_minutes: 30,
        };
      return undefined;
    });
  });

  it('renders Settings heading', async () => {
    render(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders Scan Folders section', () => {
    render(<Settings />);
    expect(screen.getByText('Scan Folders')).toBeInTheDocument();
  });

  it('shows Add Folder button', () => {
    render(<Settings />);
    expect(screen.getByText('Add Folder')).toBeInTheDocument();
  });

  it('shows empty folders message', () => {
    render(<Settings />);
    expect(screen.getByText('No scan folders configured')).toBeInTheDocument();
  });

  it('shows Scan Now button', () => {
    render(<Settings />);
    expect(screen.getByText('Scan Now')).toBeInTheDocument();
  });

  it('disables Scan Now when no folders', () => {
    render(<Settings />);
    const scanBtn = screen.getByText('Scan Now').closest('button');
    expect(scanBtn).toBeDisabled();
  });

  it('opens file dialog on Add Folder click', async () => {
    mockOpen.mockResolvedValue('/music');

    render(<Settings />);
    fireEvent.click(screen.getByText('Add Folder'));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          directory: true,
        })
      );
    });
  });

  it('adds folder after selection', async () => {
    mockOpen.mockResolvedValue('/new/music');
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_scan_folders') return [mockScanFolder];
      if (cmd === 'get_scan_settings')
        return {
          scan_on_startup: true,
          periodic_scan_enabled: true,
          periodic_scan_interval_minutes: 30,
        };
      return undefined;
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Add Folder'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_scan_folder', { path: '/new/music' });
    });
  });

  it('displays scan folders', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_scan_folders') return [mockScanFolder];
      if (cmd === 'get_scan_settings')
        return {
          scan_on_startup: true,
          periodic_scan_enabled: true,
          periodic_scan_interval_minutes: 30,
        };
      return undefined;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('/home/user/Music')).toBeInTheDocument();
    });
  });

  it('removes folder on delete click', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_scan_folders') return [mockScanFolder];
      if (cmd === 'get_scan_settings')
        return {
          scan_on_startup: true,
          periodic_scan_enabled: true,
          periodic_scan_interval_minutes: 30,
        };
      return undefined;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('/home/user/Music')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Remove folder'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('remove_scan_folder', { id: 1 });
    });
  });

  it('starts scan on Scan Now click', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_scan_folders') return [mockScanFolder];
      if (cmd === 'get_scan_settings')
        return {
          scan_on_startup: true,
          periodic_scan_enabled: true,
          periodic_scan_interval_minutes: 30,
        };
      if (cmd === 'scan_folders') return mockScanResult;
      return undefined;
    });

    render(<Settings />);

    await waitFor(() => {
      const scanBtn = screen.getByText('Scan Now').closest('button');
      expect(scanBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Scan Now'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('scan_folders');
    });
  });

  it('shows scan result after scan completes', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_scan_folders') return [mockScanFolder];
      if (cmd === 'get_scan_settings')
        return {
          scan_on_startup: true,
          periodic_scan_enabled: true,
          periodic_scan_interval_minutes: 30,
        };
      if (cmd === 'scan_folders') return mockScanResult;
      return undefined;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Scan Now').closest('button')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Scan Now'));

    await waitFor(() => {
      expect(screen.getByText('Scan complete')).toBeInTheDocument();
    });
  });

  describe('Automatic Scanning section', () => {
    it('shows automatic scanning section', () => {
      render(<Settings />);
      expect(screen.getByText('Automatic Scanning')).toBeInTheDocument();
    });

    it('shows scan on startup toggle', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Scan on startup')).toBeInTheDocument();
    });

    it('shows periodic scan toggle', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Periodic scan')).toBeInTheDocument();
    });
  });

  describe('Appearance section', () => {
    it('shows Appearance heading', () => {
      render(<Settings />);
      expect(screen.getByText('Appearance')).toBeInTheDocument();
    });

    it('shows visualizer toggle', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Audio Visualizer')).toBeInTheDocument();
    });

    it('toggles visualizer', () => {
      render(<Settings />);
      fireEvent.click(screen.getByLabelText('Audio Visualizer'));
      expect(useStore.getState().visualizerEnabled).toBe(false);
    });

    it('shows opacity slider when visualizer enabled', () => {
      render(<Settings />);
      expect(screen.getByText('Visualizer Opacity')).toBeInTheDocument();
    });

    it('hides opacity slider when visualizer disabled', () => {
      useStore.setState({ visualizerEnabled: false });
      render(<Settings />);
      expect(screen.queryByText('Visualizer Opacity')).not.toBeInTheDocument();
    });
  });

  describe('Table Columns section', () => {
    it('shows Table Columns heading', () => {
      render(<Settings />);
      expect(screen.getByText('Table Columns')).toBeInTheDocument();
    });

    it('shows column toggles', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Toggle Title column')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Artist column')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Album column')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Genre column')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Duration column')).toBeInTheDocument();
    });

    it('Title toggle is disabled', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Toggle Title column')).toBeDisabled();
    });

    it('shows Reset Column Widths button', () => {
      render(<Settings />);
      expect(screen.getByText('Reset Column Widths')).toBeInTheDocument();
    });

    it('resets column widths on click', () => {
      const spy = vi.spyOn(useStore.getState(), 'resetColumnWidths');
      render(<Settings />);
      fireEvent.click(screen.getByText('Reset Column Widths'));
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Metadata section', () => {
    it('shows Metadata heading', () => {
      render(<Settings />);
      expect(screen.getByRole('heading', { name: 'Metadata' })).toBeInTheDocument();
    });

    it('shows auto-fetch toggle', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Auto-fetch metadata')).toBeInTheDocument();
    });
  });

  describe('Support section', () => {
    it('shows Support OSMP heading', () => {
      render(<Settings />);
      expect(screen.getByText('Support OSMP')).toBeInTheDocument();
    });

    it('has Ko-fi link', () => {
      render(<Settings />);
      const link = screen.getByText('Support on Ko-fi').closest('a');
      expect(link).toHaveAttribute('href', 'https://ko-fi.com/la7');
    });
  });

  describe('Guide section', () => {
    it('shows Guide heading', () => {
      render(<Settings />);
      expect(screen.getByText('Guide')).toBeInTheDocument();
    });

    it('shows expandable sections', () => {
      render(<Settings />);
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('Playback')).toBeInTheDocument();
      expect(screen.getAllByText('Metadata').length).toBeGreaterThan(0);
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('expands Getting Started on click', async () => {
      render(<Settings />);
      fireEvent.click(screen.getByText('Getting Started'));

      await waitFor(() => {
        expect(screen.getByText(/1\. Add folders/)).toBeInTheDocument();
      });
    });

    it('expands Keyboard Shortcuts on click', async () => {
      render(<Settings />);
      fireEvent.click(screen.getByText('Keyboard Shortcuts'));

      await waitFor(() => {
        expect(screen.getByText('Play / Pause')).toBeInTheDocument();
      });
    });

    it('toggles guide sections open and closed', async () => {
      render(<Settings />);

      fireEvent.click(screen.getByText('Getting Started'));
      expect(screen.getByText(/1\. Add folders/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Getting Started'));
      await waitFor(() => {
        expect(screen.queryByText(/1\. Add folders/)).not.toBeInTheDocument();
      });
    });
  });

  describe('About section', () => {
    it('shows About heading', () => {
      render(<Settings />);
      expect(screen.getByText('About')).toBeInTheDocument();
    });

    it('shows version', async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText('0.2.5')).toBeInTheDocument();
      });
    });

    it('shows Check for Updates button', () => {
      render(<Settings />);
      expect(screen.getByText('Check for Updates')).toBeInTheDocument();
    });

    it('checks for updates on button click', async () => {
      mockCheck.mockResolvedValue(null);
      render(<Settings />);
      fireEvent.click(screen.getByText('Check for Updates'));

      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalled();
      });
    });

    it('shows no update available message', async () => {
      mockCheck.mockResolvedValue(null);
      render(<Settings />);
      fireEvent.click(screen.getByText('Check for Updates'));

      await waitFor(() => {
        expect(screen.getByText("You're on the latest version.")).toBeInTheDocument();
      });
    });

    it('shows update available with version', async () => {
      mockCheck.mockResolvedValue({ version: '1.0.0' });
      render(<Settings />);
      fireEvent.click(screen.getByText('Check for Updates'));

      await waitFor(() => {
        expect(screen.getByText('Update available: v1.0.0')).toBeInTheDocument();
      });
    });

    it('handles update check error for platform mismatch', async () => {
      mockCheck.mockRejectedValue(new Error('No matching platform'));
      render(<Settings />);
      fireEvent.click(screen.getByText('Check for Updates'));

      await waitFor(() => {
        expect(screen.getByText("You're on the latest version.")).toBeInTheDocument();
      });
    });

    it('shows error message for other update check errors', async () => {
      mockCheck.mockRejectedValue(new Error('Network error'));
      render(<Settings />);
      fireEvent.click(screen.getByText('Check for Updates'));

      await waitFor(() => {
        expect(screen.getByText('Could not check for updates.')).toBeInTheDocument();
      });
    });

    it('shows built with info', () => {
      render(<Settings />);
      expect(screen.getByText(/Tauri, React, Rust/)).toBeInTheDocument();
    });
  });

  describe('Error list in scan results', () => {
    it('shows error toggle when scan has errors', async () => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_scan_folders') return [mockScanFolder];
        if (cmd === 'get_scan_settings')
          return {
            scan_on_startup: true,
            periodic_scan_enabled: true,
            periodic_scan_interval_minutes: 30,
          };
        if (cmd === 'scan_folders') return mockScanResult;
        return undefined;
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Scan Now').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Scan Now'));

      await waitFor(() => {
        expect(screen.getByText('Show errors')).toBeInTheDocument();
      });
    });

    it('toggles error list visibility', async () => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_scan_folders') return [mockScanFolder];
        if (cmd === 'get_scan_settings')
          return {
            scan_on_startup: true,
            periodic_scan_enabled: true,
            periodic_scan_interval_minutes: 30,
          };
        if (cmd === 'scan_folders') return mockScanResult;
        return undefined;
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Scan Now').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Scan Now'));

      await waitFor(() => {
        expect(screen.getByText('Show errors')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Show errors'));

      await waitFor(() => {
        expect(screen.getByText('Hide errors')).toBeInTheDocument();
      });
    });
  });
});
