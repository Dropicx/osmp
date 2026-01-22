use rusqlite::{Connection, Result as SqlResult, params};
use crate::models::{Track, ScanFolder, TrackFilters, Playlist};
use crate::equalizer::EqualizerSettings;
use anyhow::{Context, Result};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

pub type Database = Arc<Mutex<DatabaseInner>>;

pub struct DatabaseInner {
    conn: Connection,
}

impl DatabaseInner {
    pub fn new() -> Result<Self> {
        // Use a local database file in the app directory
        let db_path = "osmp.db";
        let conn = Connection::open(db_path)
            .context("Failed to open database")?;
        
        let mut db = DatabaseInner { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&mut self) -> SqlResult<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                title TEXT,
                artist TEXT,
                album TEXT,
                duration INTEGER,
                year INTEGER,
                genre TEXT,
                track_number INTEGER,
                file_size INTEGER,
                file_format TEXT,
                last_modified INTEGER,
                metadata_fetched BOOLEAN DEFAULT 0,
                release_mbid TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        // Add release_mbid column if it doesn't exist (for existing databases)
        let _ = self.conn.execute(
            "ALTER TABLE tracks ADD COLUMN release_mbid TEXT",
            [],
        );

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS albums (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                artist TEXT,
                year INTEGER,
                cover_art_path TEXT
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id INTEGER,
                track_id INTEGER,
                position INTEGER,
                FOREIGN KEY (playlist_id) REFERENCES playlists(id),
                FOREIGN KEY (track_id) REFERENCES tracks(id)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS scan_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                enabled BOOLEAN DEFAULT 1
            )",
            [],
        )?;

        // Create indexes for performance
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre)",
            [],
        )?;

        // Create indexes for playlist_tracks
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position)",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS eq_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled BOOLEAN DEFAULT 1,
                preamp_db REAL DEFAULT 0.0,
                band1_gain REAL DEFAULT 0.0,
                band2_gain REAL DEFAULT 0.0,
                band3_gain REAL DEFAULT 0.0,
                band4_gain REAL DEFAULT 0.0,
                band5_gain REAL DEFAULT 0.0,
                preset_name TEXT DEFAULT 'Flat'
            )",
            [],
        )?;

        Ok(())
    }

    pub fn insert_or_update_track(&mut self, track: &Track) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO tracks (
                file_path, title, artist, album, duration, year, genre,
                track_number, file_size, file_format, last_modified, metadata_fetched
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(file_path) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album = excluded.album,
                duration = excluded.duration,
                year = excluded.year,
                genre = excluded.genre,
                track_number = excluded.track_number,
                file_size = excluded.file_size,
                file_format = excluded.file_format,
                last_modified = excluded.last_modified,
                metadata_fetched = excluded.metadata_fetched",
            params![
                track.file_path,
                track.title,
                track.artist,
                track.album,
                track.duration,
                track.year,
                track.genre,
                track.track_number,
                track.file_size,
                track.file_format,
                track.last_modified,
                track.metadata_fetched,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_tracks(&mut self, filters: Option<&TrackFilters>) -> SqlResult<Vec<Track>> {
        let mut query = "SELECT id, file_path, title, artist, album, duration, year, genre,
                        track_number, file_size, file_format, last_modified, metadata_fetched,
                        release_mbid, created_at FROM tracks WHERE 1=1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if let Some(filters) = filters {
            if let Some(artist) = &filters.artist {
                query.push_str(" AND artist = ?");
                params_vec.push(Box::new(artist.clone()));
            }
            if let Some(album) = &filters.album {
                query.push_str(" AND album = ?");
                params_vec.push(Box::new(album.clone()));
            }
            if let Some(genre) = &filters.genre {
                query.push_str(" AND genre = ?");
                params_vec.push(Box::new(genre.clone()));
            }
            if let Some(year) = filters.year {
                query.push_str(" AND year = ?");
                params_vec.push(Box::new(year));
            }
            if let Some(format) = &filters.format {
                query.push_str(" AND file_format = ?");
                params_vec.push(Box::new(format.clone()));
            }
        }

        query.push_str(" ORDER BY title COLLATE NOCASE");

        let mut stmt = self.conn.prepare(&query)?;
        let rows = stmt.query_map(
            rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())),
            |row| {
                Ok(Track {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    duration: row.get(5)?,
                    year: row.get(6)?,
                    genre: row.get(7)?,
                    track_number: row.get(8)?,
                    file_size: row.get(9)?,
                    file_format: row.get(10)?,
                    last_modified: row.get(11)?,
                    metadata_fetched: row.get(12)?,
                    release_mbid: row.get(13)?,
                    created_at: row.get(14)?,
                })
            },
        )?;

        let mut tracks = Vec::new();
        for track in rows {
            tracks.push(track?);
        }
        Ok(tracks)
    }

    pub fn search_tracks(&mut self, query: &str) -> SqlResult<Vec<Track>> {
        let search_term = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, title, artist, album, duration, year, genre,
             track_number, file_size, file_format, last_modified, metadata_fetched,
             release_mbid, created_at FROM tracks
             WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1
             ORDER BY title COLLATE NOCASE"
        )?;

        let rows = stmt.query_map(params![search_term], |row| {
            Ok(Track {
                id: row.get(0)?,
                file_path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration: row.get(5)?,
                year: row.get(6)?,
                genre: row.get(7)?,
                track_number: row.get(8)?,
                file_size: row.get(9)?,
                file_format: row.get(10)?,
                last_modified: row.get(11)?,
                metadata_fetched: row.get(12)?,
                release_mbid: row.get(13)?,
                created_at: row.get(14)?,
            })
        })?;

        let mut tracks = Vec::new();
        for track in rows {
            tracks.push(track?);
        }
        Ok(tracks)
    }

    pub fn get_track_by_id(&mut self, id: i64) -> SqlResult<Track> {
        self.conn.query_row(
            "SELECT id, file_path, title, artist, album, duration, year, genre,
             track_number, file_size, file_format, last_modified, metadata_fetched,
             release_mbid, created_at FROM tracks WHERE id = ?1",
            params![id],
            |row| {
                Ok(Track {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    duration: row.get(5)?,
                    year: row.get(6)?,
                    genre: row.get(7)?,
                    track_number: row.get(8)?,
                    file_size: row.get(9)?,
                    file_format: row.get(10)?,
                    last_modified: row.get(11)?,
                    metadata_fetched: row.get(12)?,
                    release_mbid: row.get(13)?,
                    created_at: row.get(14)?,
                })
            },
        )
    }

    pub fn update_track_metadata(&mut self, track_id: i64, title: Option<String>, artist: Option<String>,
                                album: Option<String>, year: Option<i64>, genre: Option<String>) -> SqlResult<()> {
        self.conn.execute(
            "UPDATE tracks SET title = ?1, artist = ?2, album = ?3, year = ?4, genre = ?5, metadata_fetched = 1
             WHERE id = ?6",
            params![title, artist, album, year, genre, track_id],
        )?;
        Ok(())
    }

    /// Smart update that only updates fields with values, preserving existing data
    pub fn update_track_metadata_smart(&mut self, track_id: i64, title: Option<String>, artist: Option<String>,
                                       album: Option<String>, year: Option<i64>, genre: Option<String>,
                                       release_mbid: Option<String>) -> SqlResult<()> {
        // Build dynamic update query - only update fields that have values
        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref t) = title {
            updates.push("title = ?");
            params.push(Box::new(t.clone()));
        }
        if let Some(ref a) = artist {
            updates.push("artist = ?");
            params.push(Box::new(a.clone()));
        }
        if let Some(ref al) = album {
            updates.push("album = ?");
            params.push(Box::new(al.clone()));
        }
        if let Some(y) = year {
            updates.push("year = ?");
            params.push(Box::new(y));
        }
        if let Some(ref g) = genre {
            updates.push("genre = ?");
            params.push(Box::new(g.clone()));
        }
        if let Some(ref mbid) = release_mbid {
            updates.push("release_mbid = ?");
            params.push(Box::new(mbid.clone()));
        }

        if updates.is_empty() {
            // Nothing to update, just mark as fetched
            self.conn.execute(
                "UPDATE tracks SET metadata_fetched = 1 WHERE id = ?",
                params![track_id],
            )?;
        } else {
            updates.push("metadata_fetched = 1");
            let query = format!("UPDATE tracks SET {} WHERE id = ?", updates.join(", "));
            params.push(Box::new(track_id));

            self.conn.execute(
                &query,
                rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            )?;
        }

        Ok(())
    }

    /// Manual metadata update - replaces all editable fields
    pub fn update_track_metadata_manual(
        &mut self,
        track_id: i64,
        title: Option<String>,
        artist: Option<String>,
        album: Option<String>,
        year: Option<i64>,
        genre: Option<String>,
        track_number: Option<i64>,
    ) -> SqlResult<()> {
        self.conn.execute(
            "UPDATE tracks SET title = ?1, artist = ?2, album = ?3, year = ?4, genre = ?5, track_number = ?6
             WHERE id = ?7",
            params![title, artist, album, year, genre, track_number, track_id],
        )?;
        Ok(())
    }

    pub fn get_scan_folders(&mut self) -> SqlResult<Vec<ScanFolder>> {
        let mut stmt = self.conn.prepare("SELECT id, path, enabled FROM scan_folders ORDER BY path")?;
        let rows = stmt.query_map([], |row| {
            Ok(ScanFolder {
                id: row.get(0)?,
                path: row.get(1)?,
                enabled: row.get(2)?,
            })
        })?;

        let mut folders = Vec::new();
        for folder in rows {
            folders.push(folder?);
        }
        Ok(folders)
    }

    pub fn add_scan_folder(&mut self, path: &str) -> SqlResult<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO scan_folders (path, enabled) VALUES (?1, 1)",
            params![path],
        )?;
        Ok(())
    }

    pub fn remove_scan_folder(&mut self, id: i64) -> SqlResult<()> {
        self.conn.execute("DELETE FROM scan_folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_track(&mut self, id: i64) -> SqlResult<()> {
        self.conn.execute("DELETE FROM tracks WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_tracks(&mut self, ids: &[i64]) -> SqlResult<()> {
        for id in ids {
            self.conn.execute("DELETE FROM tracks WHERE id = ?1", params![id])?;
        }
        Ok(())
    }

    pub fn get_albums(&mut self) -> SqlResult<Vec<(String, Option<String>, Option<i64>, i64, Option<i64>, i64)>> {
        // Group by album and artist, calculate aggregates
        // Returns: (album_name, artist, year, track_count, total_duration, most_recent_created_at)
        let mut stmt = self.conn.prepare(
            "SELECT 
                album,
                artist,
                MAX(year) as year,
                COUNT(*) as track_count,
                SUM(duration) as total_duration,
                MAX(created_at) as most_recent_created_at
            FROM tracks
            WHERE album IS NOT NULL AND album != ''
            GROUP BY album, artist
            ORDER BY most_recent_created_at DESC, album COLLATE NOCASE"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })?;

        let mut albums = Vec::new();
        for album in rows {
            albums.push(album?);
        }
        Ok(albums)
    }

    pub fn get_album_tracks(&mut self, album_name: &str, artist: Option<&str>) -> SqlResult<Vec<Track>> {
        let mut query = "SELECT id, file_path, title, artist, album, duration, year, genre,
                        track_number, file_size, file_format, last_modified, metadata_fetched,
                        release_mbid, created_at FROM tracks WHERE album = ?1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(album_name.to_string())];

        if let Some(artist) = artist {
            query.push_str(" AND artist = ?2");
            params_vec.push(Box::new(artist.to_string()));
        }

        // Order by track_number if available, otherwise by title
        query.push_str(" ORDER BY 
            CASE WHEN track_number IS NOT NULL THEN track_number ELSE 999999 END,
            title COLLATE NOCASE");

        let mut stmt = self.conn.prepare(&query)?;
        let rows = stmt.query_map(
            rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())),
            |row| {
                Ok(Track {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    duration: row.get(5)?,
                    year: row.get(6)?,
                    genre: row.get(7)?,
                    track_number: row.get(8)?,
                    file_size: row.get(9)?,
                    file_format: row.get(10)?,
                    last_modified: row.get(11)?,
                    metadata_fetched: row.get(12)?,
                    release_mbid: row.get(13)?,
                    created_at: row.get(14)?,
                })
            },
        )?;

        let mut tracks = Vec::new();
        for track in rows {
            tracks.push(track?);
        }
        Ok(tracks)
    }

    pub fn get_album_first_track_id(&mut self, album_name: &str, artist: Option<&str>) -> SqlResult<Option<i64>> {
        // Get first track ID from album, preferring one with release_mbid
        let mut query = "SELECT id FROM tracks WHERE album = ?1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(album_name.to_string())];

        if let Some(artist) = artist {
            query.push_str(" AND artist = ?2");
            params_vec.push(Box::new(artist.to_string()));
        }

        // Prefer tracks with release_mbid, then order by track_number
        query.push_str(" ORDER BY 
            CASE WHEN release_mbid IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN track_number IS NOT NULL THEN track_number ELSE 999999 END,
            title COLLATE NOCASE
            LIMIT 1");

        let mut stmt = self.conn.prepare(&query)?;
        let result = stmt.query_row(
            rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())),
            |row| row.get::<_, i64>(0),
        );

        match result {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Get existing file paths with their last_modified timestamps for incremental scanning
    pub fn get_existing_file_info(&mut self) -> SqlResult<HashMap<String, i64>> {
        let mut stmt = self.conn.prepare(
            "SELECT file_path, last_modified FROM tracks"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;

        let mut map = HashMap::new();
        for row in rows {
            let (path, modified) = row?;
            map.insert(path, modified);
        }
        Ok(map)
    }

    /// Batch insert/update tracks within a single transaction for better performance
    pub fn insert_tracks_batch(&mut self, tracks: &[Track]) -> SqlResult<usize> {
        let tx = self.conn.transaction()?;

        for track in tracks {
            tx.execute(
                "INSERT INTO tracks (
                    file_path, title, artist, album, duration, year, genre,
                    track_number, file_size, file_format, last_modified, metadata_fetched
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                ON CONFLICT(file_path) DO UPDATE SET
                    title = excluded.title,
                    artist = excluded.artist,
                    album = excluded.album,
                    duration = excluded.duration,
                    year = excluded.year,
                    genre = excluded.genre,
                    track_number = excluded.track_number,
                    file_size = excluded.file_size,
                    file_format = excluded.file_format,
                    last_modified = excluded.last_modified,
                    metadata_fetched = excluded.metadata_fetched",
                params![
                    track.file_path,
                    track.title,
                    track.artist,
                    track.album,
                    track.duration,
                    track.year,
                    track.genre,
                    track.track_number,
                    track.file_size,
                    track.file_format,
                    track.last_modified,
                    track.metadata_fetched,
                ],
            )?;
        }

        tx.commit()?;
        Ok(tracks.len())
    }

    // Playlist methods
    pub fn create_playlist(&mut self, name: &str) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO playlists (name) VALUES (?1)",
            params![name],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn delete_playlist(&mut self, id: i64) -> SqlResult<()> {
        let tx = self.conn.transaction()?;
        // Delete all tracks from playlist first
        tx.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
            params![id],
        )?;
        // Then delete the playlist
        tx.execute(
            "DELETE FROM playlists WHERE id = ?1",
            params![id],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn rename_playlist(&mut self, id: i64, new_name: &str) -> SqlResult<()> {
        self.conn.execute(
            "UPDATE playlists SET name = ?1 WHERE id = ?2",
            params![new_name, id],
        )?;
        Ok(())
    }

    pub fn get_playlists(&mut self) -> SqlResult<Vec<Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT 
                p.id,
                p.name,
                p.created_at,
                COUNT(pt.track_id) as track_count,
                SUM(t.duration) as total_duration
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            LEFT JOIN tracks t ON pt.track_id = t.id
            GROUP BY p.id, p.name, p.created_at
            ORDER BY p.name COLLATE NOCASE"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                track_count: row.get(3)?,
                total_duration: row.get(4)?,
            })
        })?;

        let mut playlists = Vec::new();
        for playlist in rows {
            playlists.push(playlist?);
        }
        Ok(playlists)
    }

    pub fn get_playlist(&mut self, id: i64) -> SqlResult<Playlist> {
        self.conn.query_row(
            "SELECT 
                p.id,
                p.name,
                p.created_at,
                COUNT(pt.track_id) as track_count,
                SUM(t.duration) as total_duration
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            LEFT JOIN tracks t ON pt.track_id = t.id
            WHERE p.id = ?1
            GROUP BY p.id, p.name, p.created_at",
            params![id],
            |row| {
                Ok(Playlist {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    track_count: row.get(3)?,
                    total_duration: row.get(4)?,
                })
            },
        )
    }

    pub fn get_playlist_tracks(&mut self, playlist_id: i64) -> SqlResult<Vec<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.file_path, t.title, t.artist, t.album, t.duration, t.year, t.genre,
                    t.track_number, t.file_size, t.file_format, t.last_modified, t.metadata_fetched,
                    t.release_mbid, t.created_at
             FROM tracks t
             INNER JOIN playlist_tracks pt ON t.id = pt.track_id
             WHERE pt.playlist_id = ?1
             ORDER BY pt.position ASC"
        )?;

        let rows = stmt.query_map(params![playlist_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                file_path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album: row.get(4)?,
                duration: row.get(5)?,
                year: row.get(6)?,
                genre: row.get(7)?,
                track_number: row.get(8)?,
                file_size: row.get(9)?,
                file_format: row.get(10)?,
                last_modified: row.get(11)?,
                metadata_fetched: row.get(12)?,
                release_mbid: row.get(13)?,
                created_at: row.get(14)?,
            })
        })?;

        let mut tracks = Vec::new();
        for track in rows {
            tracks.push(track?);
        }
        Ok(tracks)
    }

    pub fn add_track_to_playlist(&mut self, playlist_id: i64, track_id: i64, position: Option<i64>) -> SqlResult<()> {
        // If position is not specified, add to end
        let final_position = if let Some(pos) = position {
            pos
        } else {
            // Get max position and add 1
            let max_pos: Option<i64> = self.conn.query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |row| row.get(0),
            ).unwrap_or(Some(0));
            max_pos.unwrap_or(0)
        };

        // Check if track already exists in playlist
        let exists: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2)",
            params![playlist_id, track_id],
            |row| row.get(0),
        ).unwrap_or(false);

        if !exists {
            self.conn.execute(
                "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
                params![playlist_id, track_id, final_position],
            )?;
        }
        Ok(())
    }

    pub fn remove_track_from_playlist(&mut self, playlist_id: i64, track_id: i64) -> SqlResult<()> {
        // Get the position of the track being removed
        let removed_position: Option<i64> = self.conn.query_row(
            "SELECT position FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
            |row| row.get(0),
        ).ok();

        // Delete the track
        self.conn.execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
        )?;

        // Reorder remaining tracks if needed
        if let Some(pos) = removed_position {
            self.conn.execute(
                "UPDATE playlist_tracks SET position = position - 1 
                 WHERE playlist_id = ?1 AND position > ?2",
                params![playlist_id, pos],
            )?;
        }

        Ok(())
    }

    pub fn reorder_playlist_tracks(&mut self, playlist_id: i64, track_positions: Vec<(i64, i64)>) -> SqlResult<()> {
        let tx = self.conn.transaction()?;
        
        for (track_id, new_position) in track_positions {
            tx.execute(
                "UPDATE playlist_tracks SET position = ?1 WHERE playlist_id = ?2 AND track_id = ?3",
                params![new_position, playlist_id, track_id],
            )?;
        }
        
        tx.commit()?;
        Ok(())
    }

    pub fn duplicate_playlist(&mut self, playlist_id: i64, new_name: &str) -> SqlResult<i64> {
        let tx = self.conn.transaction()?;
        
        // Create new playlist
        tx.execute(
            "INSERT INTO playlists (name) VALUES (?1)",
            params![new_name],
        )?;
        let new_playlist_id = tx.last_insert_rowid();
        
        // Copy all tracks with their positions
        tx.execute(
            "INSERT INTO playlist_tracks (playlist_id, track_id, position)
             SELECT ?1, track_id, position
             FROM playlist_tracks
             WHERE playlist_id = ?2
             ORDER BY position",
            params![new_playlist_id, playlist_id],
        )?;
        
        tx.commit()?;
        Ok(new_playlist_id)
    }

    pub fn get_playlist_metadata(&mut self, id: i64) -> SqlResult<(i64, Option<i64>)> {
        self.conn.query_row(
            "SELECT
                COUNT(pt.track_id) as track_count,
                SUM(t.duration) as total_duration
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            LEFT JOIN tracks t ON pt.track_id = t.id
            WHERE p.id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
    }

    pub fn load_eq_settings(&mut self) -> SqlResult<Option<EqualizerSettings>> {
        let result = self.conn.query_row(
            "SELECT enabled, preamp_db, band1_gain, band2_gain, band3_gain, band4_gain, band5_gain, preset_name
             FROM eq_settings WHERE id = 1",
            [],
            |row| {
                let enabled: bool = row.get(0)?;
                let preamp_db: f64 = row.get(1)?;
                let band1: f64 = row.get(2)?;
                let band2: f64 = row.get(3)?;
                let band3: f64 = row.get(4)?;
                let band4: f64 = row.get(5)?;
                let band5: f64 = row.get(6)?;
                let preset_name: String = row.get(7)?;

                let mut settings = EqualizerSettings::default();
                settings.enabled = enabled;
                settings.preamp_db = preamp_db as f32;
                settings.bands[0].gain_db = band1 as f32;
                settings.bands[1].gain_db = band2 as f32;
                settings.bands[2].gain_db = band3 as f32;
                settings.bands[3].gain_db = band4 as f32;
                settings.bands[4].gain_db = band5 as f32;
                settings.preset_name = preset_name;

                Ok(settings)
            },
        );

        match result {
            Ok(settings) => Ok(Some(settings)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_eq_settings(&mut self, settings: &EqualizerSettings) -> SqlResult<()> {
        self.conn.execute(
            "INSERT INTO eq_settings (id, enabled, preamp_db, band1_gain, band2_gain, band3_gain, band4_gain, band5_gain, preset_name)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                enabled = excluded.enabled,
                preamp_db = excluded.preamp_db,
                band1_gain = excluded.band1_gain,
                band2_gain = excluded.band2_gain,
                band3_gain = excluded.band3_gain,
                band4_gain = excluded.band4_gain,
                band5_gain = excluded.band5_gain,
                preset_name = excluded.preset_name",
            params![
                settings.enabled,
                settings.preamp_db as f64,
                settings.bands[0].gain_db as f64,
                settings.bands[1].gain_db as f64,
                settings.bands[2].gain_db as f64,
                settings.bands[3].gain_db as f64,
                settings.bands[4].gain_db as f64,
                settings.preset_name,
            ],
        )?;
        Ok(())
    }
}
