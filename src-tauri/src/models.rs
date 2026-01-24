use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: i64,
    pub file_path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<i64>,
    pub year: Option<i64>,
    pub genre: Option<String>,
    pub track_number: Option<i64>,
    pub file_size: i64,
    pub file_format: String,
    pub last_modified: i64,
    pub metadata_fetched: bool,
    pub release_mbid: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: i64,
    pub name: String,
    pub artist: Option<String>,
    pub year: Option<i64>,
    pub cover_art_path: Option<String>,
}

// Enhanced album struct for frontend with aggregated data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumInfo {
    pub name: String,
    pub artist: Option<String>,
    pub year: Option<i64>,
    pub track_count: i64,
    pub total_duration: Option<i64>,
    pub created_at: i64, // most recent track's created_at
    pub cover_art: Option<String>, // base64 data URI
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanFolder {
    pub id: i64,
    pub path: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackFilters {
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanDiscovery {
    pub files_found: usize,
    pub current_folder: String,
    pub is_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub current_file: String,
    pub total_files: usize,
    pub processed_files: usize,
    pub is_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataResult {
    pub track_id: i64,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_files: usize,
    pub scanned: usize,
    pub skipped: usize,
    pub errors: usize,
    pub error_files: Vec<String>,
    pub duration_secs: f64,
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanError {
    pub file: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverFetchResult {
    pub track_id: i64,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub created_at: i64,
    pub track_count: i64,
    pub total_duration: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistTrack {
    pub playlist_id: i64,
    pub track_id: i64,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayHistoryEntry {
    pub id: i64,
    pub track_id: i64,
    pub played_at: i64,
    pub duration_listened: i64,
    pub track: Option<Track>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct M3uEntry {
    pub path: String,
    pub title: Option<String>,
    pub duration: Option<i64>,
}
