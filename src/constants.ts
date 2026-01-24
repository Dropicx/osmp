// Timing constants
export const POSITION_UPDATE_INTERVAL = 1000;
export const PREVIOUS_TRACK_THRESHOLD = 3;
export const TOAST_TIMEOUT = 8000;

// Default display values
export const DEFAULT_TITLE = 'Unknown Title';
export const DEFAULT_ARTIST = 'Unknown Artist';
export const DEFAULT_ALBUM = 'Unknown Album';

// Context menu dimensions
export const CONTEXT_MENU_WIDTH = 180;
export const CONTEXT_MENU_HEIGHT = 240;
export const CONTEXT_MENU_PADDING = 8;

// Column configuration
import type { ColumnConfig, ContentColumnId } from './types/columns';

export const COLUMN_DEFINITIONS: ColumnConfig[] = [
  { id: 'title', label: 'Title', minWidth: 120, defaultWidth: 250 },
  { id: 'artist', label: 'Artist', minWidth: 100, defaultWidth: 200 },
  { id: 'album', label: 'Album', minWidth: 100, defaultWidth: 200 },
  { id: 'genre', label: 'Genre', minWidth: 80, defaultWidth: 150 },
  { id: 'duration', label: 'Duration', minWidth: 70, defaultWidth: 100 },
];

export const DEFAULT_COLUMN_WIDTHS: Record<ContentColumnId, number> = {
  title: 250,
  artist: 200,
  album: 200,
  genre: 150,
  duration: 100,
};

export const DEFAULT_COLUMN_VISIBILITY: Record<ContentColumnId, boolean> = {
  title: true,
  artist: true,
  album: true,
  genre: true,
  duration: true,
};

export const COLUMN_STORAGE_KEY = 'osmp-column-widths';
export const COLUMN_VISIBILITY_STORAGE_KEY = 'osmp-column-visibility';
