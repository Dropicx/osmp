import { useEffect, useState, useRef } from 'react';
import { Plus, Music2, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import CreatePlaylistDialog from './CreatePlaylistDialog';

interface AddToPlaylistMenuProps {
  trackId: number;
  trackIds?: number[];
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
}

export default function AddToPlaylistMenu({
  trackId,
  trackIds,
  isOpen,
  onClose,
  position,
}: AddToPlaylistMenuProps) {
  const {
    playlists,
    loadPlaylists,
    addTrackToPlaylist,
    addTracksToPlaylist,
  } = useStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tracksToAdd = trackIds || [trackId];

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
    }
  }, [isOpen, loadPlaylists]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      // Small delay to prevent immediate close from the click that opened the menu
      const timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      document.addEventListener('keydown', handleEscape);

      return () => {
        clearTimeout(timeout);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const handleAddToPlaylist = async (playlistId: number, playlistName: string) => {
    if (adding !== null) return; // Prevent double-clicks

    setAdding(playlistId);
    try {
      if (tracksToAdd.length === 1) {
        await addTrackToPlaylist(playlistId, tracksToAdd[0]);
      } else {
        await addTracksToPlaylist(playlistId, tracksToAdd);
      }

      setToast({
        message: `Added ${tracksToAdd.length} track${tracksToAdd.length > 1 ? 's' : ''} to "${playlistName}"`,
        type: 'success'
      });

      // Close after short delay to show success feedback
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error: any) {
      console.error('Failed to add track to playlist:', error);
      setToast({
        message: error.message || 'Failed to add tracks',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAdding(null);
    }
  };

  if (!isOpen) return null;

  // Calculate menu position, ensuring it stays on screen
  const getMenuStyle = () => {
    if (!position) return {};

    const menuWidth = 220;
    const menuHeight = Math.min(400, 100 + playlists.length * 52);
    const padding = 8;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position if menu would overflow right edge
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }

    // Adjust vertical position if menu would overflow bottom edge
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }

    // Ensure we don't go off the left or top edge
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    return {
      position: 'fixed' as const,
      left: x,
      top: y,
    };
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 bg-bg-card border border-bg-surface rounded-xl shadow-2xl py-1 min-w-[200px] max-h-[400px] overflow-y-auto animate-slide-up"
        style={getMenuStyle()}
      >
        <div className="px-3 py-2 border-b border-bg-surface">
          <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Add to Playlist
          </div>
          {tracksToAdd.length > 1 && (
            <div className="text-xs text-text-tertiary mt-1">
              {tracksToAdd.length} tracks selected
            </div>
          )}
        </div>

        {/* Toast notification */}
        {toast && (
          <div className={`mx-2 my-2 px-3 py-2 rounded-lg text-sm ${
            toast.type === 'success'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {toast.message}
          </div>
        )}

        {playlists.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-tertiary text-sm">
            <Music2 size={32} className="mx-auto mb-2 opacity-50" />
            <p>No playlists yet</p>
            <p className="text-xs mt-1">Create one below!</p>
          </div>
        ) : (
          <div className="py-1">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handleAddToPlaylist(playlist.id, playlist.name)}
                disabled={adding !== null}
                className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {adding === playlist.id ? (
                    <Loader2 size={14} className="animate-spin text-primary-500" />
                  ) : (
                    <Music2 size={14} className="text-text-tertiary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{playlist.name}</div>
                  <div className="text-xs text-text-tertiary">
                    {playlist.track_count} track{playlist.track_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-bg-surface mt-1">
          <button
            onClick={() => {
              setShowCreateDialog(true);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-primary-500 hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Plus size={14} />
            <span className="font-medium">Create New Playlist</span>
          </button>
        </div>
      </div>

      <CreatePlaylistDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={async (newPlaylistId) => {
          await loadPlaylists();
          // Add tracks to the newly created playlist
          try {
            if (tracksToAdd.length === 1) {
              await addTrackToPlaylist(newPlaylistId, tracksToAdd[0]);
            } else {
              await addTracksToPlaylist(newPlaylistId, tracksToAdd);
            }
            setToast({
              message: `Created playlist and added ${tracksToAdd.length} track${tracksToAdd.length > 1 ? 's' : ''}`,
              type: 'success'
            });
            setTimeout(() => {
              onClose();
            }, 1000);
          } catch (error) {
            console.error('Failed to add tracks to new playlist:', error);
            setToast({
              message: 'Playlist created, but failed to add tracks',
              type: 'error'
            });
          }
        }}
      />
    </>
  );
}
