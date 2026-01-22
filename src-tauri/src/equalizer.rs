use rodio::source::SeekError;
use rodio::Source;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicU32, Ordering as AtomicOrdering};
use std::time::Duration;

/// Number of analysis bands for the visualizer
pub const VIS_BAND_COUNT: usize = 10;

/// Analysis band center frequencies (Hz)
const VIS_FREQUENCIES: [f32; VIS_BAND_COUNT] = [
    32.0, 64.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];

/// Shared visualizer band levels (stored as f32 bits in AtomicU32 for lock-free access)
static VIS_LEVELS: [AtomicU32; VIS_BAND_COUNT] = [
    AtomicU32::new(0), AtomicU32::new(0), AtomicU32::new(0), AtomicU32::new(0), AtomicU32::new(0),
    AtomicU32::new(0), AtomicU32::new(0), AtomicU32::new(0), AtomicU32::new(0), AtomicU32::new(0),
];

/// Read the current visualizer levels (called from the main/Tauri thread)
pub fn get_visualizer_levels() -> [f32; VIS_BAND_COUNT] {
    let mut levels = [0.0f32; VIS_BAND_COUNT];
    for (i, atomic) in VIS_LEVELS.iter().enumerate() {
        levels[i] = f32::from_bits(atomic.load(AtomicOrdering::Relaxed));
    }
    levels
}

/// Store a visualizer level (called from the audio thread)
fn set_visualizer_level(band: usize, value: f32) {
    VIS_LEVELS[band].store(value.to_bits(), AtomicOrdering::Relaxed);
}

/// 5-band parametric equalizer settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqualizerSettings {
    pub enabled: bool,
    pub preamp_db: f32,
    pub bands: [BandSettings; 5],
    pub preset_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandSettings {
    pub frequency: f32,
    pub gain_db: f32,
    pub q: f32,
    pub filter_type: FilterType,
    pub label: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FilterType {
    LowShelf,
    Peaking,
    HighShelf,
}

impl Default for EqualizerSettings {
    fn default() -> Self {
        EqualizerSettings {
            enabled: true,
            preamp_db: 0.0,
            bands: [
                BandSettings {
                    frequency: 60.0,
                    gain_db: 0.0,
                    q: 0.707,
                    filter_type: FilterType::LowShelf,
                    label: "60Hz".to_string(),
                },
                BandSettings {
                    frequency: 250.0,
                    gain_db: 0.0,
                    q: 1.0,
                    filter_type: FilterType::Peaking,
                    label: "250Hz".to_string(),
                },
                BandSettings {
                    frequency: 1000.0,
                    gain_db: 0.0,
                    q: 1.0,
                    filter_type: FilterType::Peaking,
                    label: "1kHz".to_string(),
                },
                BandSettings {
                    frequency: 4000.0,
                    gain_db: 0.0,
                    q: 1.0,
                    filter_type: FilterType::Peaking,
                    label: "4kHz".to_string(),
                },
                BandSettings {
                    frequency: 16000.0,
                    gain_db: 0.0,
                    q: 0.707,
                    filter_type: FilterType::HighShelf,
                    label: "16kHz".to_string(),
                },
            ],
            preset_name: "Flat".to_string(),
        }
    }
}

/// Preset definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqPreset {
    pub name: String,
    pub bands: [f32; 5],
    pub preamp: f32,
}

pub fn get_presets() -> Vec<EqPreset> {
    vec![
        EqPreset { name: "Flat".to_string(), bands: [0.0, 0.0, 0.0, 0.0, 0.0], preamp: 0.0 },
        EqPreset { name: "More Bass".to_string(), bands: [6.0, 4.0, 0.0, 0.0, 0.0], preamp: -2.0 },
        EqPreset { name: "Rock".to_string(), bands: [4.0, 2.0, -1.0, 3.0, 4.0], preamp: -1.0 },
        EqPreset { name: "Pop".to_string(), bands: [-1.0, 2.0, 4.0, 2.0, -1.0], preamp: 0.0 },
        EqPreset { name: "Jazz".to_string(), bands: [3.0, 1.0, -1.0, 2.0, 4.0], preamp: 0.0 },
        EqPreset { name: "Classical".to_string(), bands: [0.0, 0.0, 0.0, 2.0, 4.0], preamp: 0.0 },
        EqPreset { name: "R&B".to_string(), bands: [5.0, 3.0, -1.0, 2.0, 3.0], preamp: -1.0 },
        EqPreset { name: "Vocal Boost".to_string(), bands: [-2.0, 0.0, 4.0, 3.0, 1.0], preamp: 0.0 },
    ]
}

/// Biquad filter coefficients
#[derive(Debug, Clone, Copy)]
struct BiquadCoeffs {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
}

impl BiquadCoeffs {
    fn compute(band: &BandSettings, sample_rate: f32) -> Self {
        let freq = band.frequency as f64;
        let gain_db = band.gain_db as f64;
        let q = band.q as f64;
        let sr = sample_rate as f64;

        let a = 10.0_f64.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f64::consts::PI * freq / sr;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q);

        let (b0, b1, b2, a0, a1, a2) = match band.filter_type {
            FilterType::LowShelf => {
                let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;
                (
                    a * ((a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha),
                    2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0),
                    a * ((a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha),
                    (a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha,
                    -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0),
                    (a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha,
                )
            }
            FilterType::Peaking => {
                (
                    1.0 + alpha * a,
                    -2.0 * cos_w0,
                    1.0 - alpha * a,
                    1.0 + alpha / a,
                    -2.0 * cos_w0,
                    1.0 - alpha / a,
                )
            }
            FilterType::HighShelf => {
                let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;
                (
                    a * ((a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha),
                    -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0),
                    a * ((a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha),
                    (a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha,
                    2.0 * ((a - 1.0) - (a + 1.0) * cos_w0),
                    (a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha,
                )
            }
        };

        // Normalize by a0
        BiquadCoeffs {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
        }
    }

    fn identity() -> Self {
        BiquadCoeffs {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
        }
    }

    /// Compute bandpass filter coefficients for frequency analysis
    fn bandpass(freq: f32, q: f32, sample_rate: f32) -> Self {
        let w0 = 2.0 * std::f64::consts::PI * freq as f64 / sample_rate as f64;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q as f64);

        let b0 = alpha;
        let b1 = 0.0;
        let b2 = -alpha;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;

        BiquadCoeffs {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
        }
    }
}

/// Per-channel filter state for one biquad
#[derive(Debug, Clone, Copy, Default)]
struct BiquadState {
    x1: f64,
    x2: f64,
    y1: f64,
    y2: f64,
}

impl BiquadState {
    fn process(&mut self, coeffs: &BiquadCoeffs, input: f64) -> f64 {
        let output = coeffs.b0 * input + coeffs.b1 * self.x1 + coeffs.b2 * self.x2
            - coeffs.a1 * self.y1
            - coeffs.a2 * self.y2;

        self.x2 = self.x1;
        self.x1 = input;
        self.y2 = self.y1;
        self.y1 = output;

        output
    }
}

/// The equalizer source wrapper for rodio
pub struct EqualizerSource<S: Source<Item = f32>> {
    source: S,
    settings: Arc<RwLock<EqualizerSettings>>,
    coeffs: [BiquadCoeffs; 5],
    // Per-channel state for each band (support up to 2 channels)
    states: [[BiquadState; 5]; 2],
    channels: u16,
    sample_rate: u32,
    current_channel: u16,
    preamp_linear: f64,
    last_checked_version: u64,
    // Visualizer analysis
    vis_coeffs: [BiquadCoeffs; VIS_BAND_COUNT],
    vis_states: [[BiquadState; VIS_BAND_COUNT]; 2],
    vis_energy: [f64; VIS_BAND_COUNT],
    vis_sample_count: u32,
    vis_window_size: u32, // samples per analysis window
}

/// Atomic version counter for settings changes
static SETTINGS_VERSION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

pub fn bump_settings_version() {
    SETTINGS_VERSION.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
}

pub fn get_settings_version() -> u64 {
    SETTINGS_VERSION.load(std::sync::atomic::Ordering::Relaxed)
}

impl<S: Source<Item = f32>> EqualizerSource<S> {
    pub fn new(source: S, settings: Arc<RwLock<EqualizerSettings>>) -> Self {
        let channels = source.channels();
        let sample_rate = source.sample_rate();

        let coeffs = Self::compute_coefficients(&settings.read().unwrap(), sample_rate);
        let preamp_linear = Self::db_to_linear(settings.read().unwrap().preamp_db);
        let version = get_settings_version();

        // Compute bandpass filter coefficients for visualizer analysis
        // Q of 1.4 gives roughly 1-octave bandwidth per band
        let mut vis_coeffs = [BiquadCoeffs::identity(); VIS_BAND_COUNT];
        for (i, &freq) in VIS_FREQUENCIES.iter().enumerate() {
            // Clamp frequency to below Nyquist
            if freq < sample_rate as f32 / 2.0 {
                vis_coeffs[i] = BiquadCoeffs::bandpass(freq, 1.4, sample_rate as f32);
            }
        }

        // Analysis window: ~46ms at any sample rate (2048 samples at 44.1kHz)
        let vis_window_size = (sample_rate as f32 * 0.046) as u32;

        EqualizerSource {
            source,
            settings,
            coeffs,
            states: [[BiquadState::default(); 5]; 2],
            channels,
            sample_rate,
            current_channel: 0,
            preamp_linear,
            last_checked_version: version,
            vis_coeffs,
            vis_states: [[BiquadState::default(); VIS_BAND_COUNT]; 2],
            vis_energy: [0.0; VIS_BAND_COUNT],
            vis_sample_count: 0,
            vis_window_size,
        }
    }

    fn compute_coefficients(settings: &EqualizerSettings, sample_rate: u32) -> [BiquadCoeffs; 5] {
        let mut coeffs = [BiquadCoeffs::identity(); 5];
        if settings.enabled {
            for (i, band) in settings.bands.iter().enumerate() {
                if band.gain_db.abs() > 0.01 {
                    coeffs[i] = BiquadCoeffs::compute(band, sample_rate as f32);
                }
            }
        }
        coeffs
    }

    fn db_to_linear(db: f32) -> f64 {
        10.0_f64.powf(db as f64 / 20.0)
    }

    fn maybe_update_coefficients(&mut self) {
        let current_version = get_settings_version();
        if current_version != self.last_checked_version {
            self.last_checked_version = current_version;
            if let Ok(settings) = self.settings.read() {
                self.coeffs = Self::compute_coefficients(&settings, self.sample_rate);
                self.preamp_linear = Self::db_to_linear(settings.preamp_db);
                if !settings.enabled {
                    // Reset filter states when disabled
                    self.states = [[BiquadState::default(); 5]; 2];
                }
            }
        }
    }
}

impl<S: Source<Item = f32>> Iterator for EqualizerSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        // Check for settings updates periodically (every frame start)
        if self.current_channel == 0 {
            self.maybe_update_coefficients();
        }

        let sample = self.source.next()?;
        let ch = self.current_channel as usize;
        self.current_channel = (self.current_channel + 1) % self.channels;

        let channel_idx = ch.min(1);
        let input_value = sample as f64;

        // --- Visualizer analysis (runs on raw input, independent of EQ) ---
        // Only analyze left channel (or mono) to save CPU
        if ch == 0 {
            for (i, coeffs) in self.vis_coeffs.iter().enumerate() {
                let filtered = self.vis_states[channel_idx][i].process(coeffs, input_value);
                self.vis_energy[i] += filtered * filtered;
            }
            self.vis_sample_count += 1;

            // When we've accumulated enough samples, compute RMS and publish
            if self.vis_sample_count >= self.vis_window_size {
                let inv_count = 1.0 / self.vis_sample_count as f64;
                for i in 0..VIS_BAND_COUNT {
                    let rms = (self.vis_energy[i] * inv_count).sqrt();
                    // Scale to 0..1 range (RMS of bandpass output is typically small)
                    // Multiply by a gain factor to get useful visual range
                    let level = (rms * 8.0).min(1.0) as f32;
                    set_visualizer_level(i, level);
                    self.vis_energy[i] = 0.0;
                }
                self.vis_sample_count = 0;
            }
        }

        // --- EQ processing ---
        let settings_enabled = self.settings.read().map(|s| s.enabled).unwrap_or(false);
        if !settings_enabled {
            return Some(sample);
        }

        // Apply preamp
        let mut value = input_value * self.preamp_linear;

        // Apply each band's biquad filter in series
        for (i, coeffs) in self.coeffs.iter().enumerate() {
            value = self.states[channel_idx][i].process(coeffs, value);
        }

        // Soft clip to prevent harsh distortion
        let output = if value > 1.0 {
            1.0 - (-value + 1.0).exp() * 0.5
        } else if value < -1.0 {
            -1.0 + (value + 1.0).exp() * 0.5
        } else {
            value
        };

        Some(output as f32)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.source.size_hint()
    }
}

impl<S: Source<Item = f32>> Source for EqualizerSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
    }

    fn channels(&self) -> u16 {
        self.source.channels()
    }

    fn sample_rate(&self) -> u32 {
        self.source.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        // Forward seek to inner source
        self.source.try_seek(pos)?;

        // Reset EQ filter states to avoid artifacts after seeking
        self.states = [[BiquadState::default(); 5]; 2];
        self.current_channel = 0;

        // Reset visualizer analysis state
        self.vis_states = [[BiquadState::default(); VIS_BAND_COUNT]; 2];
        self.vis_energy = [0.0; VIS_BAND_COUNT];
        self.vis_sample_count = 0;

        Ok(())
    }
}
