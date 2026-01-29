import { memo } from 'react';
import type { Track } from '../../types';
import type { ColumnConfig, ContentColumnId } from '../../types/columns';
import type { FixedColumn } from './types';
import { getCellContent } from '../../utils/columns';

interface TrackTableRowProps {
  track: Track;
  index: number;
  visibleColumns: ColumnConfig[];
  leadingColumns: FixedColumn[];
  trailingColumns: FixedColumn[];
  onClick?: (track: Track, index: number, e: React.MouseEvent) => void;
  onDoubleClick?: (track: Track, index: number) => void;
  onContextMenu?: (e: React.MouseEvent, track: Track, index: number) => void;
  className?: string;
}

function getCellClassName(colId: ContentColumnId): string {
  switch (colId) {
    case 'title':
      return 'font-semibold text-text-primary';
    case 'duration':
      return 'text-right text-text-tertiary font-medium';
    case 'genre':
      return 'text-text-tertiary';
    default:
      return 'text-text-secondary';
  }
}

export default memo(function TrackTableRow({
  track,
  index,
  visibleColumns,
  leadingColumns,
  trailingColumns,
  onClick,
  onDoubleClick,
  onContextMenu,
  className = '',
}: TrackTableRowProps) {
  return (
    <tr
      className={`hover:bg-bg-hover cursor-pointer transition-colors select-none ${className}`}
      onClick={(e) => onClick?.(track, index, e)}
      onDoubleClick={() => onDoubleClick?.(track, index)}
      onContextMenu={(e) => onContextMenu?.(e, track, index)}
      data-track-id={track.id}
    >
      {leadingColumns.map((col) => (
        <td key={col.id} className={`p-4 ${col.cellClassName ?? ''}`}>
          {col.renderCell(track, index)}
        </td>
      ))}
      {visibleColumns.map((col) => (
        <td key={col.id} className={`p-4 truncate ${getCellClassName(col.id)}`}>
          {getCellContent(track, col.id)}
        </td>
      ))}
      {trailingColumns.map((col) => (
        <td key={col.id} className={`p-4 ${col.cellClassName ?? ''}`}>
          {col.renderCell(track, index)}
        </td>
      ))}
    </tr>
  );
});
