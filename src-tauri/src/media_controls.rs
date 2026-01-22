use tokio::sync::mpsc;

// Unified media control events that can be sent from platform-specific implementations
#[derive(Debug, Clone)]
pub enum MediaControlEvent {
    Play,
    Pause,
    PlayPause,
    Next,
    Previous,
    Seek(f64), // Position in seconds
    Stop,
}

// Metadata for the current track
#[derive(Debug, Clone)]
pub struct MediaMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub artwork: Option<Vec<u8>>, // Raw image data
    pub duration: f64, // Duration in seconds
}

// Playback state
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PlaybackState {
    Playing,
    Paused,
    Stopped,
}

// Trait for platform-specific media control implementations
pub trait MediaControlsPlatform: Send + Sync {
    fn update_metadata(&self, metadata: &MediaMetadata) -> Result<(), String>;
    fn update_playback_state(&self, state: PlaybackState) -> Result<(), String>;
    fn update_position(&self, position: f64) -> Result<(), String>;
    fn set_available_actions(&self, can_go_next: bool, can_go_previous: bool) -> Result<(), String>;
}

// Main media controls manager
pub struct MediaControlsManager {
    platform: Box<dyn MediaControlsPlatform>,
    event_sender: mpsc::UnboundedSender<MediaControlEvent>,
}

impl MediaControlsManager {
    pub fn new() -> Result<(Self, mpsc::UnboundedReceiver<MediaControlEvent>), String> {
        let (sender, receiver) = mpsc::unbounded_channel();

        #[cfg(target_os = "linux")]
        let platform: Box<dyn MediaControlsPlatform> = Box::new(
            crate::media_controls_mpris::MprisControls::new(sender.clone()).map_err(|e| format!("Failed to initialize MPRIS: {}", e))?
        );

        #[cfg(target_os = "macos")]
        let platform: Box<dyn MediaControlsPlatform> = Box::new(
            crate::media_controls_macos::MacOSControls::new(sender.clone()).map_err(|e| format!("Failed to initialize macOS controls: {}", e))?
        );

        #[cfg(target_os = "windows")]
        let platform: Box<dyn MediaControlsPlatform> = Box::new(
            crate::media_controls_windows::WindowsControls::new(sender.clone()).map_err(|e| format!("Failed to initialize Windows controls: {}", e))?
        );

        #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
        {
            return Err("Media controls not supported on this platform".to_string());
        }

        Ok((
            MediaControlsManager {
                platform,
                event_sender: sender,
            },
            receiver,
        ))
    }

    pub fn update_metadata(&self, metadata: &MediaMetadata) -> Result<(), String> {
        self.platform.update_metadata(metadata)
    }

    pub fn update_playback_state(&self, state: PlaybackState) -> Result<(), String> {
        self.platform.update_playback_state(state)
    }

    pub fn update_position(&self, position: f64) -> Result<(), String> {
        self.platform.update_position(position)
    }

    pub fn set_available_actions(&self, can_go_next: bool, can_go_previous: bool) -> Result<(), String> {
        self.platform.set_available_actions(can_go_next, can_go_previous)
    }

    pub fn get_event_sender(&self) -> mpsc::UnboundedSender<MediaControlEvent> {
        self.event_sender.clone()
    }
}

// Default implementation for unsupported platforms
#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
struct DummyPlatform;

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
impl MediaControlsPlatform for DummyPlatform {
    fn update_metadata(&self, _metadata: &MediaMetadata) -> Result<(), String> {
        Ok(())
    }

    fn update_playback_state(&self, _state: PlaybackState) -> Result<(), String> {
        Ok(())
    }

    fn update_position(&self, _position: f64) -> Result<(), String> {
        Ok(())
    }

    fn set_available_actions(&self, _can_go_next: bool, _can_go_previous: bool) -> Result<(), String> {
        Ok(())
    }
}
