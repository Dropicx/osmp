use crate::database::Database;
use crate::models::Track;
use lofty::prelude::{Accessor, AudioFile, TaggedFileExt};
use lofty::read_from_path;
use std::path::Path;
use walkdir::WalkDir;
use anyhow::Result;
use std::fs;

pub struct Scanner {
    db: Database,
}

impl Scanner {
    pub fn new(db: Database) -> Self {
        Scanner { db }
    }

    pub fn scan_folders(&self, folders: Vec<String>) -> Result<Vec<Track>> {
        let mut all_tracks = Vec::new();
        let audio_extensions = ["mp3", "flac", "ogg", "m4a", "wav", "aac", "opus", "wma"];

        for folder_path in folders {
            if !Path::new(&folder_path).exists() {
                continue;
            }

            for entry in WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();

                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        let ext_lower = ext.to_string_lossy().to_lowercase();
                        if audio_extensions.contains(&ext_lower.as_str()) {
                            if let Ok(track) = self.scan_file(path) {
                                all_tracks.push(track);
                            }
                        }
                    }
                }
            }
        }

        Ok(all_tracks)
    }

    fn scan_file(&self, path: &Path) -> Result<Track> {
        let file_path = path.to_string_lossy().to_string();
        let metadata = fs::metadata(path)?;
        let file_size = metadata.len() as i64;
        let last_modified = metadata
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Initialize metadata fields
        let mut title = None;
        let mut artist = None;
        let mut album = None;
        let mut year = None;
        let mut genre = None;
        let mut track_number = None;
        let mut duration = None;

        // Skip files that are likely sound effects based on path
        let path_str = file_path.to_lowercase();
        let skip_patterns = [
            ".app/",           // macOS app bundles
            "/library/sounds", // System sounds
            "/sfx/",           // Sound effects folders
            "/sounds/",        // Generic sounds folders
            "/notification",   // Notification sounds
            "/alert",          // Alert sounds
        ];

        if skip_patterns.iter().any(|p| path_str.contains(p)) {
            return Err(anyhow::anyhow!("File in sound effects directory"));
        }

        // Try to read metadata using lofty
        if let Ok(tagged_file) = read_from_path(path) {
            // Get duration from audio properties
            let properties = tagged_file.properties();
            let duration_secs = properties.duration().as_secs() as i64;

            // Skip files shorter than 30 seconds (likely sound effects)
            if duration_secs < 30 {
                return Err(anyhow::anyhow!("File too short (< 30s), likely a sound effect"));
            }

            duration = Some(duration_secs);

            // Get metadata from tags
            if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                title = tag.title().map(|s| s.to_string());
                artist = tag.artist().map(|s| s.to_string());
                album = tag.album().map(|s| s.to_string());
                year = tag.year().map(|y| y as i64);
                genre = tag.genre().map(|s| s.to_string());
                track_number = tag.track().map(|t| t as i64);
            }
        }

        // If no title found in tags, use filename
        if title.is_none() {
            if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                title = Some(file_stem.to_string());
            }
        }

        let track = Track {
            id: 0, // Will be set by database
            file_path,
            title,
            artist,
            album,
            duration,
            year,
            genre,
            track_number,
            file_size,
            file_format: extension,
            last_modified,
            metadata_fetched: false,
            created_at: 0,
        };

        // Insert or update in database
        self.db.lock().unwrap().insert_or_update_track(&track)?;

        Ok(track)
    }
}
