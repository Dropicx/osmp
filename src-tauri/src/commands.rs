use crate::database::DatabaseInner;
use crate::equalizer::{get_presets, get_visualizer_levels, EqPreset, EqualizerSettings};
use crate::media_controls::{MediaMetadata, PlaybackState};
use crate::metadata::MetadataFetcher;
use crate::models::{
    AlbumInfo, MetadataResult, Playlist, ScanFolder, ScanResult, ScanSettings, Track, TrackFilters,
};
use crate::scanner::ScannerWithProgress;
use crate::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use lofty::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, MutexGuard};
use tauri::{Manager, State};

/// Lock the database mutex. See `database.rs` for deadlock risk rationale.
fn lock_db(state: &AppState) -> Result<MutexGuard<'_, DatabaseInner>, String> {
    state.db.lock().map_err(|e| {
        tracing::error!("Database lock poisoned: {}", e);
        "Database is temporarily unavailable".to_string()
    })
}

/// Log the full error server-side, return a generic message to the frontend.
fn sanitize_err<E: std::fmt::Display>(context: &str) -> impl FnOnce(E) -> String + '_ {
    move |e: E| {
        tracing::error!("{}: {}", context, e);
        format!("{} failed", context)
    }
}

#[tauri::command]
pub async fn get_scan_folders(state: State<'_, AppState>) -> Result<Vec<ScanFolder>, String> {
    let result = lock_db(&state)?.get_scan_folders();
    result.map_err(sanitize_err("Loading scan folders"))
}

#[tauri::command]
pub async fn add_scan_folder(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let metadata = std::fs::metadata(&path)
        .map_err(|_| "The selected path does not exist or is not accessible".to_string())?;

    if !metadata.is_dir() {
        return Err("The selected path is not a directory".to_string());
    }

    let canonical = std::fs::canonicalize(&path)
        .map_err(|_| "Could not resolve the directory path".to_string())?;
    let canonical_str = canonical.to_string_lossy().to_string();

    // Reject well-known system directories
    let blocked_prefixes: &[&str] = if cfg!(target_os = "macos") {
        &[
            "/System",
            "/usr",
            "/bin",
            "/sbin",
            "/etc",
            "/var",
            "/private/etc",
            "/private/var",
        ]
    } else if cfg!(target_os = "linux") {
        &[
            "/usr", "/bin", "/sbin", "/etc", "/var", "/boot", "/proc", "/sys", "/dev", "/lib",
            "/lib64",
        ]
    } else if cfg!(target_os = "windows") {
        &[
            "C:\\Windows",
            "C:\\Program Files",
            "C:\\Program Files (x86)",
        ]
    } else {
        &[]
    };

    for prefix in blocked_prefixes {
        let matches = if cfg!(target_os = "linux") {
            canonical_str.starts_with(prefix)
        } else {
            canonical_str
                .to_lowercase()
                .starts_with(&prefix.to_lowercase())
        };
        if matches {
            return Err(format!(
                "Cannot add system directory '{}' as a scan folder",
                prefix
            ));
        }
    }

    let result = lock_db(&state)?.add_scan_folder(&canonical_str);
    result.map_err(sanitize_err("Adding scan folder"))
}

#[tauri::command]
pub async fn remove_scan_folder(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let result = lock_db(&state)?.remove_scan_folder(id);
    result.map_err(sanitize_err("Removing scan folder"))
}

#[tauri::command]
pub async fn scan_folders(
    state: State<'_, AppState>,
    window: tauri::Window,
) -> Result<ScanResult, String> {
    // Check if a scan is already running
    if state
        .scan_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A scan is already in progress".to_string());
    }

    let db = Arc::clone(&state.db);
    let cancelled = Arc::clone(&state.scan_cancelled);
    let scan_running = Arc::clone(&state.scan_running);

    let enabled_folders: Vec<String> = {
        let folders = db
            .lock()
            .map_err(|e| {
                scan_running.store(false, Ordering::SeqCst);
                tracing::error!("Loading folders for scan: {}", e);
                "Loading folders for scan failed".to_string()
            })?
            .get_scan_folders()
            .map_err(|e| {
                scan_running.store(false, Ordering::SeqCst);
                tracing::error!("Loading folders for scan: {}", e);
                "Loading folders for scan failed".to_string()
            })?;
        folders
            .into_iter()
            .filter(|f| f.enabled)
            .map(|f| f.path)
            .collect()
    };

    // Run scanning in a background thread to prevent UI freeze
    let result = tokio::task::spawn_blocking(move || {
        let scanner = ScannerWithProgress::new(db, window.app_handle().clone(), cancelled);
        let result = scanner.scan_with_progress(enabled_folders);
        scan_running.store(false, Ordering::SeqCst);
        result
    })
    .await
    .map_err(sanitize_err("Scanning folders"))?
    .map_err(sanitize_err("Scanning folders"))?;

    Ok(result)
}

#[tauri::command]
pub async fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    state.scan_cancelled.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn get_tracks(
    state: State<'_, AppState>,
    filters: Option<TrackFilters>,
) -> Result<Vec<Track>, String> {
    let result = lock_db(&state)?.get_tracks(filters.as_ref());
    result.map_err(sanitize_err("Loading tracks"))
}

#[tauri::command]
pub async fn search_tracks(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Track>, String> {
    let result = lock_db(&state)?.search_tracks(&query);
    result.map_err(sanitize_err("Searching tracks"))
}

#[tauri::command]
pub async fn fetch_metadata(
    state: State<'_, AppState>,
    track_ids: Vec<i64>,
    _force: bool,
) -> Result<Vec<MetadataResult>, String> {
    let fetcher = MetadataFetcher::with_client(Arc::clone(&state.db), state.http_client.clone());

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
        let db = lock_db(&state)?;
        let track = db
            .get_track_by_id(track_id)
            .map_err(sanitize_err("Loading track"))?;
        (
            track.file_path.clone(),
            track.clone(),
            track.release_mbid.clone(),
        )
    };

    // Play the track
    state
        .audio
        .play_file(&file_path)
        .map_err(sanitize_err("Playing audio"))?;

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
    let clamped = volume.clamp(0.0, 1.0);
    state.audio.set_volume(clamped);
    Ok(())
}

#[tauri::command]
pub async fn get_playback_position(state: State<'_, AppState>) -> Result<f64, String> {
    Ok(state.audio.get_position())
}

#[tauri::command]
pub async fn seek_to_position(state: State<'_, AppState>, position: f64) -> Result<(), String> {
    let clamped = if position < 0.0 { 0.0 } else { position };
    state.audio.seek(clamped);

    // Update media controls position
    if let Some(ref media_controls) = state.media_controls {
        let _ = media_controls.update_position(clamped);
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_track(state: State<'_, AppState>, track_id: i64) -> Result<(), String> {
    let result = lock_db(&state)?.delete_track(track_id);
    result.map_err(sanitize_err("Deleting track"))
}

#[tauri::command]
pub async fn delete_tracks(state: State<'_, AppState>, track_ids: Vec<i64>) -> Result<(), String> {
    let result = lock_db(&state)?.delete_tracks(&track_ids);
    result.map_err(sanitize_err("Deleting tracks"))
}

// Helper functions for cover art caching
fn get_covers_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".osmp").join("covers")
}

fn get_cached_cover_path(release_mbid: &str) -> PathBuf {
    // Sanitize MBID to alphanumeric + dash only (UUID format) to prevent path traversal
    let sanitized: String = release_mbid
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(36)
        .collect();
    get_covers_dir().join(format!("{}.jpg", sanitized))
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

    let mime_type = picture
        .mime_type()
        .map(|m| m.as_str())
        .unwrap_or("image/jpeg");

    let base64_data = BASE64.encode(picture.data());
    Some(format!("data:{};base64,{}", mime_type, base64_data))
}

async fn fetch_cover_from_archive(client: &reqwest::Client, release_mbid: &str) -> Option<Vec<u8>> {
    let url = format!("https://coverartarchive.org/release/{}/front", release_mbid);

    let response = client.get(&url).send().await.ok()?;

    // Guard against oversized responses (10 MB limit for cover images)
    const MAX_COVER_SIZE: u64 = 10 * 1024 * 1024;
    if response.content_length().unwrap_or(0) > MAX_COVER_SIZE {
        return None;
    }

    if response.status().is_success() {
        response.bytes().await.ok().map(|b| b.to_vec())
    } else {
        None
    }
}

#[tauri::command]
pub async fn get_track_cover(
    state: State<'_, AppState>,
    track_id: i64,
) -> Result<Option<String>, String> {
    let (file_path, release_mbid) = {
        let track = lock_db(&state)?
            .get_track_by_id(track_id)
            .map_err(sanitize_err("Loading track"))?;
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
        if let Some(cover_data) = fetch_cover_from_archive(&state.http_client, mbid).await {
            // Cache it for future use
            let _ = save_cover_to_cache(mbid, &cover_data);
            let base64_data = BASE64.encode(&cover_data);
            return Ok(Some(format!("data:image/jpeg;base64,{}", base64_data)));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn fetch_covers(
    state: State<'_, AppState>,
    track_ids: Vec<i64>,
) -> Result<Vec<crate::models::CoverFetchResult>, String> {
    use crate::models::CoverFetchResult;

    let mut results = Vec::new();

    for track_id in track_ids {
        let (file_path, release_mbid, title) = {
            match lock_db(&state)?.get_track_by_id(track_id) {
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
            if let Some(cover_data) = fetch_cover_from_archive(&state.http_client, mbid).await {
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
            message: format!(
                "{}: {}",
                title.unwrap_or_else(|| "Unknown".to_string()),
                reason
            ),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<AlbumInfo>, String> {
    // Single query returns album info with first track's file_path and release_mbid
    let album_data = lock_db(&state)?
        .get_albums_with_cover_info()
        .map_err(sanitize_err("Loading albums"))?;

    let albums = album_data
        .into_iter()
        .map(
            |(
                album_name,
                artist,
                year,
                track_count,
                total_duration,
                created_at,
                file_path,
                release_mbid,
            )| {
                // Only check local sources (embedded art + cached covers) - no network fetches
                let cover_art = if let Some(ref path) = file_path {
                    if let Some(cover) = extract_embedded_cover(path) {
                        Some(cover)
                    } else if let Some(ref mbid) = release_mbid {
                        let cache_path = get_cached_cover_path(mbid);
                        if cache_path.exists() {
                            std::fs::read(&cache_path).ok().map(|data| {
                                let base64_data = BASE64.encode(&data);
                                format!("data:image/jpeg;base64,{}", base64_data)
                            })
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                AlbumInfo {
                    name: album_name,
                    artist,
                    year,
                    track_count,
                    total_duration,
                    created_at,
                    cover_art,
                }
            },
        )
        .collect();

    Ok(albums)
}

#[tauri::command]
pub async fn get_album_tracks(
    state: State<'_, AppState>,
    album_name: String,
    artist: Option<String>,
) -> Result<Vec<Track>, String> {
    let tracks = lock_db(&state)?
        .get_album_tracks(&album_name, artist.as_deref())
        .map_err(sanitize_err("Loading album tracks"))?;
    Ok(tracks)
}

#[tauri::command]
pub async fn get_album_cover(
    state: State<'_, AppState>,
    album_name: String,
    artist: Option<String>,
) -> Result<Option<String>, String> {
    // Find first track in album (prefer one with release_mbid)
    let track_id = lock_db(&state)?
        .get_album_first_track_id(&album_name, artist.as_deref())
        .map_err(sanitize_err("Loading album cover"))?;

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
    let tracks = lock_db(&state)?
        .get_album_tracks(&album_name, artist.as_deref())
        .map_err(sanitize_err("Loading album"))?;

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
    lock_db(&state)?
        .update_track_metadata_manual(track_id, title, artist, album, year, genre, track_number)
        .map_err(sanitize_err("Updating metadata"))
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
    use lofty::config::WriteOptions;
    use lofty::prelude::{Accessor, TagExt};

    let file_path = {
        let track = lock_db(&state)?
            .get_track_by_id(track_id)
            .map_err(sanitize_err("Reading audio file"))?;
        track.file_path
    };

    // Read the file
    let mut tagged_file =
        lofty::read_from_path(&file_path).map_err(sanitize_err("Reading audio file"))?;

    // Get or create primary tag
    let has_primary = tagged_file.primary_tag().is_some();
    let tag = if has_primary {
        tagged_file
            .primary_tag_mut()
            .ok_or_else(|| "Primary tag not found in file".to_string())?
    } else {
        tagged_file
            .first_tag_mut()
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
        if let Ok(valid) = u32::try_from(y) {
            tag.set_year(valid);
        }
    }
    if let Some(g) = genre {
        tag.set_genre(g);
    }
    if let Some(tn) = track_number {
        if let Ok(valid) = u32::try_from(tn) {
            tag.set_track(valid);
        }
    }

    // Save to file
    tag.save_to_path(&file_path, WriteOptions::default())
        .map_err(sanitize_err("Writing metadata"))?;

    Ok(())
}

// Playlist commands
#[tauri::command]
pub async fn create_playlist(state: State<'_, AppState>, name: String) -> Result<i64, String> {
    if name.trim().is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }
    let result = lock_db(&state)?.create_playlist(&name);
    result.map_err(sanitize_err("Creating playlist"))
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let result = lock_db(&state)?.delete_playlist(id);
    result.map_err(sanitize_err("Deleting playlist"))
}

#[tauri::command]
pub async fn rename_playlist(
    state: State<'_, AppState>,
    id: i64,
    new_name: String,
) -> Result<(), String> {
    if new_name.trim().is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }
    let result = lock_db(&state)?.rename_playlist(id, &new_name);
    result.map_err(sanitize_err("Renaming playlist"))
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    let result = lock_db(&state)?.get_playlists();
    result.map_err(sanitize_err("Loading playlists"))
}

#[tauri::command]
pub async fn get_playlist(state: State<'_, AppState>, id: i64) -> Result<Playlist, String> {
    let result = lock_db(&state)?.get_playlist(id);
    result.map_err(sanitize_err("Loading playlist"))
}

#[tauri::command]
pub async fn get_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: i64,
) -> Result<Vec<Track>, String> {
    let result = lock_db(&state)?.get_playlist_tracks(playlist_id);
    result.map_err(sanitize_err("Loading playlist tracks"))
}

#[tauri::command]
pub async fn add_track_to_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_id: i64,
    position: Option<i64>,
) -> Result<(), String> {
    // Validate playlist and track exist
    let mut db = lock_db(&state)?;
    db.get_playlist(playlist_id)
        .map_err(|_| format!("Playlist {} not found", playlist_id))?;
    db.get_track_by_id(track_id)
        .map_err(|_| format!("Track {} not found", track_id))?;
    db.add_track_to_playlist(playlist_id, track_id, position)
        .map_err(sanitize_err("Adding to playlist"))
}

#[tauri::command]
pub async fn add_tracks_to_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_ids: Vec<i64>,
) -> Result<(), String> {
    lock_db(&state)?
        .add_tracks_to_playlist_batch(playlist_id, &track_ids)
        .map_err(sanitize_err("Adding to playlist"))
}

#[tauri::command]
pub async fn remove_track_from_playlist(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_id: i64,
) -> Result<(), String> {
    let result = lock_db(&state)?.remove_track_from_playlist(playlist_id, track_id);
    result.map_err(sanitize_err("Removing from playlist"))
}

#[tauri::command]
pub async fn reorder_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: i64,
    track_positions: Vec<(i64, i64)>,
) -> Result<(), String> {
    let result = lock_db(&state)?.reorder_playlist_tracks(playlist_id, track_positions);
    result.map_err(sanitize_err("Reordering playlist"))
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
    let result = lock_db(&state)?.duplicate_playlist(playlist_id, &new_name);
    result.map_err(sanitize_err("Duplicating playlist"))
}

#[tauri::command]
pub async fn play_playlist(state: State<'_, AppState>, playlist_id: i64) -> Result<(), String> {
    let tracks = lock_db(&state)?
        .get_playlist_tracks(playlist_id)
        .map_err(sanitize_err("Loading playlist"))?;

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
pub async fn set_eq_band(
    state: State<'_, AppState>,
    band: usize,
    gain_db: f32,
) -> Result<(), String> {
    if band >= 5 {
        return Err("Band index must be 0-4".to_string());
    }
    if !gain_db.is_finite() || !(-12.0..=12.0).contains(&gain_db) {
        return Err("Gain must be a finite number between -12.0 and 12.0 dB".to_string());
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
    let preset = presets
        .iter()
        .find(|p| p.name == preset_name)
        .ok_or_else(|| format!("Unknown preset: {}", preset_name))?;
    state
        .audio
        .set_eq_preset(preset.bands, preset.preamp, preset.name.clone());
    Ok(())
}

#[tauri::command]
pub async fn set_eq_preamp(state: State<'_, AppState>, preamp_db: f32) -> Result<(), String> {
    if !preamp_db.is_finite() {
        return Err("Preamp must be a finite number".to_string());
    }
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
    lock_db(&state)?
        .save_eq_settings(&settings)
        .map_err(sanitize_err("Saving equalizer"))
}

#[tauri::command]
pub async fn get_visualizer_data() -> Result<Vec<f32>, String> {
    Ok(get_visualizer_levels().to_vec())
}

// Playback speed control
#[tauri::command]
pub async fn set_playback_speed(state: State<'_, AppState>, speed: f32) -> Result<(), String> {
    if !speed.is_finite() || !(0.25..=4.0).contains(&speed) {
        return Err("Speed must be a finite number between 0.25 and 4.0".to_string());
    }
    state.audio.set_speed(speed);
    Ok(())
}

// Gapless playback: preload next track
#[tauri::command]
pub async fn preload_next_track(state: State<'_, AppState>, track_id: i64) -> Result<(), String> {
    let file_path = {
        let db = lock_db(&state)?;
        let track = db
            .get_track_by_id(track_id)
            .map_err(sanitize_err("Loading track"))?;
        track.file_path
    };
    state.audio.preload_next(&file_path);
    Ok(())
}

// Play history
#[tauri::command]
pub async fn record_play_history(
    state: State<'_, AppState>,
    track_id: i64,
    duration_listened: i64,
) -> Result<(), String> {
    lock_db(&state)?
        .record_play_history(track_id, duration_listened)
        .map_err(sanitize_err("Recording history"))
}

#[tauri::command]
pub async fn get_play_history(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<crate::models::PlayHistoryEntry>, String> {
    lock_db(&state)?
        .get_play_history(limit.unwrap_or(50))
        .map_err(sanitize_err("Loading history"))
}

// Duplicate detection
#[tauri::command]
pub async fn get_duplicates(state: State<'_, AppState>) -> Result<Vec<Vec<Track>>, String> {
    lock_db(&state)?
        .get_duplicate_tracks()
        .map_err(sanitize_err("Finding duplicates"))
}

// M3U Playlist Import/Export
#[tauri::command]
pub async fn export_playlist_m3u(
    state: State<'_, AppState>,
    playlist_id: i64,
    output_path: String,
) -> Result<(), String> {
    let tracks = lock_db(&state)?
        .get_playlist_tracks(playlist_id)
        .map_err(sanitize_err("Exporting playlist"))?;
    let playlist = lock_db(&state)?
        .get_playlist(playlist_id)
        .map_err(sanitize_err("Exporting playlist"))?;
    crate::playlist_io::export_m3u(&playlist.name, &tracks, &output_path)
        .map_err(sanitize_err("Exporting playlist"))
}

#[tauri::command]
pub async fn import_playlist_m3u(
    state: State<'_, AppState>,
    file_path: String,
    playlist_name: Option<String>,
) -> Result<i64, String> {
    let entries =
        crate::playlist_io::parse_m3u(&file_path).map_err(sanitize_err("Importing playlist"))?;

    let name = playlist_name.unwrap_or_else(|| {
        std::path::Path::new(&file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Imported Playlist")
            .to_string()
    });

    let mut db = lock_db(&state)?;
    let playlist_id = db
        .create_playlist(&name)
        .map_err(sanitize_err("Importing playlist"))?;

    // Match entries to existing tracks by file path
    for entry in &entries {
        if let Ok(tracks) = db.find_tracks_by_path(&entry.path) {
            for track in tracks {
                let _ = db.add_track_to_playlist(playlist_id, track.id, None);
            }
        }
    }

    Ok(playlist_id)
}

// Scan settings commands

#[tauri::command]
pub async fn get_scan_settings(state: State<'_, AppState>) -> Result<ScanSettings, String> {
    let db = lock_db(&state)?;
    let scan_on_startup = db
        .get_setting("scan_on_startup")
        .map_err(sanitize_err("Loading scan settings"))?
        .map(|v| v == "true")
        .unwrap_or(true);
    let periodic_scan_enabled = db
        .get_setting("periodic_scan_enabled")
        .map_err(sanitize_err("Loading scan settings"))?
        .map(|v| v == "true")
        .unwrap_or(true);
    let periodic_scan_interval_minutes = db
        .get_setting("periodic_scan_interval_minutes")
        .map_err(sanitize_err("Loading scan settings"))?
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(30);

    Ok(ScanSettings {
        scan_on_startup,
        periodic_scan_enabled,
        periodic_scan_interval_minutes,
    })
}

#[tauri::command]
pub async fn set_scan_settings(
    state: State<'_, AppState>,
    settings: ScanSettings,
) -> Result<(), String> {
    let mut db = lock_db(&state)?;
    db.set_setting("scan_on_startup", &settings.scan_on_startup.to_string())
        .map_err(sanitize_err("Saving scan settings"))?;
    db.set_setting(
        "periodic_scan_enabled",
        &settings.periodic_scan_enabled.to_string(),
    )
    .map_err(sanitize_err("Saving scan settings"))?;
    db.set_setting(
        "periodic_scan_interval_minutes",
        &settings.periodic_scan_interval_minutes.to_string(),
    )
    .map_err(sanitize_err("Saving scan settings"))?;
    Ok(())
}
