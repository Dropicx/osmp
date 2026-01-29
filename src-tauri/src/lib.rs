pub mod models;
pub mod database;
mod scanner;
mod metadata;
mod audio;
mod commands;
mod media_controls;
mod equalizer;
pub mod error;
pub mod playlist_io;
mod background_scan;

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
use tracing::{info, warn, error};

pub struct AppState {
    pub db: Database,
    pub audio: Arc<AudioController>,
    pub scan_cancelled: Arc<AtomicBool>,
    pub scan_running: Arc<AtomicBool>,
    pub media_controls: Option<Arc<MediaControlsManager>>,
    pub media_control_event_sender: Option<mpsc::UnboundedSender<media_controls::MediaControlEvent>>,
    pub http_client: reqwest::Client,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("osmp_lib=info,warn"))
        )
        .with_target(false)
        .init();

    info!("OSMP starting up");

    // Initialize database once at startup
    let db = match DatabaseInner::new() {
        Ok(db) => Arc::new(Mutex::new(db)),
        Err(e) => {
            error!("Failed to initialize database: {}", e);
            eprintln!("FATAL: Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    // Load EQ settings from database, or use defaults
    let eq_settings = {
        let db_lock = match db.lock() {
            Ok(lock) => lock,
            Err(e) => {
                error!("Failed to lock database during initialization: {}", e);
                std::process::exit(1);
            }
        };
        db_lock.load_eq_settings()
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let eq_settings = Arc::new(RwLock::new(eq_settings));

    // Initialize audio controller once at startup
    let audio = match AudioController::new(Arc::clone(&eq_settings)) {
        Ok(controller) => Arc::new(controller),
        Err(e) => {
            error!("Failed to initialize audio: {}", e);
            eprintln!("FATAL: Failed to initialize audio system: {}", e);
            std::process::exit(1);
        }
    };

    // Initialize shared HTTP client (reuses connections)
    let http_client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .pool_max_idle_per_host(2)
        .user_agent(format!("OSMP/{} (https://github.com/Dropicx/osmp)", env!("CARGO_PKG_VERSION")))
        .build()
    {
        Ok(client) => client,
        Err(e) => {
            error!("Failed to create HTTP client: {}", e);
            std::process::exit(1);
        }
    };

    // Initialize scan cancellation flag and running guard
    let scan_cancelled = Arc::new(AtomicBool::new(false));
    let scan_running = Arc::new(AtomicBool::new(false));

    // Initialize media controls (may fail on unsupported platforms, that's OK)
    let (media_controls, media_control_receiver) = match MediaControlsManager::new() {
        Ok((manager, receiver)) => {
            (Some(Arc::new(manager)), Some(receiver))
        }
        Err(e) => {
            warn!("Media controls not available: {}", e);
            (None, None)
        }
    };

    let media_control_event_sender = media_controls.as_ref().map(|mc| mc.get_event_sender());

    // Clone references for the event handlers
    let audio_for_events = Arc::clone(&audio);
    let audio_for_position = Arc::clone(&audio);
    let media_controls_for_events = media_controls.clone();

    // Clone references for background scanning
    let db_for_bg_scan = Arc::clone(&db);
    let scan_running_for_bg = Arc::clone(&scan_running);
    let scan_cancelled_for_bg = Arc::clone(&scan_cancelled);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            // Push-based position updates: emit position every ~1s when playing
            {
                let app_handle = app.handle().clone();
                let audio = audio_for_position;
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        if audio.state.is_playing() {
                            let position = audio.get_position();
                            let _ = app_handle.emit("position-update", position);
                        }
                    }
                });
            }

            // Set up media control event handler
            if let Some(mut receiver) = media_control_receiver {
                let app_handle = app.handle().clone();
                let audio = audio_for_events;
                let mc = media_controls_for_events;
                tauri::async_runtime::spawn(async move {
                    let mut last_toggle = Instant::now() - std::time::Duration::from_secs(1);
                    while let Some(event) = receiver.recv().await {
                        info!("[MediaControls] Received event: {:?}", event);
                        match event {
                            MediaControlEvent::Play | MediaControlEvent::Pause | MediaControlEvent::PlayPause => {
                                // Debounce: ignore events within 300ms of last toggle
                                let now = Instant::now();
                                if now.duration_since(last_toggle) < std::time::Duration::from_millis(300) {
                                    info!("[MediaControls] Debounced, skipping");
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
                                    info!("[MediaControls] Toggled: new_is_playing={}", new_is_playing);
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

            // Launch background scanning (startup + periodic)
            background_scan::start_background_scanning(
                app.handle().clone(),
                db_for_bg_scan,
                scan_running_for_bg,
                scan_cancelled_for_bg,
            );

            Ok(())
        })
        .manage(AppState {
            db,
            audio,
            scan_cancelled,
            scan_running,
            media_controls,
            media_control_event_sender,
            http_client,
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
            get_visualizer_data,
            set_playback_speed,
            preload_next_track,
            record_play_history,
            get_play_history,
            get_duplicates,
            export_playlist_m3u,
            import_playlist_m3u,
            get_scan_settings,
            set_scan_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
