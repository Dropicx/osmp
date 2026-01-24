import type { ContentColumnId } from '../types/columns';

interface ColumnResizeHandleProps {
  columnId: ContentColumnId;
  isResizing: boolean;
  onStartResize: (columnId: ContentColumnId, startX: number) => void;
}

export default function ColumnResizeHandle({
  columnId,
  isResizing,
  onStartResize,
}: ColumnResizeHandleProps) {
  return (
    <div
      className={`column-resize-handle ${isResizing ? 'active' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onStartResize(columnId, e.clientX);
      }}
    />
  );
}
