import { useEffect, useState } from 'react';
import { Plus, Music2, MoreVertical, Trash2, Copy, Edit2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import CreatePlaylistDialog from './CreatePlaylistDialog';
import type { Playlist } from '../types';

export default function PlaylistsSidebar() {
  const {
    playlists,
    currentPlaylist,
    loadPlaylists,
    setCurrentPlaylist,
    loadPlaylistTracks,
    deletePlaylist,
    duplicatePlaylist,
    renamePlaylist,
    clearSelection,
  } = useStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    playlistId: number;
    x: number;
    y: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handlePlaylistClick = async (playlist: Playlist) => {
    clearSelection();
    setCurrentPlaylist(playlist);
    await loadPlaylistTracks(playlist.id);
  };

  const handleContextMenu = (e: React.MouseEvent, playlistId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ playlistId, x: e.clientX, y: e.clientY });
  };

  const handleDelete = async (playlistId: number) => {
    if (confirm('Are you sure you want to delete this playlist?')) {
      try {
        await deletePlaylist(playlistId);
      } catch {
        /* silently handled */
        alert('Failed to delete playlist');
      }
    }
    setContextMenu(null);
  };

  const handleDuplicate = async (playlistId: number) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    const newName = `${playlist.name} (Copy)`;
    try {
      await duplicatePlaylist(playlistId, newName);
    } catch {
      /* silently handled */
      alert('Failed to duplicate playlist');
    }
    setContextMenu(null);
  };

  const handleStartRename = (playlist: Playlist) => {
    setEditingId(playlist.id);
    setEditName(playlist.name);
    setContextMenu(null);
  };

  const handleRename = async (playlistId: number) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      await renamePlaylist(playlistId, editName.trim());
      setEditingId(null);
    } catch {
      /* silently handled */
      alert('Failed to rename playlist');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <>
      <div className="mt-6 pt-6 border-t border-bg-surface">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider px-4">
            Playlists
          </h3>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mr-4 text-text-tertiary hover:text-primary-500 transition-colors"
            title="Create Playlist"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="space-y-1">
          {playlists.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-tertiary text-sm">
              <Music2 size={32} className="mx-auto mb-2 opacity-50" />
              <p>No playlists yet</p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="mt-2 text-primary-500 hover:text-primary-400 text-sm"
              >
                Create one
              </button>
            </div>
          ) : (
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                data-playlist-id={playlist.id}
                className={`group relative px-4 py-2 rounded-lg mx-2 transition-colors select-none ${
                  currentPlaylist?.id === playlist.id
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'hover:bg-bg-card text-text-secondary hover:text-text-primary'
                }`}
              >
                {editingId === playlist.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(playlist.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRename(playlist.id);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    className="w-full bg-bg-elevated border border-primary-500 rounded px-2 py-1 text-sm text-text-primary focus:outline-none"
                    autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <button
                      onClick={() => handlePlaylistClick(playlist)}
                      className="w-full text-left flex items-center gap-3"
                    >
                      <Music2 size={16} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{playlist.name}</div>
                        <div className="text-xs text-text-tertiary">
                          {playlist.track_count} track{playlist.track_count !== 1 ? 's' : ''}
                          {playlist.total_duration &&
                            ` • ${formatDuration(playlist.total_duration)}`}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleContextMenu(e, playlist.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-bg-hover rounded"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            role="presentation"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-bg-card border border-bg-surface rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              onClick={() => {
                const playlist = playlists.find((p) => p.id === contextMenu.playlistId);
                if (playlist) handleStartRename(playlist);
              }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-hover flex items-center gap-2"
            >
              <Edit2 size={14} />
              Rename
            </button>
            <button
              onClick={() => handleDuplicate(contextMenu.playlistId)}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-hover flex items-center gap-2"
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              onClick={() => handleDelete(contextMenu.playlistId)}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-bg-hover flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}

      <CreatePlaylistDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={async (playlistId) => {
          await loadPlaylists();
          // Get the fresh playlists from the store after loading
          const freshPlaylists = useStore.getState().playlists;
          const newPlaylist = freshPlaylists.find((p) => p.id === playlistId);
          if (newPlaylist) {
            setCurrentPlaylist(newPlaylist);
            await loadPlaylistTracks(newPlaylist.id);
          }
        }}
      />
    </>
  );
}
