import { SkeletonBox } from "@/components/skeletons/Skeletons";

export default function EventDetailLoading() {
  return (
    <div className="container-page py-10">
      <SkeletonBox className="h-4 w-32" />
      <SkeletonBox className="mt-4 h-52 w-full rounded-2xl sm:h-72" />
      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SkeletonBox className="h-8 w-3/4" />
          <SkeletonBox className="h-4 w-full" />
          <SkeletonBox className="h-4 w-5/6" />
          <SkeletonBox className="h-4 w-2/3" />
          <SkeletonBox className="mt-6 h-32 w-full rounded-2xl" />
        </div>
        <div className="space-y-3">
          <SkeletonBox className="h-40 w-full rounded-2xl" />
          <SkeletonBox className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
