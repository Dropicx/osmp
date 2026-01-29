import type {
  Track,
  Playlist,
  Album,
  EqualizerSettings,
  EqPreset,
  EqBand,
  ScanFolder,
  ScanResult,
} from '../types';

export const mockTrack: Track = {
  id: 1,
  file_path: '/music/song.mp3',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 180,
  year: 2023,
  genre: 'Rock',
  track_number: 1,
  file_size: 5000000,
  file_format: 'mp3',
  last_modified: 1700000000,
  metadata_fetched: true,
  release_mbid: null,
  created_at: 1700000000,
};

export const mockTrack2: Track = {
  id: 2,
  file_path: '/music/song2.mp3',
  title: 'Second Song',
  artist: 'Another Artist',
  album: 'Another Album',
  duration: 240,
  year: 2022,
  genre: 'Pop',
  track_number: 2,
  file_size: 6000000,
  file_format: 'mp3',
  last_modified: 1700000100,
  metadata_fetched: false,
  release_mbid: null,
  created_at: 1700000100,
};

export const mockTrack3: Track = {
  id: 3,
  file_path: '/music/song3.flac',
  title: null,
  artist: null,
  album: null,
  duration: null,
  year: null,
  genre: null,
  track_number: null,
  file_size: 30000000,
  file_format: 'flac',
  last_modified: 1700000200,
  metadata_fetched: false,
  release_mbid: null,
  created_at: 1700000200,
};

export const mockPlaylist: Playlist = {
  id: 1,
  name: 'Test Playlist',
  created_at: 1700000000,
  track_count: 5,
  total_duration: 900,
};

export const mockPlaylist2: Playlist = {
  id: 2,
  name: 'Another Playlist',
  created_at: 1700000100,
  track_count: 3,
  total_duration: 600,
};

export const mockAlbum: Album = {
  name: 'Test Album',
  artist: 'Test Artist',
  year: 2023,
  cover_art: null,
  track_count: 10,
  total_duration: 2400,
  created_at: 1700000000,
};

export const mockAlbum2: Album = {
  name: 'Another Album',
  artist: 'Another Artist',
  year: 2022,
  cover_art: 'data:image/png;base64,abc123',
  track_count: 8,
  total_duration: 1800,
  created_at: 1700000100,
};

export const mockEqBand: EqBand = {
  frequency: 60,
  gain_db: 0,
  q: 1.0,
  filter_type: 'peaking',
  label: '60 Hz',
};

export const mockEqSettings: EqualizerSettings = {
  enabled: true,
  preamp_db: 0,
  bands: [
    { frequency: 60, gain_db: 0, q: 1.0, filter_type: 'peaking', label: '60 Hz' },
    { frequency: 230, gain_db: 0, q: 1.0, filter_type: 'peaking', label: '230 Hz' },
    { frequency: 910, gain_db: 0, q: 1.0, filter_type: 'peaking', label: '910 Hz' },
    { frequency: 4000, gain_db: 0, q: 1.0, filter_type: 'peaking', label: '4 kHz' },
    { frequency: 14000, gain_db: 0, q: 1.0, filter_type: 'peaking', label: '14 kHz' },
  ],
  preset_name: 'Flat',
};

export const mockEqPreset: EqPreset = {
  name: 'Rock',
  bands: [4, 2, -1, 3, 5],
  preamp: 0,
};

export const mockScanFolder: ScanFolder = {
  id: 1,
  path: '/home/user/Music',
  enabled: true,
};

export const mockScanResult: ScanResult = {
  total_files: 100,
  scanned: 95,
  skipped: 3,
  errors: 2,
  error_files: ['file1.mp3|Decode error', 'file2.wav|Too short'],
  duration_secs: 5.2,
  cancelled: false,
};
