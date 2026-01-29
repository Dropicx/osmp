use crate::media_controls::{
    MediaControlEvent, MediaControlsPlatform, MediaMetadata, PlaybackState,
};
use mpris_server::{Metadata, PlaybackStatus, Player, Time};
use std::sync::Mutex;
use tokio::sync::mpsc;

enum MprisCommand {
    UpdateMetadata(MediaMetadata),
    UpdatePlaybackState(PlaybackState),
    UpdatePosition(f64),
    SetAvailableActions(bool, bool),
}

pub struct MprisControls {
    command_sender: Mutex<mpsc::UnboundedSender<MprisCommand>>,
}

impl MprisControls {
    pub fn new(
        event_sender: mpsc::UnboundedSender<MediaControlEvent>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<MprisCommand>();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            let local = tokio::task::LocalSet::new();
            local.block_on(&rt, async move {
                if let Err(e) = Self::run_player(event_sender, cmd_rx).await {
                    eprintln!("Failed to run MPRIS player: {}", e);
                }
            });
        });

        Ok(MprisControls {
            command_sender: Mutex::new(cmd_tx),
        })
    }

    async fn run_player(
        event_sender: mpsc::UnboundedSender<MediaControlEvent>,
        mut cmd_rx: mpsc::UnboundedReceiver<MprisCommand>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let player = Player::builder("OSMP")
            .can_play(true)
            .can_pause(true)
            .can_go_next(true)
            .can_go_previous(true)
            .can_seek(true)
            .build()
            .await?;

        let es = event_sender.clone();
        player.connect_next(move |_| {
            let _ = es.send(MediaControlEvent::Next);
        });

        let es = event_sender.clone();
        player.connect_previous(move |_| {
            let _ = es.send(MediaControlEvent::Previous);
        });

        let es = event_sender.clone();
        player.connect_play_pause(move |_| {
            let _ = es.send(MediaControlEvent::PlayPause);
        });

        let es = event_sender.clone();
        player.connect_play(move |_| {
            let _ = es.send(MediaControlEvent::Play);
        });

        let es = event_sender.clone();
        player.connect_pause(move |_| {
            let _ = es.send(MediaControlEvent::Pause);
        });

        let es = event_sender;
        player.connect_stop(move |_| {
            let _ = es.send(MediaControlEvent::Stop);
        });

        // Start the D-Bus server for handling incoming MPRIS requests
        tokio::task::spawn_local(player.run());

        // Process commands from the main thread
        while let Some(cmd) = cmd_rx.recv().await {
            match cmd {
                MprisCommand::UpdateMetadata(meta) => {
                    let mpris_meta = Metadata::builder()
                        .title(meta.title)
                        .artist([meta.artist])
                        .album(meta.album)
                        .length(Time::from_micros((meta.duration * 1_000_000.0) as i64))
                        .build();
                    if let Err(e) = player.set_metadata(mpris_meta).await {
                        eprintln!("Failed to set MPRIS metadata: {}", e);
                    }
                }
                MprisCommand::UpdatePlaybackState(state) => {
                    let status = match state {
                        PlaybackState::Playing => PlaybackStatus::Playing,
                        PlaybackState::Paused => PlaybackStatus::Paused,
                        PlaybackState::Stopped => PlaybackStatus::Stopped,
                    };
                    if let Err(e) = player.set_playback_status(status).await {
                        eprintln!("Failed to set MPRIS playback status: {}", e);
                    }
                }
                MprisCommand::UpdatePosition(position) => {
                    player.set_position(Time::from_micros((position * 1_000_000.0) as i64));
                }
                MprisCommand::SetAvailableActions(next, prev) => {
                    if let Err(e) = player.set_can_go_next(next).await {
                        eprintln!("Failed to set MPRIS can_go_next: {}", e);
                    }
                    if let Err(e) = player.set_can_go_previous(prev).await {
                        eprintln!("Failed to set MPRIS can_go_previous: {}", e);
                    }
                }
            }
        }

        Ok(())
    }
}

impl MediaControlsPlatform for MprisControls {
    fn update_metadata(&self, metadata: &MediaMetadata) -> Result<(), String> {
        let sender = self
            .command_sender
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        sender
            .send(MprisCommand::UpdateMetadata(metadata.clone()))
            .map_err(|e| format!("Failed to send metadata command: {}", e))
    }

    fn update_playback_state(&self, state: PlaybackState) -> Result<(), String> {
        let sender = self
            .command_sender
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        sender
            .send(MprisCommand::UpdatePlaybackState(state))
            .map_err(|e| format!("Failed to send playback state command: {}", e))
    }

    fn update_position(&self, position: f64) -> Result<(), String> {
        let sender = self
            .command_sender
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        sender
            .send(MprisCommand::UpdatePosition(position))
            .map_err(|e| format!("Failed to send position command: {}", e))
    }

    fn set_available_actions(
        &self,
        can_go_next: bool,
        can_go_previous: bool,
    ) -> Result<(), String> {
        let sender = self
            .command_sender
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        sender
            .send(MprisCommand::SetAvailableActions(
                can_go_next,
                can_go_previous,
            ))
            .map_err(|e| format!("Failed to send actions command: {}", e))
    }
}
