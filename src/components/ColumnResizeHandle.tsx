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
      role="slider"
      aria-orientation="vertical"
      aria-label="Resize column"
      aria-valuenow={0}
      tabIndex={0}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onStartResize(columnId, e.clientX);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
