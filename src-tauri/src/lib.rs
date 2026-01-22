mod models;
mod database;
mod scanner;
mod metadata;
mod audio;
mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            set_volume
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
