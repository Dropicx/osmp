use crate::equalizer::{bump_settings_version, EqualizerSettings, EqualizerSource};
use anyhow::{Context, Result};
use rodio::{Decoder, OutputStreamBuilder, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;
use std::time::Instant;
use tracing::{error, info};

// Commands sent to the audio thread
pub enum AudioCommand {
    Play(String),
    Pause,
    Stop,
    SetVolume(f32),
    Seek(f64), // Seek to position in seconds
    SetSpeed(f32),
    PreloadNext(String),
    SetEqBand {
        band: usize,
        gain_db: f32,
    },
    SetEqEnabled(bool),
    SetEqPreset {
        bands: [f32; 5],
        preamp: f32,
        name: String,
    },
    SetEqPreamp(f32),
}

// Shared state that can be read from any thread
pub struct AudioState {
    is_playing: AtomicBool,
    is_paused: AtomicBool,
    position_ms: AtomicU64,
    pub eq_settings: Arc<RwLock<EqualizerSettings>>,
}

impl AudioState {
    pub fn new(eq_settings: Arc<RwLock<EqualizerSettings>>) -> Self {
        AudioState {
            is_playing: AtomicBool::new(false),
            is_paused: AtomicBool::new(false),
            position_ms: AtomicU64::new(0),
            eq_settings,
        }
    }

    pub fn get_position(&self) -> f64 {
        self.position_ms.load(Ordering::Relaxed) as f64 / 1000.0
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Relaxed) && !self.is_paused.load(Ordering::Relaxed)
    }
}

// The audio controller that can be sent across threads
pub struct AudioController {
    sender: Sender<AudioCommand>,
    pub state: Arc<AudioState>,
}

impl AudioController {
    pub fn new(eq_settings: Arc<RwLock<EqualizerSettings>>) -> Result<Self> {
        let (sender, receiver) = channel::<AudioCommand>();
        let state = Arc::new(AudioState::new(Arc::clone(&eq_settings)));
        let thread_state = Arc::clone(&state);
        let thread_eq_settings = Arc::clone(&eq_settings);

        // Spawn the audio thread
        thread::spawn(move || {
            // Create output stream in the audio thread (rodio 0.21 API)
            let stream = match OutputStreamBuilder::open_default_stream() {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to create audio output: {}", e);
                    return;
                }
            };
            let mixer = stream.mixer();

            let mut current_sink: Option<Sink> = None;
            let mut playback_start: Option<Instant> = None;
            let mut paused_position_ms: u64 = 0;
            let mut current_volume: f32 = 1.0;
            let mut current_speed: f32 = 1.0;
            let mut preloaded_path: Option<String> = None;

            loop {
                // Check for commands with timeout so we can update position regularly
                match receiver.recv_timeout(Duration::from_millis(100)) {
                    Ok(cmd) => {
                        match cmd {
                            AudioCommand::Play(file_path) => {
                                // Stop current playback
                                if let Some(sink) = current_sink.take() {
                                    sink.stop();
                                }

                                // Stream audio with 256KB buffered reader to prevent micro-lags
                                match File::open(&file_path)
                                    .map(|f| BufReader::with_capacity(256 * 1024, f))
                                {
                                    Ok(reader) => {
                                        match Decoder::new(reader) {
                                            Ok(source) => {
                                                let sink = Sink::connect_new(mixer);
                                                sink.set_volume(current_volume);
                                                sink.set_speed(current_speed);
                                                // Wrap source with EQ
                                                let eq_source = EqualizerSource::new(
                                                    source,
                                                    Arc::clone(&thread_eq_settings),
                                                );
                                                sink.append(eq_source);
                                                sink.play();

                                                current_sink = Some(sink);
                                                playback_start = Some(Instant::now());
                                                paused_position_ms = 0;
                                                preloaded_path = None;

                                                thread_state
                                                    .is_playing
                                                    .store(true, Ordering::Relaxed);
                                                thread_state
                                                    .is_paused
                                                    .store(false, Ordering::Relaxed);
                                                thread_state
                                                    .position_ms
                                                    .store(0, Ordering::Relaxed);
                                            }
                                            Err(e) => error!("Failed to decode audio: {}", e),
                                        }
                                    }
                                    Err(e) => error!("Failed to open file: {}", e),
                                }
                            }

                            AudioCommand::Pause => {
                                if let Some(ref sink) = current_sink {
                                    if sink.is_paused() {
                                        // Resume
                                        playback_start = Some(Instant::now());
                                        sink.play();
                                        thread_state.is_paused.store(false, Ordering::Relaxed);
                                    } else {
                                        // Pause
                                        if let Some(start) = playback_start {
                                            paused_position_ms +=
                                                start.elapsed().as_millis() as u64;
                                        }
                                        sink.pause();
                                        thread_state.is_paused.store(true, Ordering::Relaxed);
                                    }
                                }
                            }

                            AudioCommand::Stop => {
                                if let Some(sink) = current_sink.take() {
                                    sink.stop();
                                }
                                playback_start = None;
                                paused_position_ms = 0;
                                thread_state.is_playing.store(false, Ordering::Relaxed);
                                thread_state.is_paused.store(false, Ordering::Relaxed);
                                thread_state.position_ms.store(0, Ordering::Relaxed);
                            }

                            AudioCommand::SetVolume(volume) => {
                                current_volume = volume.clamp(0.0, 1.0);
                                if let Some(ref sink) = current_sink {
                                    sink.set_volume(current_volume);
                                }
                            }

                            AudioCommand::Seek(position_secs) => {
                                if let Some(ref sink) = current_sink {
                                    let seek_duration = Duration::from_secs_f64(position_secs);
                                    let _ = sink.try_seek(seek_duration);

                                    paused_position_ms = (position_secs * 1000.0) as u64;
                                    playback_start = Some(Instant::now());
                                    thread_state
                                        .position_ms
                                        .store(paused_position_ms, Ordering::Relaxed);
                                }
                            }

                            AudioCommand::SetSpeed(speed) => {
                                current_speed = speed.clamp(0.25, 4.0);
                                if let Some(ref sink) = current_sink {
                                    sink.set_speed(current_speed);
                                }
                            }

                            AudioCommand::PreloadNext(file_path) => {
                                // Store the path for gapless transition
                                preloaded_path = Some(file_path);
                                info!("Preloaded next track for gapless playback");
                            }

                            AudioCommand::SetEqBand { band, gain_db } => {
                                if let Ok(mut settings) = thread_eq_settings.write() {
                                    if band < 5 {
                                        settings.bands[band].gain_db = gain_db.clamp(-12.0, 12.0);
                                        settings.preset_name = "Custom".to_string();
                                    }
                                }
                                bump_settings_version();
                            }

                            AudioCommand::SetEqEnabled(enabled) => {
                                if let Ok(mut settings) = thread_eq_settings.write() {
                                    settings.enabled = enabled;
                                }
                                bump_settings_version();
                            }

                            AudioCommand::SetEqPreset {
                                bands,
                                preamp,
                                name,
                            } => {
                                if let Ok(mut settings) = thread_eq_settings.write() {
                                    for (i, &gain) in bands.iter().enumerate() {
                                        if i < 5 {
                                            settings.bands[i].gain_db = gain;
                                        }
                                    }
                                    settings.preamp_db = preamp;
                                    settings.preset_name = name;
                                }
                                bump_settings_version();
                            }

                            AudioCommand::SetEqPreamp(preamp_db) => {
                                if let Ok(mut settings) = thread_eq_settings.write() {
                                    settings.preamp_db = preamp_db.clamp(-12.0, 12.0);
                                }
                                bump_settings_version();
                            }
                        }
                    }
                    Err(RecvTimeoutError::Timeout) => {
                        // No command received, just continue to update position
                    }
                    Err(RecvTimeoutError::Disconnected) => {
                        // Channel closed, exit thread
                        break;
                    }
                }

                // Update position
                if thread_state.is_playing.load(Ordering::Relaxed)
                    && !thread_state.is_paused.load(Ordering::Relaxed)
                {
                    if let Some(start) = playback_start {
                        let current_pos = paused_position_ms + start.elapsed().as_millis() as u64;
                        thread_state
                            .position_ms
                            .store(current_pos, Ordering::Relaxed);
                    }
                }

                // Check if playback finished - handle gapless transition
                if let Some(ref sink) = current_sink {
                    if sink.empty()
                        && !sink.is_paused()
                        && thread_state.is_playing.load(Ordering::Relaxed)
                    {
                        if let Some(next_path) = preloaded_path.take() {
                            // Gapless: immediately start preloaded track
                            match File::open(&next_path)
                                .map(|f| BufReader::with_capacity(256 * 1024, f))
                            {
                                Ok(reader) => {
                                    if let Ok(source) = Decoder::new(reader) {
                                        let eq_source = EqualizerSource::new(
                                            source,
                                            Arc::clone(&thread_eq_settings),
                                        );
                                        sink.append(eq_source);
                                        playback_start = Some(Instant::now());
                                        paused_position_ms = 0;
                                        thread_state.position_ms.store(0, Ordering::Relaxed);
                                        info!("Gapless transition to next track");
                                    } else {
                                        thread_state.is_playing.store(false, Ordering::Relaxed);
                                    }
                                }
                                Err(_) => {
                                    thread_state.is_playing.store(false, Ordering::Relaxed);
                                }
                            }
                        } else {
                            thread_state.is_playing.store(false, Ordering::Relaxed);
                        }
                    }
                }
            }
        });

        Ok(AudioController { sender, state })
    }

    pub fn play_file(&self, file_path: &str) -> Result<()> {
        self.sender
            .send(AudioCommand::Play(file_path.to_string()))
            .context("Failed to send play command")?;
        Ok(())
    }

    pub fn pause(&self) {
        let _ = self.sender.send(AudioCommand::Pause);
    }

    pub fn stop(&self) {
        let _ = self.sender.send(AudioCommand::Stop);
    }

    pub fn set_volume(&self, volume: f32) {
        let _ = self.sender.send(AudioCommand::SetVolume(volume));
    }

    pub fn get_position(&self) -> f64 {
        self.state.get_position()
    }

    pub fn seek(&self, position_secs: f64) {
        let _ = self.sender.send(AudioCommand::Seek(position_secs));
    }

    pub fn set_speed(&self, speed: f32) {
        let _ = self.sender.send(AudioCommand::SetSpeed(speed));
    }

    pub fn preload_next(&self, file_path: &str) {
        let _ = self
            .sender
            .send(AudioCommand::PreloadNext(file_path.to_string()));
    }

    pub fn set_eq_band(&self, band: usize, gain_db: f32) {
        let _ = self.sender.send(AudioCommand::SetEqBand { band, gain_db });
    }

    pub fn set_eq_enabled(&self, enabled: bool) {
        let _ = self.sender.send(AudioCommand::SetEqEnabled(enabled));
    }

    pub fn set_eq_preset(&self, bands: [f32; 5], preamp: f32, name: String) {
        let _ = self.sender.send(AudioCommand::SetEqPreset {
            bands,
            preamp,
            name,
        });
    }

    pub fn set_eq_preamp(&self, preamp_db: f32) {
        let _ = self.sender.send(AudioCommand::SetEqPreamp(preamp_db));
    }

    pub fn get_eq_settings(&self) -> EqualizerSettings {
        self.state
            .eq_settings
            .read()
            .map(|s| s.clone())
            .unwrap_or_default()
    }
}
