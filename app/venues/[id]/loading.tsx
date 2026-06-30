import { SkeletonBox } from "@/components/skeletons/Skeletons";

export default function VenueDetailLoading() {
  return (
    <div className="container-page py-10">
      <SkeletonBox className="h-4 w-28" />
      <SkeletonBox className="mt-4 h-8 w-2/3" />
      <SkeletonBox className="mt-2 h-4 w-1/2" />
      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SkeletonBox className="h-72 w-full rounded-2xl" />
        </div>
        <div className="space-y-3">
          <SkeletonBox className="h-48 w-full rounded-2xl" />
          <SkeletonBox className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
