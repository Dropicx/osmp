export interface Track {
  id: number;
  file_path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  file_size: number;
  file_format: string;
  last_modified: number;
  metadata_fetched: boolean;
  release_mbid: string | null;
  created_at: number;
}

export interface ScanFolder {
  id: number;
  path: string;
  enabled: boolean;
}

export interface TrackFilters {
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  format?: string;
}

export interface Album {
  name: string;
  artist: string | null;
  year: number | null;
  cover_art: string | null;
  track_count: number;
  total_duration: number | null;
  created_at: number;
}

export interface ScanDiscovery {
  files_found: number;
  current_folder: string;
  is_complete: boolean;
}

export interface ScanProgress {
  current_file: string;
  total_files: number;
  processed_files: number;
  is_complete: boolean;
}

export interface ScanResult {
  total_files: number;
  scanned: number;
  skipped: number;
  errors: number;
  error_files: string[];
  duration_secs: number;
  cancelled: boolean;
}

export interface ScanError {
  file: string;
  error: string;
}

export interface ScanSettings {
  scan_on_startup: boolean;
  periodic_scan_enabled: boolean;
  periodic_scan_interval_minutes: number;
}

// Library sorting types
export type SortField = 'title' | 'artist' | 'album' | 'genre' | 'duration' | 'year';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface MetadataResult {
  track_id: number;
  success: boolean;
  message: string;
}

export interface CoverFetchResult {
  track_id: number;
  success: boolean;
  message: string;
}

export interface Playlist {
  id: number;
  name: string;
  created_at: number;
  track_count: number;
  total_duration: number | null;
}

export interface PlaylistTrack {
  playlist_id: number;
  track_id: number;
  position: number;
}

// Equalizer types
export interface EqBand {
  frequency: number;
  gain_db: number;
  q: number;
  filter_type: string;
  label: string;
}

export interface EqualizerSettings {
  enabled: boolean;
  preamp_db: number;
  bands: EqBand[];
  preset_name: string;
}

export interface EqPreset {
  name: string;
  bands: number[];
  preamp: number;
}

export interface PlayHistoryEntry {
  id: number;
  track_id: number;
  played_at: number;
  duration_listened: number;
  track: Track | null;
}

export interface M3uEntry {
  path: string;
  title: string | null;
  duration: number | null;
}
