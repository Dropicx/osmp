mod models;
mod database;
mod scanner;
mod metadata;
mod audio;
mod commands;

use commands::*;
use audio::AudioController;
use database::{Database, DatabaseInner};
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Database,
    pub audio: AudioController,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database once at startup
    let db = Arc::new(Mutex::new(
        DatabaseInner::new().expect("Failed to initialize database")
    ));

    // Initialize audio controller once at startup
    let audio = AudioController::new().expect("Failed to initialize audio");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { db, audio })
        .invoke_handler(tauri::generate_handler![
            get_scan_folders,
            add_scan_folder,
            remove_scan_folder,
            scan_folders,
            get_tracks,
            search_tracks,
            fetch_metadata,
            play_track,
            pause_playback,
            stop_playback,
            set_volume,
            get_playback_position,
            seek_to_position,
            delete_track,
            delete_tracks,
            get_track_cover
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
