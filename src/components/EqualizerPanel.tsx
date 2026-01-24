import { useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function EqualizerPanel() {
  const {
    eqSettings,
    eqPresets,
    isEqPanelOpen,
    loadEqSettings,
    loadEqPresets,
    setEqBand,
    setEqEnabled,
    setEqPreamp,
    applyEqPreset,
    saveEqSettings,
    toggleEqPanel,
  } = useStore();

  useEffect(() => {
    if (isEqPanelOpen) {
      loadEqSettings();
      loadEqPresets();
    }
  }, [isEqPanelOpen, loadEqSettings, loadEqPresets]);

  const handleClose = useCallback(() => {
    saveEqSettings();
    toggleEqPanel();
  }, [saveEqSettings, toggleEqPanel]);

  const handleReset = useCallback(() => {
    applyEqPreset('Flat');
  }, [applyEqPreset]);

  const handleBandChange = useCallback(
    (band: number, value: number) => {
      setEqBand(band, value);
    },
    [setEqBand]
  );

  const handlePreampChange = useCallback(
    (value: number) => {
      setEqPreamp(value);
    },
    [setEqPreamp]
  );

  if (!isEqPanelOpen || !eqSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Panel */}
      <div className="relative bg-bg-elevated rounded-2xl shadow-2xl border border-bg-surface w-[520px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-surface">
          <h2 className="text-lg font-semibold text-text-primary">Equalizer</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-bg-card text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-bg-surface">
          {/* Enable Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm text-text-secondary">Enabled</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={eqSettings.enabled}
                onChange={(e) => setEqEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </label>

          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Preset:</span>
            <select
              value={eqSettings.preset_name}
              onChange={(e) => applyEqPreset(e.target.value)}
              className="bg-bg-card border border-bg-surface rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {eqPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
              {eqSettings.preset_name === 'Custom' && <option value="Custom">Custom</option>}
            </select>
          </div>
        </div>

        {/* Preamp */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-bg-surface">
          <span className="text-sm text-text-secondary w-16">Preamp</span>
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={eqSettings.preamp_db}
            onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-bg-card rounded-full appearance-none cursor-pointer accent-primary-500
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-md"
          />
          <span className="text-xs text-text-tertiary w-12 text-right">
            {eqSettings.preamp_db > 0 ? '+' : ''}
            {eqSettings.preamp_db.toFixed(1)} dB
          </span>
        </div>

        {/* Band Sliders */}
        <div className="px-6 py-5">
          <div className="flex justify-between items-end gap-2">
            {eqSettings.bands.map((band, index) => (
              <div key={index} className="flex flex-col items-center gap-2 flex-1">
                {/* Gain value */}
                <span className="text-xs text-text-tertiary h-4">
                  {band.gain_db > 0 ? '+' : ''}
                  {band.gain_db.toFixed(0)}
                </span>

                {/* Vertical slider container */}
                <div className="relative h-40 flex items-center justify-center">
                  {/* Track background */}
                  <div className="absolute w-1 h-full bg-bg-card rounded-full" />
                  {/* Center line */}
                  <div className="absolute w-3 h-px bg-bg-surface top-1/2" />

                  {/* Range input (rotated) */}
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={band.gain_db}
                    onChange={(e) => handleBandChange(index, parseFloat(e.target.value))}
                    className="absolute w-40 appearance-none bg-transparent cursor-pointer
                      [transform:rotate(-90deg)]
                      [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full
                      [&::-webkit-slider-runnable-track]:bg-bg-card
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500
                      [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:mt-[-6px]"
                  />
                </div>

                {/* Frequency label */}
                <span className="text-xs text-text-secondary">{band.label}</span>
              </div>
            ))}
          </div>

          {/* dB scale labels */}
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[10px] text-text-tertiary">-12 dB</span>
            <span className="text-[10px] text-text-tertiary">+12 dB</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center px-6 py-4 border-t border-bg-surface">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card hover:bg-bg-surface
              text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            <RotateCcw size={14} />
            Reset to Flat
          </button>
        </div>
      </div>
    </div>
  );
}
