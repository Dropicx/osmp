use crate::media_controls::{MediaControlsPlatform, MediaControlEvent, MediaMetadata, PlaybackState};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use windows::{
    core::*,
    Media::SystemMediaTransportControls,
    Media::MediaPlaybackStatus,
    Foundation::*,
};

pub struct WindowsControls {
    smtc: Arc<Mutex<Option<SystemMediaTransportControls>>>,
    event_sender: mpsc::UnboundedSender<MediaControlEvent>,
}

impl WindowsControls {
    pub fn new(event_sender: mpsc::UnboundedSender<MediaControlEvent>) -> Result<Self, Box<dyn std::error::Error>> {
        let smtc = Arc::new(Mutex::new(None));
        
        // Get SMTC on a separate thread since it requires COM initialization
        let smtc_clone = Arc::clone(&smtc);
        let event_sender_clone = event_sender.clone();
        
        std::thread::spawn(move || {
            unsafe {
                match SystemMediaTransportControls::GetForCurrentView() {
                    Ok(controls) => {
                        // Set up button handlers
                        let play_handler = TypedEventHandler::new(move |_sender, _args| {
                            let _ = event_sender_clone.send(MediaControlEvent::Play);
                            Ok(())
                        });
                        
                        let pause_handler = TypedEventHandler::new({
                            let event_sender = event_sender_clone.clone();
                            move |_sender, _args| {
                                let _ = event_sender.send(MediaControlEvent::Pause);
                                Ok(())
                            }
                        });
                        
                        let next_handler = TypedEventHandler::new({
                            let event_sender = event_sender_clone.clone();
                            move |_sender, _args| {
                                let _ = event_sender.send(MediaControlEvent::Next);
                                Ok(())
                            }
                        });
                        
                        let previous_handler = TypedEventHandler::new({
                            let event_sender = event_sender_clone.clone();
                            move |_sender, _args| {
                                let _ = event_sender.send(MediaControlEvent::Previous);
                                Ok(())
                            }
                        });
                        
                        let stop_handler = TypedEventHandler::new({
                            let event_sender = event_sender_clone.clone();
                            move |_sender, _args| {
                                let _ = event_sender.send(MediaControlEvent::Stop);
                                Ok(())
                            }
                        });
                        
                        // Register button pressed handlers
                        let _ = controls.ButtonPressed(&play_handler);
                        let _ = controls.ButtonPressed(&pause_handler);
                        let _ = controls.ButtonPressed(&next_handler);
                        let _ = controls.ButtonPressed(&previous_handler);
                        let _ = controls.ButtonPressed(&stop_handler);
                        
                        // Enable buttons
                        let _ = controls.SetIsEnabled(true);
                        let _ = controls.SetIsPlayEnabled(true);
                        let _ = controls.SetIsPauseEnabled(true);
                        let _ = controls.SetIsNextEnabled(true);
                        let _ = controls.SetIsPreviousEnabled(true);
                        let _ = controls.SetIsStopEnabled(true);
                        
                        *smtc_clone.lock().unwrap() = Some(controls);
                    }
                    Err(e) => {
                        eprintln!("Failed to get SystemMediaTransportControls: {:?}", e);
                    }
                }
            }
        });

        Ok(WindowsControls {
            smtc,
            event_sender,
        })
    }
}

impl MediaControlsPlatform for WindowsControls {
    fn update_metadata(&self, metadata: &MediaMetadata) -> Result<(), String> {
        let smtc_guard = self.smtc.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref controls) = *smtc_guard {
            unsafe {
                // Create display updater
                let updater = controls.GetDisplayUpdater().map_err(|e| format!("Windows error: {:?}", e))?;
                
                // Set media type to Music
                updater.SetType(1).map_err(|e| format!("Windows error: {:?}", e))?; // MediaPlaybackType::Music = 1
                
                // Get music properties
                let music_props = updater.MusicProperties().map_err(|e| format!("Windows error: {:?}", e))?;
                
                // Set title
                if !metadata.title.is_empty() {
                    let title = HString::from(&metadata.title);
                    music_props.SetTitle(&title).map_err(|e| format!("Windows error: {:?}", e))?;
                }
                
                // Set artist
                if !metadata.artist.is_empty() {
                    let artist = HString::from(&metadata.artist);
                    music_props.SetArtist(&artist).map_err(|e| format!("Windows error: {:?}", e))?;
                }
                
                // Set album
                if !metadata.album.is_empty() {
                    let album = HString::from(&metadata.album);
                    music_props.SetAlbumTitle(&album).map_err(|e| format!("Windows error: {:?}", e))?;
                }
                
                // Update the display
                updater.Update().map_err(|e| format!("Windows error: {:?}", e))?;
            }
        }
        Ok(())
    }

    fn update_playback_state(&self, state: PlaybackState) -> Result<(), String> {
        let smtc_guard = self.smtc.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref controls) = *smtc_guard {
            unsafe {
                let playback_status = match state {
                    PlaybackState::Playing => MediaPlaybackStatus::Playing,
                    PlaybackState::Paused => MediaPlaybackStatus::Paused,
                    PlaybackState::Stopped => MediaPlaybackStatus::Stopped,
                };
                controls.SetPlaybackStatus(playback_status).map_err(|e| format!("Windows error: {:?}", e))?;
            }
        }
        Ok(())
    }

    fn update_position(&self, position: f64) -> Result<(), String> {
        // Windows SMTC doesn't have a direct position update method
        // Position is typically managed through timeline properties
        // For now, we'll skip this as it requires more complex timeline management
        Ok(())
    }

    fn set_available_actions(&self, can_go_next: bool, can_go_previous: bool) -> Result<(), String> {
        let smtc_guard = self.smtc.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref controls) = *smtc_guard {
            unsafe {
                controls.SetIsNextEnabled(can_go_next).map_err(|e| format!("Windows error: {:?}", e))?;
                controls.SetIsPreviousEnabled(can_go_previous).map_err(|e| format!("Windows error: {:?}", e))?;
            }
        }
        Ok(())
    }
}
