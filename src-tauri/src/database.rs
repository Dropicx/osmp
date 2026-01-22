use rusqlite::{Connection, Result as SqlResult, params};
use crate::models::{Track, Album, Artist, ScanFolder, TrackFilters};
use std::path::PathBuf;
use anyhow::{Context, Result};
use std::sync::{Arc, Mutex};

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
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

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
                        created_at FROM tracks WHERE 1=1".to_string();
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
                    created_at: row.get(13)?,
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
             created_at FROM tracks
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
                created_at: row.get(13)?,
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
             created_at FROM tracks WHERE id = ?1",
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
                    created_at: row.get(13)?,
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
}
