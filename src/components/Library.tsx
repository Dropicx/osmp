import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Play, Pause, Trash2, Download } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function Library() {
  const { tracks, loading, loadTracks, playTrack, pausePlayback, isPlaying, currentTrack, selectedTracks, toggleTrackSelection, clearSelection } = useStore();
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFetchMetadata = async () => {
    if (selectedTracks.length === 0) return;

    setFetchingMetadata(true);
    try {
      await invoke('fetch_metadata', { trackIds: selectedTracks, force: false });
      await loadTracks();
      clearSelection();
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTracks.length === 0) return;

    try {
      await invoke('delete_tracks', { trackIds: selectedTracks });
      await loadTracks();
      clearSelection();
    } catch (error) {
      console.error('Failed to delete tracks:', error);
    }
  };

  const handlePlayPause = (trackId: number) => {
    if (currentTrack?.id === trackId && isPlaying) {
      pausePlayback();
    } else {
      playTrack(trackId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-tertiary">Loading tracks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text-primary">Your Library</h1>
        {selectedTracks.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-text-tertiary text-sm font-medium px-3 py-1.5 bg-bg-card rounded-lg">
              {selectedTracks.length} selected
            </span>
            <button
              onClick={handleFetchMetadata}
              disabled={fetchingMetadata}
              className="btn-success flex items-center gap-2"
            >
              <Download size={16} />
              {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
            </button>
            <button
              onClick={handleDeleteSelected}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="btn-tertiary"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
          <p className="text-lg">No tracks found</p>
          <p className="text-sm mt-2">Add scan folders in Settings and scan for music</p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-2xl overflow-hidden border border-bg-surface shadow-lg">
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-bg-surface">
              <tr>
                <th className="text-left p-4 w-12">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTracks.length === tracks.length && tracks.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          tracks.forEach(t => {
                            if (!selectedTracks.includes(t.id)) {
                              toggleTrackSelection(t.id);
                            }
                          });
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                    <span className="checkmark"></span>
                  </label>
                </th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm w-12">#</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Title</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Artist</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Album</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Genre</th>
                <th className="text-right p-4 text-text-tertiary font-medium text-sm">Duration</th>
                <th className="text-center p-4 text-text-tertiary font-medium text-sm w-12"></th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, index) => (
                <tr
                  key={track.id}
                  className={`hover:bg-bg-hover cursor-pointer transition-colors ${
                    selectedTracks.includes(track.id) 
                      ? 'bg-primary-600/10 border-l-2 border-l-primary-600' 
                      : ''
                  } ${currentTrack?.id === track.id ? 'bg-primary-600/5' : ''}`}
                  onDoubleClick={() => playTrack(track.id)}
                >
                  <td className="p-4">
                    <label className="custom-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedTracks.includes(track.id)}
                        onChange={() => toggleTrackSelection(track.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="checkmark"></span>
                    </label>
                  </td>
                  <td className="p-4 text-text-tertiary">{index + 1}</td>
                  <td className="p-4 font-semibold text-text-primary">{track.title || 'Unknown Title'}</td>
                  <td className="p-4 text-text-secondary">{track.artist || 'Unknown Artist'}</td>
                  <td className="p-4 text-text-secondary">{track.album || 'Unknown Album'}</td>
                  <td className="p-4 text-text-tertiary">{track.genre || '-'}</td>
                  <td className="p-4 text-right text-text-tertiary font-medium">
                    {formatDuration(track.duration)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPause(track.id);
                        }}
                        className="btn-icon"
                        title={currentTrack?.id === track.id && isPlaying ? "Pause" : "Play"}
                      >
                        {currentTrack?.id === track.id && isPlaying ? (
                          <Pause size={16} className="text-primary-500" />
                        ) : (
                          <Play size={16} className="text-text-tertiary" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
