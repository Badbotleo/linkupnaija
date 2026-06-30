import { SkeletonBox } from "@/components/skeletons/Skeletons";

export default function AdminLoading() {
  return (
    <div className="container-page py-10">
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-8 w-64" />
        <SkeletonBox className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonBox className="mt-2 h-4 w-48" />

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
          >
            <SkeletonBox className="h-7 w-7 rounded-lg" />
            <SkeletonBox className="mt-3 h-7 w-24" />
            <SkeletonBox className="mt-2 h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Section placeholders */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mt-10">
          <SkeletonBox className="mb-3 h-6 w-40" />
          <div className="space-y-2">
            <SkeletonBox className="h-16 w-full rounded-xl" />
            <SkeletonBox className="h-16 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
