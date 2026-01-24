import { useStore, QueueItem } from '../store/useStore';
import { X, GripVertical, Trash2, Music } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableQueueItem({ item, index }: { item: QueueItem; index: number }) {
  const { removeFromQueue, playTrack } = useStore();
  const track = item.track;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.queueId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors ${
        isDragging ? 'bg-bg-card shadow-lg rounded-lg' : ''
      }`}
    >
      {/* Drag handle */}
      <div
        className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary flex-shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </div>

      {/* Index */}
      <span className="text-xs text-text-tertiary w-5 text-right flex-shrink-0">{index + 1}</span>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate text-text-primary">{track.title || 'Unknown Title'}</p>
        <p className="text-sm text-text-secondary truncate">{track.artist || 'Unknown Artist'}</p>
      </div>

      {/* Duration */}
      <div className="text-sm text-text-tertiary flex-shrink-0 w-16 text-right">
        {formatDuration(track.duration)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => playTrack(track.id)}
          className="btn-icon text-text-tertiary hover:text-primary-500"
          title="Play now"
        >
          <Music size={16} />
        </button>
        <button
          onClick={() => removeFromQueue(item.queueId)}
          className="btn-icon text-text-tertiary hover:text-red-400"
          title="Remove from queue"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function QueuePanel() {
  const { queue, currentTrack, isQueuePanelOpen, toggleQueuePanel, clearQueue, reorderQueue } =
    useStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = queue.findIndex((item) => item.queueId === active.id);
    const toIndex = queue.findIndex((item) => item.queueId === over.id);

    if (fromIndex !== -1 && toIndex !== -1) {
      reorderQueue(fromIndex, toIndex);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isQueuePanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={toggleQueuePanel}
      />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-elevated border-t border-bg-surface shadow-2xl max-h-[60vh] flex flex-col animate-slide-up-from-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-surface">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">Queue</h2>
            {queue.length > 0 && (
              <span className="text-sm text-text-tertiary">
                {queue.length} track{queue.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button onClick={clearQueue} className="btn-tertiary text-sm" title="Clear queue">
                Clear
              </button>
            )}
            <button onClick={toggleQueuePanel} className="btn-icon" title="Close queue">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto">
          {currentTrack && (
            <div className="px-4 py-3 border-b border-bg-surface bg-primary-600/10 border-l-4 border-l-primary-600">
              <div className="flex items-center gap-3">
                <div className="w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate text-primary-500">
                      {currentTrack.title || 'Unknown Title'}
                    </p>
                    <span className="text-xs text-primary-500 font-medium px-2 py-0.5 bg-primary-600/20 rounded-full whitespace-nowrap">
                      Now Playing
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary truncate">
                    {currentTrack.artist || 'Unknown Artist'}
                  </p>
                </div>
                <div className="text-sm text-text-tertiary flex-shrink-0 w-16 text-right">
                  {formatDuration(currentTrack.duration)}
                </div>
                <div className="w-20 flex-shrink-0" />
              </div>
            </div>
          )}

          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
              <Music size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Queue is empty</p>
              <p className="text-sm mt-2">Add tracks to see them here</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map((item) => item.queueId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-bg-surface">
                  {queue.map((item, index) => (
                    <SortableQueueItem key={item.queueId} item={item} index={index} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </>
  );
}
