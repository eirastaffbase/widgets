/* ============================================================================
   frontier-nav-multibrand.js   (v1.1)
   ----------------------------------------------------------------------------
   Multibrands the NEW (c13y) nav for the Frontier Communications group on
   verizon-demo. The nav shell sits OUTSIDE the content iframe and gets no
   `.group-<id>` class; the content iframe DOES carry the group classes. So:
     1. hide the nav logo immediately (avoid a wrong-logo flash),
     2. read group classes from ANY same-origin doc (self / top / top's iframes),
     3. in the Frontier group -> full Frontier nav branding, else -> reveal original.

   All nav work targets window.top.document (where the nav lives), so it works
   whether it's injected in the shell OR inside the content iframe.

   Frontier nav branding (overrides ALL the default Block B nav CSS):
     logo -> Frontier rebrand SVG · nav bar + border -> #ED0037 · labels/icons -> white.
     Standard font, standard radius — left untouched on purpose.

   IMPORTANT (same lesson learned on the Hill's build): the nav bar's
   background/text/border are driven by Tailwind utility classes tied to CSS
   vars (bg-nav-appintranet, bg-menu-appintranet, text-nav-appintranet,
   text-menu-appintranet, border-nav-appintranet, border-menu-appintranet —
   this also covers the "-accent" variants of each, e.g. bg-nav-appintranet-accent,
   since they contain the same substring). Fighting that with
   [data-c13y-region="header"] specificity stacking wins on some properties
   (border) but silently loses on others (background), leaving white boxes
   (the menu pill container, the search icon button) with white-on-white
   text/icons. [class*="..."] substring selectors targeting the actual
   utility classes are what reliably win — that's the technique carried over
   from the Hill's script's accent-badge rule, just applied to the base nav/
   menu classes too since Frontier needs a full color fill, not just an accent.

   It logs its version to the console so you can confirm which build is live.
   ============================================================================ */
(function () {
  "use strict";

  var VERSION = "1.1";

  // ---- CONFIG --------------------------------------------------------------
  var GROUP_ID = "6a210a560c7df97c6070a2cd"; // Frontier Communications group
  var LOGO_URL = "https://tundra.frontier.redventures.io/migration/site-logo-rebrand.svg";
  var ACCENT   = "#ED0037";  // nav bar background fill
  var BORDER   = "#ED0037";  // nav bar border
  var TEXT     = "#ffffff";  // nav labels + icons
  // --------------------------------------------------------------------------

  var STYLE_ID  = "replify-frontier-nav";
  var REVEAL_ID = "replify-nav-reveal";   /* Block B hides the nav; this rule reveals it */
  var GROUP_RE  = /group-[a-f0-9]{16,}/;

  var H = '[data-c13y-region="header"]';
  var LOGO_SEL = H + ' [data-c13y-component="image"][data-c13y-purpose="logo"]';

  // The document that actually contains the nav (the app shell / top frame).
  var TOP; try { TOP = window.top.document; } catch (e) { TOP = document; }

  function addStyle(id, css) {
    if (TOP.getElementById(id)) return TOP.getElementById(id);
    var s = TOP.createElement("style");
    s.id = id; s.textContent = css;
    (TOP.head || TOP.documentElement).appendChild(s);
    return s;
  }

  // The nav is hidden by Block B CSS ([data-c13y-region="header"]{display:none}).
  // Inject a later same-selector rule to reveal it (wins by source order). No flash.
  function reveal() { addStyle(REVEAL_ID, H + "{display:flex !important;}"); }

  // Read group classes from any same-origin document we can reach.
  function groupClasses() {
    var docs = [document];
    if (TOP !== document) docs.push(TOP);
    try {
      [].forEach.call(TOP.querySelectorAll("iframe"), function (f) {
        try { if (f.contentDocument) docs.push(f.contentDocument); } catch (e) {}
      });
    } catch (e) {}
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i]; if (!d || !d.documentElement) continue;
      var cls = (d.documentElement.className || "") + " " + (d.body ? d.body.className : "");
      if (GROUP_RE.test(cls)) return cls;
    }
    return null;
  }

  function applyBranding() {
    if (TOP.getElementById(STYLE_ID)) return;
    var border =
      "border-color:" + BORDER + " !important;" +
      "border-top-color:" + BORDER + " !important;border-right-color:" + BORDER + " !important;" +
      "border-bottom-color:" + BORDER + " !important;border-left-color:" + BORDER + " !important;";
    var css =
      LOGO_SEL + "{" +
        'content:url("' + LOGO_URL + '") !important;' +
        "width:120px !important;height:40px !important;" +
        "object-fit:contain !important;object-position:left center !important;" +
        "visibility:visible !important;}" +
      H + H + H + "{" + border + "}" +
      '[class*="border-nav-appintranet"],[class*="border-menu-appintranet"]{border-color:' + BORDER + " !important;}" +
      '[class*="bg-nav-appintranet"],[class*="bg-menu-appintranet"]{background-color:' + ACCENT + " !important;}" +
      '[class*="text-nav-appintranet"],[class*="text-menu-appintranet"]{color:' + TEXT + " !important;}" +
      H + ' [data-c13y-component="icon"]{color:' + TEXT + " !important;fill:" + TEXT + " !important;}" +
      H + ' [data-c13y-component="title"]{color:' + TEXT + " !important;}";
    addStyle(STYLE_ID, css);
    console.log("[replify frontier-nav v" + VERSION + "] Frontier branding applied.");
  }

  // Frontier -> brand + reveal; groups known but not Frontier -> reveal; else wait.
  function tick() {
    var cls = groupClasses();
    if (cls === null) return false;
    var inFrontier = cls.indexOf("group-" + GROUP_ID) !== -1;
    if (inFrontier) applyBranding();
    else console.log("[replify frontier-nav v" + VERSION + "] not in Frontier group — nav untouched.");
    reveal();
    return true;
  }

  console.log("[replify frontier-nav v" + VERSION + "] loaded.");
  if (!tick()) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (tick() || tries > 80) {   // ~20s failsafe
        if (tries > 80) reveal();
        clearInterval(iv);
      }
    }, 250);
  }
})();
