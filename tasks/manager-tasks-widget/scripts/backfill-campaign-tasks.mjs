#!/usr/bin/env node
/**
 * backfill-campaign-tasks.mjs — demo-data seeder for the Manager Tasks widget.
 *
 * Picks older recurring task instances that nobody is tracking any more, spreads
 * them across the branch's campaigns, and completes a share of each campaign's
 * batch so the widget's Analytics tab has something to show.
 *
 * This writes to a live tenant, so it is a dry run unless you pass --apply, and
 * every applied run leaves a manifest behind that --revert can replay backwards.
 *
 *   export SB_TOKEN='<basic-auth token>'
 *   node backfill-campaign-tasks.mjs                     # preview only
 *   node backfill-campaign-tasks.mjs --apply
 *   node backfill-campaign-tasks.mjs --revert=<manifest>
 *
 * Requires Node 18+ (global fetch). No dependencies.
 */

import { writeFileSync, readFileSync } from "node:fs";

// ── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_BASE = "https://7eleven-demo.staffbase.rocks/api";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  }),
);
const arg = (k, d) => (args.has(k) ? args.get(k) : d);
const num = (k, d) => { const v = Number(arg(k, d)); return Number.isFinite(v) ? v : d; };

const BASE   = String(arg("base", process.env.SB_BASE_URL || DEFAULT_BASE)).replace(/\/$/, "");
const TOKEN  = process.env.SB_TOKEN || "";
const LIMIT  = num("limit", 100);
const SEED   = num("seed", 20260824);
const APPLY  = args.get("apply") === true;
const REVERT = args.get("revert");
const CONC   = Math.max(1, num("concurrency", 4));
const ONLY   = String(arg("campaigns", "")).split(",").map((s) => s.trim()).filter(Boolean);

// How much of each campaign's batch gets completed. A dashboard where every bar
// sits at the same percentage reads as fake, so campaigns are dealt from this
// cycle to give the Analytics tab a believable spread of progress.
const COMPLETION_MIX = [0.9, 0.35, 0.7, 0.15, 0.55, 0.8, 0.25, 0.6];

// ── Helpers ──────────────────────────────────────────────────────────────────
const log   = (...a) => console.log(...a);
const bail  = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Deterministic PRNG so a given --seed always produces the same plan. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

const headers = () => ({ Authorization: `Basic ${TOKEN}`, "Content-Type": "application/json" });

/** fetch with retry/backoff on the transient statuses this API actually returns. */
async function api(path, opts = {}, tries = 4) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, { ...opts, headers: headers() });
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(400 * 2 ** i);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (i === tries - 1) throw new Error(`HTTP ${res.status} ${url}`);
      await sleep(400 * 2 ** i);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
}

/** Run jobs with a bounded number in flight; failures are isolated per job. */
async function pool(items, worker, size = CONC) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try { out[idx] = { ok: true, value: await worker(items[idx], idx) }; }
        catch (e) { out[idx] = { ok: false, error: e.message }; }
      }
    }),
  );
  return out;
}

const asList = (r) => (Array.isArray(r) ? r : r?.data || []);

// Mirrors withCampaignTag() in the widget — same tag format, same tolerance for
// descriptions that already carry [type:]/[recur:]/etc.
const CAMPAIGN_RE = /\[campaign:\s*([^\]]+)\]/i;
function withCampaignTag(desc, ref) {
  const base = desc || "";
  if (!ref) return base.replace(CAMPAIGN_RE, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (CAMPAIGN_RE.test(base)) return base.replace(CAMPAIGN_RE, `[campaign: ${ref}]`);
  return base.trim() ? `${base.replace(/\s+$/, "")}\n[campaign: ${ref}]` : `[campaign: ${ref}]`;
}

// ── Data loading ─────────────────────────────────────────────────────────────
async function loadInstallations() {
  const out = new Map();
  for (let offset = 0; offset <= 900; offset += 100) {
    const page = await api(`/branch/installations?limit=100&offset=${offset}`);
    const rows = asList(page);
    for (const i of rows) if (i.pluginId === "tasks") out.set(i.id, i.title || i.id);
    if (rows.length < 100) break;
  }
  return [...out].map(([id, title]) => ({ id, title }));
}

async function loadCampaigns() {
  const out = [];
  let cursor = "";
  for (let guard = 0; guard < 20; guard++) {
    const q = `/campaigns?limit=100&sort=title_ASC${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const page = await api(q);
    out.push(...asList(page));
    cursor = page?.cursor || "";
    if (!cursor) break;
  }
  return out.map((c) => ({ id: c.id, title: c.title || c.id }));
}

async function loadTasks(installs) {
  const all = [];
  for (const inst of installs) {
    let lists = [];
    try { lists = asList(await api(`/tasks/${inst.id}/lists`)); }
    catch { continue; }
    const pages = await pool(lists, (l) => api(`/tasks/${inst.id}/task?listId=${l.id}`));
    pages.forEach((p, idx) => {
      if (!p.ok) return;
      for (const t of asList(p.value)) {
        all.push({
          id: t.id,
          installationId: inst.id,
          store: inst.title,
          list: lists[idx]?.name || "",
          title: t.title || "",
          status: t.status || "OPEN",
          dueDate: t.dueDate || null,
          description: t.description || "",
        });
      }
    });
  }
  return all;
}

// ── Selection ────────────────────────────────────────────────────────────────
function selectCandidates(tasks) {
  const today = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((t) => {
      const d = t.description;
      // recur-template rows are hidden system records that drive the recurrence
      // series — tagging or closing one would corrupt future instances.
      if (/\[type:\s*recur-template\s*\]/i.test(d)) return false;
      if (!/\[recur:/i.test(d)) return false;          // recurring instances only
      if (CAMPAIGN_RE.test(d)) return false;           // never clobber a real assignment
      if (t.status !== "OPEN") return false;
      const due = (t.dueDate || "").slice(0, 10);
      return !!due && due < today;                     // "older" == already past due
    })
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || a.id.localeCompare(b.id))
    .slice(0, LIMIT);
}

/** Deal candidates round-robin across campaigns, then pick who gets completed. */
function buildPlan(candidates, campaigns) {
  const rand = rng(SEED);
  const buckets = campaigns.map((c) => ({ campaign: c, tasks: [] }));
  candidates.forEach((t, i) => buckets[i % buckets.length].tasks.push(t));

  const plan = [];
  buckets.forEach((b, bi) => {
    if (!b.tasks.length) return;
    const ratio = COMPLETION_MIX[bi % COMPLETION_MIX.length];
    // Shuffle first so "which ones are done" isn't just the oldest N.
    const shuffled = b.tasks.map((t) => ({ t, k: rand() })).sort((x, y) => x.k - y.k).map((x) => x.t);
    const nDone = Math.round(shuffled.length * ratio);
    shuffled.forEach((t, i) => plan.push({ task: t, campaign: b.campaign, complete: i < nDone }));
  });
  return plan;
}

// ── Writes ───────────────────────────────────────────────────────────────────
async function applyPlan(plan) {
  const manifest = { base: BASE, at: new Date().toISOString(), seed: SEED, entries: [] };
  let tagged = 0, completed = 0, failed = 0;

  const results = await pool(plan, async (p) => {
    const { task, campaign, complete } = p;
    const entry = {
      taskId: task.id, installationId: task.installationId, title: task.title,
      campaignId: campaign.id, prevDescription: task.description,
      prevStatus: task.status, completed: false,
    };
    const url = `/tasks/${task.installationId}/task/${task.id}`;
    await api(url, { method: "PATCH", body: JSON.stringify({ description: withCampaignTag(task.description, campaign.id) }) });
    if (complete) {
      await api(url, { method: "PATCH", body: JSON.stringify({ status: "CLOSED" }) });
      entry.completed = true;
    }
    return entry;
  });

  results.forEach((r, i) => {
    if (r.ok) {
      manifest.entries.push(r.value);
      tagged++;
      if (r.value.completed) completed++;
    } else {
      failed++;
      console.error(`  ! ${plan[i].task.title.slice(0, 48)} — ${r.error}`);
    }
  });

  const file = `backfill-manifest-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  return { tagged, completed, failed, file };
}

async function revert(file) {
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  log(`Reverting ${manifest.entries.length} task(s) from ${file}\n`);
  const results = await pool(manifest.entries, async (e) => {
    const url = `/tasks/${e.installationId}/task/${e.taskId}`;
    await api(url, { method: "PATCH", body: JSON.stringify({ description: e.prevDescription }) });
    if (e.completed) await api(url, { method: "PATCH", body: JSON.stringify({ status: e.prevStatus }) });
  });
  const bad = results.filter((r) => !r.ok);
  bad.forEach((r) => console.error(`  ! ${r.error}`));
  log(`\n✓ Reverted ${results.length - bad.length}/${results.length}${bad.length ? ` (${bad.length} failed)` : ""}\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!TOKEN) bail("SB_TOKEN is not set. export SB_TOKEN='<basic-auth token>'");
  log(`\nBase: ${BASE}`);

  if (REVERT) return revert(String(REVERT));

  log("Loading installations, campaigns and tasks…");
  const [installs, campaignsAll] = await Promise.all([loadInstallations(), loadCampaigns()]);
  const campaigns = ONLY.length ? campaignsAll.filter((c) => ONLY.includes(c.id)) : campaignsAll;
  if (!campaigns.length) bail("No campaigns available to assign to.");

  const tasks = await loadTasks(installs);
  log(`  ${installs.length} task installations · ${campaigns.length} campaigns · ${tasks.length} tasks`);

  const candidates = selectCandidates(tasks);
  if (!candidates.length) bail("No eligible tasks (recurring, open, past due, untagged).");
  log(`  ${candidates.length} eligible task(s) selected (limit ${LIMIT})\n`);

  const plan = buildPlan(candidates, campaigns);

  log("Plan — tasks per campaign:");
  const byCampaign = new Map();
  for (const p of plan) {
    const e = byCampaign.get(p.campaign.id) || { title: p.campaign.title, total: 0, done: 0 };
    e.total++; if (p.complete) e.done++;
    byCampaign.set(p.campaign.id, e);
  }
  for (const e of byCampaign.values()) {
    const pct = e.total ? Math.round((e.done / e.total) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 5)).padEnd(20, "░");
    log(`  ${e.title.padEnd(24).slice(0, 24)} ${bar} ${String(pct).padStart(3)}%  ${e.done}/${e.total} done`);
  }
  const totalDone = plan.filter((p) => p.complete).length;
  log(`\n  ${plan.length} task(s) to tag · ${totalDone} to complete`);

  if (!APPLY) {
    log("\nDry run — nothing was changed. Re-run with --apply to write.\n");
    return;
  }

  log("\nApplying…");
  const { tagged, completed, failed, file } = await applyPlan(plan);
  log(`\n✓ Tagged ${tagged} · completed ${completed}${failed ? ` · ${failed} failed` : ""}`);
  log(`  Manifest: ${file}`);
  log(`  Undo with: node backfill-campaign-tasks.mjs --revert=${file}\n`);
})().catch((e) => bail(e.message));
