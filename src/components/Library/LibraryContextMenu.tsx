import { Play, Download, Image, Pencil, Trash2, Music2, List, ListPlus } from 'lucide-react';

interface LibraryContextMenuProps {
  position: { left: number; top: number };
  selectedCount: number;
  fetchingMetadata: boolean;
  fetchingCovers: boolean;
  onPlay: () => void;
  onAddToQueue: () => void;
  onAddNextToQueue: () => void;
  onEditMetadata: () => void;
  onFetchMetadata: () => void;
  onFetchCovers: () => void;
  onAddToPlaylist: () => void;
  onDelete: () => void;
}

export default function LibraryContextMenu({
  position,
  selectedCount,
  fetchingMetadata,
  fetchingCovers,
  onPlay,
  onAddToQueue,
  onAddNextToQueue,
  onEditMetadata,
  onFetchMetadata,
  onFetchCovers,
  onAddToPlaylist,
  onDelete,
}: LibraryContextMenuProps) {
  const countBadge =
    selectedCount > 1 ? (
      <span className="ml-auto text-xs text-text-tertiary">({selectedCount})</span>
    ) : null;

  return (
    <div
      className="fixed z-50 bg-bg-card border border-bg-surface rounded-xl shadow-2xl py-2 min-w-[180px] animate-slide-up"
      style={position}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      tabIndex={-1}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label="Track context menu"
    >
      <button
        onClick={onPlay}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
        role="menuitem"
      >
        <Play size={16} className="text-primary-500" />
        Play
      </button>
      <div className="h-px bg-bg-surface my-1" />
      <button
        onClick={onAddToQueue}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
        role="menuitem"
      >
        <List size={16} className="text-primary-500" />
        Add to Queue
        {countBadge}
      </button>
      <button
        onClick={onAddNextToQueue}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
        role="menuitem"
      >
        <ListPlus size={16} className="text-primary-500" />
        Add Next to Queue
        {countBadge}
      </button>
      <div className="h-px bg-bg-surface my-1" />
      <button
        onClick={onEditMetadata}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
        role="menuitem"
      >
        <Pencil size={16} className="text-blue-400" />
        Edit Metadata
      </button>
      <div className="h-px bg-bg-surface my-1" />
      <button
        onClick={onFetchMetadata}
        disabled={fetchingMetadata}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
        role="menuitem"
      >
        <Download size={16} className="text-green-400" />
        {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
        {countBadge}
      </button>
      <button
        onClick={onFetchCovers}
        disabled={fetchingCovers}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
        role="menuitem"
      >
        <Image size={16} className="text-purple-400" />
        {fetchingCovers ? 'Fetching...' : 'Fetch Covers'}
        {countBadge}
      </button>
      <div className="h-px bg-bg-surface my-1" />
      <button
        onClick={onAddToPlaylist}
        className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
        role="menuitem"
      >
        <Music2 size={16} className="text-primary-500" />
        Add to Playlist
        {countBadge}
      </button>
      <div className="h-px bg-bg-surface my-1" />
      <button
        onClick={onDelete}
        className="w-full px-4 py-2 text-left text-red-400 hover:bg-bg-hover flex items-center gap-3 transition-colors"
        role="menuitem"
      >
        <Trash2 size={16} />
        Delete
        {countBadge}
      </button>
    </div>
  );
}
