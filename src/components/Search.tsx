import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Search as SearchIcon, Play, List, ListPlus } from 'lucide-react';
import { useContextMenu } from '../hooks/useContextMenu';
import { useDebounce } from '../hooks/useDebounce';
import TrackTable from './TrackTable';
import type { FixedColumn } from './TrackTable';

export default function Search() {
  const { tracks, searchTracks, playTrack, addToQueue, loadTracks } = useStore();
  const [query, setQuery] = useState('');
  const { contextMenu, getMenuPosition, openContextMenu, closeContextMenu } = useContextMenu(200);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);
  const hasSearched = debouncedQuery.trim().length > 0;

  // Debounced live search - triggers on typing after 300ms
  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchTracks(debouncedQuery);
    } else {
      // Reset to full library when query is cleared
      loadTracks(true);
    }
  }, [debouncedQuery, searchTracks, loadTracks]);

  // Listen for Ctrl/Cmd+F focus event
  useEffect(() => {
    const handleFocusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('osmp:focus-search', handleFocusSearch);
    return () => window.removeEventListener('osmp:focus-search', handleFocusSearch);
  }, []);

  // Immediate search on Enter
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchTracks(query);
    }
  };

  const leadingColumns = useMemo<FixedColumn[]>(
    () => [
      {
        id: 'row-number',
        width: 48,
        headerContent: '#',
        renderCell: (_track, index) => <span className="text-text-tertiary">{index + 1}</span>,
      },
    ],
    []
  );

  const trailingColumns = useMemo<FixedColumn[]>(
    () => [
      {
        id: 'actions',
        width: 96,
        headerContent: 'Actions',
        renderCell: (track) => (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToQueue([track.id], 'end');
              }}
              className="btn-icon"
              aria-label="Add to Queue"
              title="Add to Queue"
            >
              <List size={16} className="text-text-tertiary" aria-hidden="true" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToQueue([track.id], 'next');
              }}
              className="btn-icon"
              aria-label="Add Next to Queue"
              title="Add Next to Queue"
            >
              <ListPlus size={16} className="text-text-tertiary" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [addToQueue]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-6 text-text-primary">Search</h1>
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon
            className="absolute left-5 top-1/2 transform -translate-y-1/2 text-text-tertiary"
            size={20}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs, artists, or albums..."
            className="w-full bg-bg-card border border-bg-surface rounded-full pl-14 pr-6 py-4 text-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            aria-label="Search for songs, artists, or albums"
          />
        </form>
      </div>

      {hasSearched && tracks?.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-text-primary">Results</h2>
          <div className="bg-bg-card rounded-2xl overflow-auto border border-bg-surface shadow-lg">
            <TrackTable
              tracks={tracks}
              leadingColumns={leadingColumns}
              trailingColumns={trailingColumns}
              virtualized={false}
              onRowDoubleClick={(track) => playTrack(track.id)}
              onRowContextMenu={(e, track) => openContextMenu(e, track.id)}
            />
          </div>
        </div>
      )}

      {hasSearched && query && (tracks?.length ?? 0) === 0 && (
        <div className="text-center text-text-tertiary py-12">
          <p className="text-lg">No results found for &quot;{query}&quot;</p>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-bg-card border border-bg-surface rounded-xl shadow-2xl py-2 min-w-[180px] animate-slide-up"
          style={getMenuPosition()}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          tabIndex={-1}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Track context menu"
        >
          <button
            onClick={() => {
              if (contextMenu) {
                playTrack(contextMenu.trackId);
              }
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
            role="menuitem"
          >
            <Play size={16} className="text-primary-500" aria-hidden="true" />
            Play
          </button>
          <div className="h-px bg-bg-surface my-1" role="separator" />
          <button
            onClick={async () => {
              if (contextMenu) {
                await addToQueue([contextMenu.trackId], 'end');
              }
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
            role="menuitem"
          >
            <List size={16} className="text-primary-500" aria-hidden="true" />
            Add to Queue
          </button>
          <button
            onClick={async () => {
              if (contextMenu) {
                await addToQueue([contextMenu.trackId], 'next');
              }
              closeContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
            role="menuitem"
          >
            <ListPlus size={16} className="text-primary-500" aria-hidden="true" />
            Add Next to Queue
          </button>
        </div>
      )}
    </div>
  );
}
