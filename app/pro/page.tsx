import { redirect } from "next/navigation";

/**
 * Pro was renamed Premium on 2 Sep 2026.
 *
 * This route stays because the old name is already out in the world: the
 * desktop rail, the offers rail, pricing links in emails already sent, and
 * anything anybody has shared. A rename that 404s the old URL is not a
 * rename, it is a deletion with extra steps.
 */
export default function ProRedirect() {
  redirect("/premium");
}
