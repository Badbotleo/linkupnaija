"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import type { OpportunityDef } from "@/lib/opportunities";

const inputCls = "input";

export default function OpportunityModal({
  def,
  onClose,
}: {
  def: OpportunityDef;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [base, setBase] = useState({
    business_name: "",
    contact_name: "",
    phone: "",
    email: "",
    state: "",
  });
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function setDetail(key: string, value: unknown) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  function toggleCheckbox(key: string, option: string) {
    setDetails((d) => {
      const arr = Array.isArray(d[key]) ? [...(d[key] as string[])] : [];
      const i = arr.indexOf(option);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(option);
      return { ...d, [key]: arr };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("opportunities").insert({
      type: def.type,
      business_name: base.business_name.trim(),
      contact_name: base.contact_name.trim() || null,
      phone: base.phone.trim() || null,
      email: base.email.trim() || null,
      state: base.state || null,
      details,
    });
    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success("Application submitted! We'll review and be in touch.");
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            {def.emoji} {def.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-3 font-semibold text-gray-900">
              Application submitted!
            </p>
            <p className="mt-1 text-sm text-gray-500">
              LinkUpNaija will review it and get in touch.
            </p>
            <button onClick={onClose} className="btn-primary mt-6">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="label">{def.businessLabel}</label>
              <input
                required
                value={base.business_name}
                onChange={(e) =>
                  setBase((b) => ({ ...b, business_name: e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Contact name</label>
                <input
                  value={base.contact_name}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, contact_name: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  required
                  value={base.phone}
                  onChange={(e) =>
                    setBase((b) => ({ ...b, phone: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input
                required
                type="email"
                value={base.email}
                onChange={(e) =>
                  setBase((b) => ({ ...b, email: e.target.value }))
                }
                className={inputCls}
              />
            </div>

            {def.extra.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.kind === "select" ? (
                  <select
                    required={f.required}
                    value={(details[f.key] as string) ?? ""}
                    onChange={(e) => setDetail(f.key, e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="">Select…</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.kind === "checkboxes" ? (
                  <div className="flex flex-wrap gap-3">
                    {f.options?.map((o) => {
                      const arr = (details[f.key] as string[]) ?? [];
                      return (
                        <label
                          key={o}
                          className="inline-flex items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={arr.includes(o)}
                            onChange={() => toggleCheckbox(f.key, o)}
                            className="h-4 w-4 accent-brand"
                          />
                          {o}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type={f.kind === "number" ? "number" : "text"}
                    min={f.kind === "number" ? 0 : undefined}
                    value={(details[f.key] as string) ?? ""}
                    onChange={(e) =>
                      setDetail(
                        f.key,
                        f.kind === "number"
                          ? e.target.value
                          : e.target.value
                      )
                    }
                    className={inputCls}
                  />
                )}
              </div>
            ))}

            <div>
              <label className="label">State</label>
              <select
                required
                value={base.state}
                onChange={(e) =>
                  setBase((b) => ({ ...b, state: e.target.value }))
                }
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
