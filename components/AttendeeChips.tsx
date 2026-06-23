"use client";

import { useState } from "react";
import Avatar from "./Avatar";
import AttendeeProfileModal from "./AttendeeProfileModal";

interface Attendee {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

export default function AttendeeChips({
  attendees,
}: {
  attendees: Attendee[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <ul className="mt-4 flex flex-wrap gap-3">
        {attendees.map((a) => (
          <li key={a.user_id}>
            <button
              type="button"
              onClick={() => setOpenId(a.user_id)}
              className="flex items-center gap-2 rounded-full border border-gray-100 bg-white py-1.5 pl-1.5 pr-4 shadow-sm transition hover:border-brand/40"
            >
              <Avatar name={a.name} url={a.avatar_url} size="sm" />
              <span className="text-sm font-medium text-gray-700">
                {a.name ?? "Guest"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openId && (
        <AttendeeProfileModal userId={openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
