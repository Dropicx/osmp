export default function LoadingSkeleton() {
  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="skeleton h-10 w-24 rounded-lg" />
        <div className="flex-1" />
        <div className="skeleton h-8 w-32 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="flex-1 bg-bg-card rounded-2xl border border-bg-surface shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-bg-surface">
          <div className="skeleton h-4 w-8" />
          <div className="skeleton h-4 w-8" />
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-16" />
        </div>

        {/* Rows */}
        {[180, 220, 160, 200, 240, 170, 210, 190, 230, 150, 200, 180].map((titleW, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-bg-surface/50">
            <div className="skeleton h-4 w-8" />
            <div className="skeleton h-4 w-8" />
            <div className="skeleton h-4 rounded" style={{ width: `${titleW}px` }} />
            <div className="skeleton h-4 rounded" style={{ width: `${100 + (i % 4) * 20}px` }} />
            <div className="skeleton h-4 rounded" style={{ width: `${90 + (i % 3) * 25}px` }} />
            <div className="skeleton h-4 w-20 rounded" />
            <div className="skeleton h-4 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
