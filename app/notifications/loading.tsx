import { SkeletonBox } from "@/components/skeletons/Skeletons";

export default function NotificationsLoading() {
  return (
    <div className="container-page max-w-2xl py-5">
      <SkeletonBox className="h-8 w-36" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBox key={i} className="h-[72px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
