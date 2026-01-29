use osmp_lib::database::DatabaseInner;
use osmp_lib::models::Track;

fn create_test_db() -> Result<DatabaseInner, Box<dyn std::error::Error>> {
    let temp_dir = tempfile::TempDir::new()?;
    let db_path = temp_dir.path().join("test.db");

    let conn = rusqlite::Connection::open(&db_path)?;
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    let mut db = DatabaseInner { conn };
    db.init_schema()?;
    Ok(db)
}

#[test]
fn test_database_operations() -> Result<(), Box<dyn std::error::Error>> {
    let mut db = create_test_db()?;

    // Test track insertion
    let track = Track {
        id: 0,
        file_path: "/test/path.mp3".to_string(),
        title: Some("Integration Test Song".to_string()),
        artist: Some("Test Artist".to_string()),
        album: Some("Test Album".to_string()),
        duration: Some(180i64),
        year: Some(2023i64),
        genre: Some("Rock".to_string()),
        track_number: Some(1i64),
        file_size: 5000000,
        file_format: "mp3".to_string(),
        last_modified: 1234567890,
        metadata_fetched: false,
        release_mbid: None,
        created_at: 1234567890,
    };

    let track_id = db.insert_track(&track)?;

    // Test track retrieval
    let retrieved = db.get_track_by_id(track_id)?;
    assert_eq!(retrieved.title, track.title);
    assert_eq!(retrieved.artist, track.artist);

    // Test search
    let search_results = db.search_tracks("Integration")?;
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].id, track_id);

    // Test playlist creation
    let playlist_id = db.create_playlist("Test Playlist")?;
    let playlists = db.get_playlists()?;
    assert_eq!(playlists.len(), 1);

    // Test adding track to playlist
    db.add_track_to_playlist(playlist_id, track_id, None)?;
    let playlist_tracks = db.get_playlist_tracks(playlist_id)?;
    assert_eq!(playlist_tracks.len(), 1);
    assert_eq!(playlist_tracks[0].id, track_id);

    Ok(())
}

#[test]
fn test_playlist_operations() -> Result<(), Box<dyn std::error::Error>> {
    let mut db = create_test_db()?;

    // Create multiple playlists
    let playlist1_id = db.create_playlist("Playlist 1")?;
    let playlist2_id = db.create_playlist("Playlist 2")?;

    let playlists = db.get_playlists()?;
    assert_eq!(playlists.len(), 2);

    // Test playlist deletion
    db.delete_playlist(playlist1_id)?;
    let playlists_after_delete = db.get_playlists()?;
    assert_eq!(playlists_after_delete.len(), 1);
    assert_eq!(playlists_after_delete[0].id, playlist2_id);

    Ok(())
}
