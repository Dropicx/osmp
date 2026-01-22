use crate::media_controls::{MediaControlsPlatform, MediaControlEvent, MediaMetadata, PlaybackState};
use mpris_server::{PlaybackStatus, Player, PlayerBuilder};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use zbus::Connection;

pub struct MprisControls {
    player: Arc<Mutex<Option<Player>>>,
    event_sender: mpsc::UnboundedSender<MediaControlEvent>,
    connection: Arc<Mutex<Option<Connection>>>,
}

impl MprisControls {
    pub fn new(event_sender: mpsc::UnboundedSender<MediaControlEvent>) -> Result<Self, Box<dyn std::error::Error>> {
        let player = Arc::new(Mutex::new(None));
        let connection = Arc::new(Mutex::new(None));
        
        // Create player on a separate thread since zbus requires async runtime
        let player_clone = Arc::clone(&player);
        let connection_clone = Arc::clone(&connection);
        let event_sender_clone = event_sender.clone();
        
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                match Self::setup_player(event_sender_clone).await {
                    Ok((p, conn)) => {
                        *player_clone.lock().unwrap() = Some(p);
                        *connection_clone.lock().unwrap() = Some(conn);
                    }
                    Err(e) => {
                        eprintln!("Failed to setup MPRIS player: {}", e);
                    }
                }
            });
        });

        Ok(MprisControls {
            player,
            event_sender,
            connection,
        })
    }

    async fn setup_player(
        event_sender: mpsc::UnboundedSender<MediaControlEvent>,
    ) -> Result<(Player, Connection), Box<dyn std::error::Error>> {
        let connection = Connection::session().await?;
        
        let player = PlayerBuilder::new("OSMP", 100)
            .can_raise(false)
            .can_quit(false)
            .can_set_fullscreen(false)
            .has_track_list(false)
            .build()
            .await?;

        // Set up event handlers
        let player_clone = player.clone();
        player.on_next(move || {
            let _ = event_sender.send(MediaControlEvent::Next);
        });

        let player_clone = player.clone();
        player.on_previous(move || {
            let _ = event_sender.send(MediaControlEvent::Previous);
        });

        let player_clone = player.clone();
        player.on_play_pause(move || {
            let _ = event_sender.send(MediaControlEvent::PlayPause);
        });

        let player_clone = player.clone();
        player.on_play(move || {
            let _ = event_sender.send(MediaControlEvent::Play);
        });

        let player_clone = player.clone();
        player.on_pause(move || {
            let _ = event_sender.send(MediaControlEvent::Pause);
        });

        let player_clone = player.clone();
        player.on_stop(move || {
            let _ = event_sender.send(MediaControlEvent::Stop);
        });

        player.set_playback_status(PlaybackStatus::Stopped).await?;
        player.set_can_play(true).await?;
        player.set_can_pause(true).await?;
        player.set_can_go_next(true).await?;
        player.set_can_go_previous(true).await?;
        player.set_can_seek(true).await?;

        // Register the player on D-Bus
        connection
            .object_server()
            .at("/org/mpris/MediaPlayer2", player.clone())
            .await?;

        Ok((player, connection))
    }
}

impl MediaControlsPlatform for MprisControls {
    fn update_metadata(&self, metadata: &MediaMetadata) -> Result<(), String> {
        let player_guard = self.player.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref player) = *player_guard {
            let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
            
            rt.block_on(async {
                let mut mpris_metadata = mpris_server::Metadata::empty();
                mpris_metadata.set_title(&metadata.title);
                mpris_metadata.set_artists(&[metadata.artist.clone()]);
                mpris_metadata.set_album(&metadata.album);
                mpris_metadata.set_length(metadata.duration as u64 * 1_000_000); // Convert to microseconds
                
                // Set artwork if available
                if let Some(ref artwork) = metadata.artwork {
                    // MPRIS expects artwork as a file:// URL or data URI
                    // For simplicity, we'll skip artwork for now or convert to base64
                    // mpris_metadata.set_art_url(&format!("data:image/jpeg;base64,{}", base64::encode(artwork)));
                }
                
                player.set_metadata(mpris_metadata).await
            }).map_err(|e| format!("Failed to update MPRIS metadata: {}", e))?;
        }
        Ok(())
    }

    fn update_playback_state(&self, state: PlaybackState) -> Result<(), String> {
        let player_guard = self.player.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref player) = *player_guard {
            let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
            
            rt.block_on(async {
                let playback_status = match state {
                    PlaybackState::Playing => PlaybackStatus::Playing,
                    PlaybackState::Paused => PlaybackStatus::Paused,
                    PlaybackState::Stopped => PlaybackStatus::Stopped,
                };
                player.set_playback_status(playback_status).await
            }).map_err(|e| format!("Failed to update MPRIS playback state: {}", e))?;
        }
        Ok(())
    }

    fn update_position(&self, position: f64) -> Result<(), String> {
        let player_guard = self.player.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref player) = *player_guard {
            let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
            
            rt.block_on(async {
                // MPRIS position is in microseconds
                let position_us = (position * 1_000_000.0) as i64;
                player.set_position(position_us).await
            }).map_err(|e| format!("Failed to update MPRIS position: {}", e))?;
        }
        Ok(())
    }

    fn set_available_actions(&self, can_go_next: bool, can_go_previous: bool) -> Result<(), String> {
        let player_guard = self.player.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(ref player) = *player_guard {
            let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
            
            rt.block_on(async {
                player.set_can_go_next(can_go_next).await?;
                player.set_can_go_previous(can_go_previous).await;
                Ok::<(), zbus::Error>(())
            }).map_err(|e| format!("Failed to update MPRIS actions: {}", e))?;
        }
        Ok(())
    }
}
