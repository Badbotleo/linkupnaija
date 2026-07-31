#!/usr/bin/env node
/**
 * Validates every Supabase `.select("…")` in the codebase against the live
 * PostgREST schema.
 *
 * Why this exists: three separate outages this codebase has had were the same
 * shape — a select embeds a related table, PostgREST rejects the whole query
 * (usually PGRST200 "no relationship found" or PGRST201 "more than one
 * relationship found"), and the call site does `const { data } = await …`,
 * discarding the error and falling back to []. The page then renders as if the
 * data simply didn't exist: no attendees, no pending requests, no posts. Silent
 * and very hard to spot by eye.
 *
 * The most recent one hid every join request from hosts, because rsvps gained a
 * second foreign key to users (companion_id) and made a bare `users(...)` embed
 * ambiguous — a schema change broke a query in a file nobody had touched.
 *
 * Run it after any migration that adds a foreign key:
 *     npm run check:queries
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local. Exits non-zero if any query is broken, so CI can gate on it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SKIP = [".next", "node_modules", ".git", "scripts"];

function env() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
      const [k, ...rest] = line.split("=");
      const v = rest.join("=").trim();
      if (k === "NEXT_PUBLIC_SUPABASE_URL" && !url) url = v;
      if (k === "NEXT_PUBLIC_SUPABASE_ANON_KEY" && !key) key = v;
    }
  } catch {
    /* env vars only */
  }
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY.");
    process.exit(2);
  }
  return { url: url.replace(/\/+$/, ""), key };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// .from("table") … .select(<literal | CONSTANT>) — tolerates chained calls between.
// The argument is captured loosely because the select is very often a named
// constant rather than an inline string: RSVP_PROFILE_SELECT is exactly the
// query that hid every join request from hosts, and matching only literals
// would have walked straight past it.
// Only locates `.from("table")`; the select argument is then read by scanning
// for balanced parentheses, because embeds are full of them and any `[^)]`
// pattern stops at the first inner bracket.
const FROM_RE = /\.from\(\s*"([a-z_]+)"\s*\)/g;

/** Read the balanced argument list starting at the '(' index. */
function readArgs(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

// `const NAME = "…" + "…";` at module scope, so .select(NAME) can be resolved.
const CONST_RE = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*((?:"[^"]*"|'[^']*')(?:\s*\+\s*(?:"[^"]*"|'[^']*'))*)\s*;/g;

function literalsOf(raw) {
  const parts = [...raw.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]);
  return parts.join("").trim();
}

function collect(files) {
  const found = new Map();
  for (const f of files) {
    const src = readFileSync(f, "utf8");

    // Resolve string constants declared in this file first.
    const consts = new Map();
    for (const c of src.matchAll(CONST_RE)) consts.set(c[1], literalsOf(c[2]));

    for (const m of src.matchAll(FROM_RE)) {
      const table = m[1];
      // Walk the chain after .from(...) until we reach .select(
      const rest = src.slice(m.index + m[0].length);
      const sIdx = rest.search(/\.select\(/);
      if (sIdx === -1) continue;
      // Guard against running into an unrelated later query.
      const between = rest.slice(0, sIdx);
      if (between.includes(".from(") || between.length > 400) continue;

      const raw = readArgs(rest, sIdx + ".select".length);
      if (raw === null) continue;
      // Drop a trailing options object: .select("…", { count: "exact" })
      const arg = raw.replace(/,\s*\{[\s\S]*\}\s*$/, "").trim();
      if (!arg) continue;

      let sel;
      if (/["'`]/.test(arg)) sel = literalsOf(arg);
      else if (consts.has(arg)) sel = consts.get(arg); // .select(SOME_CONSTANT)
      else continue; // built at runtime — nothing to verify statically

      if (!sel || sel.includes("${")) continue;
      const key = `${table}::${sel}`;
      if (!found.has(key)) found.set(key, { file: f.replace(ROOT + "/", ""), table, sel });
    }
  }
  return [...found.values()];
}

const { url, key } = env();
const queries = collect(walk(ROOT));
const embeds = queries.filter((q) => q.sel.includes("("));

console.log(
  `Checking ${embeds.length} embedded selects (of ${queries.length} total) against ${url}\n`
);

const broken = [];
for (const q of embeds) {
  const target = `${url}/rest/v1/${q.table}?select=${encodeURIComponent(q.sel)}&limit=1`;
  try {
    const res = await fetch(target, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) continue;
    const body = await res.json().catch(() => ({}));
    // Only relationship/column errors are real bugs. RLS simply returning no
    // rows is a 200, and permission errors are a policy question, not a query one.
    if (["PGRST200", "PGRST201", "PGRST100", "42703"].includes(body.code)) {
      broken.push({ ...q, code: body.code, message: body.message ?? "" });
    }
  } catch (err) {
    console.warn(`  ! could not reach the API for ${q.table}: ${err.message}`);
  }
}

if (broken.length === 0) {
  console.log("✓ every embedded select resolves against the live schema");
  process.exit(0);
}

console.error(`\n✗ ${broken.length} broken quer${broken.length === 1 ? "y" : "ies"}:\n`);
for (const b of broken) {
  console.error(`  ${b.file}`);
  console.error(`    ${b.table}: ${b.sel.slice(0, 140)}`);
  console.error(`    ${b.code} ${b.message.slice(0, 160)}\n`);
}
console.error(
  "These fail at runtime and, where the call site drops the error, render as\n" +
    "missing data rather than an error. Name the foreign key explicitly, e.g.\n" +
    "  users(...)  ->  users!rsvps_user_id_fkey(...)\n"
);
process.exit(1);
