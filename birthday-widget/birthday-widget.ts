import {
  BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock,
} from "@staffbase/widget-sdk";
import { JSONSchema7 } from "json-schema";
import { detectLocale, isRtl, makeT } from "../tasks/shared/i18n";
import { fetchThemeColors } from "../tasks/shared/theming";
import { AVAILABLE_LOCALES, BUNDLES } from "./strings";

const P = "sbbd";
const DEFAULT_PRIMARY = "#3DDC97";
const DEFAULT_ACCENT  = "#7C5CFF";

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken:      { type: "string", title: "API Token", default: "" },
    baseurl:       { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: "" },
    people:        { type: "string", title: "People (semicolon-separated: Name, +N; Name, +N)", default: "" },
    widgettitle:   { type: "string", title: "Widget Title (optional override)", default: "" },
    usethemecolors:{ type: "boolean", title: "Use Theme Colors", default: true },
  },
  dependencies: {
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY },
            accentcolor:  { type: "string", title: "Accent Color",  default: DEFAULT_ACCENT  },
          },
        },
        { properties: { usethemecolors: { const: true } } },
      ],
    },
  },
};

const uiSchema = {
  apitoken: { "ui:help": "Used to load profile photos and brand colors from the API." },
  baseurl:  { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
  people:   { "ui:help": "Semicolon-separated. Format: Name, +N; Name, +N (N = days from today)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return ((words[0][0] || "") + (words.length > 1 ? words[words.length - 1][0] || "" : "")).toUpperCase();
}

function hexToRgb(hex: string): string {
  const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

function readableOn(hex: string): string {
  const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const l = 0.2126 * lin(parseInt(h.slice(0, 2), 16) / 255)
    + 0.7152 * lin(parseInt(h.slice(2, 4), 16) / 255)
    + 0.0722 * lin(parseInt(h.slice(4, 6), 16) / 255);
  return l > 0.45 ? "#111827" : "#FFFFFF";
}

interface BirthdayPerson {
  name: string;
  daysUntil: number;
}

function parsePeople(raw: string): BirthdayPerson[] {
  return raw.split(";")
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const m = entry.match(/^(.+?),\s*\+?(\d+)\s*$/);
      if (!m) return null;
      const days = parseInt(m[2], 10);
      return isFinite(days) && days >= 0 ? { name: m[1].trim(), daysUntil: days } : null;
    })
    .filter((p): p is BirthdayPerson => p !== null);
}

function birthdayDateLabel(daysFromNow: number, locale: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  try {
    return d.toLocaleDateString(locale.replace("_", "-"), { month: "long", day: "numeric" });
  } catch (_) {
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
}

function countdownLabel(days: number, t: (k: string) => string): string {
  if (days === 0) return t("countdown.today");
  if (days === 1) return t("countdown.tomorrow");
  return t("countdown.days").replace("{n}", String(days));
}

/** Fetch all users and return a lowercase-name → avatar URL map. */
async function fetchUserAvatars(baseUrl: string, apiToken: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiToken) headers.Authorization = `Basic ${apiToken}`;
    let offset = 0;
    const limit = 100;
    while (true) {
      const res = await fetch(`${baseUrl}/users?limit=${limit}&offset=${offset}`, { headers, credentials: "omit" });
      if (!res.ok) break;
      const data = await res.json();
      const rows: any[] = data?.data || [];
      for (const u of rows) {
        const name = ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "").trim();
        const avatar = u.avatar?.thumb?.url || u.avatar?.icon?.url || u.avatar?.original?.url || "";
        if (name && avatar) map.set(name.toLowerCase(), avatar);
      }
      const total = Number(data?.total ?? 0);
      offset += rows.length;
      if (rows.length < limit || offset >= total) break;
    }
  } catch (_) { /* leave empty — initials fallback */ }
  return map;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const HOST_RESET = `
.${P}-root button{
  width:auto!important;min-width:0!important;margin:0!important;
  background:none!important;border:0!important;box-shadow:none!important;
  color:inherit!important;font-family:inherit!important;line-height:normal!important;
  text-transform:none!important;letter-spacing:inherit!important;outline:none!important;
  padding:0;border-radius:0;cursor:pointer;-webkit-appearance:none;appearance:none;
  display:inline-flex;align-items:center;justify-content:center}
.${P}-root ol,.${P}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${P}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${P}-root h1,.${P}-root h2,.${P}-root h3,.${P}-root h4,.${P}-root h5,.${P}-root h6,
.${P}-root p,.${P}-root figure{margin:0!important;padding:0!important;font-family:inherit!important}
.${P}-root p{color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
  font-style:normal!important;line-height:inherit!important}
.${P}-root img{max-width:none!important;margin:0!important;border-radius:0}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:border-box}
`;

const CSS = `
${HOST_RESET}

.${P}-root{
  background:transparent;
  padding:20px 22px;
  font-family:inherit;
  color:#111827;
  -webkit-font-smoothing:antialiased;
}

.${P}-header{
  display:flex;align-items:center;gap:10px;margin-bottom:16px;
}
.${P}-balloon{
  flex:0 0 auto;color:var(--sbbd-primary,${DEFAULT_PRIMARY});
  display:inline-flex;align-items:center;
}
.${P}-title{
  font-size:16px;font-weight:700;color:#111827;flex:1 1 auto;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.${P}-count{
  display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;flex:0 0 auto;
  font-size:11.5px;font-weight:600;letter-spacing:.01em;
  background:rgba(var(--sbbd-primary-rgb),.10);color:var(--sbbd-primary,${DEFAULT_PRIMARY});
}

.${P}-list{display:flex;flex-direction:column;gap:4px}

.${P}-card{
  display:flex;align-items:center;gap:14px;padding:12px 14px;
  border-radius:12px;background:transparent;
  transition:background .18s ease,transform .18s ease;
  animation:${P}-rise .45s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(var(--i,0)*60ms);
}
.${P}-card:hover{background:#f9fafb;transform:translateX(3px)}

/* Avatar circle */
.${P}-av{
  width:44px;height:44px;border-radius:50%;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;overflow:hidden;
  background:linear-gradient(140deg,var(--sbbd-primary,${DEFAULT_PRIMARY}),var(--sbbd-accent,${DEFAULT_ACCENT}));
  color:var(--sbbd-primary-text,#fff);font-weight:700;font-size:16px;letter-spacing:-.01em;
}
/* Shows initials only when the image is absent */
.${P}-av-fb::after{content:attr(data-ini)}
.${P}-av img{width:100%;height:100%;object-fit:cover;display:block}

.${P}-info{flex:1 1 auto;min-width:0}
.${P}-root .${P}-name{
  font-size:14px!important;font-weight:600!important;color:#111827!important;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3!important;
}
.${P}-root .${P}-date{
  font-size:12px!important;color:#6b7280!important;margin-top:2px!important;line-height:1.4!important;
}

.${P}-pill{
  flex:0 0 auto;padding:4px 11px;border-radius:99px;
  font-size:12px;font-weight:600;white-space:nowrap;
  background:rgba(var(--sbbd-primary-rgb),.10);
  color:var(--sbbd-primary,${DEFAULT_PRIMARY});
}
.${P}-pill.is-today{
  background:rgba(var(--sbbd-primary-rgb),.18);
  box-shadow:0 0 10px rgba(var(--sbbd-primary-rgb),.25);
}

.${P}-root .${P}-empty{
  text-align:center;padding:36px 16px;
  color:#9ca3af!important;font-size:13px!important;line-height:1.5!important;
}

@keyframes ${P}-rise{
  from{opacity:0;transform:translateY(8px)}
  to{opacity:1;transform:none}
}

@media(max-width:380px){
  .${P}-card{flex-wrap:wrap}
  .${P}-pill{margin-top:4px;margin-left:calc(44px + 14px)}
}

@media(prefers-reduced-motion:reduce){
  .${P}-root *,.${P}-root *::before,.${P}-root *::after{
    animation:none!important;transition:none!important}
}
`;

// ── Factory ───────────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class BirthdayWidget extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async renderBlock(container: HTMLElement) {
      const attr = (k: string): string => this.getAttribute(k) || "";
      const bool = (k: string, dflt: boolean): boolean => {
        const v = this.getAttribute(k);
        return v == null || v === "" ? dflt : v !== "false";
      };

      const apiToken = attr("apitoken");
      const baseUrl  = attr("baseurl").replace(/\/+$/, "");

      let primary = attr("primarycolor") || DEFAULT_PRIMARY;
      let accent  = attr("accentcolor")  || DEFAULT_ACCENT;

      // Kick off avatar + theme fetches concurrently when credentials are available.
      const [avatarMap] = await Promise.all([
        (apiToken && baseUrl) ? fetchUserAvatars(baseUrl, apiToken) : Promise.resolve(new Map<string, string>()),
        (bool("usethemecolors", true) && apiToken && baseUrl)
          ? fetchThemeColors(baseUrl, apiToken, "primary", "light").then(themed => {
              if (themed.primary) primary = themed.primary;
              if (themed.accent)  accent  = themed.accent;
            }).catch(() => { /* leave defaults */ })
          : Promise.resolve(),
      ]);
      if (accent.toLowerCase() === primary.toLowerCase()) accent = DEFAULT_ACCENT;

      const locale = detectLocale({
        configLocale: (widgetApi as any)?.getContentLanguage?.() || null,
        available: AVAILABLE_LOCALES,
      });
      const t   = makeT(BUNDLES, locale);
      const rtl = isRtl(locale);

      const people = parsePeople(attr("people"));
      people.sort((a, b) => a.daysUntil - b.daysUntil);

      const heading = attr("widgettitle") || t("widget.title");

      const cardHtml = (p: BirthdayPerson, i: number): string => {
        const avatarUrl = avatarMap.get(p.name.toLowerCase()) || "";
        const ini = initials(p.name);
        const imgHtml = avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="" onerror="this.parentElement.setAttribute('data-ini','${esc(ini)}');this.parentElement.classList.add('${P}-av-fb');this.remove()">`
          : "";
        const avClass = `${P}-av${avatarUrl ? "" : ` ${P}-av-fb`}`;
        const isToday = p.daysUntil === 0;
        return `<li class="${P}-card" style="--i:${i}">
          <span class="${avClass}" data-ini="${esc(ini)}" aria-hidden="true">${imgHtml}</span>
          <div class="${P}-info">
            <p class="${P}-name">${esc(p.name)}</p>
            <p class="${P}-date">${esc(birthdayDateLabel(p.daysUntil, locale))}</p>
          </div>
          <span class="${P}-pill${isToday ? " is-today" : ""}">${esc(countdownLabel(p.daysUntil, t))}</span>
        </li>`;
      };

      const cardsHtml = people.length
        ? `<ul class="${P}-list">${people.map(cardHtml).join("")}</ul>`
        : `<p class="${P}-empty">${esc(t("state.empty"))}</p>`;

      container.innerHTML = `<style>${CSS}</style>
        <div class="${P}-root" dir="${rtl ? "rtl" : "ltr"}" style="
          --sbbd-primary:${esc(primary)};
          --sbbd-accent:${esc(accent)};
          --sbbd-primary-rgb:${hexToRgb(primary)};
          --sbbd-primary-text:${readableOn(primary)}">
          <div class="${P}-header">
            <span class="${P}-balloon" aria-hidden="true"><svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="9" cy="8.5" rx="7.5" ry="8.5" fill="currentColor"/><path d="M9 17 L8.5 19.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M7 20 Q9 23 11 20" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="6.5" cy="5.5" rx="1.8" ry="2.5" fill="white" opacity="0.25" transform="rotate(-30 6.5 5.5)"/></svg></span>
            <span class="${P}-title">${esc(heading)}</span>
            ${people.length ? `<span class="${P}-count">${esc(String(people.length))}</span>` : ""}
          </div>
          ${cardsHtml}
        </div>`;
    }

    disconnectedCallback() {
      // No timers or listeners to tear down.
    }

    static get observedAttributes() {
      return ATTRS;
    }
  };
};

const ATTRS = [
  "apitoken", "baseurl", "people", "widgettitle",
  "usethemecolors", "primarycolor", "accentcolor",
];

// ── Block registration ────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "birthday-widget",
  label: "Upcoming Birthdays",
  attributes: ATTRS,
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%233DDC97'/%3E%3Cg fill='%23fff'%3E%3Crect x='8' y='20' width='24' height='13' rx='3'/%3E%3Crect x='11' y='14' width='18' height='8' rx='2'/%3E%3Crect x='19' y='7' width='2' height='6' rx='1'/%3E%3Crect x='13' y='8' width='2' height='5' rx='1'/%3E%3Crect x='25' y='8' width='2' height='5' rx='1'/%3E%3C/g%3E%3C/svg%3E",
};

(window as any).defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" } as ExternalBlockDefinition);
