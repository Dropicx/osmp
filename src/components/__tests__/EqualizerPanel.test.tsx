import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EqualizerPanel from '../EqualizerPanel';
import { useStore } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { mockEqSettings, mockEqPreset } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('EqualizerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
    useStore.setState({
      isEqPanelOpen: true,
      eqSettings: { ...mockEqSettings },
      eqPresets: [mockEqPreset, { name: 'Flat', bands: [0, 0, 0, 0, 0], preamp: 0 }],
    });
  });

  it('renders nothing when panel is closed', () => {
    useStore.setState({ isEqPanelOpen: false });
    const { container } = render(<EqualizerPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when eqSettings is null', () => {
    useStore.setState({ eqSettings: null });
    const { container } = render(<EqualizerPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders equalizer heading', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('Equalizer')).toBeInTheDocument();
  });

  it('shows enabled toggle', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable equalizer')).toBeChecked();
  });

  it('toggles enabled state', async () => {
    render(<EqualizerPanel />);
    fireEvent.click(screen.getByLabelText('Enable equalizer'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_enabled', { enabled: false });
    });
  });

  it('shows preset selector', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('Preset:')).toBeInTheDocument();
  });

  it('applies preset on change', async () => {
    render(<EqualizerPanel />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Rock' } });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_preset', { presetName: 'Rock' });
    });
  });

  it('shows preamp slider', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('Preamp')).toBeInTheDocument();
  });

  it('renders band sliders for all bands', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('60 Hz')).toBeInTheDocument();
    expect(screen.getByText('230 Hz')).toBeInTheDocument();
    expect(screen.getByText('910 Hz')).toBeInTheDocument();
    expect(screen.getByText('4 kHz')).toBeInTheDocument();
    expect(screen.getByText('14 kHz')).toBeInTheDocument();
  });

  it('shows dB scale labels', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('-12 dB')).toBeInTheDocument();
    expect(screen.getByText('+12 dB')).toBeInTheDocument();
  });

  it('shows Reset to Flat button', () => {
    render(<EqualizerPanel />);
    expect(screen.getByText('Reset to Flat')).toBeInTheDocument();
  });

  it('applies Flat preset on reset', async () => {
    render(<EqualizerPanel />);
    fireEvent.click(screen.getByText('Reset to Flat'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_preset', { presetName: 'Flat' });
    });
  });

  it('saves settings and closes on close button', async () => {
    render(<EqualizerPanel />);
    const closeButtons = screen.getAllByRole('button');
    // Close button is the X button near the header
    const closeButton = closeButtons.find((btn) => btn.querySelector('svg'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_eq_settings');
    });
  });

  it('saves settings and closes on backdrop click', async () => {
    render(<EqualizerPanel />);
    fireEvent.click(screen.getByRole('presentation'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_eq_settings');
    });
  });

  it('loads settings and presets when panel opens', async () => {
    useStore.setState({ isEqPanelOpen: false, eqSettings: mockEqSettings });
    render(<EqualizerPanel />);

    // Open panel
    useStore.setState({ isEqPanelOpen: true });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_eq_settings');
      expect(mockInvoke).toHaveBeenCalledWith('get_eq_presets');
    });
  });

  it('shows Custom option when preset is Custom', () => {
    useStore.setState({
      eqSettings: { ...mockEqSettings, preset_name: 'Custom' },
    });
    render(<EqualizerPanel />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
