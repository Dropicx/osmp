import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';

interface CreatePlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (playlistId: number) => void;
}

export default function CreatePlaylistDialog({
  isOpen,
  onClose,
  onCreated,
}: CreatePlaylistDialogProps) {
  const { createPlaylist, playlists } = useStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setName('');
    setError('');
    onClose();
  }, [onClose]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Playlist name cannot be empty');
      return;
    }

    // Check for duplicate names
    if (playlists.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('A playlist with this name already exists');
      return;
    }

    try {
      const playlistId = await createPlaylist(name.trim());
      setName('');
      onCreated?.(playlistId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="bg-bg-card rounded-2xl p-6 w-full max-w-md border border-bg-surface shadow-xl"
        role="dialog"
        aria-label="Create playlist"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-text-primary">Create Playlist</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="playlist-name"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Playlist Name
            </label>
            <input
              ref={inputRef}
              id="playlist-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="My Playlist"
              className="w-full px-4 py-2.5 bg-bg-elevated border border-bg-surface rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
              autoComplete="off"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
