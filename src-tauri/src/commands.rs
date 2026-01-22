use crate::models::{Track, TrackFilters, ScanFolder, MetadataResult};
use crate::scanner::Scanner;
use crate::metadata::MetadataFetcher;
use crate::AppState;
use tauri::State;
use std::sync::Arc;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use lofty::prelude::*;

#[tauri::command]
pub async fn get_scan_folders(state: State<'_, AppState>) -> Result<Vec<ScanFolder>, String> {
    let result = state.db.lock().unwrap().get_scan_folders();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_scan_folder(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let result = state.db.lock().unwrap().add_scan_folder(&path);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_scan_folder(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let result = state.db.lock().unwrap().remove_scan_folder(id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_folders(state: State<'_, AppState>) -> Result<Vec<Track>, String> {
    let enabled_folders: Vec<String> = {
        let folders = state.db.lock().unwrap().get_scan_folders().map_err(|e| e.to_string())?;
        folders
            .into_iter()
            .filter(|f| f.enabled)
            .map(|f| f.path)
            .collect()
    };

    let scanner = Scanner::new(Arc::clone(&state.db));
    scanner.scan_folders(enabled_folders).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tracks(state: State<'_, AppState>, filters: Option<TrackFilters>) -> Result<Vec<Track>, String> {
    let result = state.db.lock().unwrap().get_tracks(filters.as_ref());
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_tracks(state: State<'_, AppState>, query: String) -> Result<Vec<Track>, String> {
    let result = state.db.lock().unwrap().search_tracks(&query);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_metadata(state: State<'_, AppState>, track_ids: Vec<i64>, _force: bool) -> Result<Vec<MetadataResult>, String> {
    let fetcher = MetadataFetcher::new(Arc::clone(&state.db));

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
pub async fn play_track(state: State<'_, AppState>, track_id: i64) -> Result<(), String> {
    let file_path = {
        let track = state.db.lock().unwrap().get_track_by_id(track_id).map_err(|e| e.to_string())?;
        track.file_path
    };

    state.audio.play_file(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_playback(state: State<'_, AppState>) -> Result<(), String> {
    state.audio.pause();
    Ok(())
}

#[tauri::command]
pub async fn stop_playback(state: State<'_, AppState>) -> Result<(), String> {
    state.audio.stop();
    Ok(())
}

#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), String> {
    state.audio.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub async fn get_playback_position(state: State<'_, AppState>) -> Result<f64, String> {
    Ok(state.audio.get_position())
}

#[tauri::command]
pub async fn seek_to_position(state: State<'_, AppState>, position: f64) -> Result<(), String> {
    state.audio.seek(position);
    Ok(())
}

#[tauri::command]
pub async fn delete_track(state: State<'_, AppState>, track_id: i64) -> Result<(), String> {
    let result = state.db.lock().unwrap().delete_track(track_id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tracks(state: State<'_, AppState>, track_ids: Vec<i64>) -> Result<(), String> {
    let result = state.db.lock().unwrap().delete_tracks(&track_ids);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_track_cover(state: State<'_, AppState>, track_id: i64) -> Result<Option<String>, String> {
    let file_path = {
        let track = state.db.lock().unwrap().get_track_by_id(track_id).map_err(|e| e.to_string())?;
        track.file_path
    };

    // Extract cover art from the audio file
    let tagged_file = lofty::read_from_path(&file_path).map_err(|e| e.to_string())?;

    let tag = match tagged_file.primary_tag() {
        Some(t) => t,
        None => return Ok(None),
    };

    let picture = match tag.pictures().first() {
        Some(p) => p,
        None => return Ok(None),
    };

    let mime_type = match picture.mime_type() {
        Some(mime) => mime.as_str(),
        None => "image/jpeg",
    };

    let base64_data = BASE64.encode(picture.data());
    Ok(Some(format!("data:{};base64,{}", mime_type, base64_data)))
}
