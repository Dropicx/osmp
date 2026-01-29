import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { X, Play, Pause, List, ListPlus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDebounce } from '../../hooks/useDebounce';
import { TOAST_TIMEOUT } from '../../constants';
import { Track, TrackFilters, MetadataResult, CoverFetchResult } from '../../types';
import type { ContentColumnId } from '../../types/columns';
import EditMetadataModal from '../EditMetadataModal';
import AddToPlaylistMenu from '../AddToPlaylistMenu';
import LibraryToolbar from './LibraryToolbar';
import LibraryContextMenu from './LibraryContextMenu';
import TrackTable from '../TrackTable';
import type { FixedColumn } from '../TrackTable';
import LoadingSkeleton from './LoadingSkeleton';

export default function Library() {
  const {
    tracks,
    loading,
    loadTracks,
    playTrack,
    pausePlayback,
    isPlaying,
    currentTrack,
    selectedTracks,
    toggleTrackSelection,
    clearSelection,
    refreshCurrentTrack,
    addToQueue,
    loadAlbums,
  } = useStore();

  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [fetchingCovers, setFetchingCovers] = useState(false);
  const [metadataToast, setMetadataToast] = useState<{
    show: boolean;
    success: number;
    failed: number;
    messages: string[];
  } | null>(null);
  const [coverToast, setCoverToast] = useState<{
    show: boolean;
    success: number;
    failed: number;
    messages: string[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TrackFilters>({});
  const [sortConfig, setSortConfig] = useState<{
    field: ContentColumnId;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    trackId: number;
  } | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [addToPlaylistMenu, setAddToPlaylistMenu] = useState<{
    trackId: number;
    trackIds?: number[];
    position: { x: number; y: number };
  } | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastClickedIndexRef = useRef<number>(-1);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [duplicateIds, setDuplicateIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  // Clean up click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  // Cancel pending click timer when a drag starts (fired from useDragToPlaylist in App)
  useEffect(() => {
    const onDragStart = () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
    document.addEventListener('osmp:drag-start', onDragStart);
    return () => document.removeEventListener('osmp:drag-start', onDragStart);
  }, []);

  // Handle keyboard shortcuts for select-all and delete-selected
  useEffect(() => {
    const onSelectAll = () => {
      displayedTracks.forEach((t) => {
        if (!selectedTracks.includes(t.id)) {
          toggleTrackSelection(t.id);
        }
      });
    };
    const onDeleteSelected = () => {
      if (selectedTracks.length > 0) {
        handleDeleteSelected_();
      }
    };
    window.addEventListener('osmp:select-all', onSelectAll);
    window.addEventListener('osmp:delete-selected', onDeleteSelected);
    return () => {
      window.removeEventListener('osmp:select-all', onSelectAll);
      window.removeEventListener('osmp:delete-selected', onDeleteSelected);
    };
  });

  // Fetch duplicates when filter is toggled
  useEffect(() => {
    if (showDuplicatesOnly) {
      invoke<Track[][]>('get_duplicates')
        .then((groups) => {
          const ids = new Set<number>();
          groups.forEach((group) => group.forEach((t) => ids.add(t.id)));
          setDuplicateIds(ids);
        })
        .catch(() => setDuplicateIds(new Set()));
    }
  }, [showDuplicatesOnly]);

  // Close context menu on click outside, scroll, or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const getContextMenuPosition = useCallback(() => {
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
  }, [contextMenu]);

  const filterOptions = useMemo(() => {
    const artists = new Set<string>();
    const albums = new Set<string>();
    const genres = new Set<string>();
    const years = new Set<number>();
    const formats = new Set<string>();

    tracks.forEach((track) => {
      if (track.artist) artists.add(track.artist);
      if (track.album) albums.add(track.album);
      if (track.genre) genres.add(track.genre);
      if (track.year) years.add(track.year);
      if (track.file_format) formats.add(track.file_format.toUpperCase());
    });

    return {
      artists: Array.from(artists).sort(),
      albums: Array.from(albums).sort(),
      genres: Array.from(genres).sort(),
      years: Array.from(years).sort((a, b) => b - a),
      formats: Array.from(formats).sort(),
    };
  }, [tracks]);

  const displayedTracks = useMemo(() => {
    let result = [...tracks];

    if (showDuplicatesOnly && duplicateIds.size > 0) {
      result = result.filter((t) => duplicateIds.has(t.id));
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(query) ||
          t.artist?.toLowerCase().includes(query) ||
          t.album?.toLowerCase().includes(query)
      );
    }

    if (filters.artist) result = result.filter((t) => t.artist === filters.artist);
    if (filters.album) result = result.filter((t) => t.album === filters.album);
    if (filters.genre) result = result.filter((t) => t.genre === filters.genre);
    if (filters.year) result = result.filter((t) => t.year === filters.year);
    if (filters.format)
      result = result.filter((t) => t.file_format?.toUpperCase() === filters.format);

    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        switch (sortConfig.field) {
          case 'title':
            aVal = a.title?.toLowerCase() || '';
            bVal = b.title?.toLowerCase() || '';
            break;
          case 'artist':
            aVal = a.artist?.toLowerCase() || '';
            bVal = b.artist?.toLowerCase() || '';
            break;
          case 'album':
            aVal = a.album?.toLowerCase() || '';
            bVal = b.album?.toLowerCase() || '';
            break;
          case 'genre':
            aVal = a.genre?.toLowerCase() || '';
            bVal = b.genre?.toLowerCase() || '';
            break;
          case 'duration':
            aVal = a.duration || 0;
            bVal = b.duration || 0;
            break;
        }

        if (aVal! < bVal!) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal! > bVal!) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tracks, debouncedSearch, filters, sortConfig, showDuplicatesOnly, duplicateIds]);

  const handleRowClick = useCallback(
    (track: Track, index: number, e: React.MouseEvent) => {
      const doSelection = () => {
        if (e.shiftKey && lastClickedIndexRef.current >= 0) {
          const start = Math.min(lastClickedIndexRef.current, index);
          const end = Math.max(lastClickedIndexRef.current, index);
          for (let i = start; i <= end; i++) {
            const t = displayedTracks[i];
            if (t && !selectedTracks.includes(t.id)) {
              toggleTrackSelection(t.id);
            }
          }
        } else if (e.metaKey || e.ctrlKey) {
          toggleTrackSelection(track.id);
        } else {
          clearSelection();
          toggleTrackSelection(track.id);
        }
        lastClickedIndexRef.current = index;
      };

      // Defer single-click so a double-click can cancel it
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        doSelection();
      } else {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(doSelection, 250);
      }
    },
    [displayedTracks, selectedTracks, toggleTrackSelection, clearSelection]
  );

  const handleRowDoubleClick = useCallback(
    (track: Track) => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      playTrack(track.id);
    },
    [playTrack]
  );

  const handleFetchMetadata = async () => {
    if (selectedTracks.length === 0) return;
    setFetchingMetadata(true);
    setMetadataToast(null);
    try {
      const results = await invoke<MetadataResult[]>('fetch_metadata', {
        trackIds: selectedTracks,
        force: false,
      });
      await loadTracks(true);
      await loadAlbums(true);
      await refreshCurrentTrack();
      clearSelection();

      const success = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const messages = results
        .filter((r) => r.success && r.message !== 'Metadata already available')
        .map((r) => r.message)
        .slice(0, 5);

      setMetadataToast({ show: true, success, failed, messages });
      setTimeout(() => setMetadataToast(null), TOAST_TIMEOUT);
    } catch (error) {
      // Error handled by toast notification
      setMetadataToast({
        show: true,
        success: 0,
        failed: selectedTracks.length,
        messages: [`Error: ${error}`],
      });
      setTimeout(() => setMetadataToast(null), TOAST_TIMEOUT);
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleDeleteSelected_ = async () => {
    if (selectedTracks.length === 0) return;
    try {
      await invoke('delete_tracks', { trackIds: selectedTracks });
      await loadTracks(true);
      await loadAlbums(true);
      clearSelection();
    } catch {
      // Error handled silently
    }
  };

  const handleContextMenu = (e: React.MouseEvent, trackId: number) => {
    e.preventDefault();
    if (!selectedTracks.includes(trackId)) {
      clearSelection();
      toggleTrackSelection(trackId);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, trackId });
  };

  const handleFetchCovers = async () => {
    if (selectedTracks.length === 0) return;
    setFetchingCovers(true);
    setCoverToast(null);
    try {
      const results = await invoke<CoverFetchResult[]>('fetch_covers', {
        trackIds: selectedTracks,
      });
      await loadTracks(true);
      await loadAlbums(true);
      await refreshCurrentTrack();

      const success = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const messages = results
        .filter((r) => r.success)
        .map((r) => r.message)
        .slice(0, 5);
      const failedMessages = results
        .filter((r) => !r.success)
        .map((r) => r.message)
        .slice(0, 3);

      setCoverToast({ show: true, success, failed, messages: [...messages, ...failedMessages] });
      setTimeout(() => setCoverToast(null), TOAST_TIMEOUT);
    } catch (error) {
      // Error handled by toast notification
      setCoverToast({
        show: true,
        success: 0,
        failed: selectedTracks.length,
        messages: [`Error: ${error}`],
      });
      setTimeout(() => setCoverToast(null), TOAST_TIMEOUT);
    } finally {
      setFetchingCovers(false);
    }
  };

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

  const handleSort = (field: ContentColumnId) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        if (prev.direction === 'asc') return { field, direction: 'desc' };
        return null;
      }
      return { field, direction: 'asc' };
    });
  };

  const handleFilterChange = (key: keyof TrackFilters, value: string | number | undefined) => {
    setFilters((prev) => {
      if (value === undefined || value === '') {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const activeFilterCount = Object.keys(filters).length + (searchQuery ? 1 : 0);

  const leadingColumns = useMemo<FixedColumn[]>(
    () => [
      {
        id: 'checkbox',
        width: 48,
        headerContent: (
          <label className="custom-checkbox">
            <input
              type="checkbox"
              checked={
                selectedTracks.length === displayedTracks.length && displayedTracks.length > 0
              }
              onChange={(e) => {
                if (e.target.checked) {
                  displayedTracks.forEach((t) => {
                    if (!selectedTracks.includes(t.id)) {
                      toggleTrackSelection(t.id);
                    }
                  });
                } else {
                  clearSelection();
                }
              }}
              aria-label="Select all tracks"
            />
            <span className="checkmark"></span>
          </label>
        ),
        renderCell: (track) => (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <label
            className="custom-checkbox"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTrackSelection(track.id);
              }
            }}
          >
            <input
              type="checkbox"
              checked={selectedTracks.includes(track.id)}
              onChange={() => toggleTrackSelection(track.id)}
              aria-label="Select track"
            />
            <span className="checkmark"></span>
          </label>
        ),
      },
      {
        id: 'row-number',
        width: 48,
        headerContent: '#',
        renderCell: (_track, index) => <span className="text-text-tertiary">{index + 1}</span>,
      },
    ],
    [selectedTracks, displayedTracks, toggleTrackSelection, clearSelection]
  );

  const trailingColumns = useMemo<FixedColumn[]>(
    () => [
      {
        id: 'queue-buttons',
        width: 80,
        headerContent: 'Queue',
        renderCell: (track) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToQueue([track.id], 'end');
              }}
              className="btn-icon"
              title="Add to Queue"
              aria-label="Add to Queue"
            >
              <List size={14} className="text-text-tertiary" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToQueue([track.id], 'next');
              }}
              className="btn-icon"
              title="Add Next"
              aria-label="Add Next"
            >
              <ListPlus size={14} className="text-text-tertiary" />
            </button>
          </div>
        ),
      },
      {
        id: 'play-button',
        width: 48,
        renderCell: (track) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause(track.id);
            }}
            className="btn-icon"
            title={currentTrack?.id === track.id && isPlaying ? 'Pause' : 'Play'}
            aria-label={currentTrack?.id === track.id && isPlaying ? 'Pause' : 'Play'}
          >
            {currentTrack?.id === track.id && isPlaying ? (
              <Pause size={16} className="text-primary-500" />
            ) : (
              <Play size={16} className="text-text-tertiary" />
            )}
          </button>
        ),
      },
    ],
    [currentTrack?.id, isPlaying, handlePlayPause, addToQueue]
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <LibraryToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        activeFilterCount={activeFilterCount}
        onClearAll={() => {
          setFilters({});
          setSearchQuery('');
        }}
        displayedCount={displayedTracks.length}
        totalCount={tracks.length}
        selectedCount={selectedTracks.length}
        onClearSelection={clearSelection}
        onFetchMetadata={handleFetchMetadata}
        onFetchCovers={handleFetchCovers}
        onDeleteSelected={handleDeleteSelected_}
        showDuplicatesOnly={showDuplicatesOnly}
        onToggleDuplicates={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
        onAddToPlaylist={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          setAddToPlaylistMenu({
            trackId: selectedTracks[0],
            trackIds: selectedTracks,
            position: { x: rect.left, y: rect.bottom + 4 },
          });
        }}
        fetchingMetadata={fetchingMetadata}
        fetchingCovers={fetchingCovers}
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
      />

      {/* Table */}
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
          <p className="text-lg">No tracks found</p>
          <p className="text-sm mt-2">Add scan folders in Settings and scan for music</p>
        </div>
      ) : displayedTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
          <p className="text-lg">No matching tracks</p>
          <p className="text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div
          ref={tableContainerRef}
          className="flex-1 bg-bg-card rounded-2xl overflow-auto border border-bg-surface shadow-lg"
          style={{ minHeight: '400px' }}
        >
          <TrackTable
            tracks={displayedTracks}
            leadingColumns={leadingColumns}
            trailingColumns={trailingColumns}
            virtualized={true}
            estimatedRowHeight={56}
            overscan={10}
            scrollContainerRef={tableContainerRef}
            sortConfig={sortConfig}
            onSort={handleSort}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            onRowContextMenu={(e, track) => handleContextMenu(e, track.id)}
            rowClassName={(track) =>
              `${selectedTracks.includes(track.id) ? 'bg-primary-600/10 border-l-2 border-l-primary-600' : ''}${
                currentTrack?.id === track.id ? ' bg-primary-600/5' : ''
              }`
            }
            currentTrackId={currentTrack?.id}
          />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <LibraryContextMenu
          position={getContextMenuPosition()}
          selectedCount={selectedTracks.length}
          fetchingMetadata={fetchingMetadata}
          fetchingCovers={fetchingCovers}
          onPlay={() => {
            playTrack(contextMenu.trackId);
            setContextMenu(null);
          }}
          onAddToQueue={async () => {
            const tracksToAdd = selectedTracks.length > 1 ? selectedTracks : [contextMenu.trackId];
            await addToQueue(tracksToAdd, 'end');
            setContextMenu(null);
          }}
          onAddNextToQueue={async () => {
            const tracksToAdd = selectedTracks.length > 1 ? selectedTracks : [contextMenu.trackId];
            await addToQueue(tracksToAdd, 'next');
            setContextMenu(null);
          }}
          onEditMetadata={() => {
            const track = tracks.find((t) => t.id === contextMenu.trackId);
            if (track) setEditingTrack(track);
            setContextMenu(null);
          }}
          onFetchMetadata={async () => {
            setContextMenu(null);
            await handleFetchMetadata();
          }}
          onFetchCovers={async () => {
            setContextMenu(null);
            await handleFetchCovers();
          }}
          onAddToPlaylist={() => {
            setAddToPlaylistMenu({
              trackId: contextMenu.trackId,
              trackIds: selectedTracks.length > 1 ? selectedTracks : undefined,
              position: { x: contextMenu.x, y: contextMenu.y },
            });
            setContextMenu(null);
          }}
          onDelete={async () => {
            setContextMenu(null);
            await handleDeleteSelected_();
          }}
        />
      )}

      {/* Metadata Fetch Toast */}
      {metadataToast?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-bg-card border border-bg-surface rounded-xl shadow-2xl p-4 max-w-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ToastIcon success={metadataToast.success} failed={metadataToast.failed} />
                  <span className="font-semibold text-text-primary">Metadata Fetch Complete</span>
                </div>
                <ToastDetails
                  success={metadataToast.success}
                  failed={metadataToast.failed}
                  messages={metadataToast.messages}
                  label="track"
                />
              </div>
              <button
                onClick={() => setMetadataToast(null)}
                className="text-text-muted hover:text-text-secondary"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Fetch Toast */}
      {coverToast?.show && (
        <div
          className="fixed bottom-6 right-6 z-50 animate-slide-up"
          style={{ bottom: metadataToast?.show ? '140px' : '24px' }}
        >
          <div className="bg-bg-card border border-bg-surface rounded-xl shadow-2xl p-4 max-w-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ToastIcon
                    success={coverToast.success}
                    failed={coverToast.failed}
                    color="purple"
                  />
                  <span className="font-semibold text-text-primary">Cover Fetch Complete</span>
                </div>
                <ToastDetails
                  success={coverToast.success}
                  failed={coverToast.failed}
                  messages={coverToast.messages}
                  label="cover"
                  successColor="text-purple-400"
                />
              </div>
              <button
                onClick={() => setCoverToast(null)}
                className="text-text-muted hover:text-text-secondary"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTrack && (
        <EditMetadataModal
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSaved={async () => {
            await loadTracks(true);
            await loadAlbums(true);
            await refreshCurrentTrack();
          }}
        />
      )}

      {addToPlaylistMenu && (
        <AddToPlaylistMenu
          trackId={addToPlaylistMenu.trackId}
          trackIds={addToPlaylistMenu.trackIds}
          isOpen={true}
          onClose={() => setAddToPlaylistMenu(null)}
          position={addToPlaylistMenu.position}
        />
      )}
    </div>
  );
}

function ToastIcon({
  success,
  failed,
  color = 'green',
}: {
  success: number;
  failed: number;
  color?: string;
}) {
  if (success > 0 && failed === 0) {
    return (
      <div className={`w-6 h-6 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
        <span className={`text-${color}-400 text-sm`}>&#10003;</span>
      </div>
    );
  }
  if (failed > 0 && success === 0) {
    return (
      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
        <span className="text-red-400 text-sm">&#10007;</span>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
      <span className="text-yellow-400 text-sm">!</span>
    </div>
  );
}

function ToastDetails({
  success,
  failed,
  messages,
  label,
  successColor = 'text-green-400',
}: {
  success: number;
  failed: number;
  messages: string[];
  label: string;
  successColor?: string;
}) {
  return (
    <>
      <div className="text-sm text-text-secondary space-y-1">
        {success > 0 && (
          <p className={successColor}>
            {success} {label}
            {success !== 1 ? 's' : ''} updated
          </p>
        )}
        {failed > 0 && (
          <p className="text-red-400">
            {failed} {label}
            {failed !== 1 ? 's' : ''} not found
          </p>
        )}
      </div>
      {messages.length > 0 && (
        <div className="mt-2 pt-2 border-t border-bg-surface">
          <div className="space-y-0.5">
            {messages.map((msg, i) => (
              <p key={i} className="text-xs text-text-secondary truncate" title={msg}>
                {msg.replace('Found: ', '')}
              </p>
            ))}
            {success > 5 && <p className="text-xs text-text-tertiary">...and {success - 5} more</p>}
          </div>
        </div>
      )}
    </>
  );
}
