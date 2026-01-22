use crate::models::{Track, TrackFilters, ScanFolder, MetadataResult, AlbumInfo, ScanResult, Playlist};
use crate::scanner::ScannerWithProgress;
use crate::metadata::MetadataFetcher;
use crate::equalizer::{EqualizerSettings, EqPreset, get_presets, get_visualizer_levels};
use crate::AppState;
use crate::media_controls::{MediaMetadata, PlaybackState};
use tauri::State;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::path::PathBuf;
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
pub async fn scan_folders(state: State<'_, AppState>, window: tauri::Window) -> Result<ScanResult, String> {
    let db = Arc::clone(&state.db);
    let cancelled = Arc::clone(&state.scan_cancelled);

    let enabled_folders: Vec<String> = {
        let folders = db.lock().unwrap().get_scan_folders().map_err(|e| e.to_string())?;
        folders
            .into_iter()
            .filter(|f| f.enabled)
            .map(|f| f.path)
            .collect()
    };

    // Run scanning in a background thread to prevent UI freeze
    let result = tokio::task::spawn_blocking(move || {
        let scanner = ScannerWithProgress::new(db, window, cancelled);
        scanner.scan_with_progress(enabled_folders)
    })
    .await
    .map_err(|e| format!("Scan task error: {}", e))?
    .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    state.scan_cancelled.store(true, Ordering::SeqCst);
    Ok(())
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
    // Get track info
    let (file_path, track, release_mbid) = {
        let mut db = state.db.lock().unwrap();
        let track = db.get_track_by_id(track_id).map_err(|e| e.to_string())?;
        (track.file_path.clone(), track.clone(), track.release_mbid.clone())
    };

    // Play the track
    state.audio.play_file(&file_path).map_err(|e| e.to_string())?;

    // Update media controls with track metadata
    if let Some(ref media_controls) = state.media_controls {
        // Fetch cover art using the same logic as get_track_cover
        let artwork = {
            // 1. Try embedded art first
            if let Some(cover_str) = extract_embedded_cover(&file_path) {
                if cover_str.starts_with("data:image") {
                    if let Some(comma_pos) = cover_str.find(',') {
                        BASE64.decode(&cover_str[comma_pos + 1..]).ok()
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            // 2. Try cached cover
            else if let Some(ref mbid) = release_mbid {
                let cache_path = get_cached_cover_path(mbid);
                if cache_path.exists() {
                    std::fs::read(&cache_path).ok()
                } else {
                    None
                }
            } else {
                None
            }
        };

        let metadata = MediaMetadata {
            title: track.title.unwrap_or_else(|| "Unknown Title".to_string()),
            artist: track.artist.unwrap_or_else(|| "Unknown Artist".to_string()),
            album: track.album.unwrap_or_else(|| "Unknown Album".to_string()),
            artwork,
            duration: track.duration.map(|d| d as f64).unwrap_or(0.0),
        };

        let _ = media_controls.update_metadata(&metadata);
        let _ = media_controls.update_playback_state(PlaybackState::Playing);
        let _ = media_controls.update_position(0.0);

        // Determine if next/previous are available (simplified - could check queue)
        let _ = media_controls.set_available_actions(true, true);
    }

    Ok(())
}

#[tauri::command]
pub async fn pause_playback(state: State<'_, AppState>) -> Result<(), String> {
    // Check state BEFORE toggling (audio.pause() is async via channel, can't check after)
    let was_playing = state.audio.state.is_playing();
    let current_position = state.audio.get_position();

    state.audio.pause();

    // Update media controls with the NEW state (opposite of what it was)
    if let Some(ref media_controls) = state.media_controls {
        let new_state = if was_playing {
            PlaybackState::Paused
        } else {
            PlaybackState::Playing
        };
        let _ = media_controls.update_playback_state(new_state);
        let _ = media_controls.update_position(current_position);
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_playback(state: State<'_, AppState>) -> Result<(), String> {
    state.audio.stop();
    
    // Update media controls playback state
    if let Some(ref media_controls) = state.media_controls {
        let _ = media_controls.update_playback_state(PlaybackState::Stopped);
    }
    
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
    
    // Update media controls position
    if let Some(ref media_controls) = state.media_controls {
        let _ = media_controls.update_position(position);
    }
    
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

// Helper functions for cover art caching
fn get_covers_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".osmp").join("covers")
}

fn get_cached_cover_path(release_mbid: &str) -> PathBuf {
    get_covers_dir().join(format!("{}.jpg", release_mbid))
}

fn save_cover_to_cache(release_mbid: &str, data: &[u8]) -> Result<(), std::io::Error> {
    let dir = get_covers_dir();
    std::fs::create_dir_all(&dir)?;
    let path = get_cached_cover_path(release_mbid);
    std::fs::write(&path, data)?;
    Ok(())
}

fn extract_embedded_cover(file_path: &str) -> Option<String> {
    let tagged_file = lofty::read_from_path(file_path).ok()?;
    let tag = tagged_file.primary_tag()?;
    let picture = tag.pictures().first()?;

    let mime_type = picture.mime_type()
        .map(|m| m.as_str())
        .unwrap_or("image/jpeg");

    let base64_data = BASE64.encode(picture.data());
    Some(format!("data:{};base64,{}", mime_type, base64_data))
}

async fn fetch_cover_from_archive(release_mbid: &str) -> Option<Vec<u8>> {
    let url = format!("https://coverartarchive.org/release/{}/front", release_mbid);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "OSMP/0.1.0 (https://github.com/Dropicx/osmp)")
        .send()
        .await
        .ok()?;

    if response.status().is_success() {
        response.bytes().await.ok().map(|b| b.to_vec())
    } else {
        None
    }
}

#[tauri::command]
pub async fn get_track_cover(state: State<'_, AppState>, track_id: i64) -> Result<Option<String>, String> {
    let (file_path, release_mbid) = {
        let track = state.db.lock().unwrap().get_track_by_id(track_id).map_err(|e| e.to_string())?;
        (track.file_path, track.release_mbid)
    };

    // 1. Try embedded art first
    if let Some(cover) = extract_embedded_cover(&file_path) {
        return Ok(Some(cover));
    }

    // 2. Try cached cover
    if let Some(ref mbid) = release_mbid {
        let cache_path = get_cached_cover_path(mbid);
        if cache_path.exists() {
            if let Ok(data) = std::fs::read(&cache_path) {
                let base64_data = BASE64.encode(&data);
                return Ok(Some(format!("data:image/jpeg;base64,{}", base64_data)));
            }
        }
    }

    // 3. Fetch from Cover Art Archive
    if let Some(ref mbid) = release_mbid {
        if let Some(cover_data) = fetch_cover_from_archive(mbid).await {
            // Cache it for future use
            let _ = save_cover_to_cache(mbid, &cover_data);
            let base64_data = BASE64.encode(&cover_data);
            return Ok(Some(format!("data:image/jpeg;base64,{}", base64_data)));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn fetch_covers(state: State<'_, AppState>, track_ids: Vec<i64>) -> Result<Vec<crate::models::CoverFetchResult>, String> {
    use crate::models::CoverFetchResult;

    let mut results = Vec::new();

    for track_id in track_ids {
        let (file_path, release_mbid, title) = {
            match state.db.lock().unwrap().get_track_by_id(track_id) {
                Ok(track) => (track.file_path, track.release_mbid, track.title),
                Err(_) => {
                    results.push(CoverFetchResult {
                        track_id,
                        success: false,
                        message: "Track not found".to_string(),
                    });
                    continue;
                }
            }
        };

        // 1. Check for embedded cover
        if extract_embedded_cover(&file_path).is_some() {
            results.push(CoverFetchResult {
                track_id,
                success: true,
                message: format!("Embedded cover found for {}", title.unwrap_or_default()),
            });
            continue;
        }

        // 2. Check for cached cover
        if let Some(ref mbid) = release_mbid {
            let cache_path = get_cached_cover_path(mbid);
            if cache_path.exists() {
                results.push(CoverFetchResult {
                    track_id,
                    success: true,
                    message: format!("Cached cover for {}", title.unwrap_or_default()),
                });
                continue;
            }
        }

        // 3. Try to fetch from Cover Art Archive
        if let Some(ref mbid) = release_mbid {
            if let Some(cover_data) = fetch_cover_from_archive(mbid).await {
                let _ = save_cover_to_cache(mbid, &cover_data);
                results.push(CoverFetchResult {
                    track_id,
                    success: true,
                    message: format!("Downloaded cover for {}", title.unwrap_or_default()),
                });
                continue;
            }
        }

        // No cover found
        let reason = if release_mbid.is_none() {
            "No MusicBrainz ID - fetch metadata first"
        } else {
            "No cover art available"
        };
        results.push(CoverFetchResult {
            track_id,
            success: false,
            message: format!("{}: {}", title.unwrap_or_else(|| "Unknown".to_string()), reason),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<AlbumInfo>, String> {
    let album_data = state.db.lock().unwrap().get_albums().map_err(|e| e.to_string())?;
    
    let mut albums = Vec::new();
    for (album_name, artist, year, track_count, total_duration, created_at) in album_data {
        // Get cover art for this album - find a track and get its cover
        // First, get the track info while holding the lock, then drop the lock before async operations
        let (file_path, release_mbid) = {
            let mut db = state.db.lock().unwrap();
            let track_id = db.get_album_first_track_id(&album_name, artist.as_deref())
                .map_err(|e| e.to_string())?;
            
            if let Some(id) = track_id {
                let track = db.get_track_by_id(id).map_err(|e| e.to_string())?;
                (Some(track.file_path), track.release_mbid)
            } else {
                (None, None)
            }
        };
        
        // Now we can do async operations without holding the lock
        let cover_art = if let Some(ref path) = file_path {
            // Try embedded first
            if let Some(cover) = extract_embedded_cover(path) {
                Some(cover)
            } else if let Some(ref mbid) = release_mbid {
                // Try cached
                let cache_path = get_cached_cover_path(mbid);
                if cache_path.exists() {
                    if let Ok(data) = std::fs::read(&cache_path) {
                        let base64_data = BASE64.encode(&data);
                        Some(format!("data:image/jpeg;base64,{}", base64_data))
                    } else {
                        None
                    }
                } else {
                    // Try fetching from archive (this is async, so lock is already dropped)
                    if let Some(cover_data) = fetch_cover_from_archive(mbid).await {
                        let _ = save_cover_to_cache(mbid, &cover_data);
                        let base64_data = BASE64.encode(&cover_data);
                        Some(format!("data:image/jpeg;base64,{}", base64_data))
                    } else {
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        albums.push(AlbumInfo {
            name: album_name,
            artist,
            year,
            track_count,
            total_duration,
            created_at,
            cover_art,
        });
    }
    
    Ok(albums)
}

#[tauri::command]
pub async fn get_album_tracks(
    state: State<'_, AppState>,
    album_name: String,
    artist: Option<String>,
) -> Result<Vec<Track>, String> {
    let tracks = state.db.lock().unwrap()
        .get_album_tracks(&album_name, artist.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(tracks)
}

#[tauri::command]
pub async fn get_album_cover(
    state: State<'_, AppState>,
    album_name: String,
    artist: Option<String>,
) -> Result<Option<String>, String> {
    // Find first track in album (prefer one with release_mbid)
    let track_id = state.db.lock().unwrap()
        .get_album_first_track_id(&album_name, artist.as_deref())
        .map_err(|e| e.to_string())?;

    if let Some(id) = track_id {
        // Leverage existing get_track_cover infrastructure
        get_track_cover(state, id).await
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn play_album(
    state: State<'_, AppState>,
    album_name: String,
    artist: Option<String>,
) -> Result<(), String> {
    let tracks = state.db.lock().unwrap()
        .get_album_tracks(&album_name, artist.as_deref())
        .map_err(|e| e.to_string())?;

    if tracks.is_empty() {
        return Err("No tracks found in album".to_string());
    }

    // Play first track
    let first_track = &tracks[0];
    play_track(state, first_track.id).await?;

    Ok(())
}

#[tauri::command]
pub async fn update_track_metadata_manual(
    state: State<'_, AppState>,
    track_id: i64,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<i64>,
    genre: Option<String>,
    track_number: Option<i64>,
) -> Result<(), String> {
    state.db.lock().unwrap()
        .update_track_metadata_manual(track_id, title, artist, album, year, genre, track_number)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_metadata_to_file(
    state: State<'_, AppState>,
    track_id: i64,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<i64>,
    genre: Option<String>,
    track_number: Option<i64>,
) -> Result<(), String> {
    use lofty::prelude::{Accessor, TagExt};
    use lofty::config::WriteOptions;

    let file_path = {
        let track = state.db.lock().unwrap()
            .get_track_by_id(track_id)
            .map_err(|e| e.to_string())?;
        track.file_path
    };

    // Read the file
    let mut tagged_file = lofty::read_from_path(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Get or create primary tag
    let has_primary = tagged_file.primary_tag().is_some();
    let tag = if has_primary {
        tagged_file.primary_tag_mut().unwrap()
    } else {
        tagged_file.first_tag_mut()
            .ok_or_else(|| "No tag found in file".to_string())?
    };

    // Update fields
    if let Some(t) = title {
        tag.set_title(t);
    }
    if let Some(a) = artist {
        tag.set_artist(a);
    }
    if let Some(al) = album {
        tag.set_album(al);
    }
    if let Some(y) = year {
        tag.set_year(y as u32);
    }
    if let Some(g) = genre {
        tag.set_genre(g);
    }
    if let Some(tn) = track_number {
        tag.set_track(tn as u32);
    }

    // Save to file
    tag.save_to_path(&file_path, WriteOptions::default())
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    Ok(())
}

// Playlist commands
#[tauri::command]
pub async fn create_playlist(state: State<'_, AppState>, name: String) -> Result<i64, String> {
    if name.trim().is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }
    let result = state.db.lock().unwrap().create_playlist(&name);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let result = state.db.lock().unwrap().delete_playlist(id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_playlist(state: State<'_, AppState>, id: i64, new_name: String) -> Result<(), String> {
    if new_name.trim().is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }
    let result = state.db.lock().unwrap().rename_playlist(id, &new_name);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    let result = state.db.lock().unwrap().get_playlists();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlist(state: State<'_, AppState>, id: i64) -> Result<Playlist, String> {
    let result = state.db.lock().unwrap().get_playlist(id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlist_tracks(state: State<'_, AppState>, playlist_id: i64) -> Result<Vec<Track>, String> {
    let result = state.db.lock().unwrap().get_playlist_tracks(playlist_id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_track_to_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_id: i64,
    position: Option<i64>,
) -> Result<(), String> {
    let result = state.db.lock().unwrap().add_track_to_playlist(playlist_id, track_id, position);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_tracks_to_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_ids: Vec<i64>,
) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    // Get current max position by querying existing tracks
    let existing_tracks = db.get_playlist_tracks(playlist_id).map_err(|e| e.to_string())?;
    let start_position = existing_tracks.len() as i64;
    
    // Add all tracks in a transaction
    for (index, track_id) in track_ids.iter().enumerate() {
        db.add_track_to_playlist(playlist_id, *track_id, Some(start_position + index as i64))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_track_from_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_id: i64,
) -> Result<(), String> {
    let result = state.db.lock().unwrap().remove_track_from_playlist(playlist_id, track_id);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_positions: Vec<(i64, i64)>,
) -> Result<(), String> {
    let result = state.db.lock().unwrap().reorder_playlist_tracks(playlist_id, track_positions);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn duplicate_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    new_name: String,
) -> Result<i64, String> {
    if new_name.trim().is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }
    let result = state.db.lock().unwrap().duplicate_playlist(playlist_id, &new_name);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn play_playlist(state: State<'_, AppState>, playlist_id: i64) -> Result<(), String> {
    let tracks = state.db.lock().unwrap()
        .get_playlist_tracks(playlist_id)
        .map_err(|e| e.to_string())?;

    if tracks.is_empty() {
        return Err("Playlist is empty".to_string());
    }

    // Play first track
    let first_track = &tracks[0];
    play_track(state, first_track.id).await?;

    Ok(())
}

// Equalizer commands

#[tauri::command]
pub async fn get_eq_settings(state: State<'_, AppState>) -> Result<EqualizerSettings, String> {
    Ok(state.audio.get_eq_settings())
}

#[tauri::command]
pub async fn set_eq_band(state: State<'_, AppState>, band: usize, gain_db: f32) -> Result<(), String> {
    if band >= 5 {
        return Err("Band index must be 0-4".to_string());
    }
    state.audio.set_eq_band(band, gain_db);
    Ok(())
}

#[tauri::command]
pub async fn set_eq_enabled(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    state.audio.set_eq_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub async fn set_eq_preset(state: State<'_, AppState>, preset_name: String) -> Result<(), String> {
    let presets = get_presets();
    let preset = presets.iter().find(|p| p.name == preset_name)
        .ok_or_else(|| format!("Unknown preset: {}", preset_name))?;
    state.audio.set_eq_preset(preset.bands, preset.preamp, preset.name.clone());
    Ok(())
}

#[tauri::command]
pub async fn set_eq_preamp(state: State<'_, AppState>, preamp_db: f32) -> Result<(), String> {
    state.audio.set_eq_preamp(preamp_db);
    Ok(())
}

#[tauri::command]
pub async fn get_eq_presets() -> Result<Vec<EqPreset>, String> {
    Ok(get_presets())
}

#[tauri::command]
pub async fn save_eq_settings(state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.audio.get_eq_settings();
    state.db.lock().unwrap()
        .save_eq_settings(&settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_visualizer_data() -> Result<Vec<f32>, String> {
    Ok(get_visualizer_levels().to_vec())
}
