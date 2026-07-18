"use client";

import { INTEREST_GROUPS, MIN_INTERESTS } from "@/lib/constants";

// Substack/Tinder-style interest chips, grouped and multi-select.
// Controlled: parent owns the `selected` array.
export default function InterestPicker({
  selected,
  onChange,
  min = MIN_INTERESTS,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  min?: number;
}) {
  const set = new Set(selected);

  function toggle(label: string) {
    const next = new Set(set);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(Array.from(next));
  }

  const remaining = Math.max(0, min - selected.length);

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-1 mb-3 flex items-center justify-between rounded-xl bg-brand-50/80 px-3 py-2 backdrop-blur">
        <p className="text-sm font-semibold text-brand">
          {selected.length} selected
        </p>
        <p className="text-xs text-gray-500">
          {remaining > 0
            ? `Pick ${remaining} more to continue`
            : "Nice! Pick as many as you like 🎉"}
        </p>
      </div>

      <div className="space-y-5">
        {INTEREST_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-sm font-bold text-gray-900">{group.title}</p>
            <div className="flex flex-wrap gap-2">
              {group.interests.map((i) => {
                const active = set.has(i.label);
                return (
                  <button
                    key={i.label}
                    type="button"
                    onClick={() => toggle(i.label)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-brand bg-brand text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-brand/40 hover:bg-brand-50"
                    }`}
                  >
                    <span aria-hidden>{i.emoji}</span>
                    {i.label}
                    {active && <span aria-hidden className="ml-0.5">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
