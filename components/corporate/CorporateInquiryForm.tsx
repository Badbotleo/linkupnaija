"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NIGERIAN_STATES } from "@/lib/constants";
import { toast } from "@/lib/toast";

const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Oil & Gas",
  "Healthcare",
  "Education",
  "Retail & E-commerce",
  "Media & Entertainment",
  "Manufacturing",
  "Professional Services",
  "Other",
];
const SIZES = ["1-10", "11-50", "51-200", "200+"];
const EVENT_TYPES = [
  "Team outing",
  "Client entertainment",
  "Company picnic",
  "Training retreat",
  "Other",
];
const PLANS = [
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

export default function CorporateInquiryForm({
  defaultPlan,
}: {
  defaultPlan?: string;
}) {
  const supabase = createClient();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    industry: "",
    company_size: "",
    state: "",
    plan: defaultPlan ?? "",
    event_type: "",
    attendees: "",
    date_range: "",
    budget_range: "",
    requirements: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("corporate_accounts")
      .insert({
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        industry: form.industry || null,
        company_size: form.company_size || null,
        state: form.state || null,
        plan: form.plan || null,
        event_type: form.event_type || null,
        attendees: form.attendees ? Number(form.attendees) : null,
        date_range: form.date_range.trim() || null,
        budget_range: form.budget_range.trim() || null,
        requirements: form.requirements.trim() || null,
      })
      .select("id")
      .single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Best-effort confirmation + admin email (no-op if function isn't deployed).
    supabase.functions
      .invoke("send-corporate-inquiry", { body: { id: data.id } })
      .catch(() => {});

    setDone(true);
    setLoading(false);
    toast.success("Request received. We'll be in touch shortly!");
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-card">
        <p className="text-4xl">🎉</p>
        <h3 className="mt-3 text-xl font-bold text-gray-900">Thanks, we&apos;ve got it!</h3>
        <p className="mt-2 text-gray-600">
          Our team will reach out to {form.email} within one business day with a
          tailored proposal.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
      <h3 className="text-xl font-bold text-gray-900">Get a quote</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required>
          <input required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} className="input" />
        </Field>
        <Field label="Contact name">
          <input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className="input" />
        </Field>
        <Field label="Email" required>
          <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className="input" />
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" />
        </Field>
        <Field label="Industry">
          <select value={form.industry} onChange={(e) => set("industry", e.target.value)} className="input cursor-pointer">
            <option value="">Select…</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Company size">
          <select value={form.company_size} onChange={(e) => set("company_size", e.target.value)} className="input cursor-pointer">
            <option value="">Select…</option>
            {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
          </select>
        </Field>
        <Field label="Event type">
          <select value={form.event_type} onChange={(e) => set("event_type", e.target.value)} className="input cursor-pointer">
            <option value="">Select…</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Approx. attendees">
          <input type="number" min={1} value={form.attendees} onChange={(e) => set("attendees", e.target.value)} className="input" />
        </Field>
        <Field label="State">
          <select value={form.state} onChange={(e) => set("state", e.target.value)} className="input cursor-pointer">
            <option value="">Select…</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Plan of interest">
          <select value={form.plan} onChange={(e) => set("plan", e.target.value)} className="input cursor-pointer">
            <option value="">Not sure yet</option>
            {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Preferred date range">
          <input value={form.date_range} onChange={(e) => set("date_range", e.target.value)} placeholder="e.g. Late July" className="input" />
        </Field>
        <Field label="Budget range">
          <input value={form.budget_range} onChange={(e) => set("budget_range", e.target.value)} placeholder="e.g. ₦200k–₦500k" className="input" />
        </Field>
      </div>

      <Field label="Additional requirements">
        <textarea rows={4} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} placeholder="Tell us what you have in mind…" className="input resize-y" />
      </Field>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending…" : "Request a quote"}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
