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
  "ui:order": ["groups", "usethemecolors", "accentcolor", "apitoken", "baseurl"],
  groups: {
    "ui:widget": "textarea",
    "ui:options": { rows: 14 },
    "ui:placeholder": PLACEHOLDER,
    "ui:help":
      'A JSON array of the groups a viewer can move between. Each entry needs "id", the group ID. ' +
      'The name and description are read from the group itself; add "name" or "description" only ' +
      'to override them. ' +
      '"icon" takes either a picture or an icon name. Anything starting with http:// https:// or ' +
      "data:image/ is treated as a picture, and once any entry has one the list becomes image cards " +
      "on wide screens (pictures are cropped to fill, so keep the subject centered). " +
      "Otherwise it's one of these names: " +
      resolveIcon.names.join(", ") +
      ".",
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
type GroupDetails = { name: string; description: string };

const BLANK_GROUP: GroupDetails = { name: "", description: "" };

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

// ── Session ──────────────────────────────────────────────────────────────────

const DISCOVER_ACCEPT = "application/vnd.staffbase.auth.discovery.v2+json";
const USER_ACCEPT = "application/vnd.staffbase.accessors.user.v2+json";

let discoverPromise: Promise<any> | null = null;

/** `/auth/discover` returns both the viewer and a CSRF token. Cached per page. */
function fetchDiscover(): Promise<any> {
  if (!discoverPromise) {
    discoverPromise = fetch("/auth/discover", {
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

  const response = await fetch("/api/users/me", {
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
 * Name and description for a group; blank fields when they can't be read.
 *
 * The groups API keeps both under `config.localization.{locale}`, so the flat
 * top-level fields are only a fallback for endpoints that expose them.
 */
async function fetchGroup(id: string): Promise<GroupDetails> {
  try {
    const group = await readGroup(id);
    if (!group) return BLANK_GROUP;

    const local = group?.config?.localization;
    const picked = pickLocale(local);

    return {
      name: text(picked?.name) || text(group?.name) || text(group?.title),
      description: text(picked?.description) || text(group?.description),
    };
  } catch (_) {
    return BLANK_GROUP;
  }
}

/** The vendor media type carries the full record; plain JSON is the fallback. */
async function readGroup(id: string): Promise<any | undefined> {
  const url = `/api/groups/${encodeURIComponent(id)}`;
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

  const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify({ userIds: [userId] }),
  });
  if (!response.ok) throw new Error(`Could not ${action} the group membership.`);
}

/** Full document load of the app root, so the app re-boots against the new groups. */
function refreshToHome(): void {
  const home = new URL("/", window.location.origin);
  if (home.origin !== window.location.origin) return;
  const atRoot = window.location.pathname === home.pathname && !window.location.search;
  if (atRoot) window.location.reload();
  else window.location.assign(home.href);
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
      const apiToken = this.getAttribute("apitoken") || "";
      const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
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

      // Cards only pay their way when there are real images to show.
      const hasMedia = groups.some((g) => resolveIcon(g.icon).kind === "image");
      const listAttrs = `class="${p}-list"${hasMedia ? ` data-media="true"` : ""}`;

      // One skeleton per group, so the list is at final height before data lands.
      main.innerHTML =
        `<ul ${listAttrs}>` +
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
          // Skip the lookup only when the config already supplies both fields.
          Promise.all(
            groups.map((g) =>
              g.name && g.description
                ? Promise.resolve({ name: g.name, description: g.description })
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

      const memberOf = new Set(viewer.groupIDs || []);
      let busy = false;

      const list = document.createElement("ul");
      list.className = `${p}-list`;
      if (hasMedia) list.dataset.media = "true";

      groups.forEach((group, index) => {
        // Config wins over the API, so an editor can override either field.
        const label = group.name || details[index].name || group.id;
        const description = group.description || details[index].description;
        const isCurrent = memberOf.has(group.id);
        const icon = resolveIcon(group.icon);

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
      return ["groups", "usethemecolors", "accentcolor", "apitoken", "baseurl"];
    }
  };
};

// ── Registration ─────────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "group-switcher",
  label: "Group Switcher",
  attributes: ["groups", "usethemecolors", "accentcolor", "apitoken", "baseurl"],
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
