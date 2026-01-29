import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { commands } from '../commands';

vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

describe('commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe('scan operations', () => {
    it('getScanFolders calls invoke correctly', async () => {
      mockInvoke.mockResolvedValue([]);
      await commands.getScanFolders();
      expect(mockInvoke).toHaveBeenCalledWith('get_scan_folders');
    });

    it('addScanFolder passes path', async () => {
      await commands.addScanFolder('/music');
      expect(mockInvoke).toHaveBeenCalledWith('add_scan_folder', { path: '/music' });
    });

    it('removeScanFolder passes id', async () => {
      await commands.removeScanFolder(1);
      expect(mockInvoke).toHaveBeenCalledWith('remove_scan_folder', { id: 1 });
    });

    it('scanFolders calls invoke', async () => {
      await commands.scanFolders();
      expect(mockInvoke).toHaveBeenCalledWith('scan_folders');
    });

    it('cancelScan calls invoke', async () => {
      await commands.cancelScan();
      expect(mockInvoke).toHaveBeenCalledWith('cancel_scan');
    });
  });

  describe('track operations', () => {
    it('getTracks passes null filters by default', async () => {
      await commands.getTracks();
      expect(mockInvoke).toHaveBeenCalledWith('get_tracks', { filters: null });
    });

    it('getTracks passes provided filters', async () => {
      const filters = { artist: 'Test' };
      await commands.getTracks(filters);
      expect(mockInvoke).toHaveBeenCalledWith('get_tracks', { filters });
    });

    it('getTracks converts null/undefined filters', async () => {
      await commands.getTracks(null);
      expect(mockInvoke).toHaveBeenCalledWith('get_tracks', { filters: null });
    });

    it('searchTracks passes query', async () => {
      await commands.searchTracks('rock');
      expect(mockInvoke).toHaveBeenCalledWith('search_tracks', { query: 'rock' });
    });

    it('deleteTrack passes trackId', async () => {
      await commands.deleteTrack(5);
      expect(mockInvoke).toHaveBeenCalledWith('delete_track', { trackId: 5 });
    });

    it('deleteTracks passes trackIds array', async () => {
      await commands.deleteTracks([1, 2, 3]);
      expect(mockInvoke).toHaveBeenCalledWith('delete_tracks', { trackIds: [1, 2, 3] });
    });
  });

  describe('playback', () => {
    it('playTrack passes trackId', async () => {
      await commands.playTrack(1);
      expect(mockInvoke).toHaveBeenCalledWith('play_track', { trackId: 1 });
    });

    it('pausePlayback calls invoke', async () => {
      await commands.pausePlayback();
      expect(mockInvoke).toHaveBeenCalledWith('pause_playback');
    });

    it('stopPlayback calls invoke', async () => {
      await commands.stopPlayback();
      expect(mockInvoke).toHaveBeenCalledWith('stop_playback');
    });

    it('setVolume clamps to [0, 1]', async () => {
      await commands.setVolume(0.5);
      expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0.5 });

      await commands.setVolume(-1);
      expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 0 });

      await commands.setVolume(2);
      expect(mockInvoke).toHaveBeenCalledWith('set_volume', { volume: 1 });
    });

    it('getPlaybackPosition calls invoke', async () => {
      await commands.getPlaybackPosition();
      expect(mockInvoke).toHaveBeenCalledWith('get_playback_position');
    });

    it('seekToPosition clamps to >= 0', async () => {
      await commands.seekToPosition(30);
      expect(mockInvoke).toHaveBeenCalledWith('seek_to_position', { position: 30 });

      await commands.seekToPosition(-5);
      expect(mockInvoke).toHaveBeenCalledWith('seek_to_position', { position: 0 });
    });

    it('setPlaybackSpeed passes speed', async () => {
      await commands.setPlaybackSpeed(1.5);
      expect(mockInvoke).toHaveBeenCalledWith('set_playback_speed', { speed: 1.5 });
    });

    it('preloadNextTrack passes trackId', async () => {
      await commands.preloadNextTrack(5);
      expect(mockInvoke).toHaveBeenCalledWith('preload_next_track', { trackId: 5 });
    });
  });

  describe('metadata', () => {
    it('fetchMetadata passes trackIds and force', async () => {
      await commands.fetchMetadata([1, 2]);
      expect(mockInvoke).toHaveBeenCalledWith('fetch_metadata', { trackIds: [1, 2], force: false });

      await commands.fetchMetadata([3], true);
      expect(mockInvoke).toHaveBeenCalledWith('fetch_metadata', { trackIds: [3], force: true });
    });

    it('updateTrackMetadataManual passes all params', async () => {
      await commands.updateTrackMetadataManual(1, 'Title', 'Artist', 'Album', 2023, 'Rock', 1);
      expect(mockInvoke).toHaveBeenCalledWith('update_track_metadata_manual', {
        trackId: 1,
        title: 'Title',
        artist: 'Artist',
        album: 'Album',
        year: 2023,
        genre: 'Rock',
        trackNumber: 1,
      });
    });

    it('writeMetadataToFile passes all params', async () => {
      await commands.writeMetadataToFile(1, 'T', 'A', 'Al', 2023, 'Pop', 2);
      expect(mockInvoke).toHaveBeenCalledWith('write_metadata_to_file', {
        trackId: 1,
        title: 'T',
        artist: 'A',
        album: 'Al',
        year: 2023,
        genre: 'Pop',
        trackNumber: 2,
      });
    });
  });

  describe('cover art', () => {
    it('getTrackCover passes trackId', async () => {
      await commands.getTrackCover(1);
      expect(mockInvoke).toHaveBeenCalledWith('get_track_cover', { trackId: 1 });
    });

    it('fetchCovers passes trackIds', async () => {
      await commands.fetchCovers([1, 2]);
      expect(mockInvoke).toHaveBeenCalledWith('fetch_covers', { trackIds: [1, 2] });
    });

    it('getAlbumCover passes albumName and artist', async () => {
      await commands.getAlbumCover('Album', 'Artist');
      expect(mockInvoke).toHaveBeenCalledWith('get_album_cover', {
        albumName: 'Album',
        artist: 'Artist',
      });

      await commands.getAlbumCover('Album');
      expect(mockInvoke).toHaveBeenCalledWith('get_album_cover', {
        albumName: 'Album',
        artist: undefined,
      });
    });
  });

  describe('albums', () => {
    it('getAlbums calls invoke', async () => {
      await commands.getAlbums();
      expect(mockInvoke).toHaveBeenCalledWith('get_albums');
    });

    it('getAlbumTracks passes params', async () => {
      await commands.getAlbumTracks('Album', 'Artist');
      expect(mockInvoke).toHaveBeenCalledWith('get_album_tracks', {
        albumName: 'Album',
        artist: 'Artist',
      });
    });

    it('playAlbum passes params', async () => {
      await commands.playAlbum('Album', null);
      expect(mockInvoke).toHaveBeenCalledWith('play_album', { albumName: 'Album', artist: null });
    });
  });

  describe('playlists', () => {
    it('createPlaylist passes name', async () => {
      await commands.createPlaylist('My Playlist');
      expect(mockInvoke).toHaveBeenCalledWith('create_playlist', { name: 'My Playlist' });
    });

    it('deletePlaylist passes id', async () => {
      await commands.deletePlaylist(1);
      expect(mockInvoke).toHaveBeenCalledWith('delete_playlist', { id: 1 });
    });

    it('renamePlaylist passes id and newName', async () => {
      await commands.renamePlaylist(1, 'New Name');
      expect(mockInvoke).toHaveBeenCalledWith('rename_playlist', { id: 1, newName: 'New Name' });
    });

    it('getPlaylists calls invoke', async () => {
      await commands.getPlaylists();
      expect(mockInvoke).toHaveBeenCalledWith('get_playlists');
    });

    it('getPlaylist passes id', async () => {
      await commands.getPlaylist(1);
      expect(mockInvoke).toHaveBeenCalledWith('get_playlist', { id: 1 });
    });

    it('getPlaylistTracks passes playlistId', async () => {
      await commands.getPlaylistTracks(1);
      expect(mockInvoke).toHaveBeenCalledWith('get_playlist_tracks', { playlistId: 1 });
    });

    it('addTrackToPlaylist passes all params', async () => {
      await commands.addTrackToPlaylist(1, 2, 0);
      expect(mockInvoke).toHaveBeenCalledWith('add_track_to_playlist', {
        playlistId: 1,
        trackId: 2,
        position: 0,
      });

      await commands.addTrackToPlaylist(1, 2);
      expect(mockInvoke).toHaveBeenLastCalledWith('add_track_to_playlist', {
        playlistId: 1,
        trackId: 2,
        position: undefined,
      });
    });

    it('addTracksToPlaylist passes params', async () => {
      await commands.addTracksToPlaylist(1, [2, 3]);
      expect(mockInvoke).toHaveBeenCalledWith('add_tracks_to_playlist', {
        playlistId: 1,
        trackIds: [2, 3],
      });
    });

    it('removeTrackFromPlaylist passes params', async () => {
      await commands.removeTrackFromPlaylist(1, 2);
      expect(mockInvoke).toHaveBeenCalledWith('remove_track_from_playlist', {
        playlistId: 1,
        trackId: 2,
      });
    });

    it('reorderPlaylistTracks passes tuples', async () => {
      await commands.reorderPlaylistTracks(1, [
        [2, 0],
        [3, 1],
      ]);
      expect(mockInvoke).toHaveBeenCalledWith('reorder_playlist_tracks', {
        playlistId: 1,
        trackPositions: [
          [2, 0],
          [3, 1],
        ],
      });
    });

    it('duplicatePlaylist passes params', async () => {
      await commands.duplicatePlaylist(1, 'Copy');
      expect(mockInvoke).toHaveBeenCalledWith('duplicate_playlist', {
        playlistId: 1,
        newName: 'Copy',
      });
    });

    it('playPlaylist passes playlistId', async () => {
      await commands.playPlaylist(1);
      expect(mockInvoke).toHaveBeenCalledWith('play_playlist', { playlistId: 1 });
    });
  });

  describe('M3U import/export', () => {
    it('exportPlaylistM3u passes params', async () => {
      await commands.exportPlaylistM3u(1, '/out.m3u');
      expect(mockInvoke).toHaveBeenCalledWith('export_playlist_m3u', {
        playlistId: 1,
        outputPath: '/out.m3u',
      });
    });

    it('importPlaylistM3u passes params', async () => {
      await commands.importPlaylistM3u('/in.m3u', 'Imported');
      expect(mockInvoke).toHaveBeenCalledWith('import_playlist_m3u', {
        filePath: '/in.m3u',
        playlistName: 'Imported',
      });
    });
  });

  describe('equalizer', () => {
    it('getEqSettings calls invoke', async () => {
      await commands.getEqSettings();
      expect(mockInvoke).toHaveBeenCalledWith('get_eq_settings');
    });

    it('setEqBand passes band and gainDb', async () => {
      await commands.setEqBand(0, 3.5);
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_band', { band: 0, gainDb: 3.5 });
    });

    it('setEqEnabled passes enabled', async () => {
      await commands.setEqEnabled(true);
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_enabled', { enabled: true });
    });

    it('setEqPreset passes presetName', async () => {
      await commands.setEqPreset('Rock');
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_preset', { presetName: 'Rock' });
    });

    it('setEqPreamp passes preampDb', async () => {
      await commands.setEqPreamp(2.5);
      expect(mockInvoke).toHaveBeenCalledWith('set_eq_preamp', { preampDb: 2.5 });
    });

    it('getEqPresets calls invoke', async () => {
      await commands.getEqPresets();
      expect(mockInvoke).toHaveBeenCalledWith('get_eq_presets');
    });

    it('saveEqSettings calls invoke', async () => {
      await commands.saveEqSettings();
      expect(mockInvoke).toHaveBeenCalledWith('save_eq_settings');
    });

    it('getVisualizerData calls invoke', async () => {
      await commands.getVisualizerData();
      expect(mockInvoke).toHaveBeenCalledWith('get_visualizer_data');
    });
  });

  describe('play history', () => {
    it('recordPlayHistory passes params', async () => {
      await commands.recordPlayHistory(1, 120);
      expect(mockInvoke).toHaveBeenCalledWith('record_play_history', {
        trackId: 1,
        durationListened: 120,
      });
    });

    it('getPlayHistory passes limit', async () => {
      await commands.getPlayHistory(50);
      expect(mockInvoke).toHaveBeenCalledWith('get_play_history', { limit: 50 });
    });
  });

  describe('duplicate detection', () => {
    it('getDuplicates calls invoke', async () => {
      await commands.getDuplicates();
      expect(mockInvoke).toHaveBeenCalledWith('get_duplicates');
    });
  });
});
