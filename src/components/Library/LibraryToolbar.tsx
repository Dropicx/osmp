import {
  Search,
  Filter,
  X,
  Download,
  Trash2,
  Image,
  Music2,
  ChevronDown,
  Copy,
} from 'lucide-react';
import type { TrackFilters } from '../../types';

interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  onClearAll: () => void;
  displayedCount: number;
  totalCount: number;
  // Selection
  selectedCount: number;
  onClearSelection: () => void;
  onFetchMetadata: () => void;
  onFetchCovers: () => void;
  onDeleteSelected: () => void;
  onAddToPlaylist: (e: React.MouseEvent) => void;
  fetchingMetadata: boolean;
  fetchingCovers: boolean;
  // Filters
  filters: TrackFilters;
  filterOptions: {
    artists: string[];
    albums: string[];
    genres: string[];
    years: number[];
    formats: string[];
  };
  onFilterChange: (key: keyof TrackFilters, value: string | number | undefined) => void;
  // Duplicates
  showDuplicatesOnly?: boolean;
  onToggleDuplicates?: () => void;
}

export default function LibraryToolbar({
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  onClearAll,
  displayedCount,
  totalCount,
  selectedCount,
  onClearSelection,
  onFetchMetadata,
  onFetchCovers,
  onDeleteSelected,
  onAddToPlaylist,
  fetchingMetadata,
  fetchingCovers,
  filters,
  filterOptions,
  onFilterChange,
  showDuplicatesOnly,
  onToggleDuplicates,
}: LibraryToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-1">
          <div className="flex-shrink-0">
            <h1 className="text-3xl font-bold text-text-primary">Your Library</h1>
            <p className="text-text-tertiary text-sm mt-1">
              {displayedCount === totalCount
                ? `${totalCount} tracks`
                : `${displayedCount} of ${totalCount} tracks`}
            </p>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-bg-card border border-bg-surface rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-primary-500 transition-colors"
              aria-label="Search tracks"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={onToggleFilters}
            className={`btn-secondary flex items-center gap-2 flex-shrink-0 ${showFilters ? 'bg-primary-600/20 border-primary-500' : ''}`}
            aria-expanded={showFilters}
            aria-label="Toggle filters"
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button onClick={onClearAll} className="btn-tertiary text-sm flex-shrink-0">
              Clear all
            </button>
          )}

          {onToggleDuplicates && (
            <button
              onClick={onToggleDuplicates}
              className={`btn-secondary flex items-center gap-2 flex-shrink-0 text-sm ${showDuplicatesOnly ? 'bg-orange-600/20 border-orange-500 text-orange-400' : ''}`}
              aria-pressed={showDuplicatesOnly}
              aria-label="Show duplicate tracks"
            >
              <Copy size={14} aria-hidden="true" />
              Duplicates
            </button>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-text-tertiary text-sm font-medium px-3 py-1.5 bg-bg-card rounded-lg">
              {selectedCount} selected
            </span>
            <button onClick={onAddToPlaylist} className="btn-secondary flex items-center gap-2">
              <Music2 size={16} />
              Add to Playlist
            </button>
            <button
              onClick={onFetchMetadata}
              disabled={fetchingMetadata}
              className="btn-success flex items-center gap-2"
            >
              <Download size={16} />
              {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
            </button>
            <button
              onClick={onFetchCovers}
              disabled={fetchingCovers}
              className="btn-secondary flex items-center gap-2 border-purple-500/50 hover:bg-purple-600/20"
            >
              <Image size={16} className="text-purple-400" />
              {fetchingCovers ? 'Fetching...' : 'Fetch Covers'}
            </button>
            <button onClick={onDeleteSelected} className="btn-danger flex items-center gap-2">
              <Trash2 size={16} />
              Delete
            </button>
            <button onClick={onClearSelection} className="btn-tertiary">
              Clear
            </button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-bg-card rounded-xl border border-bg-surface">
          <FilterDropdown
            label="Artist"
            value={filters.artist || ''}
            options={filterOptions.artists}
            onChange={(v) => onFilterChange('artist', v || undefined)}
          />
          <FilterDropdown
            label="Album"
            value={filters.album || ''}
            options={filterOptions.albums}
            onChange={(v) => onFilterChange('album', v || undefined)}
          />
          <FilterDropdown
            label="Genre"
            value={filters.genre || ''}
            options={filterOptions.genres}
            onChange={(v) => onFilterChange('genre', v || undefined)}
          />
          <FilterDropdown
            label="Year"
            value={filters.year?.toString() || ''}
            options={filterOptions.years.map(String)}
            onChange={(v) => onFilterChange('year', v ? parseInt(v) : undefined)}
          />
          <FilterDropdown
            label="Format"
            value={filters.format || ''}
            options={filterOptions.formats}
            onChange={(v) => onFilterChange('format', v || undefined)}
          />
        </div>
      )}

      {Object.keys(filters).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.artist && (
            <FilterChip
              label={`Artist: ${filters.artist}`}
              onRemove={() => onFilterChange('artist', undefined)}
            />
          )}
          {filters.album && (
            <FilterChip
              label={`Album: ${filters.album}`}
              onRemove={() => onFilterChange('album', undefined)}
            />
          )}
          {filters.genre && (
            <FilterChip
              label={`Genre: ${filters.genre}`}
              onRemove={() => onFilterChange('genre', undefined)}
            />
          )}
          {filters.year && (
            <FilterChip
              label={`Year: ${filters.year}`}
              onRemove={() => onFilterChange('year', undefined)}
            />
          )}
          {filters.format && (
            <FilterChip
              label={`Format: ${filters.format}`}
              onRemove={() => onFilterChange('format', undefined)}
            />
          )}
        </div>
      )}
    </>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
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
          aria-label={`Filter by ${label}`}
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-600/20 text-primary-400 text-sm rounded-full">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-primary-300"
        aria-label={`Remove ${label} filter`}
      >
        <X size={14} />
      </button>
    </span>
  );
}
