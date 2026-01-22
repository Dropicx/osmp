use rodio::{Decoder, OutputStreamBuilder, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{channel, Sender, RecvTimeoutError};
use std::time::Duration;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Instant;
use anyhow::{Context, Result};

// Commands sent to the audio thread
pub enum AudioCommand {
    Play(String),
    Pause,
    Stop,
    SetVolume(f32),
    Seek(f64), // Seek to position in seconds
}

// Shared state that can be read from any thread
pub struct AudioState {
    is_playing: AtomicBool,
    is_paused: AtomicBool,
    position_ms: AtomicU64,
}

impl AudioState {
    pub fn new() -> Self {
        AudioState {
            is_playing: AtomicBool::new(false),
            is_paused: AtomicBool::new(false),
            position_ms: AtomicU64::new(0),
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
    pub fn new() -> Result<Self> {
        let (sender, receiver) = channel::<AudioCommand>();
        let state = Arc::new(AudioState::new());
        let thread_state = Arc::clone(&state);

        // Spawn the audio thread
        thread::spawn(move || {
            // Create output stream in the audio thread (rodio 0.21 API)
            let stream = match OutputStreamBuilder::open_default_stream() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to create audio output: {}", e);
                    return;
                }
            };
            let mixer = stream.mixer();

            let mut current_sink: Option<Sink> = None;
            let mut playback_start: Option<Instant> = None;
            let mut paused_position_ms: u64 = 0;
            let mut current_volume: f32 = 1.0;

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

                                // Open and decode the file
                                match File::open(&file_path) {
                                    Ok(file) => {
                                        match Decoder::new(BufReader::new(file)) {
                                            Ok(source) => {
                                                let sink = Sink::connect_new(&mixer);
                                                sink.set_volume(current_volume);
                                                sink.append(source);
                                                sink.play();

                                                current_sink = Some(sink);
                                                playback_start = Some(Instant::now());
                                                paused_position_ms = 0;

                                                thread_state.is_playing.store(true, Ordering::Relaxed);
                                                thread_state.is_paused.store(false, Ordering::Relaxed);
                                                thread_state.position_ms.store(0, Ordering::Relaxed);
                                            }
                                            Err(e) => eprintln!("Failed to decode audio: {}", e),
                                        }
                                    }
                                    Err(e) => eprintln!("Failed to open file: {}", e),
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
                                            paused_position_ms += start.elapsed().as_millis() as u64;
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
                                    // try_seek is fast native seeking
                                    let _ = sink.try_seek(seek_duration);

                                    // Update position tracking
                                    paused_position_ms = (position_secs * 1000.0) as u64;
                                    playback_start = Some(Instant::now());
                                    thread_state.position_ms.store(paused_position_ms, Ordering::Relaxed);
                                }
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
                if thread_state.is_playing.load(Ordering::Relaxed) && !thread_state.is_paused.load(Ordering::Relaxed) {
                    if let Some(start) = playback_start {
                        let current_pos = paused_position_ms + start.elapsed().as_millis() as u64;
                        thread_state.position_ms.store(current_pos, Ordering::Relaxed);
                    }
                }

                // Check if playback finished
                if let Some(ref sink) = current_sink {
                    if sink.empty() && !sink.is_paused() {
                        thread_state.is_playing.store(false, Ordering::Relaxed);
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
}
