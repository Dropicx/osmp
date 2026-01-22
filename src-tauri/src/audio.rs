use rodio::{Decoder, OutputStream, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use anyhow::{Context, Result};

pub struct AudioPlayer {
    _stream: OutputStream,
    _stream_handle: rodio::OutputStreamHandle,
    sink: Arc<Mutex<Option<Sink>>>,
    current_file: Arc<Mutex<Option<String>>>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self> {
        let (_stream, stream_handle) = OutputStream::try_default()
            .context("Failed to create audio output stream")?;

        Ok(AudioPlayer {
            _stream,
            _stream_handle: stream_handle,
            sink: Arc::new(Mutex::new(None)),
            current_file: Arc::new(Mutex::new(None)),
        })
    }

    pub fn play_file(&self, file_path: &str) -> Result<()> {
        // Stop current playback
        self.stop();

        let file = File::open(file_path)
            .context(format!("Failed to open file: {}", file_path))?;
        let source = Decoder::new(BufReader::new(file))
            .context("Failed to decode audio file")?;

        let sink = Sink::try_new(&self._stream_handle)
            .context("Failed to create audio sink")?;
        
        sink.append(source);
        sink.play();

        *self.sink.lock().unwrap() = Some(sink);
        *self.current_file.lock().unwrap() = Some(file_path.to_string());

        Ok(())
    }

    pub fn pause(&self) {
        if let Some(sink) = self.sink.lock().unwrap().as_ref() {
            if sink.is_paused() {
                sink.play();
            } else {
                sink.pause();
            }
        }
    }

    pub fn stop(&self) {
        if let Some(sink) = self.sink.lock().unwrap().take() {
            sink.stop();
        }
        *self.current_file.lock().unwrap() = None;
    }

    pub fn set_volume(&self, volume: f32) {
        if let Some(sink) = self.sink.lock().unwrap().as_ref() {
            sink.set_volume(volume.clamp(0.0, 1.0));
        }
    }

    pub fn is_playing(&self) -> bool {
        if let Some(sink) = self.sink.lock().unwrap().as_ref() {
            !sink.is_paused() && sink.len() > 0
        } else {
            false
        }
    }

    pub fn get_current_file(&self) -> Option<String> {
        self.current_file.lock().unwrap().clone()
    }
}
