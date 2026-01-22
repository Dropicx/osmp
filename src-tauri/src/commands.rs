use crate::database::Database;
use crate::models::{Track, TrackFilters, ScanFolder, MetadataResult};
use crate::scanner::Scanner;
use crate::metadata::MetadataFetcher;
use crate::audio::AudioPlayer;
use std::sync::{Arc, Mutex};
use anyhow::Result;

// Note: We'll use Tauri's state management instead of static variables
// For now, create database on each call (inefficient but works)
// In production, use tauri::State

fn get_db() -> Result<Database> {
    use crate::database::DatabaseInner;
    Ok(Arc::new(Mutex::new(DatabaseInner::new()?)))
}

// Audio player will be created per-command for now
// In production, store in Tauri app state

#[tauri::command]
pub async fn get_scan_folders() -> Result<Vec<ScanFolder>, String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let result = db.lock().unwrap().get_scan_folders();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_scan_folder(path: String) -> Result<(), String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let result = db.lock().unwrap().add_scan_folder(&path);
    result.map_err(|e| e.to_string())
}


#[tauri::command]
pub async fn remove_scan_folder(id: i64) -> Result<(), String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let result = db.lock().unwrap().remove_scan_folder(id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_folders() -> Result<Vec<Track>, String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let enabled_folders: Vec<String> = {
        let folders = db.lock().unwrap().get_scan_folders().map_err(|e| e.to_string())?;
        folders
            .into_iter()
            .filter(|f| f.enabled)
            .map(|f| f.path)
            .collect()
    };

    let scanner = Scanner::new(Arc::clone(&db));
    scanner.scan_folders(enabled_folders).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tracks(filters: Option<TrackFilters>) -> Result<Vec<Track>, String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let result = db.lock().unwrap().get_tracks(filters.as_ref());
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_tracks(query: String) -> Result<Vec<Track>, String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let result = db.lock().unwrap().search_tracks(&query);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_metadata(track_ids: Vec<i64>, _force: bool) -> Result<Vec<MetadataResult>, String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let fetcher = MetadataFetcher::new(Arc::clone(&db));
    
    let mut results = Vec::new();
    for track_id in track_ids {
        match fetcher.fetch_metadata_for_track(track_id).await {
            Ok(result) => results.push(result),
            Err(e) => results.push(MetadataResult {
                track_id,
                success: false,
                message: e.to_string(),
            }),
        }
    }
    
    Ok(results)
}

#[tauri::command]
pub async fn play_track(track_id: i64) -> Result<(), String> {
    let db = get_db().map_err(|e| e.to_string())?;
    let file_path = {
        let track = db.lock().unwrap().get_track_by_id(track_id).map_err(|e| e.to_string())?;
        track.file_path
    };
    
    let player = AudioPlayer::new().map_err(|e| e.to_string())?;
    player.play_file(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_playback() -> Result<(), String> {
    // Note: This is a simplified implementation
    // In production, store player in app state
    Ok(())
}

#[tauri::command]
pub async fn stop_playback() -> Result<(), String> {
    // Note: This is a simplified implementation  
    // In production, store player in app state
    Ok(())
}

#[tauri::command]
pub async fn set_volume(_volume: f32) -> Result<(), String> {
    // Note: This is a simplified implementation
    // In production, store player in app state
    Ok(())
}
