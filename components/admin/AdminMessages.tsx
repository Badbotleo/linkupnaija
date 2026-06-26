"use client";

import { useState } from "react";
import MessageThread from "@/components/MessageThread";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
}

export default function AdminMessages({
  adminId,
  users,
}: {
  adminId: string;
  users: UserRow[];
}) {
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = users.filter((u) =>
    `${u.name ?? ""} ${u.email}`.toLowerCase().includes(query.toLowerCase())
  );

  if (selected) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 text-sm font-medium text-gray-500 hover:text-brand"
        >
          ← All users
        </button>
        <MessageThread
          meId={adminId}
          otherId={selected.id}
          otherName={selected.name ?? selected.email}
        />
      </div>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users…"
        className="input mb-3"
      />
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
        <ul className="max-h-96 divide-y divide-gray-50 overflow-y-auto">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {u.name ?? "Unnamed"}
                </p>
                <p className="truncate text-xs text-gray-500">{u.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(u)}
                className="btn-outline shrink-0 py-1.5 text-sm"
              >
                Message
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
