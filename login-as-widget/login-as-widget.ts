import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
  WidgetApi,
} from "@staffbase/widget-sdk";

// One configured persona the widget can switch into. Only `id` is required — the
// rest is resolved from the Users API (name/avatar/email) unless overridden here.
interface UserEntry {
  id: string;
  password?: string;   // per-user secret; falls back to the shared password
  identifier?: string; // login identifier override (email/username); else resolved from the API
  label?: string;      // display-name override
}

const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#DA2E32";
const DEFAULT_ACCENT_COLOR = "#F59E0B";

// ── Inline SVG chrome icons ────────────────────────────────────────────────────
const ICONS = {
  // small arrow used inside the "Log in as" / confirm buttons
  enter: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`,
};

function buildCss(p: string): string {
  return `
.${p}{--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--bg-soft:#f7f7f9;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:16px;--shadow-sm:0 1px 2px rgba(0,0,0,.04),0 1px 3px rgba(0,0,0,.06);--shadow-md:0 6px 22px rgba(0,0,0,.09);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);padding:20px}
.${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
/* "Signed in as" chip */
.${p}-current{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:var(--r-md);background:var(--bg-soft);margin-bottom:16px}
.${p}-current-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0;overflow:hidden}
.${p}-current-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-current-txt{min-width:0;line-height:1.3}
.${p}-current-eyebrow{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt)}
.${p}-current-name{font-size:13.5px;font-weight:700;color:var(--dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* search */
.${p}-search-wrap{position:relative;margin-bottom:14px}
.${p}-search-ic{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;display:flex}
.${p}-in{width:100%;font-family:inherit;font-size:14px;color:var(--dark);background:#fafafa;border:1.5px solid var(--border);border-radius:var(--r-md);padding:11px 14px 11px 40px;transition:border-color .15s,box-shadow .15s,background .15s}
.${p}-in::placeholder{color:var(--gray-lt)}
.${p}-in:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
/* list */
.${p}-list{display:flex;flex-direction:column;gap:10px}
.${p}-list.intro>*{animation:${p}-rise .42s cubic-bezier(.22,.9,.3,1) backwards}
.${p}-list.intro>*:nth-child(1){animation-delay:.02s}
.${p}-list.intro>*:nth-child(2){animation-delay:.07s}
.${p}-list.intro>*:nth-child(3){animation-delay:.12s}
.${p}-list.intro>*:nth-child(4){animation-delay:.17s}
.${p}-list.intro>*:nth-child(n+5){animation-delay:.22s}
@keyframes ${p}-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.${p}-card{position:relative;display:flex;align-items:center;gap:13px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:13px 15px;transition:transform .16s,box-shadow .16s,border-color .16s;overflow:hidden}
.${p}-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:transparent}
.${p}-card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:3px;background:linear-gradient(var(--primary),var(--accent));opacity:0;transition:opacity .16s}
.${p}-card:hover::before{opacity:1}
.${p}-card.is-current{border-color:rgba(var(--primary-rgb),.45);box-shadow:0 0 0 1.5px rgba(var(--primary-rgb),.18) inset}
.${p}-av{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent))}
.${p}-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-who{flex:1;min-width:0}
.${p}-name{font-size:14.5px;font-weight:700;color:var(--dark);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${p}-meta{font-size:12px;color:var(--gray-lt);line-height:1.35;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${p}-meta.err{color:var(--error);display:flex;align-items:center;gap:4px}
.${p}-you-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--primary);background:rgba(var(--primary-rgb),.1);padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle}
.${p}-login-btn{flex-shrink:0;padding:9px 15px;border-radius:var(--r-md);border:none;color:var(--primary-text);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 3px 10px rgba(var(--primary-rgb),.28);transition:transform .15s,box-shadow .15s,filter .15s;white-space:nowrap}
.${p}-login-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.05)}
.${p}-login-btn:active:not(:disabled){transform:translateY(0)}
.${p}-login-btn svg{flex-shrink:0}
.${p}-empty{text-align:center;padding:30px 16px;color:var(--gray-lt);font-size:13px;font-weight:500;line-height:1.6}
.${p}-skel{height:70px;border-radius:var(--r-lg);background:linear-gradient(100deg,#f1f1f4 30%,#f7f7f9 50%,#f1f1f4 70%);background-size:220% 100%;animation:${p}-shim 1.2s linear infinite}
@keyframes ${p}-shim{from{background-position:180% 0}to{background-position:-40% 0}}
.${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;animation:${p}-spin .7s linear infinite;display:inline-block}
@keyframes ${p}-spin{to{transform:rotate(360deg)}}
.${p}-toast{position:absolute;bottom:18px;left:50%;transform:translate(-50%,8px);background:var(--dark);color:#fff;padding:11px 18px;border-radius:var(--r-md);font-size:13px;font-weight:700;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;z-index:10;box-shadow:var(--shadow-md);display:flex;align-items:center;gap:8px}
.${p}-toast.show{opacity:1;transform:translate(-50%,0)}
.${p}-wrap{position:relative;min-height:90px}
@media (prefers-reduced-motion:reduce){.${p}-list.intro>*{animation:none!important}}
/* ── Confirm modal ─────────────────────────────────────────────────────── */
.${p}-modal-backdrop{position:absolute;inset:0;background:rgba(20,20,22,.45);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:30}
.${p}-modal-backdrop.show{opacity:1;pointer-events:auto}
.${p}-modal{width:100%;max-width:320px;background:#fff;border-radius:var(--r-lg);box-shadow:0 20px 60px rgba(0,0,0,.28);padding:22px;text-align:center;transform:translateY(8px) scale(.97);transition:transform .2s}
.${p}-modal-backdrop.show .${p}-modal{transform:none}
.${p}-modal-av{width:60px;height:60px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));overflow:hidden}
.${p}-modal-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-modal-title{font-size:16px;font-weight:800;color:var(--dark);line-height:1.35}
.${p}-modal-name{color:var(--primary)}
.${p}-modal-msg{font-size:13px;color:var(--gray);line-height:1.5;margin-top:8px}
.${p}-modal-actions{display:flex;gap:9px;margin-top:18px}
.${p}-modal-actions button{flex:1}
.${p}-modal-cancel{padding:11px;border-radius:var(--r-md);border:1.5px solid var(--border);background:#fff;color:var(--gray);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}
.${p}-modal-confirm{padding:11px;border-radius:var(--r-md);border:none;color:var(--primary-text);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 3px 10px rgba(var(--primary-rgb),.28);display:inline-flex;align-items:center;justify-content:center;gap:6px}
/* ── Neutralize Staffbase global button rules (margin:auto / width:90% / blue+red
      hover/focus/active backgrounds). Their rules aren't !important, so these win. */
.${p} button{width:auto!important;margin:0!important;box-sizing:border-box;font-family:inherit;line-height:normal!important}
.${p} button:focus,.${p} button:focus-visible{outline:none!important;box-shadow:none}
.${p} .${p}-login-btn,.${p} .${p}-login-btn:hover,.${p} .${p}-login-btn:focus,.${p} .${p}-login-btn:active{background:linear-gradient(135deg,var(--primary),var(--accent))!important;color:var(--primary-text)!important;border:none!important}
.${p} .${p}-login-btn:disabled{background:var(--border)!important;color:var(--gray-lt)!important;cursor:not-allowed;box-shadow:none!important;transform:none!important;filter:none!important}
.${p} .${p}-modal-confirm,.${p} .${p}-modal-confirm:hover,.${p} .${p}-modal-confirm:focus,.${p} .${p}-modal-confirm:active{background:linear-gradient(135deg,var(--primary),var(--accent))!important;color:var(--primary-text)!important;border:none!important}
.${p} .${p}-modal-cancel,.${p} .${p}-modal-cancel:hover,.${p} .${p}-modal-cancel:focus,.${p} .${p}-modal-cancel:active{background:#fff!important;color:var(--gray)!important;border:1.5px solid var(--border)!important}
`;
}

function makeApiOpts(token: string, extra?: RequestInit): RequestInit {
  return {
    ...extra,
    credentials: "omit",
    headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" },
  };
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Color utilities (shared idiom with the recognition / task widgets) ──────────
function hexToRgb(hex: string): string {
  const h = (hex.replace("#", "") + "000000").slice(0, 6);
  return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}

function relLuminance(hex: string): number {
  const h = (hex.replace("#", "") + "000000").slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastColor(hex: string): string {
  return relLuminance(hex) > 0.45 ? "#1a1a1a" : "#ffffff";
}

function contrastOnWhite(hex: string): number {
  return 1.05 / (relLuminance(hex) + 0.05);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const x = (hex.replace("#", "") + "000000").slice(0, 6);
  const r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  let s = 0, h = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function darkenToContrast(hex: string, target = 4.5): string {
  let { h, s, l } = hexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 50 && contrastOnWhite(out) < target && l > 0.04; i++) {
    l = Math.max(0, l - 0.02);
    out = hslToHex(h, s, l);
  }
  return out;
}

function pickOnWhite(cands: string[]): string {
  const isHex = (s: string) => /^#[0-9a-fA-F]{3,8}$/.test(s);
  const scored = cands.filter(isHex).map(hex => ({ hex, ...hexToHsl(hex), contrast: contrastOnWhite(hex) }));
  let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.12 && c.l <= 0.85);
  if (!pool.length) pool = scored.filter(c => c.s >= 0.2 && c.l <= 0.9);
  if (!pool.length) return "";
  pool.sort((a, b) => (b.contrast - a.contrast) || (b.s - a.s));
  return darkenToContrast(pool[0].hex, 4.5);
}

function pickVivid(cands: string[], exclude = ""): string {
  const isHex = (s: string) => /^#[0-9a-fA-F]{3,8}$/.test(s);
  const pool = cands.filter(isHex).map(hex => ({ hex, ...hexToHsl(hex) }))
    .filter(c => c.s >= 0.3 && c.l >= 0.15 && c.l <= 0.92)
    .sort((a, b) => b.s - a.s);
  if (!pool.length) return "";
  return (pool.find(c => c.hex.toLowerCase() !== exclude.toLowerCase()) || pool[0]).hex;
}

// Pull Primary/Accent from the Staffbase branding theme (token-auth GET).
async function fetchThemeColors(baseUrl: string, apiToken: string): Promise<{ primary?: string; accent?: string }> {
  const isHex = (s: string) => /^#[0-9a-fA-F]{3,8}$/.test(s);
  const isNeutralExtreme = (s: string) => {
    const x = s.replace("#", "").toLowerCase();
    return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
  };
  try {
    const res = await fetch(`${baseUrl}/theming/themes/primary`, {
      credentials: "omit",
      headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json" },
    });
    if (!res.ok) return {};
    const data: any = await res.json();
    const customs: Record<string, string> = {};
    for (const c of data?.globalTheme?.customColors || []) {
      if (c && c.id && c.color) customs[c.id] = c.color;
    }
    const resolve = (v?: string): string => !v ? "" : (v[0] === "#" ? v : (customs[v] || ""));
    const palette = [
      ...Object.values(customs),
      typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "",
      resolve(data?.desktopTheme?.components?.navigation?.accentColor),
    ].filter(c => isHex(c) && !isNeutralExtreme(c));

    let primary = pickOnWhite(palette);
    if (!primary) {
      primary = resolve("primary-brand-color") || customs["legacy-background-color"] ||
        (typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "");
      if (isHex(primary)) primary = darkenToContrast(primary, 4.5);
    }
    let accent = pickVivid(palette, primary) || resolve(data?.desktopTheme?.components?.navigation?.accentColor) || primary;

    return {
      primary: isHex(String(primary)) ? String(primary) : undefined,
      accent: isHex(String(accent)) ? String(accent) : undefined,
    };
  } catch {
    return {};
  }
}

// A resolved persona, ready to render.
interface Persona {
  id: string;
  name: string;
  identifier: string; // email/username used as the login `identifier`
  avatar: string;
  meta: string;       // secondary line (email or position)
  password: string;
  error: string;      // non-empty if the user couldn't be resolved or has no credentials
}

const factory: BlockFactory = (BaseBlockClass, widgetApi: WidgetApi) => {
  return class LoginAsWidget extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    async renderBlock(container: HTMLElement): Promise<void> {
      const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
      const token = this.getAttribute("apitoken") || "";
      const sharedPassword = this.getAttribute("sharedpassword") || "";
      const redirectUrl = this.getAttribute("redirecturl") || "";
      const locale = this.getAttribute("locale") || "en_US";
      const apiOpts = (extra?: RequestInit) => makeApiOpts(token, extra);

      // ── Theming ────────────────────────────────────────────────────────
      let primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
      let accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
      const bgColor = this.getAttribute("backgroundcolor") || "";
      if (this.getAttribute("usethemecolors") === "true" && token) {
        const themed = await fetchThemeColors(baseUrl, token);
        if (themed.primary) primaryColor = themed.primary;
        if (themed.accent) accentColor = themed.accent;
      }
      const primaryRgb = hexToRgb(primaryColor);
      const accentRgb = hexToRgb(accentColor);
      const primaryText = contrastColor(primaryColor);
      const p = "law";

      // Parse configured users.
      let entries: UserEntry[] = [];
      try {
        const raw = this.getAttribute("users");
        if (raw) entries = JSON.parse(raw);
      } catch {}
      entries = (Array.isArray(entries) ? entries : []).filter(e => e && e.id && String(e.id).trim());

      // ── Shell ────────────────────────────────────────────────────────────
      container.innerHTML = `<style>${buildCss(p)}</style>
<div class="${p}" style="--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};background:${bgColor || "transparent"}">
  <div class="${p}-current" id="lawCurrent" style="display:none"></div>
  <div class="${p}-search-wrap" id="lawSearchWrap" style="display:none">
    <span class="${p}-search-ic">${ICONS.search}</span>
    <input class="${p}-in" id="lawSearch" type="text" placeholder="Search users…" autocomplete="off">
  </div>
  <div class="${p}-wrap">
    <div class="${p}-list" id="lawList">
      ${entries.length
        ? entries.map(() => `<div class="${p}-skel"></div>`).join("")
        : `<div class="${p}-empty">No users configured yet.<br>Add user IDs &amp; passwords in the widget settings.</div>`}
    </div>
    <div class="${p}-toast" id="lawToast"></div>
    <div class="${p}-modal-backdrop" id="lawModal">
      <div class="${p}-modal" role="dialog" aria-modal="true">
        <div class="${p}-modal-av" id="lawModalAv"></div>
        <div class="${p}-modal-title">Log in as <span class="${p}-modal-name" id="lawModalName"></span>?</div>
        <div class="${p}-modal-msg">This ends your current session and reloads the page as this user.</div>
        <div class="${p}-modal-actions">
          <button type="button" class="${p}-modal-cancel" id="lawModalCancel">Cancel</button>
          <button type="button" class="${p}-modal-confirm" id="lawModalConfirm">${ICONS.enter}Log in</button>
        </div>
      </div>
    </div>
  </div>
</div>`;

      const listEl = container.querySelector("#lawList") as HTMLElement;
      const toast = container.querySelector("#lawToast") as HTMLElement;
      const currentEl = container.querySelector("#lawCurrent") as HTMLElement;
      const searchWrap = container.querySelector("#lawSearchWrap") as HTMLElement;
      const searchInput = container.querySelector("#lawSearch") as HTMLInputElement;
      const modal = container.querySelector("#lawModal") as HTMLElement;
      const modalAv = container.querySelector("#lawModalAv") as HTMLElement;
      const modalName = container.querySelector("#lawModalName") as HTMLElement;
      const modalCancel = container.querySelector("#lawModalCancel") as HTMLButtonElement;
      const modalConfirm = container.querySelector("#lawModalConfirm") as HTMLButtonElement;

      function showToast(msg: string, ok = true) {
        toast.innerHTML = (ok ? ICONS.check : ICONS.alert) + escapeHtml(msg);
        toast.style.background = ok ? "var(--dark)" : "var(--error)";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3200);
      }

      if (!entries.length) return;

      // ── Resolve each user from the Users API (name / avatar / email) ──────
      const resolveIdentifier = (data: any, override?: string): string => {
        if (override) return override;
        const emails: any[] = Array.isArray(data?.emails) ? data.emails : [];
        const primary = emails.find(e => e && e.primary && e.value);
        const anyEmail = emails.find(e => e && e.value);
        return (primary?.value) || (anyEmail?.value) || data?.email || data?.username || data?.userName || "";
      };

      const personas: Persona[] = await Promise.all(entries.map(async (entry): Promise<Persona> => {
        const id = String(entry.id).trim();
        const password = (entry.password || sharedPassword || "").trim();
        let name = entry.label || "";
        let avatar = "";
        let identifier = entry.identifier || "";
        let meta = "";
        let error = "";
        try {
          const r = await fetch(`${baseUrl}/users/${id}`, apiOpts());
          if (r.ok) {
            const data: any = await r.json();
            name = name || [data.firstName, data.lastName].filter(Boolean).join(" ") || data.displayName || data.userName || data.username || "";
            avatar = data.avatar?.icon?.url || data.avatar?.thumb?.url || data.avatar?.original?.url || "";
            identifier = identifier || resolveIdentifier(data);
            const position = data.position || data.profile?.position || "";
            meta = identifier || position || "";
          } else {
            error = `User not found (HTTP ${r.status})`;
          }
        } catch {
          error = "Couldn't load this user";
        }
        if (!name) name = identifier || id;
        if (!error && !identifier) error = "No email on file — can't log in";
        if (!error && !password) error = "No password configured";
        return { id, name, identifier, avatar, meta, password, error };
      }));

      // ── Current viewer chip ───────────────────────────────────────────────
      let currentUserId = "";
      try {
        const prof: any = await widgetApi.getUserInformation();
        currentUserId = prof?.id || "";
        let curName = [prof?.firstName, prof?.lastName].filter(Boolean).join(" ") || "";
        let curAvatar = "";
        if (currentUserId) {
          try {
            const r = await fetch(`${baseUrl}/users/${currentUserId}`, apiOpts());
            if (r.ok) {
              const d: any = await r.json();
              curName = curName || [d.firstName, d.lastName].filter(Boolean).join(" ") || d.userName || "";
              curAvatar = d.avatar?.icon?.url || d.avatar?.thumb?.url || d.avatar?.original?.url || "";
            }
          } catch {}
        }
        if (curName) {
          const initials = getInitials(curName);
          currentEl.innerHTML = `
            <span class="${p}-current-av">${curAvatar ? `<img src="${escapeHtml(curAvatar)}" alt="" onerror="this.parentElement.textContent='${initials}'">` : initials}</span>
            <span class="${p}-current-txt">
              <span class="${p}-current-eyebrow">Signed in as</span>
              <span class="${p}-current-name">${escapeHtml(curName)}</span>
            </span>`;
          currentEl.style.display = "flex";
        }
      } catch {}

      // ── Render the persona list ───────────────────────────────────────────
      let introUsed = false;
      function renderList(filter = "") {
        const q = filter.trim().toLowerCase();
        const shown = q
          ? personas.filter(u => u.name.toLowerCase().includes(q) || u.meta.toLowerCase().includes(q))
          : personas;
        if (!shown.length) {
          listEl.classList.remove("intro");
          listEl.innerHTML = `<div class="${p}-empty">No users match “${escapeHtml(filter.trim())}”.</div>`;
          return;
        }
        // Only play the entrance animation once — not on every search keystroke.
        if (!introUsed) { listEl.classList.add("intro"); introUsed = true; }
        else listEl.classList.remove("intro");
        listEl.innerHTML = shown.map(u => {
          const initials = getInitials(u.name);
          const av = u.avatar
            ? `<span class="${p}-av"><img src="${escapeHtml(u.avatar)}" alt="" onerror="this.parentElement.textContent='${initials}'"></span>`
            : `<span class="${p}-av">${initials}</span>`;
          const isCurrent = !!currentUserId && u.id === currentUserId;
          const metaHtml = u.error
            ? `<div class="${p}-meta err">${ICONS.alert}${escapeHtml(u.error)}</div>`
            : (u.meta ? `<div class="${p}-meta">${escapeHtml(u.meta)}</div>` : "");
          const youTag = isCurrent ? `<span class="${p}-you-tag">${ICONS.user}You</span>` : "";
          const btn = isCurrent
            ? `<button class="${p}-login-btn" disabled>${ICONS.check}Current</button>`
            : `<button class="${p}-login-btn" data-id="${escapeHtml(u.id)}"${u.error ? " disabled" : ""}>${ICONS.enter}Log in as</button>`;
          return `<div class="${p}-card${isCurrent ? " is-current" : ""}">
  ${av}
  <div class="${p}-who">
    <div class="${p}-name">${escapeHtml(u.name)}${youTag}</div>
    ${metaHtml}
  </div>
  ${btn}
</div>`;
        }).join("");

        listEl.querySelectorAll(`.${p}-login-btn[data-id]`).forEach(btnEl => {
          btnEl.addEventListener("click", () => {
            const id = (btnEl as HTMLElement).dataset.id!;
            const persona = personas.find(u => u.id === id);
            if (persona) openConfirm(persona, btnEl as HTMLButtonElement);
          });
        });
      }

      // ── Confirm modal ─────────────────────────────────────────────────────
      let pendingPersona: Persona | null = null;
      let pendingBtn: HTMLButtonElement | null = null;

      function openConfirm(persona: Persona, btn: HTMLButtonElement) {
        pendingPersona = persona;
        pendingBtn = btn;
        const initials = getInitials(persona.name);
        modalAv.innerHTML = persona.avatar
          ? `<img src="${escapeHtml(persona.avatar)}" alt="" onerror="this.parentElement.textContent='${initials}'">`
          : initials;
        modalName.textContent = persona.name;
        modal.classList.add("show");
        modalConfirm.focus();
      }

      function closeConfirm() {
        modal.classList.remove("show");
        pendingPersona = null;
        pendingBtn = null;
      }

      modalCancel.addEventListener("click", closeConfirm);
      modal.addEventListener("click", (e) => { if (e.target === modal) closeConfirm(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("show")) closeConfirm(); });
      modalConfirm.addEventListener("click", () => {
        if (!pendingPersona || !pendingBtn) return;
        const persona = pendingPersona, btn = pendingBtn;
        closeConfirm();
        loginAs(persona, btn);
      });

      // ── The actual "log in as" — create a fresh session, then reload ──────
      // Same call replify injects into the Staffbase tab, but here we're already
      // on the page so we POST it directly (same-origin, credentials:include so the
      // new session cookie sticks).
      async function loginAs(persona: Persona, btn: HTMLButtonElement) {
        if (persona.error || !persona.identifier || !persona.password) return;
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="${p}-spin"></span>Signing in…`;
        try {
          const res = await fetch(`${baseUrl}/sessions`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: persona.identifier, secret: persona.password, locale }),
          });
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { const e = await res.json(); msg = e?.message || e?.error || msg; } catch {}
            throw new Error(msg);
          }
          showToast(`Logged in as ${persona.name} — reloading…`, true);
          setTimeout(() => {
            if (redirectUrl) window.location.href = redirectUrl;
            else window.location.reload();
          }, 900);
        } catch (err) {
          showToast(`Couldn't log in as ${persona.name}: ${err instanceof Error ? err.message : String(err)}`, false);
          btn.disabled = false;
          btn.innerHTML = original;
        }
      }

      // Show the search box once the list gets long enough to warrant it.
      if (personas.length > 5) {
        searchWrap.style.display = "block";
        let t: ReturnType<typeof setTimeout> | null = null;
        searchInput.addEventListener("input", () => {
          if (t) clearTimeout(t);
          t = setTimeout(() => renderList(searchInput.value), 120);
        });
      }

      renderList();
    }

    static get observedAttributes() {
      return ["apitoken", "baseurl", "users", "sharedpassword", "redirecturl", "locale", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"];
    }
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configurationSchema: any = {
  properties: {
    apitoken: { type: "string", title: "API Token" },
    baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
    users: {
      type: "string",
      title: "Users (JSON array)",
      default: JSON.stringify(
        [
          { id: "USER_ID_1", password: "PASSWORD_1" },
          { id: "USER_ID_2", password: "PASSWORD_2" },
        ],
        null, 2
      ),
    },
    sharedpassword: { type: "string", title: "Shared Password" },
    redirecturl: { type: "string", title: "Redirect After Login (optional)" },
    locale: { type: "string", title: "Login Locale", default: "en_US" },
    usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
    backgroundcolor: { type: "string", title: "Background Color", default: "" },
  },
  dependencies: {
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
            accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR },
          },
        },
        {
          properties: { usethemecolors: { const: true } },
        },
      ],
    },
  },
};

const uiSchema = {
  apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token, used to read each user's name, avatar & email." },
  baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
  users: {
    "ui:widget": "textarea",
    "ui:help": 'JSON array of users to offer. Each: {"id": required user ID, "password": optional (else uses Shared Password), "identifier": optional login email/username override, "label": optional display-name override}.',
  },
  sharedpassword: { "ui:widget": "password", "ui:help": "Password used for any user that doesn't specify its own (e.g. a shared demo password)." },
  redirecturl: { "ui:help": "Page to open after a successful switch. Leave blank to just reload the current page." },
  locale: { "ui:help": "Locale sent with the login request (default en_US)." },
  usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
  primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
  accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color (used for gradients)" },
  backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
};

const blockDefinition: BlockDefinition = {
  name: "login-as-widget",
  label: "Login As Widget",
  attributes: ["apitoken", "baseurl", "users", "sharedpassword", "redirecturl", "locale", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"],
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  // Brand-red badge with a white "log in" (door-arrow) glyph — shown in the widget
  // picker / settings. Inline data-URI so no extra webpack SVG loader is needed.
  // Source: resources/login-as-widget.svg
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iI0RBMkUzMiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTE1IDNoNGEyIDIgMCAwIDEgMiAydjE0YTIgMiAwIDAgMS0yIDJoLTQiLz48cGF0aCBkPSJNMTAgMTdsNS01LTUtNSIvPjxwYXRoIGQ9Ik0xNSAxMkgzIi8+PC9nPjwvc3ZnPgo=",
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Staffbase",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
