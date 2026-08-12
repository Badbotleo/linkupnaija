"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { formatNaira } from "@/lib/paystack";
import { isRealText } from "@/lib/content-guards";
import LineIcon from "../ui/LineIcon";

/**
 * Lets a host list several ticket types on one event.
 *
 * One `price` field could only ever show one thing, so hosts running combo
 * packs and table sizes were putting the rest in the description — where
 * nothing could read them, sort them, or show them on a card. This gives that
 * list somewhere real to live.
 *
 * Shown on the host's own event page. RLS restricts writes to the event's
 * host, so this component being reachable is not what protects it.
 */

interface Tier {
  id: string;
  name: string;
  price: number;
  description: string | null;
  admits: number | null;
  sort_order: number;
}

const field =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";

export default function TicketTiersEditor({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    price: "",
    description: "",
    admits: "",
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("ticket_tiers")
      .select("id, name, price, description, admits, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("price", { ascending: true });
    if (error) {
      // Named plainly — "no tiers yet" and "the table doesn't exist" look
      // identical from an empty list.
      if (/ticket_tiers/.test(error.message)) setMissing(true);
      return;
    }
    setMissing(false);
    setTiers((data ?? []) as Tier[]);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (saving) return;
    if (!isRealText(draft.name)) {
      toast.error("Give the ticket a name, e.g. Combo Lite or Gold Table.");
      return;
    }
    const price = Math.round(Number(draft.price));
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Set a price above zero.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ticket_tiers").insert({
      event_id: eventId,
      name: draft.name.trim(),
      price,
      description: isRealText(draft.description) ? draft.description.trim() : null,
      // Blank means "not a table" rather than zero people.
      admits: draft.admits ? Math.max(1, Math.round(Number(draft.admits))) : null,
      // Cheapest first by default; the list sorts by price within this.
      sort_order: tiers.length,
    });
    setSaving(false);
    if (error) {
      toast.error(
        /ticket_tiers/.test(error.message)
          ? "Run supabase/migration-ticket-tiers.sql first."
          : error.message
      );
      return;
    }
    setDraft({ name: "", price: "", description: "", admits: "" });
    toast.success("Ticket added");
    load();
  }

  async function remove(t: Tier) {
    if (!confirm(`Remove "${t.name}"?`)) return;
    const { error } = await supabase.from("ticket_tiers").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  if (missing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Run <code className="font-bold">supabase/migration-ticket-tiers.sql</code>{" "}
        to offer more than one ticket type.
      </div>
    );
  }

  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">Ticket types</p>
          <p className="text-xs text-gray-500">
            {tiers.length > 0
              ? `${tiers.length} on sale`
              : "Add combo packs, tables, early bird — anything with its own price."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700"
        >
          {open ? "Done" : "Manage"}
        </button>
      </div>

      {tiers.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {tiers.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">
                  {t.name}
                  {!!t.admits && (
                    <span className="ml-1.5 font-medium text-gray-400">
                      · {t.admits} {t.admits === 1 ? "person" : "people"}
                    </span>
                  )}
                </p>
                {t.description && (
                  <p className="truncate text-xs text-gray-500">{t.description}</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-extrabold tabular-nums text-gray-900">
                {formatNaira(t.price)}
              </span>
              {open && (
                <button
                  type="button"
                  onClick={() => remove(t)}
                  aria-label={`Remove ${t.name}`}
                  className="shrink-0 text-gray-300 hover:text-red-500"
                >
                  <LineIcon name="trash" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 rounded-2xl bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Name, e.g. Gold Table"
              maxLength={60}
              className={field}
            />
            <input
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              inputMode="numeric"
              placeholder="Price in naira, e.g. 280000"
              className={field}
            />
            <input
              value={draft.admits}
              onChange={(e) => setDraft({ ...draft, admits: e.target.value })}
              inputMode="numeric"
              placeholder="Admits how many? (blank if not a table)"
              className={field}
            />
            <input
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="What's included"
              className={field}
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={saving}
            className="btn-primary w-full rounded-full py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add ticket type"}
          </button>
        </div>
      )}
    </div>
  );
}
