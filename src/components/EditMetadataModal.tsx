import { useState, useEffect } from 'react';
import { X, Save, FileAudio } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Track } from '../types';

interface EditMetadataModalProps {
  track: Track;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditMetadataModal({ track, onClose, onSaved }: EditMetadataModalProps) {
  const [title, setTitle] = useState(track.title || '');
  const [artist, setArtist] = useState(track.artist || '');
  const [album, setAlbum] = useState(track.album || '');
  const [year, setYear] = useState(track.year?.toString() || '');
  const [genre, setGenre] = useState(track.genre || '');
  const [trackNumber, setTrackNumber] = useState(track.track_number?.toString() || '');
  const [writeToFile, setWriteToFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const metadata = {
      trackId: track.id,
      title: title || null,
      artist: artist || null,
      album: album || null,
      year: year ? parseInt(year) : null,
      genre: genre || null,
      trackNumber: trackNumber ? parseInt(trackNumber) : null,
    };

    try {
      // Always save to database
      await invoke('update_track_metadata_manual', metadata);

      // Optionally write to file
      if (writeToFile) {
        await invoke('write_metadata_to_file', metadata);
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e as string);
    } finally {
      setSaving(false);
    }
  };

  // Get filename from path
  const filename = track.file_path.split('/').pop() || track.file_path;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-surface">
          <h2 className="text-lg font-semibold text-text-primary">Edit Metadata</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Filename display */}
          <div className="p-3 bg-bg-elevated rounded-lg">
            <p className="text-xs text-text-tertiary mb-1">File</p>
            <p className="text-sm text-text-secondary truncate" title={track.file_path}>
              {filename}
            </p>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-text-tertiary mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-bg-surface rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="Song title"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-text-tertiary mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-bg-surface rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="Artist name"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-text-tertiary mb-1">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-bg-surface rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="Album name"
              />
            </div>

            <div>
              <label className="block text-sm text-text-tertiary mb-1">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-bg-surface rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="2024"
                min="1900"
                max="2100"
              />
            </div>

            <div>
              <label className="block text-sm text-text-tertiary mb-1">Track #</label>
              <input
                type="number"
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-bg-surface rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="1"
                min="1"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-text-tertiary mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-bg-surface rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="Pop, Rock, Hip-Hop..."
              />
            </div>
          </div>

          {/* Write to file option */}
          <div className="p-3 bg-bg-elevated rounded-lg border border-bg-surface">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={writeToFile}
                  onChange={(e) => setWriteToFile(e.target.checked)}
                  className="w-4 h-4 accent-primary-500"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <FileAudio size={16} className="text-primary-400" />
                  Also write to file
                </div>
                <p className="text-xs text-text-tertiary mt-1">
                  Save metadata directly to the audio file (ID3 tags). This will modify the original file.
                </p>
              </div>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-bg-surface bg-bg-elevated">
          <button
            onClick={onClose}
            className="btn-tertiary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
