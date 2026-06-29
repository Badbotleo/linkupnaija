import { SkeletonBox, EventGridSkeleton } from "@/components/skeletons/Skeletons";

export default function EventsLoading() {
  return (
    <div className="container-page py-10">
      <SkeletonBox className="h-8 w-56" />
      <SkeletonBox className="mt-2 h-4 w-72" />
      <SkeletonBox className="mt-8 h-11 w-full max-w-md" />
      <div className="mt-6">
        <EventGridSkeleton count={6} />
      </div>
    </div>
  );
}
