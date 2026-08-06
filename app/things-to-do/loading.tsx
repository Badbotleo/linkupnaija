import { SkeletonBox } from "@/components/skeletons/Skeletons";

export default function ThingsToDoLoading() {
  return (
    <div className="container-page py-5">
      <SkeletonBox className="h-8 w-64" />
      <SkeletonBox className="mt-2 h-4 w-80" />
      {/* Same 248px card height and 3-up grid as the real page, so nothing
          jumps when the content arrives. */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonBox key={i} className="h-[248px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
