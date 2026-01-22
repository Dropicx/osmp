mod models;
mod database;
mod scanner;
mod metadata;
mod audio;
mod commands;
mod media_controls;
mod equalizer;

#[cfg(target_os = "linux")]
mod media_controls_mpris;
#[cfg(target_os = "macos")]
#[allow(unused_imports)]
mod media_controls_macos;
#[cfg(target_os = "windows")]
mod media_controls_windows;

use commands::*;
use audio::AudioController;
use database::{Database, DatabaseInner};
use media_controls::{MediaControlsManager, MediaControlEvent, PlaybackState};
use std::sync::{Arc, Mutex, RwLock};
use std::sync::atomic::AtomicBool;
use std::time::Instant;
use tokio::sync::mpsc;
use tauri::Emitter;

pub struct AppState {
    pub db: Database,
    pub audio: Arc<AudioController>,
    pub scan_cancelled: Arc<AtomicBool>,
    pub media_controls: Option<Arc<MediaControlsManager>>,
    pub media_control_event_sender: Option<mpsc::UnboundedSender<media_controls::MediaControlEvent>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database once at startup
    let db = Arc::new(Mutex::new(
        DatabaseInner::new().expect("Failed to initialize database")
    ));

    // Load EQ settings from database, or use defaults
    let eq_settings = {
        let mut db_lock = db.lock().unwrap();
        db_lock.load_eq_settings()
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let eq_settings = Arc::new(RwLock::new(eq_settings));

    // Initialize audio controller once at startup
    let audio = Arc::new(AudioController::new(Arc::clone(&eq_settings)).expect("Failed to initialize audio"));

    // Initialize scan cancellation flag
    let scan_cancelled = Arc::new(AtomicBool::new(false));

    // Initialize media controls (may fail on unsupported platforms, that's OK)
    let (media_controls, media_control_receiver) = match MediaControlsManager::new() {
        Ok((manager, receiver)) => {
            (Some(Arc::new(manager)), Some(receiver))
        }
        Err(e) => {
            eprintln!("Media controls not available: {}", e);
            (None, None)
        }
    };

    let media_control_event_sender = media_controls.as_ref().map(|mc| mc.get_event_sender());

    // Clone references for the event handler
    let audio_for_events = Arc::clone(&audio);
    let media_controls_for_events = media_controls.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // Set up media control event handler
            if let Some(mut receiver) = media_control_receiver {
                let app_handle = app.handle().clone();
                let audio = audio_for_events;
                let mc = media_controls_for_events;
                tauri::async_runtime::spawn(async move {
                    let mut last_toggle = Instant::now() - std::time::Duration::from_secs(1);
                    while let Some(event) = receiver.recv().await {
                        eprintln!("[MediaControls] Received event: {:?}", event);
                        match event {
                            MediaControlEvent::Play | MediaControlEvent::Pause | MediaControlEvent::PlayPause => {
                                // Debounce: ignore events within 300ms of last toggle
                                let now = Instant::now();
                                if now.duration_since(last_toggle) < std::time::Duration::from_millis(300) {
                                    eprintln!("[MediaControls] Debounced, skipping");
                                    continue;
                                }

                                let was_playing = audio.state.is_playing();

                                // Play: only if not playing; Pause: only if playing; PlayPause: always toggle
                                let should_toggle = match event {
                                    MediaControlEvent::Play => !was_playing,
                                    MediaControlEvent::Pause => was_playing,
                                    MediaControlEvent::PlayPause => true,
                                    _ => false,
                                };

                                if should_toggle {
                                    last_toggle = now;
                                    audio.pause();
                                    let new_is_playing = !was_playing;

                                    // Update macOS media controls state
                                    if let Some(ref mc) = mc {
                                        let state = if new_is_playing {
                                            PlaybackState::Playing
                                        } else {
                                            PlaybackState::Paused
                                        };
                                        let _ = mc.update_playback_state(state);
                                        let position = audio.get_position();
                                        let _ = mc.update_position(position);
                                    }

                                    // Emit authoritative state to frontend
                                    let _ = app_handle.emit("playback-state-changed", new_is_playing);
                                    eprintln!("[MediaControls] Toggled: new_is_playing={}", new_is_playing);
                                }
                            }
                            MediaControlEvent::Next => {
                                let _ = app_handle.emit("media-control-next", ());
                            }
                            MediaControlEvent::Previous => {
                                let _ = app_handle.emit("media-control-previous", ());
                            }
                            MediaControlEvent::Seek(pos) => {
                                let _ = app_handle.emit("media-control-seek", pos);
                            }
                            MediaControlEvent::Stop => {
                                let _ = app_handle.emit("media-control-stop", ());
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .manage(AppState { 
            db, 
            audio, 
            scan_cancelled,
            media_controls,
            media_control_event_sender,
        })
        .invoke_handler(tauri::generate_handler![
            get_scan_folders,
            add_scan_folder,
            remove_scan_folder,
            scan_folders,
            cancel_scan,
            get_tracks,
            search_tracks,
            fetch_metadata,
            fetch_covers,
            play_track,
            pause_playback,
            stop_playback,
            set_volume,
            get_playback_position,
            seek_to_position,
            delete_track,
            delete_tracks,
            get_track_cover,
            get_albums,
            get_album_tracks,
            get_album_cover,
            play_album,
            update_track_metadata_manual,
            write_metadata_to_file,
            create_playlist,
            delete_playlist,
            rename_playlist,
            get_playlists,
            get_playlist,
            get_playlist_tracks,
            add_track_to_playlist,
            add_tracks_to_playlist,
            remove_track_from_playlist,
            reorder_playlist_tracks,
            duplicate_playlist,
            play_playlist,
            get_eq_settings,
            set_eq_band,
            set_eq_enabled,
            set_eq_preset,
            set_eq_preamp,
            get_eq_presets,
            save_eq_settings,
            get_visualizer_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
