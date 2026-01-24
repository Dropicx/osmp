import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useColumnResize } from '../../hooks/useColumnResize';
import type { ContentColumnId } from '../../types/columns';
import type { TrackTableProps } from './types';
import TrackTableRow from './TrackTableRow';
import ColumnResizeHandle from '../ColumnResizeHandle';

export default function TrackTable({
  tracks,
  leadingColumns = [],
  trailingColumns = [],
  virtualized = false,
  estimatedRowHeight = 48,
  overscan = 10,
  scrollContainerRef,
  sortConfig,
  onSort,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  rowClassName,
}: TrackTableProps) {
  const { resizingColumn, startResize, visibleColumns, getColumnWidth } = useColumnResize();

  const totalLeadingWidth = leadingColumns.reduce((sum, col) => sum + col.width, 0);
  const totalContentWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col.id), 0);
  const totalTrailingWidth = trailingColumns.reduce((sum, col) => sum + col.width, 0);
  const totalColCount = leadingColumns.length + visibleColumns.length + trailingColumns.length;

  const rowVirtualizer = useVirtualizer({
    count: virtualized ? tracks.length : 0,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: () => estimatedRowHeight,
    overscan,
    enabled: virtualized && !!scrollContainerRef,
  });

  const virtualRows = virtualized ? rowVirtualizer.getVirtualItems() : [];
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <table
      className="track-table w-full"
      role="table"
      aria-label="Track list"
      style={{
        tableLayout: 'fixed',
        minWidth: totalLeadingWidth + totalContentWidth + totalTrailingWidth,
      }}
    >
      <colgroup>
        {leadingColumns.map((col) => (
          <col key={col.id} style={{ width: `${col.width}px` }} />
        ))}
        {visibleColumns.map((col) => (
          <col key={col.id} style={{ width: `${getColumnWidth(col.id)}px` }} />
        ))}
        {trailingColumns.map((col) => (
          <col key={col.id} style={{ width: `${col.width}px` }} />
        ))}
      </colgroup>
      <thead className="bg-bg-elevated border-b border-bg-surface sticky top-0 z-10">
        <tr>
          {leadingColumns.map((col) => (
            <th key={col.id} className="p-4 text-text-tertiary font-medium text-sm text-left">
              {col.headerContent ?? null}
            </th>
          ))}
          {visibleColumns.map((col) => (
            <th
              key={col.id}
              className={`p-4 text-text-tertiary font-medium text-sm cursor-pointer hover:text-text-secondary transition-colors select-none ${
                col.id === 'duration' ? 'text-right' : 'text-left'
              }`}
              onClick={() => onSort?.(col.id as ContentColumnId)}
              aria-sort={
                sortConfig?.field === col.id
                  ? sortConfig.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div
                className={`flex items-center gap-1 ${col.id === 'duration' ? 'justify-end' : ''}`}
              >
                {col.label}
                {sortConfig?.field === col.id ? (
                  sortConfig.direction === 'asc' ? (
                    <ArrowUp size={14} className="text-primary-500" />
                  ) : (
                    <ArrowDown size={14} className="text-primary-500" />
                  )
                ) : onSort ? (
                  <ArrowUpDown size={14} className="opacity-30" />
                ) : null}
              </div>
              <ColumnResizeHandle
                columnId={col.id}
                isResizing={resizingColumn === col.id}
                onStartResize={startResize}
              />
            </th>
          ))}
          {trailingColumns.map((col) => (
            <th key={col.id} className="p-4 text-text-tertiary font-medium text-sm text-center">
              {col.headerContent ?? null}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {virtualized ? (
          <>
            {paddingTop > 0 && (
              <tr>
                <td
                  colSpan={totalColCount}
                  style={{ height: paddingTop, padding: 0, border: 'none' }}
                />
              </tr>
            )}
            {virtualRows.map((vRow) => {
              const track = tracks[vRow.index];
              return (
                <TrackTableRow
                  key={track.id}
                  track={track}
                  index={vRow.index}
                  visibleColumns={visibleColumns}
                  leadingColumns={leadingColumns}
                  trailingColumns={trailingColumns}
                  onClick={onRowClick}
                  onDoubleClick={onRowDoubleClick}
                  onContextMenu={onRowContextMenu}
                  className={rowClassName?.(track, vRow.index) ?? ''}
                />
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td
                  colSpan={totalColCount}
                  style={{ height: paddingBottom, padding: 0, border: 'none' }}
                />
              </tr>
            )}
          </>
        ) : (
          tracks.map((track, index) => (
            <TrackTableRow
              key={track.id}
              track={track}
              index={index}
              visibleColumns={visibleColumns}
              leadingColumns={leadingColumns}
              trailingColumns={trailingColumns}
              onClick={onRowClick}
              onDoubleClick={onRowDoubleClick}
              onContextMenu={onRowContextMenu}
              className={rowClassName?.(track, index) ?? ''}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

export type { TrackTableProps, FixedColumn } from './types';
