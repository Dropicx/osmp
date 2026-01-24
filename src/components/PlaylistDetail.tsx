import { useEffect, useState, useCallback, useMemo } from 'react';
import { Play, Pause, Shuffle, Trash2, Music, X, GripVertical, List, ListPlus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/formatting';
import { useColumnResize } from '../hooks/useColumnResize';
import { getCellContent } from '../utils/columns';
import ColumnResizeHandle from './ColumnResizeHandle';
import type { ColumnConfig, ContentColumnId } from '../types/columns';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Track } from '../types';

interface PlaylistDetailProps {
  playlistId: number;
  onBack?: () => void;
}

interface SortableTrackRowProps {
  track: Track;
  index: number;
  isSelected: boolean;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlayPause: (trackId: number) => void;
  onToggleSelection: (trackId: number) => void;
  onRemove: (trackId: number) => void;
  onContextMenu: (e: React.MouseEvent, trackId: number) => void;
  onPlayTrack: (trackId: number) => void;
  onAddToQueue: (trackIds: number[], position: 'next' | 'end') => void;
  gridTemplate: string;
  visibleColumns: ColumnConfig[];
  getColumnWidth: (colId: ContentColumnId) => number;
}

function SortableTrackRow({
  track,
  index,
  isSelected,
  isCurrentTrack,
  isPlaying,
  onPlayPause,
  onToggleSelection,
  onRemove,
  onContextMenu,
  onPlayTrack,
  onAddToQueue,
  gridTemplate,
  visibleColumns,
}: SortableTrackRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, gridTemplateColumns: gridTemplate }}
      className={`grid items-center gap-2 px-4 py-3 hover:bg-bg-hover cursor-pointer transition-colors ${
        isSelected ? 'bg-primary-600/10 border-l-2 border-l-primary-600' : ''
      } ${isCurrentTrack ? 'bg-primary-600/5' : ''} ${
        isDragging ? 'bg-bg-card shadow-lg rounded-lg' : ''
      }`}
      onDoubleClick={() => onPlayTrack(track.id)}
      onContextMenu={(e) => onContextMenu(e, track.id)}
    >
      {/* Drag handle */}
      <div
        className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </div>

      {/* Checkbox */}
      <label className="custom-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(track.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="checkmark"></span>
      </label>

      {/* Index */}
      <span className="text-text-tertiary text-sm">{index + 1}</span>

      {/* Dynamic content columns */}
      {visibleColumns.map((col) => (
        <span
          key={col.id}
          className={`truncate ${
            col.id === 'title'
              ? 'font-semibold text-text-primary'
              : col.id === 'duration'
                ? 'text-right text-text-tertiary font-medium text-sm'
                : col.id === 'genre'
                  ? 'text-text-tertiary'
                  : 'text-text-secondary'
          }`}
        >
          {getCellContent(track, col.id)}
        </span>
      ))}

      {/* Play/Pause */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlayPause(track.id);
        }}
        className="btn-icon"
        title={isCurrentTrack && isPlaying ? 'Pause' : 'Play'}
      >
        {isCurrentTrack && isPlaying ? (
          <Pause size={16} className="text-primary-500" />
        ) : (
          <Play size={16} className="text-text-tertiary" />
        )}
      </button>

      {/* Queue buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToQueue([track.id], 'end');
          }}
          className="btn-icon"
          title="Add to Queue"
        >
          <List size={14} className="text-text-tertiary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToQueue([track.id], 'next');
          }}
          className="btn-icon"
          title="Add Next to Queue"
        >
          <ListPlus size={14} className="text-text-tertiary" />
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(track.id);
        }}
        className="btn-icon text-text-tertiary hover:text-red-400"
        title="Remove from playlist"
      >
        <X size={16} />
      </button>
    </div>
  );
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
    addToQueue,
  } = useStore();

  const playlist = playlists.find((p) => p.id === playlistId);
  const { resizingColumn, startResize, visibleColumns, getColumnWidth } = useColumnResize();
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);

  const gridTemplate = useMemo(() => {
    const contentCols = visibleColumns.map((col) => `${getColumnWidth(col.id)}px`).join(' ');
    return `auto auto 2rem ${contentCols} 2.5rem 4rem 2.5rem`;
  }, [visibleColumns, getColumnWidth]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    trackId: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Close context menu on click outside, scroll, or Escape
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClick);
      document.addEventListener('scroll', handleScroll, true);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('scroll', handleScroll, true);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu]);

  // Adjust context menu position to stay on screen
  const getContextMenuPosition = () => {
    if (!contextMenu) return { left: 0, top: 0 };

    const menuWidth = 180;
    const menuHeight = 240;
    const padding = 8;

    let x = contextMenu.x;
    let y = contextMenu.y;

    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }

    return { left: x, top: y };
  };

  const handleContextMenu = (e: React.MouseEvent, trackId: number) => {
    e.preventDefault();
    if (!selectedTrackIds.includes(trackId)) {
      clearSelection();
      toggleTrackSelection(trackId);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, trackId });
  };

  useEffect(() => {
    if (playlistId) {
      loadPlaylistTracks(playlistId);
    }
  }, [playlistId, loadPlaylistTracks]);

  useEffect(() => {
    setSelectedTrackIds(selectedTracks);
  }, [selectedTracks]);

  const totalDuration = playlistTracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  const handlePlayPause = useCallback(
    (trackId: number) => {
      if (currentTrack?.id === trackId && isPlaying) {
        pausePlayback();
      } else {
        playTrack(trackId);
      }
    },
    [currentTrack?.id, isPlaying, pausePlayback, playTrack]
  );

  const handleRemoveTrack = async (trackId: number) => {
    try {
      await removeTrackFromPlaylist(playlistId, trackId);
    } catch {
      /* silently handled */
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
    } catch {
      /* silently handled */
      alert('Failed to remove tracks from playlist');
    }
  };

  const handleShufflePlay = async () => {
    if (playlistTracks.length === 0) return;
    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      await playTrack(shuffled[0].id);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = playlistTracks.findIndex((t) => t.id === active.id);
    const newIndex = playlistTracks.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate new order
    const newTracks = [...playlistTracks];
    const [movedTrack] = newTracks.splice(oldIndex, 1);
    newTracks.splice(newIndex, 0, movedTrack);

    // Create position updates
    const trackPositions = newTracks.map((track, index) => ({
      trackId: track.id,
      position: index,
    }));

    try {
      await reorderPlaylistTracks(playlistId, trackPositions);
    } catch {
      /* silently handled */
    }
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
            {playlist.track_count} track{playlist.track_count !== 1 ? 's' : ''} •{' '}
            {formatDuration(totalDuration)}
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
          <button onClick={handleRemoveSelected} className="btn-danger flex items-center gap-2">
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
          {/* Header row */}
          <div
            className="grid items-center gap-2 px-4 py-3 bg-bg-elevated border-b border-bg-surface sticky top-0 z-10"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="w-4" />
            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={
                  selectedTrackIds.length === playlistTracks.length && playlistTracks.length > 0
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    playlistTracks.forEach((t) => {
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
            <span className="text-text-tertiary font-medium text-sm">#</span>
            {visibleColumns.map((col) => (
              <span
                key={col.id}
                className={`text-text-tertiary font-medium text-sm relative ${col.id === 'duration' ? 'text-right' : ''}`}
              >
                {col.label}
                <ColumnResizeHandle
                  columnId={col.id}
                  isResizing={resizingColumn === col.id}
                  onStartResize={startResize}
                />
              </span>
            ))}
            <span />
            <span className="text-center text-text-tertiary font-medium text-sm">Queue</span>
            <span />
          </div>

          {/* Sortable track rows */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={playlistTracks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-bg-surface/50">
                {playlistTracks.map((track, index) => (
                  <SortableTrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    isSelected={selectedTrackIds.includes(track.id)}
                    isCurrentTrack={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    onToggleSelection={toggleTrackSelection}
                    onRemove={handleRemoveTrack}
                    onContextMenu={handleContextMenu}
                    onPlayTrack={playTrack}
                    onAddToQueue={addToQueue}
                    gridTemplate={gridTemplate}
                    visibleColumns={visibleColumns}
                    getColumnWidth={getColumnWidth}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-bg-card border border-bg-surface rounded-xl shadow-2xl py-2 min-w-[180px] animate-slide-up"
          style={getContextMenuPosition()}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Track context menu"
        >
          <button
            onClick={() => {
              if (contextMenu) {
                playTrack(contextMenu.trackId);
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Play size={16} className="text-primary-500" />
            Play
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={async () => {
              if (contextMenu) {
                const tracksToAdd =
                  selectedTrackIds.length > 1 ? selectedTrackIds : [contextMenu.trackId];
                await addToQueue(tracksToAdd, 'end');
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <List size={16} className="text-primary-500" />
            Add to Queue
            {selectedTrackIds.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">
                ({selectedTrackIds.length})
              </span>
            )}
          </button>
          <button
            onClick={async () => {
              if (contextMenu) {
                const tracksToAdd =
                  selectedTrackIds.length > 1 ? selectedTrackIds : [contextMenu.trackId];
                await addToQueue(tracksToAdd, 'next');
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <ListPlus size={16} className="text-primary-500" />
            Add Next to Queue
            {selectedTrackIds.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">
                ({selectedTrackIds.length})
              </span>
            )}
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={async () => {
              if (contextMenu) {
                await handleRemoveTrack(contextMenu.trackId);
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-red-400 hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Trash2 size={16} />
            Remove from Playlist
            {selectedTrackIds.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">
                ({selectedTrackIds.length})
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
