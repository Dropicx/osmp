import { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Shuffle, Trash2, Music, X, GripVertical } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PlaylistDetailProps {
  playlistId: number;
  onBack?: () => void;
}

export default function PlaylistDetail({ playlistId, onBack }: PlaylistDetailProps) {
  const {
    playlists,
    playlistTracks,
    playlistLoading,
    currentTrack,
    isPlaying,
    loadPlaylistTracks,
    playPlaylist,
    playTrack,
    pausePlayback,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
    selectedTracks,
    toggleTrackSelection,
    clearSelection,
  } = useStore();

  const playlist = playlists.find(p => p.id === playlistId);
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (playlistId) {
      loadPlaylistTracks(playlistId);
    }
  }, [playlistId, loadPlaylistTracks]);

  useEffect(() => {
    setSelectedTrackIds(selectedTracks);
  }, [selectedTracks]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = playlistTracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  const handlePlayPause = useCallback((trackId: number) => {
    if (currentTrack?.id === trackId && isPlaying) {
      pausePlayback();
    } else {
      playTrack(trackId);
    }
  }, [currentTrack?.id, isPlaying, pausePlayback, playTrack]);

  const handleRemoveTrack = async (trackId: number) => {
    try {
      await removeTrackFromPlaylist(playlistId, trackId);
    } catch (error) {
      console.error('Failed to remove track:', error);
      alert('Failed to remove track from playlist');
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedTrackIds.length === 0) return;
    try {
      for (const trackId of selectedTrackIds) {
        await removeTrackFromPlaylist(playlistId, trackId);
      }
      clearSelection();
    } catch (error) {
      console.error('Failed to remove tracks:', error);
      alert('Failed to remove tracks from playlist');
    }
  };

  const handleShufflePlay = async () => {
    if (playlistTracks.length === 0) return;
    // Shuffle the tracks and play first one
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      await playTrack(shuffled[0].id);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Calculate new positions
    const newTracks = [...playlistTracks];
    const [draggedTrack] = newTracks.splice(draggedIndex, 1);
    newTracks.splice(dropIndex, 0, draggedTrack);

    // Create position updates
    const trackPositions = newTracks.map((track, index) => ({
      trackId: track.id,
      position: index,
    }));

    try {
      await reorderPlaylistTracks(playlistId, trackPositions);
    } catch (error) {
      console.error('Failed to reorder tracks:', error);
      alert('Failed to reorder tracks');
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (playlistLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-tertiary">Loading playlist...</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
        <p className="text-lg">Playlist not found</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 text-primary-500 hover:text-primary-400">
            Go back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="w-64 h-64 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-gradient-to-br from-primary-600/20 to-accent-600/20">
          {playlistTracks.length > 0 ? (
            <Music size={64} className="text-primary-400" />
          ) : (
            <Music size={64} className="text-text-tertiary opacity-50" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2 text-text-primary">{playlist.name}</h1>
          <p className="text-text-tertiary mb-4">
            {playlist.track_count} track{playlist.track_count !== 1 ? 's' : ''} • {formatDuration(totalDuration)}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => playPlaylist(playlistId)}
              className="btn-primary flex items-center gap-2"
              disabled={playlistTracks.length === 0}
            >
              <Play size={20} fill="currentColor" />
              Play
            </button>
            <button
              onClick={handleShufflePlay}
              className="btn-secondary flex items-center gap-2"
              disabled={playlistTracks.length === 0}
            >
              <Shuffle size={18} />
              Shuffle Play
            </button>
            {onBack && (
              <button onClick={onBack} className="btn-tertiary">
                Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedTrackIds.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-bg-card rounded-xl border border-bg-surface">
          <span className="text-text-secondary text-sm font-medium">
            {selectedTrackIds.length} selected
          </span>
          <button
            onClick={handleRemoveSelected}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 size={16} />
            Remove
          </button>
          <button onClick={clearSelection} className="btn-tertiary">
            Clear
          </button>
        </div>
      )}

      {/* Track list */}
      {playlistTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
          <Music size={64} className="mb-4 opacity-50" />
          <p className="text-lg">This playlist is empty</p>
          <p className="text-sm mt-2">Add tracks from your library</p>
        </div>
      ) : (
        <div className="flex-1 bg-bg-card rounded-2xl overflow-auto border border-bg-surface shadow-lg">
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-bg-surface sticky top-0 z-10">
              <tr>
                <th className="text-left p-4 w-12">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTrackIds.length === playlistTracks.length && playlistTracks.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          playlistTracks.forEach(t => {
                            if (!selectedTrackIds.includes(t.id)) {
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
                <th className="text-left p-4 text-text-tertiary font-medium text-sm w-8"></th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm w-12">#</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Title</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Artist</th>
                <th className="text-left p-4 text-text-tertiary font-medium text-sm">Album</th>
                <th className="text-right p-4 text-text-tertiary font-medium text-sm">Duration</th>
                <th className="text-center p-4 text-text-tertiary font-medium text-sm w-12"></th>
                <th className="text-center p-4 text-text-tertiary font-medium text-sm w-12"></th>
              </tr>
            </thead>
            <tbody>
              {playlistTracks.map((track, index) => {
                const isSelected = selectedTrackIds.includes(track.id);
                const isCurrentTrack = currentTrack?.id === track.id;
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <tr
                    key={track.id}
                    className={`hover:bg-bg-hover cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-600/10 border-l-2 border-l-primary-600' : ''
                    } ${isCurrentTrack ? 'bg-primary-600/5' : ''} ${
                      isDragging ? 'opacity-50' : ''
                    } ${isDragOver ? 'border-t-2 border-t-primary-500' : ''}`}
                    onDoubleClick={() => playTrack(track.id)}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <td className="p-4">
                      <div
                        className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={16} />
                      </div>
                    </td>
                    <td className="p-4">
                      <label className="custom-checkbox" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
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
                    <td className="p-4 text-right text-text-tertiary font-medium">
                      {formatDuration(track.duration)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPause(track.id);
                        }}
                        className="btn-icon"
                        title={isCurrentTrack && isPlaying ? "Pause" : "Play"}
                      >
                        {isCurrentTrack && isPlaying ? (
                          <Pause size={16} className="text-primary-500" />
                        ) : (
                          <Play size={16} className="text-text-tertiary" />
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTrack(track.id);
                        }}
                        className="btn-icon text-text-tertiary hover:text-red-400"
                        title="Remove from playlist"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
