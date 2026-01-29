import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../index';
import { invoke } from '@tauri-apps/api/core';
import { mockEqSettings, mockEqPreset } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);

describe('equalizerSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      eqSettings: null,
      eqPresets: [],
      isEqPanelOpen: false,
    });
  });

  it('loadEqSettings fetches and sets settings', async () => {
    mockInvoke.mockResolvedValue(mockEqSettings);

    await useStore.getState().loadEqSettings();

    expect(mockInvoke).toHaveBeenCalledWith('get_eq_settings');
    expect(useStore.getState().eqSettings).toEqual(mockEqSettings);
  });

  it('loadEqSettings handles errors silently', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    await useStore.getState().loadEqSettings();

    expect(useStore.getState().eqSettings).toBeNull();
  });

  it('loadEqPresets fetches and sets presets', async () => {
    const presets = [mockEqPreset];
    mockInvoke.mockResolvedValue(presets);

    await useStore.getState().loadEqPresets();

    expect(mockInvoke).toHaveBeenCalledWith('get_eq_presets');
    expect(useStore.getState().eqPresets).toEqual(presets);
  });

  it('loadEqPresets handles errors silently', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    await useStore.getState().loadEqPresets();

    expect(useStore.getState().eqPresets).toEqual([]);
  });

  it('setEqBand updates band gain and sets preset to Custom', async () => {
    useStore.setState({ eqSettings: { ...mockEqSettings } });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().setEqBand(0, 5.0);

    expect(mockInvoke).toHaveBeenCalledWith('set_eq_band', { band: 0, gainDb: 5.0 });
    const settings = useStore.getState().eqSettings!;
    expect(settings.bands[0].gain_db).toBe(5.0);
    expect(settings.preset_name).toBe('Custom');
  });

  it('setEqBand handles errors silently', async () => {
    useStore.setState({ eqSettings: { ...mockEqSettings } });
    mockInvoke.mockRejectedValue(new Error('fail'));

    await useStore.getState().setEqBand(0, 5.0);

    // Settings should be unchanged
    expect(useStore.getState().eqSettings!.bands[0].gain_db).toBe(0);
  });

  it('setEqEnabled toggles enabled state', async () => {
    useStore.setState({ eqSettings: { ...mockEqSettings, enabled: false } });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().setEqEnabled(true);

    expect(mockInvoke).toHaveBeenCalledWith('set_eq_enabled', { enabled: true });
    expect(useStore.getState().eqSettings!.enabled).toBe(true);
  });

  it('setEqPreamp updates preamp_db', async () => {
    useStore.setState({ eqSettings: { ...mockEqSettings } });
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().setEqPreamp(3.5);

    expect(mockInvoke).toHaveBeenCalledWith('set_eq_preamp', { preampDb: 3.5 });
    expect(useStore.getState().eqSettings!.preamp_db).toBe(3.5);
  });

  it('applyEqPreset invokes and reloads settings', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // set_eq_preset
    mockInvoke.mockResolvedValueOnce(mockEqSettings); // get_eq_settings (loadEqSettings)

    await useStore.getState().applyEqPreset('Rock');

    expect(mockInvoke).toHaveBeenCalledWith('set_eq_preset', { presetName: 'Rock' });
    expect(mockInvoke).toHaveBeenCalledWith('get_eq_settings');
  });

  it('saveEqSettings invokes save', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await useStore.getState().saveEqSettings();

    expect(mockInvoke).toHaveBeenCalledWith('save_eq_settings');
  });

  it('toggleEqPanel flips isEqPanelOpen', () => {
    expect(useStore.getState().isEqPanelOpen).toBe(false);

    useStore.getState().toggleEqPanel();
    expect(useStore.getState().isEqPanelOpen).toBe(true);

    useStore.getState().toggleEqPanel();
    expect(useStore.getState().isEqPanelOpen).toBe(false);
  });

  it('setVisualizerEnabled updates state and localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    useStore.getState().setVisualizerEnabled(false);

    expect(useStore.getState().visualizerEnabled).toBe(false);
    expect(spy).toHaveBeenCalledWith('visualizerEnabled', 'false');
    spy.mockRestore();
  });

  it('setVisualizerOpacity updates state and localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    useStore.getState().setVisualizerOpacity(50);

    expect(useStore.getState().visualizerOpacity).toBe(50);
    expect(spy).toHaveBeenCalledWith('visualizerOpacity', '50');
    spy.mockRestore();
  });
});
