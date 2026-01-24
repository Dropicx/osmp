import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { COLUMN_DEFINITIONS } from '../constants';
import type { ContentColumnId, ColumnConfig } from '../types/columns';

export function useColumnResize() {
  const { columnWidths, columnVisibility, setColumnWidth } = useStore();
  const [resizingColumn, setResizingColumn] = useState<ContentColumnId | null>(null);
  const [liveResize, setLiveResize] = useState<{ columnId: ContentColumnId; width: number } | null>(
    null
  );

  const dragState = useRef<{
    columnId: ContentColumnId;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);

  const visibleColumns = useMemo<ColumnConfig[]>(() => {
    return COLUMN_DEFINITIONS.filter((col) => columnVisibility[col.id]);
  }, [columnVisibility]);

  const getColumnWidth = useCallback(
    (colId: ContentColumnId): number => {
      if (liveResize && liveResize.columnId === colId) {
        return liveResize.width;
      }
      return columnWidths[colId];
    },
    [columnWidths, liveResize]
  );

  const startResize = useCallback(
    (columnId: ContentColumnId, startX: number) => {
      const col = COLUMN_DEFINITIONS.find((c) => c.id === columnId);
      if (!col) return;

      dragState.current = {
        columnId,
        startX,
        startWidth: columnWidths[columnId],
        minWidth: col.minWidth,
      };
      setResizingColumn(columnId);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [columnWidths]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;

      const { columnId, startX, startWidth, minWidth } = dragState.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(minWidth, startWidth + delta);
      setLiveResize({ columnId, width: newWidth });
    };

    const handleMouseUp = () => {
      if (!dragState.current) return;

      const { columnId } = dragState.current;
      setLiveResize((prev) => {
        if (prev) {
          setColumnWidth(columnId, prev.width);
        }
        return null;
      });

      dragState.current = null;
      setResizingColumn(null);

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setColumnWidth]);

  return {
    resizingColumn,
    startResize,
    columnWidths,
    visibleColumns,
    getColumnWidth,
  };
}
