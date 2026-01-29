use crate::database::Database;
use crate::models::{ScanDiscovery, ScanError, ScanProgress, ScanResult, Track};
use anyhow::Result;
use lofty::prelude::{Accessor, AudioFile, TaggedFileExt};
use lofty::read_from_path;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::Emitter;
use tracing::{error, warn};
use walkdir::WalkDir;

const BATCH_SIZE: usize = 100;
const AUDIO_EXTENSIONS: [&str; 8] = ["mp3", "flac", "ogg", "m4a", "wav", "aac", "opus", "wma"];

/// Scanner with progress reporting, incremental scanning, batching, and cancellation support
pub struct ScannerWithProgress {
    db: Database,
    app_handle: tauri::AppHandle,
    cancelled: Arc<AtomicBool>,
    quiet: bool,
}

impl ScannerWithProgress {
    pub fn new(db: Database, app_handle: tauri::AppHandle, cancelled: Arc<AtomicBool>) -> Self {
        ScannerWithProgress {
            db,
            app_handle,
            cancelled,
            quiet: false,
        }
    }

    pub fn new_quiet(
        db: Database,
        app_handle: tauri::AppHandle,
        cancelled: Arc<AtomicBool>,
    ) -> Self {
        ScannerWithProgress {
            db,
            app_handle,
            cancelled,
            quiet: true,
        }
    }

    /// Main scan entry point with all optimizations
    pub fn scan_with_progress(&self, folders: Vec<String>) -> Result<ScanResult> {
        let start_time = Instant::now();

        // Reset cancellation flag at start of scan
        self.cancelled.store(false, Ordering::SeqCst);

        // 1. Collect all audio file paths first (fast pass)
        let files = self.collect_audio_files(&folders);
        let total_files = files.len();

        // 2. Get existing files for incremental scanning
        let existing_files = self
            .db
            .lock()
            .map_err(|e| anyhow::anyhow!("Database lock poisoned: {}", e))?
            .get_existing_file_info()
            .unwrap_or_default();

        // 3. Process files with progress reporting and batching
        let mut scanned_count = 0;
        let mut skipped_count = 0;
        let mut error_count = 0;
        let mut error_files: Vec<String> = Vec::new();
        let mut batch: Vec<Track> = Vec::with_capacity(BATCH_SIZE);

        for (index, path) in files.iter().enumerate() {
            // Check for cancellation
            if self.cancelled.load(Ordering::SeqCst) {
                // Flush any remaining batch before returning
                if !batch.is_empty() {
                    if let Ok(mut db) = self.db.lock() {
                        let _ = db.insert_tracks_batch(&batch);
                    }
                }

                return Ok(ScanResult {
                    total_files,
                    scanned: scanned_count,
                    skipped: skipped_count,
                    errors: error_count,
                    error_files,
                    duration_secs: start_time.elapsed().as_secs_f64(),
                    cancelled: true,
                });
            }

            // Emit progress event
            if !self.quiet {
                let progress = ScanProgress {
                    current_file: path.display().to_string(),
                    total_files,
                    processed_files: index,
                    is_complete: false,
                };
                let _ = self.app_handle.emit("scan-progress", &progress);
            }

            // Check if file needs scanning (incremental)
            if !self.should_scan_file(path, &existing_files) {
                skipped_count += 1;
                continue;
            }

            // Process file
            match self.scan_file_for_batch(path) {
                Ok(track) => {
                    batch.push(track);
                    scanned_count += 1;

                    // Batch insert when batch is full
                    if batch.len() >= BATCH_SIZE {
                        match self.db.lock() {
                            Ok(mut db) => {
                                if let Err(e) = db.insert_tracks_batch(&batch) {
                                    warn!("Batch insert error: {}", e);
                                }
                            }
                            Err(e) => {
                                error!("Database lock poisoned during batch insert: {}", e);
                            }
                        }
                        batch.clear();
                    }
                }
                Err(e) => {
                    error_count += 1;
                    let error_msg = e.to_string();

                    // Store all error files with their error messages
                    error_files.push(format!("{}|{}", path.display(), error_msg));

                    // Emit error event
                    if !self.quiet {
                        let scan_error = ScanError {
                            file: path.display().to_string(),
                            error: error_msg,
                        };
                        let _ = self.app_handle.emit("scan-error", &scan_error);
                    }
                }
            }
        }

        // Insert remaining batch
        if !batch.is_empty() {
            match self.db.lock() {
                Ok(mut db) => {
                    if let Err(e) = db.insert_tracks_batch(&batch) {
                        warn!("Final batch insert error: {}", e);
                    }
                }
                Err(e) => {
                    error!("Database lock poisoned during final batch insert: {}", e);
                }
            }
        }

        let duration_secs = start_time.elapsed().as_secs_f64();

        // Emit completion event
        if !self.quiet {
            let completion = ScanProgress {
                current_file: String::new(),
                total_files,
                processed_files: total_files,
                is_complete: true,
            };
            let _ = self.app_handle.emit("scan-progress", &completion);
        }

        Ok(ScanResult {
            total_files,
            scanned: scanned_count,
            skipped: skipped_count,
            errors: error_count,
            error_files,
            duration_secs,
            cancelled: false,
        })
    }

    /// Collect all audio files from folders (first pass - fast) with discovery events
    fn collect_audio_files(&self, folders: &[String]) -> Vec<PathBuf> {
        let mut files = Vec::new();
        let mut last_emit = Instant::now();

        for folder_path in folders {
            if !Path::new(folder_path).exists() {
                continue;
            }

            // Emit discovery start for this folder
            if !self.quiet {
                let _ = self.app_handle.emit(
                    "scan-discovery",
                    ScanDiscovery {
                        files_found: files.len(),
                        current_folder: folder_path.clone(),
                        is_complete: false,
                    },
                );
            }

            for entry in WalkDir::new(folder_path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                // Check for cancellation during discovery
                if self.cancelled.load(Ordering::SeqCst) {
                    return files;
                }

                let path = entry.path();

                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        let ext_lower = ext.to_string_lossy().to_lowercase();
                        if AUDIO_EXTENSIONS.contains(&ext_lower.as_str()) {
                            files.push(path.to_path_buf());

                            // Emit progress every 100ms to avoid flooding
                            if !self.quiet && last_emit.elapsed().as_millis() > 100 {
                                let _ = self.app_handle.emit(
                                    "scan-discovery",
                                    ScanDiscovery {
                                        files_found: files.len(),
                                        current_folder: folder_path.clone(),
                                        is_complete: false,
                                    },
                                );
                                last_emit = Instant::now();
                            }
                        }
                    }
                }
            }
        }

        // Emit discovery complete
        if !self.quiet {
            let _ = self.app_handle.emit(
                "scan-discovery",
                ScanDiscovery {
                    files_found: files.len(),
                    current_folder: String::new(),
                    is_complete: true,
                },
            );
        }

        files
    }

    /// Check if a file needs scanning (for incremental scan support)
    fn should_scan_file(&self, path: &Path, existing: &HashMap<String, i64>) -> bool {
        let path_str = path.to_string_lossy().to_string();

        match existing.get(&path_str) {
            None => true, // New file - needs scanning
            Some(&db_modified) => {
                // Check if file was modified since last scan
                let file_modified = fs::metadata(path)
                    .and_then(|m| m.modified())
                    .map(|t| {
                        t.duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or(std::time::Duration::ZERO)
                            .as_secs() as i64
                    })
                    .unwrap_or(0);
                file_modified > db_modified
            }
        }
    }

    /// Scan a single file and return Track (doesn't insert into DB - that's done in batches)
    fn scan_file_for_batch(&self, path: &Path) -> Result<Track> {
        let file_path = path.to_string_lossy().to_string();
        let metadata = fs::metadata(path)?;
        let file_size = metadata.len() as i64;
        let last_modified = metadata
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or(std::time::Duration::ZERO)
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
        let duration: Option<i64>;

        // Skip files that are likely sound effects based on path
        let path_str = file_path.to_lowercase();
        let skip_patterns = [
            ".app/",
            "/library/sounds",
            "/sfx/",
            "/sounds/",
            "/notification",
            "/alert",
        ];

        if skip_patterns.iter().any(|p| path_str.contains(p)) {
            return Err(anyhow::anyhow!("File in sound effects directory"));
        }

        // Try to read metadata using lofty
        match read_from_path(path) {
            Ok(tagged_file) => {
                let properties = tagged_file.properties();
                let duration_secs = properties.duration().as_secs() as i64;

                // Skip files shorter than 30 seconds (likely sound effects)
                if duration_secs < 30 {
                    return Err(anyhow::anyhow!(
                        "File too short (< 30s), likely a sound effect"
                    ));
                }

                duration = Some(duration_secs);

                if let Some(tag) = tagged_file
                    .primary_tag()
                    .or_else(|| tagged_file.first_tag())
                {
                    title = tag.title().map(|s| s.to_string());
                    artist = tag.artist().map(|s| s.to_string());
                    album = tag.album().map(|s| s.to_string());
                    year = tag.year().map(|y| y as i64);
                    genre = tag.genre().map(|s| s.to_string());
                    track_number = tag.track().map(|t| t as i64);
                }
            }
            Err(_) => {
                // Lofty failed to read the file - estimate duration from file size
                // Typical bitrates: MP3 ~128-320kbps, FLAC ~800-1400kbps
                let estimated_bitrate = match extension.as_str() {
                    "mp3" => 192_000, // 192 kbps average
                    "m4a" | "aac" => 192_000,
                    "ogg" | "opus" => 160_000,
                    "flac" => 900_000,  // ~900 kbps average
                    "wav" => 1_411_000, // CD quality
                    "wma" => 192_000,
                    _ => 192_000,
                };

                // Duration = (file_size_bits) / bitrate
                let estimated_duration = file_size
                    .checked_mul(8)
                    .and_then(|bits| bits.checked_div(estimated_bitrate))
                    .unwrap_or(0);

                // Only use estimate if it seems reasonable (> 30 seconds)
                if estimated_duration >= 30 {
                    duration = Some(estimated_duration);
                } else {
                    return Err(anyhow::anyhow!("File too short or unreadable"));
                }
            }
        }

        // If no title found in tags, use filename
        if title.is_none() {
            if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                title = Some(file_stem.to_string());
            }
        }

        Ok(Track {
            id: 0,
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
            release_mbid: None,
            created_at: 0,
        })
    }
}
