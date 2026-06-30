import type { SupabaseClient } from "@supabase/supabase-js";
import type { FriendUser } from "./types";

type Row = {
  requester_id: string;
  receiver_id: string;
  requester: FriendUser | null;
  receiver: FriendUser | null;
};

const SELECT =
  "requester_id, receiver_id, " +
  "requester:users!connections_requester_id_fkey(id, name, avatar_url, state), " +
  "receiver:users!connections_receiver_id_fkey(id, name, avatar_url, state)";

/** All accepted friends of `userId`, resolved to the "other" person. */
export async function fetchFriends(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendUser[]> {
  const { data } = await supabase
    .from("connections")
    .select(SELECT)
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

  const rows = (data ?? []) as unknown as Row[];
  return rows
    .map((r) => (r.requester_id === userId ? r.receiver : r.requester))
    .filter((u): u is FriendUser => !!u);
}
