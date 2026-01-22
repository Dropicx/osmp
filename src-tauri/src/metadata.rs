use crate::database::Database;
use crate::models::MetadataResult;
use anyhow::{Context, Result};
use regex::Regex;
use serde_json::Value;
use std::time::Duration;
use std::path::Path;

pub struct MetadataFetcher {
    db: Database,
    client: reqwest::Client,
}

struct ParsedFilename {
    cleaned_title: String,
    quoted_title: Option<String>,
    artist: Option<String>,
}

impl MetadataFetcher {
    pub fn new(db: Database) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap();

        MetadataFetcher { db, client }
    }

    pub async fn fetch_metadata_for_track(&self, track_id: i64) -> Result<MetadataResult> {
        let (existing_artist, existing_title, file_path) = {
            let track = self.db.lock().unwrap().get_track_by_id(track_id)
                .context("Track not found")?;

            // Skip if already fetched and has good metadata
            if track.metadata_fetched && track.title.is_some() && track.artist.is_some() {
                return Ok(MetadataResult {
                    track_id,
                    success: true,
                    message: "Metadata already available".to_string(),
                });
            }

            (track.artist.clone(), track.title.clone(), track.file_path.clone())
        };

        // Parse and clean the filename
        let parsed = self.parse_and_clean_filename(&file_path);

        // Build search candidates - try different combinations
        let mut search_attempts: Vec<(Option<String>, String)> = Vec::new();

        // If we found a quoted title, that's likely the real title
        if let Some(ref quoted) = parsed.quoted_title {
            if let Some(artist) = parsed.artist.as_ref().or(existing_artist.as_ref()) {
                search_attempts.push((Some(artist.to_string()), quoted.clone()));
            }
            search_attempts.push((None, quoted.clone()));
        }

        // Try cleaned title with artist
        if let Some(artist) = parsed.artist.as_ref().or(existing_artist.as_ref()) {
            search_attempts.push((Some(artist.to_string()), parsed.cleaned_title.clone()));
        }

        // Try cleaned title alone
        search_attempts.push((None, parsed.cleaned_title.clone()));

        // Try existing metadata if available
        if let (Some(ref a), Some(ref t)) = (&existing_artist, &existing_title) {
            let cleaned = self.clean_title(t);
            search_attempts.push((Some(a.clone()), cleaned));
        }

        // Try each search attempt
        for (artist, title) in search_attempts {
            if title.len() < 2 {
                continue; // Skip too short titles
            }

            if let Ok(result) = self.fetch_from_musicbrainz(artist.as_ref(), &title, track_id).await {
                if result.success {
                    return Ok(result);
                }
            }

            // Rate limit: MusicBrainz requires 1 req/sec
            tokio::time::sleep(Duration::from_millis(1100)).await;
        }

        Ok(MetadataResult {
            track_id,
            success: false,
            message: "Could not find matching metadata".to_string(),
        })
    }

    fn parse_and_clean_filename(&self, file_path: &str) -> ParsedFilename {
        let path = Path::new(file_path);
        let filename = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        let mut cleaned_title = filename.clone();
        let mut quoted_title: Option<String> = None;
        let mut artist: Option<String> = None;

        // 1. Extract quoted text (likely the real title)
        // Try regex patterns for various quote styles
        let quote_patterns = [
            r"'([^']+)'",           // 'Title'
            r#""([^"]+)""#,         // "Title"
        ];

        for pattern in quote_patterns {
            if let Ok(re) = Regex::new(pattern) {
                if let Some(caps) = re.captures(&cleaned_title) {
                    if let Some(m) = caps.get(1) {
                        let extracted = m.as_str().trim().to_string();
                        if extracted.len() >= 2 {
                            quoted_title = Some(extracted);
                            break;
                        }
                    }
                }
            }
        }

        // 2. Remove common garbage patterns using regex
        // Timestamps: (2018_07_29 13_21_06 UTC) or (2018-07-29)
        if let Ok(re) = Regex::new(r"\(\d{4}[_-]\d{2}[_-]\d{2}[^)]*\)") {
            cleaned_title = re.replace_all(&cleaned_title, " ").to_string();
        }

        // Bracketed timestamps: [2018_07_29...]
        if let Ok(re) = Regex::new(r"\[\d{4}[_-]\d{2}[_-]\d{2}[^\]]*\]") {
            cleaned_title = re.replace_all(&cleaned_title, " ").to_string();
        }

        // Track numbers at start: 01 , 01-, 01., 001
        if let Ok(re) = Regex::new(r"^\d{1,3}[\s._-]+") {
            cleaned_title = re.replace(&cleaned_title, "").to_string();
        }

        // Numbered parentheses/brackets: (1), [2], etc.
        if let Ok(re) = Regex::new(r"[\(\[]\d+[\)\]]") {
            cleaned_title = re.replace_all(&cleaned_title, " ").to_string();
        }

        // Quality/format tags: (320kbps), (mp3), (HQ)
        if let Ok(re) = Regex::new(r"(?i)\(?\b(?:320|256|192|128)\s*(?:kbps|kbs)?\)?") {
            cleaned_title = re.replace_all(&cleaned_title, " ").to_string();
        }
        if let Ok(re) = Regex::new(r"(?i)\(?\b(?:mp3|flac|wav|aac|m4a|HQ|LQ|HD)\)?") {
            cleaned_title = re.replace_all(&cleaned_title, " ").to_string();
        }

        // Common suffixes: - official, (official video), etc.
        if let Ok(re) = Regex::new(r"(?i)\s*[-_]\s*(?:official|video|audio|lyrics?|hd|hq)\s*$") {
            cleaned_title = re.replace(&cleaned_title, "").to_string();
        }
        if let Ok(re) = Regex::new(r"(?i)\s*\((?:official|video|audio|lyrics?|hd|hq)[^)]*\)\s*$") {
            cleaned_title = re.replace(&cleaned_title, "").to_string();
        }

        // Long parenthetical at end (likely garbage)
        if let Ok(re) = Regex::new(r"\s*\([^)]{15,}\)\s*$") {
            cleaned_title = re.replace(&cleaned_title, "").to_string();
        }

        // Long brackets at end
        if let Ok(re) = Regex::new(r"\s*\[[^\]]{15,}\]\s*$") {
            cleaned_title = re.replace(&cleaned_title, "").to_string();
        }

        // 3. Try to extract artist from common patterns
        let artist_patterns = [
            (" - ", false),      // "Artist - Title"
            (" – ", false),      // "Artist – Title" (en-dash)
            (" — ", false),      // "Artist — Title" (em-dash)
            (" by ", true),      // "Title by Artist"
            (" ft. ", true),     // "Title ft. Artist"
            (" feat. ", true),   // "Title feat. Artist"
            (" featuring ", true),
        ];

        for (sep, title_first) in artist_patterns {
            if let Some(pos) = cleaned_title.to_lowercase().find(&sep.to_lowercase()) {
                let before = cleaned_title[..pos].trim();
                let after = cleaned_title[pos + sep.len()..].trim();

                if title_first {
                    // "Title by Artist" or "Title feat. Artist"
                    if after.len() >= 2 {
                        artist = Some(after.to_string());
                        cleaned_title = before.to_string();
                    }
                } else {
                    // "Artist - Title"
                    if before.len() >= 2 && after.len() >= 2 {
                        artist = Some(before.to_string());
                        cleaned_title = after.to_string();
                    }
                }
                break;
            }
        }

        // 4. Clean up whitespace and special chars
        cleaned_title = cleaned_title
            .replace('_', " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        // 5. Remove quotes from cleaned title
        cleaned_title = cleaned_title
            .replace('\'', "")
            .replace('"', "")
            .trim()
            .to_string();

        ParsedFilename {
            cleaned_title,
            quoted_title,
            artist,
        }
    }

    /// Simple title cleaning for existing metadata
    fn clean_title(&self, title: &str) -> String {
        let mut result = title.to_string();

        // Remove track numbers at start
        if let Ok(re) = Regex::new(r"^\d{1,3}[\s._-]+") {
            result = re.replace(&result, "").to_string();
        }

        // Remove parenthetical garbage
        if let Ok(re) = Regex::new(r"\s*\([^)]{10,}\)\s*$") {
            result = re.replace(&result, "").to_string();
        }

        result.trim().to_string()
    }

    async fn fetch_from_musicbrainz(
        &self,
        artist: Option<&String>,
        title: &str,
        track_id: i64,
    ) -> Result<MetadataResult> {
        // Build query based on available info
        let query = if let Some(artist) = artist {
            format!("artist:\"{}\" AND recording:\"{}\"", artist, title)
        } else {
            format!("recording:\"{}\"", title)
        };

        let url = format!(
            "https://musicbrainz.org/ws/2/recording?query={}&fmt=json&limit=5",
            urlencoding::encode(&query)
        );

        let response = self.client
            .get(&url)
            .header("User-Agent", "OSMP/0.1.0 (https://github.com/Dropicx/osmp)")
            .send()
            .await
            .context("Failed to fetch from MusicBrainz")?;

        let json: Value = response.json().await?;

        if let Some(recordings) = json.get("recordings").and_then(|r| r.as_array()) {
            // Find best match - prefer one with high score
            for recording in recordings {
                let score = recording
                    .get("score")
                    .and_then(|s| s.as_i64())
                    .unwrap_or(0);

                // Only accept results with reasonable confidence
                if score < 70 {
                    continue;
                }

                let fetched_title = recording
                    .get("title")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string());

                let fetched_artist = recording
                    .get("artist-credit")
                    .and_then(|ac| ac.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|a| a.get("name"))
                    .and_then(|n| n.as_str())
                    .map(|s| s.to_string());

                // Get album and release MBID from first release
                let first_release = recording
                    .get("releases")
                    .and_then(|r| r.as_array())
                    .and_then(|arr| arr.first());

                let fetched_album = first_release
                    .and_then(|r| r.get("title"))
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string());

                // Extract release MBID for Cover Art Archive
                let release_mbid = first_release
                    .and_then(|r| r.get("id"))
                    .and_then(|id| id.as_str())
                    .map(|s| s.to_string());

                let fetched_year = recording
                    .get("first-release-date")
                    .and_then(|d| d.as_str())
                    .and_then(|s| s.split('-').next())
                    .and_then(|y| y.parse::<i64>().ok());

                // Only update if we got useful data
                if fetched_artist.is_some() || fetched_title.is_some() {
                    self.db.lock().unwrap().update_track_metadata_smart(
                        track_id,
                        fetched_title.clone(),
                        fetched_artist.clone(),
                        fetched_album.clone(),
                        fetched_year,
                        None,
                        release_mbid,
                    )?;

                    return Ok(MetadataResult {
                        track_id,
                        success: true,
                        message: format!(
                            "Found: {} - {}",
                            fetched_artist.unwrap_or_default(),
                            fetched_title.unwrap_or_default()
                        ),
                    });
                }
            }
        }

        Ok(MetadataResult {
            track_id,
            success: false,
            message: "No results found".to_string(),
        })
    }
}
