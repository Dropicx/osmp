import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Play, Pause, Trash2, Download, Search, Filter, X,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, Image, Pencil, Music2
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDebounce } from '../hooks/useDebounce';
import { Track, TrackFilters, SortConfig, SortField, MetadataResult, CoverFetchResult } from '../types';
import EditMetadataModal from './EditMetadataModal';
import AddToPlaylistMenu from './AddToPlaylistMenu';

export default function Library() {
  const {
    tracks, loading, loadTracks, playTrack, pausePlayback,
    isPlaying, currentTrack, selectedTracks, toggleTrackSelection, clearSelection,
    refreshCurrentTrack
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
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
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

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

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

  // Compute filter options from tracks
  const filterOptions = useMemo(() => {
    const artists = new Set<string>();
    const albums = new Set<string>();
    const genres = new Set<string>();
    const years = new Set<number>();
    const formats = new Set<string>();

    tracks.forEach(track => {
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

  // Filter, search, and sort tracks
  const displayedTracks = useMemo(() => {
    let result = [...tracks];

    // Apply search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(query) ||
        t.artist?.toLowerCase().includes(query) ||
        t.album?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.artist) {
      result = result.filter(t => t.artist === filters.artist);
    }
    if (filters.album) {
      result = result.filter(t => t.album === filters.album);
    }
    if (filters.genre) {
      result = result.filter(t => t.genre === filters.genre);
    }
    if (filters.year) {
      result = result.filter(t => t.year === filters.year);
    }
    if (filters.format) {
      result = result.filter(t => t.file_format?.toUpperCase() === filters.format);
    }

    // Apply sorting
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
          case 'year':
            aVal = a.year || 0;
            bVal = b.year || 0;
            break;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tracks, debouncedSearch, filters, sortConfig]);

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: displayedTracks.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFetchMetadata = async () => {
    if (selectedTracks.length === 0) return;
    setFetchingMetadata(true);
    setMetadataToast(null);
    try {
      const results = await invoke<MetadataResult[]>('fetch_metadata', { trackIds: selectedTracks, force: false });
      await loadTracks();
      await refreshCurrentTrack(); // Update player if current track was updated
      clearSelection();

      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const messages = results
        .filter(r => r.success && r.message !== 'Metadata already available')
        .map(r => r.message)
        .slice(0, 5);

      setMetadataToast({ show: true, success, failed, messages });

      // Auto-hide toast after 8 seconds
      setTimeout(() => setMetadataToast(null), 8000);
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
      setMetadataToast({
        show: true,
        success: 0,
        failed: selectedTracks.length,
        messages: [`Error: ${error}`]
      });
      setTimeout(() => setMetadataToast(null), 8000);
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

  const handleContextMenu = (e: React.MouseEvent, trackId: number) => {
    e.preventDefault();
    // If the track isn't selected, select only this track
    if (!selectedTracks.includes(trackId)) {
      clearSelection();
      toggleTrackSelection(trackId);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, trackId });
  };

  const handleContextMenuPlay = () => {
    if (contextMenu) {
      playTrack(contextMenu.trackId);
    }
    setContextMenu(null);
  };

  const handleContextMenuFetchMetadata = async () => {
    setContextMenu(null);
    await handleFetchMetadata();
  };

  const handleContextMenuDelete = async () => {
    setContextMenu(null);
    await handleDeleteSelected();
  };

  const handleFetchCovers = async () => {
    if (selectedTracks.length === 0) return;
    setFetchingCovers(true);
    setCoverToast(null);
    try {
      const results = await invoke<CoverFetchResult[]>('fetch_covers', { trackIds: selectedTracks });
      await loadTracks();
      await refreshCurrentTrack(); // Update player cover if current track was updated

      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const messages = results
        .filter(r => r.success)
        .map(r => r.message)
        .slice(0, 5);
      const failedMessages = results
        .filter(r => !r.success)
        .map(r => r.message)
        .slice(0, 3);

      setCoverToast({
        show: true,
        success,
        failed,
        messages: [...messages, ...failedMessages]
      });
      setTimeout(() => setCoverToast(null), 8000);
    } catch (error) {
      console.error('Failed to fetch covers:', error);
      setCoverToast({
        show: true,
        success: 0,
        failed: selectedTracks.length,
        messages: [`Error: ${error}`]
      });
      setTimeout(() => setCoverToast(null), 8000);
    } finally {
      setFetchingCovers(false);
    }
  };

  const handleContextMenuFetchCovers = async () => {
    setContextMenu(null);
    await handleFetchCovers();
  };

  const handleContextMenuEditMetadata = () => {
    if (contextMenu) {
      const track = tracks.find(t => t.id === contextMenu.trackId);
      if (track) {
        setEditingTrack(track);
      }
    }
    setContextMenu(null);
  };

  const handleEditMetadataSaved = async () => {
    await loadTracks();
    await refreshCurrentTrack();
  };

  const handlePlayPause = useCallback((trackId: number) => {
    if (currentTrack?.id === trackId && isPlaying) {
      pausePlayback();
    } else {
      playTrack(trackId);
    }
  }, [currentTrack?.id, isPlaying, pausePlayback, playTrack]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        if (prev.direction === 'asc') {
          return { field, direction: 'desc' };
        }
        return null; // Remove sort
      }
      return { field, direction: 'asc' };
    });
  };

  const handleFilterChange = (key: keyof TrackFilters, value: string | number | undefined) => {
    setFilters(prev => {
      if (value === undefined || value === '') {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const activeFilterCount = Object.keys(filters).length + (searchQuery ? 1 : 0);

  const SortableHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`text-left p-4 text-text-tertiary font-medium text-sm cursor-pointer hover:text-text-secondary transition-colors select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfig?.field === field ? (
          sortConfig.direction === 'asc' ? (
            <ArrowUp size={14} className="text-primary-500" />
          ) : (
            <ArrowDown size={14} className="text-primary-500" />
          )
        ) : (
          <ArrowUpDown size={14} className="opacity-30" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-tertiary">Loading tracks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header with Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-1">
          <div className="flex-shrink-0">
            <h1 className="text-3xl font-bold text-text-primary">Your Library</h1>
            <p className="text-text-tertiary text-sm mt-1">
              {displayedTracks.length === tracks.length
                ? `${tracks.length} tracks`
                : `${displayedTracks.length} of ${tracks.length} tracks`}
            </p>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-bg-card border border-bg-surface rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 flex-shrink-0 ${showFilters ? 'bg-primary-600/20 border-primary-500' : ''}`}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="btn-tertiary text-sm flex-shrink-0">
              Clear all
            </button>
          )}
        </div>

        {selectedTracks.length > 0 && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-text-tertiary text-sm font-medium px-3 py-1.5 bg-bg-card rounded-lg">
              {selectedTracks.length} selected
            </span>
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setAddToPlaylistMenu({
                  trackId: selectedTracks[0],
                  trackIds: selectedTracks,
                  position: { x: rect.left, y: rect.bottom + 4 },
                });
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <Music2 size={16} />
              Add to Playlist
            </button>
            <button
              onClick={handleFetchMetadata}
              disabled={fetchingMetadata}
              className="btn-success flex items-center gap-2"
            >
              <Download size={16} />
              {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
            </button>
            <button
              onClick={handleFetchCovers}
              disabled={fetchingCovers}
              className="btn-secondary flex items-center gap-2 border-purple-500/50 hover:bg-purple-600/20"
            >
              <Image size={16} className="text-purple-400" />
              {fetchingCovers ? 'Fetching...' : 'Fetch Covers'}
            </button>
            <button
              onClick={handleDeleteSelected}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button onClick={clearSelection} className="btn-tertiary">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-bg-card rounded-xl border border-bg-surface">
          {/* Artist Filter */}
          <FilterDropdown
            label="Artist"
            value={filters.artist || ''}
            options={filterOptions.artists}
            onChange={(v) => handleFilterChange('artist', v || undefined)}
          />

          {/* Album Filter */}
          <FilterDropdown
            label="Album"
            value={filters.album || ''}
            options={filterOptions.albums}
            onChange={(v) => handleFilterChange('album', v || undefined)}
          />

          {/* Genre Filter */}
          <FilterDropdown
            label="Genre"
            value={filters.genre || ''}
            options={filterOptions.genres}
            onChange={(v) => handleFilterChange('genre', v || undefined)}
          />

          {/* Year Filter */}
          <FilterDropdown
            label="Year"
            value={filters.year?.toString() || ''}
            options={filterOptions.years.map(String)}
            onChange={(v) => handleFilterChange('year', v ? parseInt(v) : undefined)}
          />

          {/* Format Filter */}
          <FilterDropdown
            label="Format"
            value={filters.format || ''}
            options={filterOptions.formats}
            onChange={(v) => handleFilterChange('format', v || undefined)}
          />
        </div>
      )}

      {/* Active Filter Chips */}
      {Object.keys(filters).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.artist && (
            <FilterChip label={`Artist: ${filters.artist}`} onRemove={() => handleFilterChange('artist', undefined)} />
          )}
          {filters.album && (
            <FilterChip label={`Album: ${filters.album}`} onRemove={() => handleFilterChange('album', undefined)} />
          )}
          {filters.genre && (
            <FilterChip label={`Genre: ${filters.genre}`} onRemove={() => handleFilterChange('genre', undefined)} />
          )}
          {filters.year && (
            <FilterChip label={`Year: ${filters.year}`} onRemove={() => handleFilterChange('year', undefined)} />
          )}
          {filters.format && (
            <FilterChip label={`Format: ${filters.format}`} onRemove={() => handleFilterChange('format', undefined)} />
          )}
        </div>
      )}

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
          <table className="w-full table-fixed">
            <thead className="bg-bg-elevated border-b border-bg-surface sticky top-0 z-10">
              <tr>
                <th className="text-left p-4 w-12">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTracks.length === displayedTracks.length && displayedTracks.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          displayedTracks.forEach(t => {
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
                <SortableHeader field="title" label="Title" />
                <SortableHeader field="artist" label="Artist" />
                <SortableHeader field="album" label="Album" />
                <SortableHeader field="genre" label="Genre" />
                <SortableHeader field="duration" label="Duration" className="text-right" />
                <th className="text-center p-4 text-text-tertiary font-medium text-sm w-12"></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                <td colSpan={8} style={{ padding: 0, position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const track = displayedTracks[virtualRow.index];
                    const isSelected = selectedTracks.includes(track.id);
                    const isCurrentTrack = currentTrack?.id === track.id;

                    return (
                      <div
                        key={track.id}
                        className={`absolute left-0 w-full flex items-center hover:bg-bg-hover cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary-600/10 border-l-2 border-l-primary-600' : ''
                        } ${isCurrentTrack ? 'bg-primary-600/5' : ''}`}
                        style={{
                          top: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                          height: `${virtualRow.size}px`,
                        }}
                        onDoubleClick={() => playTrack(track.id)}
                        onContextMenu={(e) => handleContextMenu(e, track.id)}
                      >
                        <div className="p-4 w-12 flex-shrink-0">
                          <label className="custom-checkbox">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTrackSelection(track.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="checkmark"></span>
                          </label>
                        </div>
                        <div className="p-4 text-text-tertiary w-12 flex-shrink-0">
                          {virtualRow.index + 1}
                        </div>
                        <div className="p-4 font-semibold text-text-primary flex-1 truncate">
                          {track.title || 'Unknown Title'}
                        </div>
                        <div className="p-4 text-text-secondary flex-1 truncate">
                          {track.artist || 'Unknown Artist'}
                        </div>
                        <div className="p-4 text-text-secondary flex-1 truncate">
                          {track.album || 'Unknown Album'}
                        </div>
                        <div className="p-4 text-text-tertiary flex-1 truncate">
                          {track.genre || '-'}
                        </div>
                        <div className="p-4 text-right text-text-tertiary font-medium w-24 flex-shrink-0">
                          {formatDuration(track.duration)}
                        </div>
                        <div className="p-4 w-12 flex-shrink-0">
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
                        </div>
                      </div>
                    );
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-bg-card border border-bg-surface rounded-xl shadow-2xl py-2 min-w-[180px] animate-slide-up"
          style={getContextMenuPosition()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleContextMenuPlay}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Play size={16} className="text-primary-500" />
            Play
          </button>
          <button
            onClick={handleContextMenuEditMetadata}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Pencil size={16} className="text-blue-400" />
            Edit Metadata
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={handleContextMenuFetchMetadata}
            disabled={fetchingMetadata}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            <Download size={16} className="text-green-400" />
            {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
            {selectedTracks.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">({selectedTracks.length})</span>
            )}
          </button>
          <button
            onClick={handleContextMenuFetchCovers}
            disabled={fetchingCovers}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            <Image size={16} className="text-purple-400" />
            {fetchingCovers ? 'Fetching...' : 'Fetch Covers'}
            {selectedTracks.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">({selectedTracks.length})</span>
            )}
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={() => {
              if (contextMenu) {
                setAddToPlaylistMenu({
                  trackId: contextMenu.trackId,
                  trackIds: selectedTracks.length > 1 ? selectedTracks : undefined,
                  position: { x: contextMenu.x, y: contextMenu.y },
                });
              }
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Music2 size={16} className="text-primary-500" />
            Add to Playlist
            {selectedTracks.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">({selectedTracks.length})</span>
            )}
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={handleContextMenuDelete}
            className="w-full px-4 py-2 text-left text-red-400 hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Trash2 size={16} />
            Delete
            {selectedTracks.length > 1 && (
              <span className="ml-auto text-xs text-text-tertiary">({selectedTracks.length})</span>
            )}
          </button>
        </div>
      )}

      {/* Metadata Fetch Toast */}
      {metadataToast?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-bg-card border border-bg-surface rounded-xl shadow-2xl p-4 max-w-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {metadataToast.success > 0 && metadataToast.failed === 0 ? (
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-green-400 text-sm">✓</span>
                    </div>
                  ) : metadataToast.failed > 0 && metadataToast.success === 0 ? (
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-red-400 text-sm">✗</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <span className="text-yellow-400 text-sm">!</span>
                    </div>
                  )}
                  <span className="font-semibold text-text-primary">Metadata Fetch Complete</span>
                </div>
                <div className="text-sm text-text-secondary space-y-1">
                  {metadataToast.success > 0 && (
                    <p className="text-green-400">{metadataToast.success} track{metadataToast.success !== 1 ? 's' : ''} updated</p>
                  )}
                  {metadataToast.failed > 0 && (
                    <p className="text-red-400">{metadataToast.failed} track{metadataToast.failed !== 1 ? 's' : ''} not found</p>
                  )}
                </div>
                {metadataToast.messages.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-bg-surface">
                    <p className="text-xs text-text-tertiary mb-1">Found:</p>
                    <div className="space-y-0.5">
                      {metadataToast.messages.map((msg, i) => (
                        <p key={i} className="text-xs text-text-secondary truncate" title={msg}>
                          {msg.replace('Found: ', '')}
                        </p>
                      ))}
                      {metadataToast.success > 5 && (
                        <p className="text-xs text-text-tertiary">...and {metadataToast.success - 5} more</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setMetadataToast(null)}
                className="text-text-muted hover:text-text-secondary"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Fetch Toast */}
      {coverToast?.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up" style={{ bottom: metadataToast?.show ? '140px' : '24px' }}>
          <div className="bg-bg-card border border-bg-surface rounded-xl shadow-2xl p-4 max-w-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {coverToast.success > 0 && coverToast.failed === 0 ? (
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <span className="text-purple-400 text-sm">✓</span>
                    </div>
                  ) : coverToast.failed > 0 && coverToast.success === 0 ? (
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-red-400 text-sm">✗</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <span className="text-yellow-400 text-sm">!</span>
                    </div>
                  )}
                  <span className="font-semibold text-text-primary">Cover Fetch Complete</span>
                </div>
                <div className="text-sm text-text-secondary space-y-1">
                  {coverToast.success > 0 && (
                    <p className="text-purple-400">{coverToast.success} cover{coverToast.success !== 1 ? 's' : ''} found</p>
                  )}
                  {coverToast.failed > 0 && (
                    <p className="text-red-400">{coverToast.failed} cover{coverToast.failed !== 1 ? 's' : ''} not found</p>
                  )}
                </div>
                {coverToast.messages.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-bg-surface">
                    <div className="space-y-0.5">
                      {coverToast.messages.map((msg, i) => (
                        <p key={i} className="text-xs text-text-secondary truncate" title={msg}>
                          {msg}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setCoverToast(null)}
                className="text-text-muted hover:text-text-secondary"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingTrack && (
        <EditMetadataModal
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSaved={handleEditMetadataSaved}
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

// Filter Dropdown Component
function FilterDropdown({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <label className="block text-xs text-text-tertiary mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-bg-elevated border border-bg-surface rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary-500 min-w-[140px] cursor-pointer"
        >
          <option value="">All</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
      </div>
    </div>
  );
}

// Filter Chip Component
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-600/20 text-primary-400 text-sm rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-primary-300">
        <X size={14} />
      </button>
    </span>
  );
}
