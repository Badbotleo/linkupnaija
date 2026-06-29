import { SkeletonBox, VenueCardSkeleton } from "@/components/skeletons/Skeletons";

export default function VenuesLoading() {
  return (
    <div className="container-page py-10">
      <SkeletonBox className="h-8 w-52" />
      <SkeletonBox className="mt-2 h-4 w-80" />
      <SkeletonBox className="mt-6 h-11 w-full" />
      <SkeletonBox className="mt-6 h-[360px] w-full rounded-2xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VenueCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
