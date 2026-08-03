"use client";

import { useState } from "react";
import Avatar from "./Avatar";
import AttendeeProfileModal from "./AttendeeProfileModal";

interface Attendee {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  gender?: string | null;
  isHost?: boolean;
}

/** M / F / ? — the badge that sits on the corner of each avatar. */
function genderMark(gender?: string | null) {
  const g = (gender ?? "").toLowerCase();
  if (g === "male") return { letter: "M", cls: "bg-blue-500" };
  if (g === "female") return { letter: "F", cls: "bg-pink-500" };
  // Deliberately shown rather than hidden: "we don't know" is useful
  // information when you're deciding whether a room is balanced.
  return { letter: "?", cls: "bg-gray-400" };
}

export default function AttendeeChips({
  attendees,
  friendIds = [],
}: {
  attendees: Attendee[];
  /** User IDs the viewer is friends with — shown with a ring and a marker. */
  friendIds?: string[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const friendSet = new Set(friendIds);

  const men = attendees.filter((a) => (a.gender ?? "").toLowerCase() === "male").length;
  const women = attendees.filter((a) => (a.gender ?? "").toLowerCase() === "female").length;
  const unknown = attendees.length - men - women;

  return (
    <>
      {/* Split of the room, so you know what you're walking into. */}
      {attendees.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[13px] font-bold text-blue-700">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-500 text-[10px] font-black text-white">
              M
            </span>
            {men} {men === 1 ? "guy" : "guys"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-[13px] font-bold text-pink-700">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-pink-500 text-[10px] font-black text-white">
              F
            </span>
            {women} {women === 1 ? "lady" : "ladies"}
          </span>
          {unknown > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[13px] font-bold text-gray-600">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gray-400 text-[10px] font-black text-white">
                ?
              </span>
              {unknown} not saying
            </span>
          )}
        </div>
      )}

      {/* A grid of faces reads as a room; a row of name pills reads as a list. */}
      <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
        {attendees.map((a) => {
          const isFriend = friendSet.has(a.user_id);
          const mark = genderMark(a.gender);
          return (
            <li key={a.user_id}>
              <button
                type="button"
                onClick={() => setOpenId(a.user_id)}
                className="group flex w-full flex-col items-center gap-1.5 text-center"
              >
                <span className="relative inline-block">
                  <span
                    className={`block overflow-hidden rounded-full transition group-hover:scale-105 group-active:scale-95 ${
                      isFriend ? "ring-2 ring-brand ring-offset-2" : ""
                    }`}
                  >
                    <Avatar
                      name={a.name}
                      url={a.avatar_url}
                      seed={a.user_id}
                      size="lg2"
                    />
                  </span>

                  <span
                    aria-label={
                      mark.letter === "M"
                        ? "Male"
                        : mark.letter === "F"
                          ? "Female"
                          : "Gender not shared"
                    }
                    className={`absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-white ring-2 ring-white ${mark.cls}`}
                  >
                    {mark.letter}
                  </span>

                  {a.isHost && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-naija px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ring-2 ring-white">
                      Host
                    </span>
                  )}
                </span>

                <span className="mt-0.5 line-clamp-1 w-full text-[12px] font-semibold text-gray-700">
                  {a.name ?? "Guest"}
                </span>
                {isFriend && (
                  <span className="-mt-1 text-[10px] font-bold text-brand">
                    Your paddy
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {openId && (
        <AttendeeProfileModal userId={openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
