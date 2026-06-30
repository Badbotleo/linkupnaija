"use client";

import { useState, type ReactNode } from "react";

export default function EventTabs({
  details,
  chat,
  gallery,
}: {
  details: ReactNode;
  chat: ReactNode;
  gallery?: ReactNode;
}) {
  const [tab, setTab] = useState<"details" | "chat" | "gallery">("details");

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        <TabButton
          active={tab === "details"}
          onClick={() => setTab("details")}
        >
          Details
        </TabButton>
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
          💬 Chat
        </TabButton>
        {gallery && (
          <TabButton
            active={tab === "gallery"}
            onClick={() => setTab("gallery")}
          >
            📸 Gallery
          </TabButton>
        )}
      </div>

      {/* Both panels stay mounted so the chat realtime subscription persists. */}
      <div className={tab === "details" ? "" : "hidden"}>{details}</div>
      <div className={tab === "chat" ? "" : "hidden"}>{chat}</div>
      {gallery && (
        <div className={tab === "gallery" ? "" : "hidden"}>{gallery}</div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-brand shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
