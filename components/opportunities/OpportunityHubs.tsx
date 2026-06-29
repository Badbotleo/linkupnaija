"use client";

import { useState } from "react";
import { OPPORTUNITIES, type OpportunityDef } from "@/lib/opportunities";
import OpportunityModal from "./OpportunityModal";

export default function OpportunityHubs() {
  const [active, setActive] = useState<OpportunityDef | null>(null);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        {OPPORTUNITIES.map((def) => (
          <div
            key={def.type}
            className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <span className="text-4xl">{def.emoji}</span>
            <h3 className="mt-3 text-lg font-extrabold text-gray-900">
              {def.headline}
            </h3>
            <p className="mt-2 text-sm text-gray-600">{def.description}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {def.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-brand" aria-hidden>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setActive(def)}
              className="btn-primary mt-5 w-full"
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
