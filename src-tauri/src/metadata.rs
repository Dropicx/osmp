use crate::database::Database;
use crate::models::MetadataResult;
use anyhow::{Context, Result};
use serde_json::Value;
use std::time::Duration;

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
        let (artist, title, already_fetched) = {
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

            (track.artist.clone(), track.title.clone(), track.metadata_fetched)
        };

        // Try MusicBrainz API
        if let Some(artist) = &artist {
            if let Some(title) = &title {
                return self.fetch_from_musicbrainz(artist, title, track_id).await;
            }
        }

        Ok(MetadataResult {
            track_id,
            success: false,
            message: "Could not fetch metadata".to_string(),
        })
    }

    async fn fetch_from_musicbrainz(
        &self,
        artist: &str,
        title: &str,
        track_id: i64,
    ) -> Result<MetadataResult> {
        let query = format!("artist:{} AND recording:{}", artist, title);
        let url = format!(
            "https://musicbrainz.org/ws/2/recording?query={}&fmt=json&limit=1",
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
            if let Some(recording) = recordings.first() {
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

                let fetched_year = recording
                    .get("first-release-date")
                    .and_then(|d| d.as_str())
                    .and_then(|s| s.split('-').next())
                    .and_then(|y| y.parse::<i64>().ok());

                {
                    self.db.lock().unwrap().update_track_metadata(
                        track_id,
                        fetched_title.clone(),
                        fetched_artist.clone(),
                        None,
                        fetched_year,
                        None,
                    )?;
                }
                return Ok(MetadataResult {
                    track_id,
                    success: true,
                    message: "Metadata fetched successfully".to_string(),
                });
            }
        }

        Ok(MetadataResult {
            track_id,
            success: false,
            message: "No results found".to_string(),
        })
    }
}

