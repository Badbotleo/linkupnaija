import { redirect } from "next/navigation";

/**
 * The feed was built here to be compared against the old home page. It won,
 * so it is the home page now and this is just an old address: anything that
 * linked to /feed while the experiment ran still lands somewhere correct.
 */
export default function FeedPage() {
  redirect("/");
}
