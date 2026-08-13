// Group Switcher: moves a viewer between a configured set of groups, then reloads
// the app at its root so it re-boots against the new membership.
//
// Switching runs entirely as the viewer's own session. The optional API token is
// only used to read brand colors from the theming API.

import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

import { fetchThemeColors } from "../tasks/shared/theming";
import { ICONS, resolveIcon } from "./icons";
import { styles } from "./styles";

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_ACCENT = "#1f6feb";

// A card frame is ~450px wide, so this is roughly what a 2x display needs to
// render it sharply. Anything smaller is a logo, not artwork.
const MIN_CARD_WIDTH = 800;
const MIN_CARD_HEIGHT = 500;
// Letterbox strips and tall banners both crop badly into a 4:3 frame.
const MIN_CARD_RATIO = 0.9;
const MAX_CARD_RATIO = 2.4;
const IMAGE_PROBE_TIMEOUT = 3000;

const PLACEHOLDER = `[
  {
    "id": "000000000000000000000000",
    "name": "I am the name of the group",
    "description": "I am the description of the group",
    "icon": "users"
  },
  {
    "id": "111111111111111111111111",
    "description": "Only \\"id\\" is required. Name and description are read from the group.",
    "icon": "https://example.com/photo.jpg"
  }
]`;

// ── Config schema ────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    groups: { type: "string", title: "Groups (JSON)", default: PLACEHOLDER },
    showfulllogos: { type: "boolean", title: "Show Full Logos", default: false },
    usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
  },
  // The token is only ever read for theming, so it appears only with theming on;
  // the manual picker takes its place when theming is off.
  dependencies: {
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT },
          },
        },
        {
          properties: {
            usethemecolors: { const: true },
            apitoken: { type: "string", title: "API Token", default: "" },
            baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
          },
          required: ["apitoken"],
        },
      ],
    },
  },
};

const uiSchema: UiSchema = {
  "ui:order": ["groups", "showfulllogos", "usethemecolors", "accentcolor", "apitoken", "baseurl"],
  groups: {
    "ui:widget": "textarea",
    "ui:options": { rows: 14 },
    "ui:placeholder": PLACEHOLDER,
    "ui:help":
      'A JSON array of the groups a viewer can move between. Each entry needs "id", the group ID. ' +
      'The name and description are read from the group itself; add "name" or "description" only ' +
      'to override them. ' +
      '"icon" takes either a picture or an icon name. Anything starting with http:// https:// or ' +
      "data:image/ is treated as a picture. When every entry has a large picture (at least 800x500, " +
      "roughly landscape) the list becomes image cards on wide screens; smaller logos, mixed lists " +
      "and icons stay as rows. Pictures are cropped to fill, so keep the subject centered. " +
      "Icon names: " +
      resolveIcon.names.join(", ") +
      ".",
  },
  showfulllogos: {
    "ui:help":
      "Show each picture whole instead of cropping it to fill, on a transparent background. " +
      "Built for wide logos, which lose their edges when cropped. Cards are used at every " +
      "screen size, two to a row, with the picture stacked above the name. " +
      "Requires a picture on every entry.",
  },
  usethemecolors: {
    "ui:help":
      "Read the accent from the app's branding theme instead of setting it here. Needs an API token.",
  },
  accentcolor: {
    "ui:widget": "color",
    "ui:help": "Marks the group the viewer is currently in, and draws the focus ring.",
  },
  apitoken: {
    "ui:widget": "password",
    "ui:help":
      "Staffbase Basic auth token, used only to read the theme colors. " +
      "Groups are read and switched using the viewer's own session, never this token.",
  },
  baseurl: { "ui:help": "Staffbase API base URL, used for the theme lookup." },
};

// ── Types ────────────────────────────────────────────────────────────────────

type GroupConfig = { id: string; name?: string; description?: string; icon?: string };
type ParseResult = { ok: true; groups: GroupConfig[] } | { ok: false; message: string };
type Viewer = { id: string; groupIDs: string[] };
type GroupDetails = { name: string; description: string; imageUrl: string };

const BLANK_GROUP: GroupDetails = { name: "", description: "", imageUrl: "" };

// ── Utilities ────────────────────────────────────────────────────────────────

function esc(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hexToRgb(hex: string): string {
  const h = (hex.replace("#", "") + "000000").slice(0, 6);
  return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${
    parseInt(h.slice(4, 6), 16) || 0
  }`;
}

/** Readable text color for a filled swatch of `hex`. */
function contrastColor(hex: string): string {
  const h = (hex.replace("#", "") + "000000").slice(0, 6);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L =
    0.2126 * lin(parseInt(h.slice(0, 2), 16) / 255) +
    0.7152 * lin(parseInt(h.slice(2, 4), 16) / 255) +
    0.0722 * lin(parseInt(h.slice(4, 6), 16) / 255);
  return L > 0.45 ? "#141821" : "#ffffff";
}

/** Skips malformed entries, but reports unparseable JSON rather than hiding it. */
function parseGroups(raw: string): ParseResult {
  const text = (raw || "").trim();
  if (!text) return { ok: true, groups: [] };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, message: (e as Error).message || "The JSON couldn't be read." };
  }
  if (!Array.isArray(data)) {
    return { ok: false, message: "Expected a JSON array of group objects." };
  }

  const seen = new Set<string>();
  const groups: GroupConfig[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = String(row.id ?? row.groupId ?? row.groupID ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    groups.push({
      id,
      name: str(row.name),
      description: str(row.description),
      icon: str(row.icon),
    });
  }
  return { ok: true, groups };
}

// ── Host ─────────────────────────────────────────────────────────────────────
// Every call below must target the real app origin rather than a root-relative
// path. In the native apps the widget runs under capacitor:// (or file://,
// ionic://), where "/api/..." resolves against the local app shell and hands
// back index.html instead of ever reaching Staffbase. Same lesson as the task
// widget's comment endpoint.

/** The app's own origin, preferred from the SDK and cached once resolved. */
let appOrigin = "";

function originOf(url: string): string {
  try {
    return new URL(String(url)).origin;
  } catch (_) {
    return "";
  }
}

/** Web origins are trustworthy; capacitor/file/ionic shells are not. */
function webOrigin(): string {
  const p = window.location.protocol;
  return p === "http:" || p === "https:" ? window.location.origin : "";
}

function resolveOrigin(widgetApi: any, baseUrlAttr: string): string {
  if (appOrigin) return appOrigin;

  // getBranchInformation().webUrl is the app's real address in every context.
  try {
    const fromSdk = originOf(widgetApi?.getBranchInformation?.()?.webUrl || "");
    if (fromSdk) return (appOrigin = fromSdk);
  } catch (_) { /* the SDK isn't always ready */ }

  // On the web the current origin is definitive, and beats a `baseurl` left at
  // its default value pointing somewhere else entirely.
  const here = webOrigin();
  if (here) return (appOrigin = here);

  const configured = originOf(baseUrlAttr);
  if (configured) return (appOrigin = configured);

  return (appOrigin = originOf(DEFAULT_BASE_URL));
}

/** Absolute URL for a root-relative API path. */
function api(path: string): string {
  return `${appOrigin || webOrigin()}${path}`;
}

// ── Session ──────────────────────────────────────────────────────────────────

const DISCOVER_ACCEPT = "application/vnd.staffbase.auth.discovery.v2+json";
const USER_ACCEPT = "application/vnd.staffbase.accessors.user.v2+json";

let discoverPromise: Promise<any> | null = null;

/** `/auth/discover` returns both the viewer and a CSRF token. Cached per page. */
function fetchDiscover(): Promise<any> {
  if (!discoverPromise) {
    discoverPromise = fetch(api("/auth/discover"), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { accept: DISCOVER_ACCEPT },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return discoverPromise;
}

/** Same lookup order as the task widgets, with discovery as a last resort. */
function readCsrf(): string {
  const w = window as any;
  try {
    const t = w.we?.authMgr?.csrfToken;
    if (t) return String(t);
  } catch (_) { /* the auth manager isn't always reachable */ }
  if (w.csrfToken) return String(w.csrfToken);
  const cookie = document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
  if (cookie) return decodeURIComponent(cookie[1]);
  const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
  return meta?.content || "";
}

/** Best effort; a missing token is survivable since the cookie is sent too. */
async function csrfToken(): Promise<string> {
  const local = readCsrf();
  if (local) return local;
  const discovery = await fetchDiscover();
  return discovery?.csrfToken ? String(discovery.csrfToken) : "";
}

async function fetchViewer(widgetApi: any): Promise<Viewer> {
  try {
    const profile: any = await widgetApi.getUserInformation();
    if (profile?.id) return { id: String(profile.id), groupIDs: profile.groupIDs || [] };
  } catch (_) { /* fall through to the session endpoints */ }

  const discovery = await fetchDiscover();
  if (discovery?.user?.id) {
    return { id: String(discovery.user.id), groupIDs: discovery.user.groupIDs || [] };
  }

  const response = await fetch(api("/api/users/me"), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { accept: USER_ACCEPT },
  });
  if (!response.ok) throw new Error("Could not read the current user.");
  const user = await response.json();
  if (!user?.id) throw new Error("Could not read the current user.");
  return { id: String(user.id), groupIDs: user.groupIDs || [] };
}

/** Staffbase text fields are sometimes localized maps rather than plain strings. */
/** A plain string, or the best entry from a locale-keyed map. */
function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const map = value as Record<string, unknown>;
  const wanted = (navigator.language || "en").toLowerCase().replace("-", "_");
  const base = wanted.split("_")[0];
  const has = (k: string) => typeof map[k] === "string" && String(map[k]).trim();

  // Exact locale, then same language, then English, then anything non-empty.
  const key =
    Object.keys(map).find((k) => k.toLowerCase() === wanted && has(k)) ||
    Object.keys(map).find((k) => k.toLowerCase().split("_")[0] === base && has(k)) ||
    Object.keys(map).find((k) => k.toLowerCase().startsWith("en") && has(k)) ||
    Object.keys(map).find((k) => has(k));

  return key ? String(map[key]).trim() : "";
}

/**
 * Name, description and artwork for a group; blank fields when unreadable.
 *
 * Reads the shared directory first, because that single search request is
 * session-authenticated and covers every group at once. The per-group endpoint
 * is only a fallback for groups the search doesn't return.
 */
async function fetchGroup(id: string): Promise<GroupDetails> {
  try {
    const listed = (await fetchDirectory()).get(id);
    if (listed) return listed;

    const group = await readGroup(id);
    return group ? detailsOf(group) : BLANK_GROUP;
  } catch (_) {
    return BLANK_GROUP;
  }
}

/** Pull the display fields out of a group record. */
function detailsOf(group: any): GroupDetails {
  const picked = pickLocale(group?.config?.localization);
  return {
    name: text(picked?.name) || text(group?.name) || text(group?.title),
    description: text(picked?.description) || text(group?.description),
    imageUrl: text(group?.config?.imageUrl) || text(group?.config?.customIconUrl),
  };
}

const SEARCH_ACCEPT = "application/vnd.staffbase.accessors.groups-search.v1+json";

let directoryPromise: Promise<Map<string, GroupDetails>> | null = null;

/**
 * Every group the viewer can see, keyed by ID. One request for the whole list,
 * fetched once per page and shared by all the lookups.
 */
function fetchDirectory(): Promise<Map<string, GroupDetails>> {
  if (directoryPromise) return directoryPromise;

  directoryPromise = (async () => {
    const found = new Map<string, GroupDetails>();
    // Unfiltered first; the type filter is a fallback for stricter deployments.
    const queries = [
      "query=&sort=name_ASC&limit=400&permission=access",
      "query=&sort=name_ASC&limit=400&type=open&permission=access",
    ];

    for (const query of queries) {
      try {
        const response = await fetch(api(`/api/groups/search?${query}`), {
          method: "GET",
          credentials: "include",
          headers: { accept: SEARCH_ACCEPT },
        });
        if (!response.ok) continue;

        const body = await response.json();
        // Entries are wrapped in `data`, though plain records are accepted too.
        for (const entry of body?.entries || []) {
          const group = entry?.data || entry;
          if (group?.id) found.set(String(group.id), detailsOf(group));
        }
        if (found.size) return found;
      } catch (_) {
        /* try the next query */
      }
    }
    return found;
  })();

  return directoryPromise;
}

/** The vendor media type carries the full record; plain JSON is the fallback. */
async function readGroup(id: string): Promise<any | undefined> {
  const url = api(`/api/groups/${encodeURIComponent(id)}`);
  const accepts = ["application/vnd.staffbase.accessors.group.v2+json", "application/json"];

  for (const accept of accepts) {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { accept },
      });
      if (!response.ok) continue;
      const body = await response.json();
      if (body) return body;
    } catch (_) {
      /* try the next media type */
    }
  }
  return undefined;
}

/**
 * Decide whether the configured images are good enough to build cards from.
 *
 * Every entry has to earn it. One missing image leaves a hole in the grid, and a
 * logo blown up across a 4:3 frame looks worse than the row it replaced, so the
 * list stays as rows unless all of the artwork is large, sharp and roughly the
 * right shape.
 */
async function imagesAreCardWorthy(artwork: string[]): Promise<boolean> {
  const sources = artwork.map((value) => resolveIcon(value));
  if (!sources.every((icon) => icon.kind === "image")) return false;

  const sizes = await Promise.all(sources.map((icon) => measureImage(icon.value)));
  return sizes.every((size) => {
    if (size.width < MIN_CARD_WIDTH || size.height < MIN_CARD_HEIGHT) return false;
    const ratio = size.width / size.height;
    return ratio >= MIN_CARD_RATIO && ratio <= MAX_CARD_RATIO;
  });
}

/** Natural size of an image, or zeroes if it fails or takes too long. */
function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const none = { width: 0, height: 0 };
    const img = new Image();
    let settled = false;

    const done = (value: { width: number; height: number }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    // A slow host shouldn't hold the list in its skeleton state.
    const timer = setTimeout(() => done(none), IMAGE_PROBE_TIMEOUT);
    img.onload = () => {
      clearTimeout(timer);
      done({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(none);
    };
    img.src = src;
  });
}

/** The localization entry matching the viewer's language, else the first usable one. */
function pickLocale(localization: unknown): Record<string, unknown> | undefined {
  if (!localization || typeof localization !== "object") return undefined;
  const map = localization as Record<string, any>;

  const wanted = (navigator.language || "en").toLowerCase().replace("-", "_");
  const base = wanted.split("_")[0];
  const usable = (k: string) => map[k] && typeof map[k] === "object";
  const named = (k: string) => usable(k) && (map[k].name || map[k].description);

  const key =
    Object.keys(map).find((k) => k.toLowerCase() === wanted && named(k)) ||
    Object.keys(map).find((k) => k.toLowerCase().split("_")[0] === base && named(k)) ||
    Object.keys(map).find((k) => k.toLowerCase().startsWith("en") && named(k)) ||
    Object.keys(map).find(named);

  return key ? map[key] : undefined;
}

async function updateMembership(
  groupId: string,
  action: "add" | "remove",
  userId: string,
  token: string
): Promise<void> {
  const mediaType =
    action === "add"
      ? "application/vnd.staffbase.accessors.group.members-add.v1+json"
      : "application/vnd.staffbase.accessors.group.members-remove.v1+json";

  const headers: Record<string, string> = { accept: mediaType, "content-type": mediaType };
  if (token) headers["x-csrf-token"] = token;

  const response = await fetch(api(`/api/groups/${encodeURIComponent(groupId)}/members`), {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify({ userIds: [userId] }),
  });
  if (!response.ok) throw new Error(`Could not ${action} the group membership.`);
}

/** Full document load of the app root, so the app re-boots against the new groups. */
function refreshToHome(): void {
  // On a web origin, navigate to the app root. Inside the native shell the
  // origin is capacitor://, where the SPA still lives at "/" — so reload the
  // shell rather than sending the webview at an https URL it can't host.
  const here = webOrigin();
  if (!here) {
    window.location.replace("/");
    return;
  }
  const atRoot = window.location.pathname === "/" && !window.location.search;
  if (atRoot) window.location.reload();
  else window.location.assign(`${here}/`);
}

// ── Widget ───────────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class GroupSwitcher extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    async renderBlock(container: any) {
      const p = "gsw";
      const parsed = parseGroups(this.getAttribute("groups") || "");

      let accent = this.getAttribute("accentcolor") || DEFAULT_ACCENT;
      const useTheme = this.getAttribute("usethemecolors") === "true";
      const fullLogos = this.getAttribute("showfulllogos") === "true";
      const apiToken = this.getAttribute("apitoken") || "";
      const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
      // Must run before any request: it decides whether calls go to the app's
      // real origin or the local shell.
      resolveOrigin(widgetApi, baseUrl);
      if (useTheme && apiToken) {
        // `primary` is the palette entry already contrast-checked for fills.
        const themed = await fetchThemeColors(baseUrl, apiToken);
        if (themed.primary) accent = themed.primary;
      }

      container.innerHTML =
        `<style>${styles(p, accent, hexToRgb(accent))}</style>` +
        `<div class="${p}">` +
        `<div class="${p}-main"></div>` +
        `<div class="${p}-status" role="status" aria-live="polite"></div>` +
        `</div>`;

      const root = container.querySelector(`.${p}`) as HTMLElement;
      root.style.setProperty(`--${p}-accent-on`, contrastColor(accent));
      root.style.setProperty(`--${p}-danger`, "#b3261e");
      root.style.setProperty(`--${p}-danger-rgb`, hexToRgb("#b3261e"));

      const main = root.querySelector(`.${p}-main`) as HTMLElement;
      const status = root.querySelector(`.${p}-status`) as HTMLElement;

      const note = (body: string, alert = false) =>
        `<div class="${p}-note${alert ? ` ${p}-note-alert` : ""}">` +
        (alert ? ICONS.alert : ICONS.info) +
        `<span>${body}</span></div>`;

      if (!parsed.ok) {
        main.innerHTML = note(
          `<strong>This widget's group list isn't valid JSON.</strong> ` +
            `Open the widget settings and correct it. The parser said: ${esc(parsed.message)}`,
          true
        );
        return;
      }

      const groups = parsed.groups;
      if (!groups.length) {
        main.innerHTML = note(
          `<strong>No groups yet.</strong> Add a JSON array to the ` +
            `<code>Groups</code> setting, one entry per group a viewer can move between.`
        );
        return;
      }

      // One skeleton per group, so the list is at final height before data lands.
      main.innerHTML =
        `<ul class="${p}-list">` +
        groups
          .map(
            () =>
              `<li><div class="${p}-row ${p}-sk ${p}-sk-shimmer" aria-hidden="true">` +
              `<span class="${p}-mark"></span>` +
              `<span class="${p}-text">` +
              `<span class="${p}-sk-line" style="width:42%"></span>` +
              `<span class="${p}-sk-line" style="width:66%"></span>` +
              `</span></div></li>`
          )
          .join("") +
        `</ul>` +
        `<span class="${p}-sr">Loading your groups.</span>`;

      let viewer: Viewer;
      let details: GroupDetails[];
      try {
        [viewer, details] = await Promise.all([
          fetchViewer(widgetApi),
          // Skip the lookup only when the config already supplies every field.
          Promise.all(
            groups.map((g) =>
              g.name && g.description && g.icon
                ? Promise.resolve({ name: g.name, description: g.description, imageUrl: "" })
                : fetchGroup(g.id)
            )
          ),
        ]);
      } catch (_) {
        main.innerHTML = note(
          `<strong>Your profile didn't load, so groups can't be switched.</strong> ` +
            `Reload the page to try again.`,
          true
        );
        return;
      }

      // A configured icon wins; otherwise the group's own artwork stands in.
      // A configured icon wins; otherwise the group's own artwork stands in.
      const artwork = groups.map((g, i) => g.icon || details[i].imageUrl || "");
      // Logo mode is an explicit editor choice, so it skips the size gate. It
      // still needs a picture everywhere, or the grid would sit half empty.
      const everyEntryHasImage = artwork.every((a) => resolveIcon(a).kind === "image");
      const logoMode = fullLogos && everyEntryHasImage;
      const cardWorthy = logoMode || (await imagesAreCardWorthy(artwork));

      const memberOf = new Set(viewer.groupIDs || []);
      let busy = false;

      const list = document.createElement("ul");
      list.className = `${p}-list`;
      if (cardWorthy) list.dataset.media = "true";
      if (logoMode) list.dataset.fit = "contain";

      groups.forEach((group, index) => {
        // Config wins over the API, so an editor can override either field.
        const label = group.name || details[index].name || group.id;
        const description = group.description || details[index].description;
        const isCurrent = memberOf.has(group.id);
        const icon = resolveIcon(artwork[index]);

        const row = document.createElement("button");
        row.type = "button";
        row.className = `${p}-row`;
        row.dataset.groupId = group.id;
        if (isCurrent) {
          row.setAttribute("aria-current", "true");
          row.disabled = true;
        }
        // The current row says so in text, not by tint alone.
        row.setAttribute(
          "aria-label",
          isCurrent ? `${label}. This is your current group.` : `Switch to ${label}`
        );

        row.innerHTML =
          `<span class="${p}-mark">` +
          (icon.kind === "image"
            ? `<img src="${esc(icon.value)}" alt="" loading="lazy">`
            : icon.value) +
          `</span>` +
          `<span class="${p}-text">` +
          `<span class="${p}-name">${esc(label)}</span>` +
          (description ? `<span class="${p}-desc">${esc(description)}</span>` : "") +
          `</span>` +
          (isCurrent
            ? `<span class="${p}-cue">${ICONS.check}<span class="${p}-cue-label">Current</span></span>`
            : `<span class="${p}-cue ${p}-cue-go">` +
              `<span class="${p}-cue-label">Switch</span>${ICONS.arrow}</span>`);

        if (!isCurrent) row.addEventListener("click", () => switchTo(group, label, row));

        const item = document.createElement("li");
        item.appendChild(row);
        list.appendChild(item);
      });

      main.innerHTML = "";
      main.appendChild(list);

      const rows = () => Array.from(list.querySelectorAll(`.${p}-row`)) as HTMLButtonElement[];

      function startBusy(row: HTMLButtonElement, label: string) {
        busy = true;
        list.dataset.busy = "true";
        rows().forEach((r) => (r.disabled = true));
        row.setAttribute("aria-busy", "true");
        const cue = row.querySelector(`.${p}-cue`);
        if (cue) cue.innerHTML = `<span class="${p}-spin">${ICONS.spinner}</span>`;
        status.textContent = `Switching to ${label}.`;
      }

      function endBusy(row: HTMLButtonElement, label: string) {
        busy = false;
        delete list.dataset.busy;
        row.removeAttribute("aria-busy");
        const cue = row.querySelector(`.${p}-cue`);
        if (cue) {
          cue.className = `${p}-cue ${p}-cue-go`;
          cue.innerHTML = `<span class="${p}-cue-label">Switch</span>${ICONS.arrow}`;
        }
        rows().forEach((r) => (r.disabled = r.getAttribute("aria-current") === "true"));
        status.innerHTML = note(
          `<strong>Switching to ${esc(label)} didn't finish.</strong> ` +
            `Your groups may be part-way changed. Try again, or reload the page.`,
          true
        );
      }

      async function switchTo(group: GroupConfig, label: string, row: HTMLButtonElement) {
        if (busy) return;
        status.textContent = "";
        startBusy(row, label);

        let reload = true;
        try {
          const token = await csrfToken();

          // Only groups named in this widget's own config are ever removed.
          const toRemove = groups
            .map((g) => g.id)
            .filter((id) => id !== group.id && memberOf.has(id));

          if (toRemove.length) {
            await Promise.allSettled(
              toRemove.map((id) => updateMembership(id, "remove", viewer.id, token))
            );
          }
          if (!memberOf.has(group.id)) {
            await updateMembership(group.id, "add", viewer.id, token);
          }
        } catch (_) {
          reload = false;
          endBusy(row, label);
        } finally {
          // Busy state stays up through the reload, so the row never flashes idle.
          if (reload) refreshToHome();
        }
      }
    }

    static get observedAttributes() {
      return ["groups", "showfulllogos", "usethemecolors", "accentcolor", "apitoken", "baseurl"];
    }
  };
};

// ── Registration ─────────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "group-switcher",
  label: "Group Switcher",
  attributes: ["groups", "showfulllogos", "usethemecolors", "accentcolor", "apitoken", "baseurl"],
  factory: factory,
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  blockLevel: "block",
  iconUrl: ICONS.widgetIconDataUri,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Staffbase",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
