"use client";

import { useState } from "react";
import { OPPORTUNITIES, type OpportunityDef } from "@/lib/opportunities";
import OpportunityModal from "./OpportunityModal";
import LineIcon from "@/components/ui/LineIcon";

// Stroke icons instead of the oversized emoji — same language as the rest of
// the app chrome.
const ICONS: Record<string, string> = {
  car_hire: "car",
  photographer: "camera",
  venue: "building",
};

export default function OpportunityHubs() {
  const [active, setActive] = useState<OpportunityDef | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OPPORTUNITIES.map((def) => (
          <div
            key={def.type}
            className="flex flex-col rounded-2xl bg-white p-5 shadow-card transition hover:border-brand/30 hover:shadow-lg"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
                <LineIcon name={ICONS[def.type] ?? "briefcase"} size={21} />
              </span>
              <div className="min-w-0">
                <h3 className="font-extrabold leading-snug tracking-tight text-gray-900">
                  {def.headline}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  {def.description}
                </p>
              </div>
            </div>

            <ul className="mt-4 flex-1 space-y-1.5">
              {def.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
                  <LineIcon
                    name="check"
                    size={14}
                    className="mt-0.5 shrink-0 text-naija-600"
                  />
                  {b}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setActive(def)}
              className="btn-primary mt-5 w-full rounded-full"
            >
              {def.buttonLabel}
            </button>
          </div>
        ))}
      </div>

      {active && (
        <OpportunityModal def={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
