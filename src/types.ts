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
