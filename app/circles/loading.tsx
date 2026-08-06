import { SkeletonBox } from "@/components/skeletons/Skeletons";

export default function CirclesLoading() {
  return (
    <div className="container-page py-5">
      <SkeletonBox className="h-8 w-40" />
      <SkeletonBox className="mt-2 h-4 w-72" />
      <SkeletonBox className="mt-5 h-11 w-full rounded-full" />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} className="h-[180px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
