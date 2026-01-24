import type { Track } from '../../types';
import type { ContentColumnId } from '../../types/columns';

export interface FixedColumn {
  id: string;
  width: number;
  headerContent?: React.ReactNode;
  renderCell: (track: Track, index: number) => React.ReactNode;
  cellClassName?: string;
}

export interface TrackTableProps {
  tracks: Track[];
  leadingColumns?: FixedColumn[];
  trailingColumns?: FixedColumn[];
  virtualized?: boolean;
  estimatedRowHeight?: number;
  overscan?: number;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  sortConfig?: { field: ContentColumnId; direction: 'asc' | 'desc' } | null;
  onSort?: (field: ContentColumnId) => void;
  onRowClick?: (track: Track, index: number, e: React.MouseEvent) => void;
  onRowDoubleClick?: (track: Track, index: number) => void;
  onRowContextMenu?: (e: React.MouseEvent, track: Track, index: number) => void;
  rowClassName?: (track: Track, index: number) => string;
  currentTrackId?: number | null;
}
