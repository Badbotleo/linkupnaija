import { SkeletonBox, ProfileSkeleton } from "@/components/skeletons/Skeletons";

export default function DashboardLoading() {
  return (
    <div className="container-page py-10">
      <SkeletonBox className="h-8 w-48" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="surface p-6 lg:col-span-1">
          <ProfileSkeleton />
        </div>
        <div className="space-y-8 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <SkeletonBox className="mb-3 h-5 w-40" />
              <div className="space-y-3">
                <SkeletonBox className="h-20 w-full rounded-2xl" />
                <SkeletonBox className="h-20 w-full rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
