use crate::database::Database;
use crate::models::MetadataResult;
use anyhow::{Context, Result};
use serde_json::Value;
use std::time::Duration;
use std::path::Path;

pub struct MetadataFetcher {
    db: Database,
    client: reqwest::Client,
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
        let (mut artist, mut title, file_path) = {
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

        // Try to parse artist and title from filename if missing
        if artist.is_none() || title.is_none() {
            if let Some((parsed_artist, parsed_title)) = self.parse_filename(&file_path) {
                if artist.is_none() {
                    artist = Some(parsed_artist);
                }
                if title.is_none() {
                    title = Some(parsed_title);
                }
            }
        }

        // Try MusicBrainz API with different strategies
        // Strategy 1: Search with both artist and title
        if let (Some(ref a), Some(ref t)) = (&artist, &title) {
            if let Ok(result) = self.fetch_from_musicbrainz(Some(a), t, track_id).await {
                if result.success {
                    return Ok(result);
                }
            }
        }

        // Strategy 2: Search with title only
        if let Some(ref t) = title {
            if let Ok(result) = self.fetch_from_musicbrainz(None, t, track_id).await {
                if result.success {
                    return Ok(result);
                }
            }
        }

        Ok(MetadataResult {
            track_id,
            success: false,
            message: "Could not fetch metadata".to_string(),
        })
    }

    fn parse_filename(&self, file_path: &str) -> Option<(String, String)> {
        let path = Path::new(file_path);
        let filename = path.file_stem()?.to_str()?;

        // Common patterns: "Artist - Title", "Artist-Title", "Artist — Title"
        let separators = [" - ", " – ", " — ", "-"];

        for sep in separators {
            if let Some(pos) = filename.find(sep) {
                let artist = filename[..pos].trim().to_string();
                let title = filename[pos + sep.len()..].trim().to_string();
                if !artist.is_empty() && !title.is_empty() {
                    return Some((artist, title));
                }
            }
        }

        None
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
                if score < 80 {
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

                // Get album from first release
                let fetched_album = recording
                    .get("releases")
                    .and_then(|r| r.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|r| r.get("title"))
                    .and_then(|t| t.as_str())
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
                        fetched_title,
                        fetched_artist,
                        fetched_album,
                        fetched_year,
                        None,
                    )?;

                    return Ok(MetadataResult {
                        track_id,
                        success: true,
                        message: "Metadata fetched successfully".to_string(),
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

