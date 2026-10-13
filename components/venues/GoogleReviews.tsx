import LineIcon from "@/components/ui/LineIcon";
import { getPlaceReviews } from "@/lib/google-places";

/**
 * What people already said about this place, on Google.
 *
 * Borrowed, clearly labelled as borrowed, and replaced the moment we have
 * our own: a venue with three of our members' ratings should lead with those
 * and keep Google as the second opinion.
 *
 * ATTRIBUTION IS NOT DECORATION HERE. Google's policy requires the author's
 * name, their photo and a link through to them or the review, plus a way to
 * reach the place on Google. All of it is load-bearing for the terms, not
 * styling, so none of it is optional and none of it should be tidied away.
 *
 * Renders nothing at all without a key, without a stored place id, or when
 * Google is slow or out of quota. A venue page has to work on its own.
 */
export default async function GoogleReviews({
  placeId,
  venueName,
}: {
  placeId: string | null;
  venueName: string;
}) {
  if (!placeId) return null;
  const data = await getPlaceReviews(placeId);
  if (!data) return null;

  const shown = data.reviews.slice(0, 3);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            What people say
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            From Google, until {venueName} has ratings from our members
          </p>
        </div>
        {data.mapsUri && (
          <a
            href={data.mapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap text-sm font-bold text-brand hover:underline"
          >
            See on Google
            <LineIcon
              name="chevronRight"
              size={13}
              className="ml-0.5 inline align-[-1px]"
            />
          </a>
        )}
      </div>

      {data.rating !== null && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FAC775]/20 px-2.5 py-1 text-sm font-extrabold text-[#8A6500] dark:text-[#FAC775]">
            <LineIcon name="star" size={13} filled />
            {data.rating.toFixed(1)}
          </span>
          {data.total !== null && (
            <span className="text-[13px] text-gray-500">
              {data.total.toLocaleString("en-NG")} Google review
              {data.total === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-3 space-y-3">
          {shown.map((r) => (
            <li
              key={r.name}
              className="rounded-2xl bg-white p-4 shadow-[var(--e1)] dark:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2.5">
                {r.authorPhoto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.authorPhoto}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10">
                    <LineIcon name="users" size={15} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {/* The author's name links to them on Google where Google
                      gave us a link. Required, not a nicety. */}
                  <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">
                    {r.authorUri ? (
                      <a
                        href={r.authorUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {r.authorName ?? "A Google user"}
                      </a>
                    ) : (
                      (r.authorName ?? "A Google user")
                    )}
                  </p>
                  <p className="truncate text-[12px] text-gray-500">
                    {[
                      r.rating ? `${r.rating} out of 5` : null,
                      r.relativeTime,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-gray-700 dark:text-white/80">
                {r.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2.5 text-[11.5px] text-gray-400">
        Reviews and ratings by Google. LinkUpNaija does not edit them and
        cannot change them.
      </p>
    </section>
  );
}
