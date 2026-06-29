// Shimmer skeleton building blocks (the .skeleton class lives in globals.css).

export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
      <SkeletonBox className="h-40 w-full rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <SkeletonBox className="h-5 w-3/4" />
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-5/6" />
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-3">
          <SkeletonBox className="h-4 w-20" />
          <SkeletonBox className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

export function EventGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function VenueCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-6 w-6 rounded-full" />
        <SkeletonBox className="h-5 w-24 rounded-full" />
      </div>
      <SkeletonBox className="mt-3 h-5 w-3/4" />
      <SkeletonBox className="mt-2 h-4 w-full" />
      <SkeletonBox className="mt-3 h-9 w-full" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <SkeletonBox className="h-20 w-20 rounded-full" />
      <SkeletonBox className="h-5 w-40" />
      <SkeletonBox className="h-4 w-24" />
      <SkeletonBox className="h-4 w-56" />
    </div>
  );
}
