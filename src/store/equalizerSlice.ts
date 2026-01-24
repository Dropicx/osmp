import { StateCreator } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { EqualizerSettings, EqPreset } from '../types';
import type { AppState, EqualizerSlice } from './types';

export const createEqualizerSlice: StateCreator<AppState, [], [], EqualizerSlice> = (set, get) => ({
  eqSettings: null,
  eqPresets: [],
  isEqPanelOpen: false,
  visualizerEnabled: localStorage.getItem('visualizerEnabled') !== 'false',
  visualizerOpacity: Number(localStorage.getItem('visualizerOpacity')) || 80,

  loadEqSettings: async () => {
    try {
      const settings = await invoke<EqualizerSettings>('get_eq_settings');
      set({ eqSettings: settings });
    } catch {
      /* silently handled */
    }
  },

  loadEqPresets: async () => {
    try {
      const presets = await invoke<EqPreset[]>('get_eq_presets');
      set({ eqPresets: presets });
    } catch {
      /* silently handled */
    }
  },

  setEqBand: async (band: number, gainDb: number) => {
    try {
      await invoke('set_eq_band', { band, gainDb });
      const { eqSettings } = get();
      if (eqSettings) {
        const newBands = [...eqSettings.bands];
        newBands[band] = { ...newBands[band], gain_db: gainDb };
        set({ eqSettings: { ...eqSettings, bands: newBands, preset_name: 'Custom' } });
      }
    } catch {
      /* silently handled */
    }
  },

  setEqEnabled: async (enabled: boolean) => {
    try {
      await invoke('set_eq_enabled', { enabled });
      const { eqSettings } = get();
      if (eqSettings) {
        set({ eqSettings: { ...eqSettings, enabled } });
      }
    } catch {
      /* silently handled */
    }
  },

  setEqPreamp: async (preampDb: number) => {
    try {
      await invoke('set_eq_preamp', { preampDb });
      const { eqSettings } = get();
      if (eqSettings) {
        set({ eqSettings: { ...eqSettings, preamp_db: preampDb } });
      }
    } catch {
      /* silently handled */
    }
  },

  applyEqPreset: async (presetName: string) => {
    try {
      await invoke('set_eq_preset', { presetName });
      await get().loadEqSettings();
    } catch {
      /* silently handled */
    }
  },

  saveEqSettings: async () => {
    try {
      await invoke('save_eq_settings');
    } catch {
      /* silently handled */
    }
  },

  toggleEqPanel: () => {
    set((state) => ({ isEqPanelOpen: !state.isEqPanelOpen }));
  },

  setVisualizerEnabled: (enabled: boolean) => {
    localStorage.setItem('visualizerEnabled', String(enabled));
    set({ visualizerEnabled: enabled });
  },

  setVisualizerOpacity: (opacity: number) => {
    localStorage.setItem('visualizerOpacity', String(opacity));
    set({ visualizerOpacity: opacity });
  },
});
