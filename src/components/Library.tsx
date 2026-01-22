import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Play, Pause, MoreVertical, Download } from 'lucide-react';
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
        <div className="text-gray-400">Loading tracks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Library</h1>
        {selectedTracks.length > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-gray-400">{selectedTracks.length} selected</span>
            <button
              onClick={handleFetchMetadata}
              disabled={fetchingMetadata}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <Download size={16} />
              {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <p className="text-lg">No tracks found</p>
          <p className="text-sm mt-2">Add scan folders in Settings and scan for music</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left p-4 w-12">
                  <input
                    type="checkbox"
                    className="rounded"
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
                </th>
                <th className="text-left p-4 text-gray-400 font-normal w-12">#</th>
                <th className="text-left p-4 text-gray-400 font-normal">Title</th>
                <th className="text-left p-4 text-gray-400 font-normal">Artist</th>
                <th className="text-left p-4 text-gray-400 font-normal">Album</th>
                <th className="text-left p-4 text-gray-400 font-normal">Genre</th>
                <th className="text-right p-4 text-gray-400 font-normal">Duration</th>
                <th className="text-center p-4 text-gray-400 font-normal w-12"></th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, index) => (
                <tr
                  key={track.id}
                  className={`hover:bg-gray-700 ${selectedTracks.includes(track.id) ? 'bg-gray-750' : ''}`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedTracks.includes(track.id)}
                      onChange={() => toggleTrackSelection(track.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-4 text-gray-400">{index + 1}</td>
                  <td className="p-4 font-medium">{track.title || 'Unknown Title'}</td>
                  <td className="p-4 text-gray-400">{track.artist || 'Unknown Artist'}</td>
                  <td className="p-4 text-gray-400">{track.album || 'Unknown Album'}</td>
                  <td className="p-4 text-gray-400">{track.genre || '-'}</td>
                  <td className="p-4 text-right text-gray-400">
                    {formatDuration(track.duration)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handlePlayPause(track.id)}
                        className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        {currentTrack?.id === track.id && isPlaying ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                      <button className="p-2 hover:bg-gray-600 rounded-lg transition-colors">
                        <MoreVertical size={16} />
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
