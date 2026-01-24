use crate::models::{Track, M3uEntry};
use std::fs;
use std::io::{self, Write, BufRead, BufReader};
use std::path::Path;

/// Export a playlist to M3U format
pub fn export_m3u(playlist_name: &str, tracks: &[Track], output_path: &str) -> io::Result<()> {
    let mut file = fs::File::create(output_path)?;

    writeln!(file, "#EXTM3U")?;
    writeln!(file, "#PLAYLIST:{}", playlist_name)?;

    for track in tracks {
        let duration = track.duration.unwrap_or(-1);
        let title = track.title.as_deref().unwrap_or("Unknown");
        let artist = track.artist.as_deref().unwrap_or("Unknown");

        writeln!(file, "#EXTINF:{},{} - {}", duration, artist, title)?;
        writeln!(file, "{}", track.file_path)?;
    }

    Ok(())
}

/// Parse an M3U/M3U8 file into entries
pub fn parse_m3u(file_path: &str) -> io::Result<Vec<M3uEntry>> {
    let file = fs::File::open(file_path)?;
    let reader = BufReader::new(file);
    let base_dir = Path::new(file_path).parent().unwrap_or(Path::new("."));

    let mut entries = Vec::new();
    let mut current_title: Option<String> = None;
    let mut current_duration: Option<i64> = None;

    for line in reader.lines() {
        let line = line?;
        let line = line.trim();

        if line.is_empty() || line == "#EXTM3U" || line.starts_with("#PLAYLIST:") {
            continue;
        }

        if let Some(extinf) = line.strip_prefix("#EXTINF:") {
            // Parse #EXTINF:duration,title
            if let Some(comma_pos) = extinf.find(',') {
                let dur_str = &extinf[..comma_pos];
                current_duration = dur_str.trim().parse::<i64>().ok();
                current_title = Some(extinf[comma_pos + 1..].trim().to_string());
            }
            continue;
        }

        if line.starts_with('#') {
            continue;
        }

        // This is a file path
        let resolved_path = if Path::new(line).is_absolute() {
            line.to_string()
        } else {
            base_dir.join(line).to_string_lossy().to_string()
        };

        entries.push(M3uEntry {
            path: resolved_path,
            title: current_title.take(),
            duration: current_duration.take(),
        });
    }

    Ok(entries)
}
