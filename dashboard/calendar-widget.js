/**
 * Staffbase external block: a glass-morphism calendar. Dashboard variant of
 * gabriellebenak-arch/staffbase-dashboard-demo (ee43a892).
 *
 * Plain JS on purpose — the birthday widget's TypeScript/webpack setup only
 * ever uses the SDK for types, and the one thing the host actually needs at
 * runtime is window.defineBlock. Skipping the build keeps this to a single
 * file that can be hosted anywhere and edited in place.
 */
(function () {
  var P = "sbcal";

  var DEFAULT_EVENTS = [
    "+1 | Team standup | 9:00 - 9:15 AM",
    "+3 | 1:1 with your manager | 2:00 - 2:30 PM",
    "+8 | Benefits enrollment closes | All day",
    "+14 | Company all-hands | 11:00 AM - 12:00 PM",
    "+22 | Q4 review submissions due | All day"
  ].join("\n");

  var COPY = {
    en: ["Up next", "Nothing scheduled.", "Previous month", "Next month"],
    de: ["Als Nächstes", "Keine Termine.", "Vorheriger Monat", "Nächster Monat"],
    es: ["Próximamente", "No hay eventos.", "Mes anterior", "Mes siguiente"],
    fr: ["À venir", "Aucun événement.", "Mois précédent", "Mois suivant"],
    nl: ["Binnenkort", "Geen afspraken.", "Vorige maand", "Volgende maand"]
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  /**
   * One event per line: "<when> | <title> | <time>".
   * `when` is either an absolute YYYY-MM-DD or an offset like +3 / -2 from
   * today. Offsets are what keep a demo environment from going stale: the
   * defaults stay plausible however long the page sits unopened.
   */
  function parseEvents(raw) {
    return String(raw || "").split(/[\n;]+/).map(function (line) {
      var bits = line.split("|").map(function (s) { return s.trim(); });
      if (!bits[0] || !bits[1]) return null;
      var key;
      if (/^[+-]?\d+$/.test(bits[0])) {
        var d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + parseInt(bits[0], 10));
        key = ymd(d);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(bits[0])) {
        key = bits[0];
      } else {
        return null;
      }
      return { date: key, title: bits[1], time: bits[2] || "" };
    }).filter(Boolean).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function prettyDay(key, locale) {
    var p = key.split("-");
    return { d: parseInt(p[2], 10), mon: new Intl.DateTimeFormat(locale, { month: "short" })
      .format(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))) };
  }

  var CSS = [
    "." + P + "-wrap{container-type:inline-size;min-width:0}",
    "." + P + "-root{--rim:rgba(255,255,255,.62);--ink:var(--rp-dashboard-ink,#2b2f33);--mute:var(--rp-dashboard-muted,#5c6660);",
    "--accent:var(--rp-dashboard-accent,var(--sbcal-config-accent,#2f5d4a));",
    "--line:rgba(120,128,138,.18);font-family:inherit;color:var(--ink);",
    "display:grid;grid-template-columns:1.25fr 1fr;gap:16px;padding:16px;border-radius:20px;",
    "background:linear-gradient(150deg,rgba(255,255,255,.36),rgba(255,255,255,.17));"
    + "-webkit-backdrop-filter:blur(34px) saturate(200%);",
    "backdrop-filter:blur(34px) saturate(200%);border:1px solid var(--rim);"
    + "text-shadow:0 1px 1px rgba(255,255,255,.5);",
    "box-shadow:0 8px 26px rgba(31,38,48,.10),inset 0 1px 0 rgba(255,255,255,.8),"
    + "inset 0 -1px 0 rgba(255,255,255,.22)}",
    "." + P + "-root *{box-sizing:border-box}",
    "." + P + "-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}",
    "." + P + "-mo{font-size:14px;font-weight:650;letter-spacing:.01em}",
    "." + P + "-nav{display:flex;gap:6px}",
    "." + P + "-nav button{display:grid;place-items:center;min-width:36px;width:36px;min-height:36px;height:36px;margin:0;padding:0;border-radius:8px;border:1px solid var(--line);",
    "background:rgba(255,255,255,.45);color:var(--mute);font-size:13px;line-height:1;cursor:pointer;",
    "transition:background .15s,color .15s}",
    "." + P + "-nav button:hover{background:#fff;color:var(--ink)}",
    "." + P + "-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}",
    "." + P + "-dow{font-size:11px;font-weight:600;color:var(--mute);text-align:center;",
    "padding:1px 0 3px;letter-spacing:.04em;text-transform:uppercase}",
    "." + P + "-d{min-width:0;width:100%;min-height:36px;margin:0;padding:0;display:flex;align-items:center;justify-content:center;",
    "font-size:12px;border-radius:9px;position:relative;border:0;background:transparent;",
    "color:inherit;font-family:inherit;cursor:pointer;transition:background .15s}",
    "." + P + "-d:hover{background:rgba(255,255,255,.6)}",
    "." + P + "-d.pad{visibility:hidden;cursor:default}",
    "." + P + "-d.ev::after{content:'';position:absolute;bottom:5px;width:4px;height:4px;",
    "border-radius:50%;background:var(--accent)}",
    "." + P + "-d.today{background:var(--accent);color:var(--rp-dashboard-on-accent,var(--sbcal-on-accent,#fff));font-weight:650}",
    "." + P + "-d.today::after{background:currentColor}",
    "." + P + "-d.sel{box-shadow:inset 0 0 0 2px var(--accent)}",
    "." + P + "-side{border-left:1px solid var(--line);padding-left:16px;min-width:0}",
    "." + P + "-sh{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 8px}",
    "." + P + "-sh h3{margin:0;font-size:14px;font-weight:650}",
    "." + P + "-back{border:0;background:transparent;width:auto;min-height:36px;margin:0;padding:0;font-family:inherit;",
    "font-size:12px;color:var(--rp-dashboard-accent-ink,var(--accent));cursor:pointer}",
    "." + P + "-ev{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--line)}",
    "." + P + "-ev:last-child{border-bottom:0}",
    "." + P + "-dt{flex:none;width:38px;text-align:center;border-radius:9px;padding:4px 0;",
    "background:rgba(255,255,255,.5);border:1px solid var(--line)}",
    "." + P + "-dt b{display:block;font-size:14px;line-height:1.1;font-weight:650}",
    "." + P + "-dt span{font-size:10px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}",
    "." + P + "-tx{min-width:0}",
    "." + P + "-tx b{display:block;font-size:13px;font-weight:600;line-height:1.3}",
    "." + P + "-tx span{font-size:12px;color:var(--mute)}",
    "." + P + "-empty{font-size:13px;color:var(--mute);margin:10px 0 0}",
    "." + P + "-root button:focus-visible{outline:2px solid var(--rp-dashboard-accent-ink,var(--accent));outline-offset:2px}",
    "." + P + "-root svg{width:16px;height:16px}",
    "@container(max-width:720px){." + P + "-root{grid-template-columns:1fr;padding:16px}",
    "." + P + "-nav button{min-width:44px;width:44px;min-height:44px;height:44px}",
    "." + P + "-side{border-left:0;border-top:1px solid var(--line);padding-left:0;padding-top:14px}}"
  ].join("");

  var ATTRS = ["widgettitle", "events", "accent", "locale"];

  var configurationSchema = {
    properties: {
      widgettitle: { type: "string", title: "Side panel heading", default: "Up next" },
      accent:      { type: "string", title: "Accent colour (hex)", default: "#2d6cdf" },
      events:      { type: "string", title: "Events", default: DEFAULT_EVENTS },
      locale:      { type: "string", title: "Language", default: "en-US" }
    }
  };

  var uiSchema = {
    events: {
      "ui:widget": "textarea",
      "ui:help": "One per line:  when | title | time.  'when' is a date (2026-11-17) or an offset from today (+3)."
    },
    accent: { "ui:help": "Used for today's highlight and the event dots." }
  };

  var factory = function (BaseBlockClass) {
    return class CalendarWidget extends BaseBlockClass {
      renderBlock(container) {
        var now = new Date();
        this._today = ymd(now);
        if (this._vy == null) { this._vy = now.getFullYear(); this._vm = now.getMonth(); }
        this._events = parseEvents(this.getAttribute("events") || DEFAULT_EVENTS);
        var locale = (this.getAttribute("locale") || navigator.language || "en-US").replace(/_/g, "-");
        if (!/^(en|de|es|fr|nl)(-[a-z]{2})?$/i.test(locale)) {
          console.warn("[Dashboard Calendar] Unsupported language; using English.");
          locale = "en-US";
        }
        this._locale = locale;
        this._copy = COPY[locale.slice(0, 2).toLowerCase()];
        var accent = this.getAttribute("accent") || "#2f5d4a";
        if (!/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(accent)) {
          console.warn("[Dashboard Calendar] Invalid accent; using the default.");
          accent = "#2f5d4a";
        }
        this._accent = accent;
        var hex = accent.slice(1);
        if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
        var light = hex.match(/../g).map(function (c) {
          var value = parseInt(c, 16) / 255;
          return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        }).reduce(function (sum, c, i) { return sum + c * [0.2126, 0.7152, 0.0722][i]; }, 0);
        this._onAccent = light > 0.179 ? "#000" : "#fff";
        this._title = this.getAttribute("widgettitle") || this._copy[0];
        this._container = container;
        this._draw();
      }

      _draw() {
        var self = this, y = this._vy, m = this._vm;
        // Monday-first: JS weeks start on Sunday, so rotate by one.
        var lead = (new Date(y, m, 1).getDay() + 6) % 7;
        var dim = new Date(y, m + 1, 0).getDate();

        var withEvents = {};
        this._events.forEach(function (e) { withEvents[e.date] = true; });

        var cells = "";
        for (var i = 0; i < lead; i++) cells += '<button class="' + P + '-d pad" disabled></button>';
        for (var d = 1; d <= dim; d++) {
          var key = ymd(new Date(y, m, d));
          var cls = P + "-d";
          if (key === this._today) cls += " today";
          if (withEvents[key]) cls += " ev";
          if (key === this._sel) cls += " sel";
          cells += '<button type="button" class="' + cls + '" data-k="' + key +
            '" aria-label="' + esc(new Intl.DateTimeFormat(this._locale, { dateStyle: "full" }).format(new Date(y, m, d))) +
            '" aria-pressed="' + (key === this._sel) + '"' +
            (key === this._today ? ' aria-current="date"' : "") + ">" + d + "</button>";
        }

        var list, heading, back = "";
        if (this._sel) {
          list = this._events.filter(function (e) { return e.date === self._sel; });
          var pd = prettyDay(this._sel, this._locale);
          heading = pd.mon + " " + pd.d;
          back = '<button type="button" class="' + P + '-back">' + esc(this._copy[0]) + "</button>";
        } else {
          list = this._events.filter(function (e) { return e.date >= self._today; }).slice(0, 5);
          heading = this._title;
        }

        var items = list.length ? list.map(function (e) {
          var pd = prettyDay(e.date, self._locale);
          return '<div class="' + P + '-ev"><div class="' + P + '-dt"><b>' + pd.d +
            "</b><span>" + pd.mon + '</span></div><div class="' + P + '-tx"><b>' +
            esc(e.title) + "</b>" + (e.time ? "<span>" + esc(e.time) + "</span>" : "") + "</div></div>";
        }).join("") : '<p class="' + P + '-empty">' + esc(this._copy[1]) + "</p>";

        this._container.innerHTML = "<style>" + CSS + "</style>" +
          '<div class="' + P + '-wrap">' +
          '<div class="' + P + '-root" style="--sbcal-config-accent:' + this._accent + ";--sbcal-on-accent:" + this._onAccent + '">' +
            "<div>" +
              '<div class="' + P + '-hd"><div class="' + P + '-mo">' +
                esc(new Intl.DateTimeFormat(this._locale, { month: "long", year: "numeric" }).format(new Date(y, m, 1))) + "</div>" +
                '<div class="' + P + '-nav">' +
                  '<button type="button" data-step="-1" aria-label="' + esc(this._copy[2]) + '"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg></button>' +
                  '<button type="button" data-step="1" aria-label="' + esc(this._copy[3]) + '"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></button>' +
                "</div></div>" +
              '<div class="' + P + '-grid">' + Array.from({ length: 7 }, function (_, index) {
                return '<div class="' + P + '-dow">' + esc(new Intl.DateTimeFormat(self._locale, { weekday: "short" })
                  .format(new Date(2026, 0, 5 + index))) + "</div>";
              }).join("") + "</div>" +
              '<div class="' + P + '-grid" style="margin-top:3px">' + cells + "</div>" +
            "</div>" +
            '<div class="' + P + '-side"><div class="' + P + '-sh"><h3>' + esc(heading) + "</h3>" +
              back + "</div>" + items + "</div>" +
          "</div></div>";

        this._container.querySelectorAll("[data-step]").forEach(function (b) {
          b.addEventListener("click", function () {
            self._vm += parseInt(b.getAttribute("data-step"), 10);
            if (self._vm < 0) { self._vm = 11; self._vy--; }
            if (self._vm > 11) { self._vm = 0; self._vy++; }
            self._draw();
          });
        });
        this._container.querySelectorAll("[data-k]").forEach(function (b) {
          b.addEventListener("click", function () {
            var k = b.getAttribute("data-k");
            self._sel = (self._sel === k) ? null : k;
            self._draw();
          });
        });
        var backBtn = this._container.querySelector("." + P + "-back");
        if (backBtn) backBtn.addEventListener("click", function () { self._sel = null; self._draw(); });
      }

      static get observedAttributes() { return ATTRS; }
    };
  };

  window.defineBlock({
    blockDefinition: {
      name: "replify-dashboard-calendar",
      label: "Calendar",
      attributes: ATTRS,
      factory: factory,
      configurationSchema: configurationSchema,
      uiSchema: uiSchema,
      blockLevel: "block",
      iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%232d6cdf'/%3E%3Cg fill='%23fff'%3E%3Crect x='8' y='11' width='24' height='21' rx='3'/%3E%3C/g%3E%3Cg fill='%232d6cdf'%3E%3Crect x='8' y='11' width='24' height='6' rx='3'/%3E%3Crect x='12' y='21' width='4' height='4' rx='1'/%3E%3Crect x='18' y='21' width='4' height='4' rx='1'/%3E%3Crect x='24' y='21' width='4' height='4' rx='1'/%3E%3C/g%3E%3Cg fill='%23fff'%3E%3Crect x='13' y='7' width='2' height='6' rx='1'/%3E%3Crect x='25' y='7' width='2' height='6' rx='1'/%3E%3C/g%3E%3C/svg%3E"
    },
    author: "Staffbase",
    version: "1.0.0"
  });
})();
