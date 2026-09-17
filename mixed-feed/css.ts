// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet.
//
// Three things here are load-bearing and easy to break:
//
// 1. HOST_RESET — Staffbase's own CSS reaches into widget markup and restyles
//    bare elements. Buttons in particular get a host width/margin/line-height,
//    lists get bullets, headings get margins. Everything is re-declared under
//    the widget's root class with `!important`.
//
//    The :hover/:focus/:active reset carries ONLY background, color, box-shadow
//    and outline. Putting width/margin/border-radius in that block is what makes
//    round buttons snap square the moment they are tapped, because the reset
//    then overrides the component's own geometry on interaction.
//
// 2. FULL_BLEED — inside the Staffbase shell the widget renders in a padded card.
//    On phones that padding wastes ~32px of an already narrow screen, so at
//    <=640px the root breaks out of its container and spans the viewport.
//
// 3. The hero image is the widget's one big gesture. It is sized by aspect-ratio
//    with a min-height floor so it stays generous on every breakpoint, and the
//    headline sits on a gradient scrim over the photo rather than beneath it.
// ─────────────────────────────────────────────────────────────────────────────

import { Brand } from "./types";

export const P = "mfd";

const HOST_RESET = `
.${P}-root button{
  width:auto!important;min-width:0!important;max-width:none!important;margin:0!important;
  border:0!important;font-family:inherit!important;font-size:inherit!important;
  line-height:normal!important;text-transform:none!important;letter-spacing:inherit!important;
  cursor:pointer;-webkit-appearance:none;appearance:none;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  display:inline-flex;align-items:center;justify-content:center}
/* Interaction states restyle paint only. Geometry (width/margin/border-radius)
   is deliberately absent — see the note at the top of this file. */
.${P}-root button:hover,
.${P}-root button:focus,
.${P}-root button:focus-visible,
.${P}-root button:active{
  background:none;color:inherit;box-shadow:none;outline:none!important}
.${P}-root a,.${P}-root a:hover,.${P}-root a:focus,.${P}-root a:active{
  color:inherit!important;text-decoration:none!important;background:none!important}
.${P}-root ol,.${P}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${P}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${P}-root h1,.${P}-root h2,.${P}-root h3,.${P}-root h4,.${P}-root h5,.${P}-root h6,
.${P}-root p,.${P}-root figure{margin:0!important;padding:0!important;font-family:inherit!important}
/* Scoped to host-authored images only. An unqualified ".${P}-root img" rule
   outranks our own single-class media rules (0,1,1 vs 0,1,0), so "height:auto"
   would silently beat "height:100%" and every cover image would size to its
   intrinsic ratio instead of filling its frame. Our images all carry a
   prefixed class; rich-text images from the host carry none. */
.${P}-root img:not([class*="${P}-"]){max-width:100%!important;height:auto;display:block}
.${P}-root input,.${P}-root textarea{
  font-family:inherit!important;font-size:16px;width:100%!important;margin:0!important;
  -webkit-appearance:none;appearance:none;box-sizing:border-box}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:border-box}
`;

/* Break out of the host's padded card and span the viewport.
   The negative margins come from `--bleed-l/r`, which the widget measures at
   runtime from the root's real distance to each viewport edge. A fixed
   `calc(50% - 50vw)` is the fallback, but it is only correct when no ancestor
   clips: overshoot the container and any `overflow:hidden` parent shears the
   overhang off, cutting the first character of every line. Measuring means the
   breakout lands exactly on the viewport edge and never exceeds it. */
const FULL_BLEED = `
@media (max-width:640px){
  .${P}-root.${P}-bleed{
    margin-left:var(--bleed-l,calc(50% - 50vw))!important;
    margin-right:var(--bleed-r,calc(50% - 50vw))!important;
    padding-left:env(safe-area-inset-left);
    padding-right:env(safe-area-inset-right);
    max-width:100vw}
  /* Square off and butt the big surfaces against the screen edges — a rounded
     card floating in a 0px gutter looks like a mistake. */
  .${P}-root.${P}-bleed .${P}-hero,
  .${P}-root.${P}-bleed .${P}-card{
    border-radius:0!important;border-left:0!important;border-right:0!important}
  .${P}-root.${P}-bleed .${P}-bar,
  .${P}-root.${P}-bleed .${P}-compose,
  .${P}-root.${P}-bleed .${P}-head{margin-inline:16px;width:auto}
}
`;

export function buildCss(brand: Brand, background: string, rtl: boolean): string {
  const dirStart = rtl ? "right" : "left";
  return `
${HOST_RESET}

.${P}-root{
  --c:${brand.color};
  --c-rgb:${brand.colorRgb};
  --on-c:${brand.onColor};
  --r:${brand.radius};
  /* Smaller radii read better on small chrome than the card radius does, but a
     brand that asks for square corners must stay square, so they clamp. */
  --r-sm:min(8px, ${brand.radius});
  --r-pill:min(999px, max(${brand.radius}, 8px));
  --ink:#14171a;
  --ink-2:#5b6472;
  --ink-3:#8b95a3;
  --line:#e6e9ee;
  --surface:#ffffff;
  --surface-2:#f6f7f9;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
  color:var(--ink);
  background:${background || "transparent"};
  -webkit-font-smoothing:antialiased;
  display:block}

/* ── Header ───────────────────────────────────────────────────────────── */
.${P}-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.${P}-title{font-size:19px;font-weight:750;letter-spacing:-.015em;line-height:1.2}
.${P}-refresh{
  margin-inline-start:auto!important;width:34px!important;height:34px;flex:0 0 34px;
  border-radius:var(--r-pill);color:var(--ink-3);background:transparent;transition:color .15s,background .15s}
.${P}-refresh:hover,.${P}-refresh:focus{color:var(--c)!important;background:rgba(var(--c-rgb),.08)!important}
.${P}-refresh.${P}-busy{animation:${P}-spin .8s linear infinite}

/* ── Hero (pinned post) ───────────────────────────────────────────────── */
/* The hero is an <a>, so it is hit by the link reset above — its background has
   to be re-declared with !important or the gradient behind the photo is dropped
   and a failed image leaves a blank white slab. */
.${P}-hero{
  position:relative;display:block;width:100%;
  aspect-ratio:16/9;min-height:320px;max-height:480px;
  border-radius:var(--r);overflow:hidden;margin-bottom:18px;
  background:linear-gradient(135deg,rgba(var(--c-rgb),.95),rgba(var(--c-rgb),.62))!important;
  box-shadow:0 12px 32px rgba(16,22,34,.13),0 2px 6px rgba(16,22,34,.06);
  isolation:isolate;cursor:pointer;-webkit-tap-highlight-color:transparent}
.${P}-hero-img{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  transform:scale(1.01);transition:transform .7s cubic-bezier(.22,.61,.36,1)}
@media (hover:hover){.${P}-hero:hover .${P}-hero-img{transform:scale(1.05)}}
/* Two stops rather than one: a soft wash over the whole frame keeps the pinned
   chip legible on a bright sky, and a steep foot anchors the headline. */
.${P}-hero-scrim{
  position:absolute;inset:0;
  background:
    linear-gradient(180deg,rgba(8,11,16,.42) 0%,rgba(8,11,16,0) 42%),
    linear-gradient(180deg,rgba(8,11,16,0) 38%,rgba(8,11,16,.62) 72%,rgba(8,11,16,.92) 100%)}
.${P}-hero-body{
  position:absolute;inset-inline:0;bottom:0;padding:28px 28px 26px;
  display:flex;flex-direction:column;gap:10px;color:#fff}
.${P}-hero-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.${P}-hero-title{
  font-size:clamp(21px,2.4vw,30px);font-weight:780;line-height:1.18;letter-spacing:-.02em;
  color:#fff!important;text-shadow:0 1px 14px rgba(0,0,0,.35);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${P}-hero-teaser{
  font-size:14.5px;line-height:1.5;color:rgba(255,255,255,.88)!important;max-width:62ch;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.${P}-hero-cta{
  display:inline-flex;align-items:center;gap:7px;align-self:flex-start;margin-top:4px;
  font-size:13.5px;font-weight:700;color:#fff}
.${P}-hero-cta svg{transition:transform .2s}
@media (hover:hover){.${P}-hero:hover .${P}-hero-cta svg{transform:translateX(3px)}}
.${P}-hero[dir="rtl"] .${P}-hero-cta svg,[dir="rtl"] .${P}-hero-cta svg{transform:scaleX(-1)}

.${P}-pin{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:var(--r-pill);
  font-size:11px;font-weight:750;letter-spacing:.03em;text-transform:uppercase;
  background:var(--c);color:var(--on-c)}
.${P}-pin svg{width:13px;height:13px}
.${P}-hero-chip{
  padding:4px 10px;border-radius:var(--r-pill);font-size:11.5px;font-weight:650;
  background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(6px)}
.${P}-hero-date{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.8)}

/* ── Filter bar ───────────────────────────────────────────────────────── */
.${P}-bar{
  display:flex;align-items:center;gap:8px;margin-bottom:16px;
  overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.${P}-bar::-webkit-scrollbar{display:none}
.${P}-chip{
  flex:0 0 auto;height:34px;padding:0 15px!important;border-radius:var(--r-pill);
  font-size:13.5px;font-weight:650;white-space:nowrap;
  background:var(--surface-2);color:var(--ink-2);
  border:1px solid transparent!important;
  transition:background .15s,color .15s,border-color .15s}
.${P}-chip:hover,.${P}-chip:focus{background:rgba(var(--c-rgb),.09)!important;color:var(--c)!important}
.${P}-chip.${P}-on,
.${P}-chip.${P}-on:hover,
.${P}-chip.${P}-on:focus,
.${P}-chip.${P}-on:active{background:var(--c)!important;color:var(--on-c)!important}
.${P}-chip-n{
  margin-inline-start:7px;font-size:11.5px;font-weight:700;opacity:.62;font-variant-numeric:tabular-nums}

/* ── Composer ─────────────────────────────────────────────────────────── */
.${P}-compose{
  display:flex;align-items:center;gap:11px;width:100%;
  padding:11px 14px!important;margin-bottom:16px;
  border-radius:var(--r);background:var(--surface);
  border:1px solid var(--line)!important;
  text-align:start;justify-content:flex-start!important;
  transition:border-color .15s,box-shadow .15s}
.${P}-compose:hover,.${P}-compose:focus{background:var(--surface)!important;border-color:rgba(var(--c-rgb),.45)!important;box-shadow:0 2px 10px rgba(16,22,34,.06)!important}
.${P}-compose-ph{font-size:14.5px;color:var(--ink-3);font-weight:500}

/* ── Grid ─────────────────────────────────────────────────────────────── */
.${P}-grid{
  display:grid;gap:16px;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
@media (min-width:1080px){.${P}-grid{grid-template-columns:repeat(3,1fr)}}
@media (max-width:900px){.${P}-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.${P}-grid{grid-template-columns:1fr;gap:12px}}

.${P}-card{
  display:flex;flex-direction:column;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--r);
  overflow:hidden;position:relative;
  transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
@media (hover:hover){
  .${P}-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(16,22,34,.10);border-color:rgba(var(--c-rgb),.3)}
}
.${P}-card:focus-within{border-color:var(--c);box-shadow:0 0 0 3px rgba(var(--c-rgb),.16)}

/* The whole card is clickable via a stretched overlay link, so the social
   buttons can still sit on top and take their own taps. */
.${P}-stretch{position:absolute;inset:0;z-index:1}
.${P}-card-body{padding:14px 16px 12px;display:flex;flex-direction:column;gap:8px;flex:1}
.${P}-card-media{
  width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--surface-2);
  transition:transform .4s cubic-bezier(.22,.61,.36,1)}
@media (hover:hover){.${P}-card:hover .${P}-card-media{transform:scale(1.03)}}
.${P}-card-media-wrap{overflow:hidden;position:relative}

.${P}-chan{
  display:inline-flex;align-items:center;align-self:flex-start;
  padding:3px 9px;border-radius:var(--r-pill);
  font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  background:rgba(var(--c-rgb),.1);color:var(--c)}
.${P}-card-title{
  font-size:15.5px;font-weight:700;line-height:1.32;letter-spacing:-.01em;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${P}-card-text{
  font-size:13.5px;line-height:1.55;color:var(--ink-2);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${P}-card-date{font-size:11.5px;font-weight:600;color:var(--ink-3);margin-top:auto;padding-top:2px}

/* Social variant: the person leads, so the byline sits at the top and the
   headline is dropped entirely (Staffbase stores the whole body in "title"). */
.${P}-byline{display:flex;align-items:center;gap:9px}
/* Grid rows stretch every card to the tallest in the row. With the photo last,
   a stretching body would open a white gap between the text and the image, so
   the body stays its natural height and the photo absorbs the slack instead. */
.${P}-card[data-kind="social"] .${P}-card-body{flex:0 0 auto}
.${P}-card[data-kind="social"] .${P}-card-media-wrap{flex:1 1 auto;min-height:180px;display:flex}
.${P}-card[data-kind="social"] .${P}-card-media{aspect-ratio:auto;height:100%;min-height:180px}
.${P}-av{
  width:34px;height:34px;flex:0 0 34px;border-radius:50%;object-fit:cover;
  background:var(--surface-2)}
.${P}-av-fb{
  display:flex;align-items:center;justify-content:center;
  font-size:12.5px;font-weight:700;color:var(--on-c);background:var(--c);text-transform:uppercase}
/* Nameless viewer: a muted neutral disc, so the composer does not shout in the
   brand colour before we even know who is looking at it. */
.${P}-av-anon{
  background:var(--surface-2);color:var(--ink-3);
  box-shadow:inset 0 0 0 1px var(--line)}
.${P}-byline-t{display:flex;flex-direction:column;min-width:0;gap:1px}
.${P}-byline-n{font-size:13.5px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.${P}-byline-d{font-size:11.5px;font-weight:550;color:var(--ink-3);line-height:1.25}

/* ── Social actions ───────────────────────────────────────────────────── */
.${P}-acts{
  display:flex;align-items:center;gap:4px;position:relative;z-index:2;
  padding:6px 10px 8px;border-top:1px solid var(--line);margin-top:2px}
.${P}-act{
  gap:6px;height:32px;padding:0 10px!important;border-radius:var(--r-pill);
  font-size:12.5px;font-weight:650;color:var(--ink-2);background:transparent;
  transition:background .15s,color .15s}
.${P}-act:hover,.${P}-act:focus{background:var(--surface-2)!important;color:var(--ink)!important}
.${P}-act.${P}-on,
.${P}-act.${P}-on:hover,
.${P}-act.${P}-on:focus,
.${P}-act.${P}-on:active{color:var(--c)!important;background:rgba(var(--c-rgb),.1)!important}
.${P}-act-n{font-variant-numeric:tabular-nums}
.${P}-act svg{flex:0 0 auto}
@keyframes ${P}-pop{0%{transform:scale(1)}45%{transform:scale(1.32)}100%{transform:scale(1)}}
.${P}-act.${P}-pop svg{animation:${P}-pop .32s ease}

/* ── States ───────────────────────────────────────────────────────────── */
.${P}-state{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  padding:52px 20px;text-align:center;
  border:1px dashed var(--line);border-radius:var(--r);color:var(--ink-3);font-size:14px}
.${P}-btn{
  height:36px;padding:0 16px!important;border-radius:var(--r-pill);
  font-size:13.5px;font-weight:700;background:var(--c);color:var(--on-c);
  box-shadow:0 3px 10px rgba(var(--c-rgb),.28)}
.${P}-btn:hover,.${P}-btn:focus,.${P}-btn:active{background:var(--c)!important;color:var(--on-c)!important;filter:brightness(1.07)}
.${P}-btn[disabled]{opacity:.5;cursor:default;filter:none;box-shadow:none}
@keyframes ${P}-spin{to{transform:rotate(360deg)}}
.${P}-spin{
  width:18px;height:18px;border-radius:50%;
  border:2px solid rgba(var(--c-rgb),.22);border-top-color:var(--c);
  animation:${P}-spin .7s linear infinite}
.${P}-skel{
  border-radius:var(--r);background:var(--surface-2);height:230px;
  animation:${P}-pulse 1.4s ease-in-out infinite}
@keyframes ${P}-pulse{0%,100%{opacity:1}50%{opacity:.55}}

/* ── Sheet (comments + composer) ──────────────────────────────────────── */
.${P}-scrim{
  position:fixed;inset:0;z-index:100000;background:rgba(10,14,20,.5);
  opacity:0;pointer-events:none;transition:opacity .28s ease}
.${P}-scrim.${P}-open{opacity:1;pointer-events:auto}
.${P}-sheet{
  position:fixed;inset-inline:0;bottom:0;z-index:100001;
  display:flex;flex-direction:column;max-height:88vh;
  background:var(--surface);border-radius:20px 20px 0 0;
  transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);
  box-shadow:0 -8px 40px rgba(0,0,0,.18);
  padding-bottom:env(safe-area-inset-bottom);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--ink)}
.${P}-sheet.${P}-open{transform:translateY(0)}
@media (min-width:720px){
  .${P}-sheet{
    inset:auto 50% 50%;transform:translate(50%,calc(50% + 20px)) scale(.97);
    width:min(560px,92vw);border-radius:18px;max-height:82vh;opacity:0}
  .${P}-sheet.${P}-open{transform:translate(50%,50%) scale(1);opacity:1}
}
.${P}-sheet-head{
  display:flex;align-items:center;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--line)}
.${P}-sheet-title{font-size:16px;font-weight:750;letter-spacing:-.01em}
.${P}-sheet-x{
  margin-inline-start:auto!important;width:32px!important;height:32px;flex:0 0 32px;
  border-radius:var(--r-pill);color:var(--ink-3);background:transparent}
.${P}-sheet-x:hover,.${P}-sheet-x:focus{background:var(--surface-2)!important;color:var(--ink)!important}
.${P}-sheet-body{
  padding:14px 18px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.${P}-sheet-foot{
  display:flex;align-items:flex-end;gap:9px;padding:12px 18px 14px;border-top:1px solid var(--line)}
.${P}-in{
  flex:1;min-height:40px;max-height:140px;resize:none;
  padding:10px 13px;border-radius:var(--r);
  border:1px solid var(--line)!important;background:var(--surface-2);
  font-size:15px;line-height:1.45;color:var(--ink);outline:none}
.${P}-in:focus{border-color:var(--c)!important;background:var(--surface);box-shadow:0 0 0 3px rgba(var(--c-rgb),.14)}
.${P}-send{
  width:40px!important;height:40px;flex:0 0 40px;border-radius:var(--r-pill);
  background:var(--c);color:var(--on-c)}
.${P}-send:hover,.${P}-send:focus,.${P}-send:active{background:var(--c)!important;color:var(--on-c)!important;filter:brightness(1.07)}
.${P}-send[disabled]{opacity:.42;cursor:default;filter:none}

.${P}-cmt{display:flex;gap:10px;padding:9px 0}
.${P}-cmt+.${P}-cmt{border-top:1px solid var(--line)}
.${P}-cmt-b{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.${P}-cmt-n{font-size:13px;font-weight:700}
.${P}-cmt-x{font-size:13.5px;line-height:1.5;color:var(--ink-2);word-break:break-word}
.${P}-cmt-x p{margin:0!important}
.${P}-cmt-d{font-size:11px;font-weight:600;color:var(--ink-3)}
.${P}-cmt-empty{padding:26px 4px;text-align:center;color:var(--ink-3);font-size:13.5px}
.${P}-err{
  margin-top:10px;padding:9px 12px;border-radius:var(--r-sm);
  background:#fdecee;color:#9f1f32;font-size:13px;font-weight:600}

/* ── Compact / phone ──────────────────────────────────────────────────── */
@media (max-width:640px){
  .${P}-hero{aspect-ratio:4/3;min-height:300px;max-height:420px;margin-bottom:14px}
  .${P}-hero-body{padding:20px 18px 18px;gap:8px}
  .${P}-head{margin-bottom:12px}
  .${P}-title{font-size:17.5px}
  .${P}-card-body{padding:13px 15px 11px}
}

@media (prefers-reduced-motion:reduce){
  .${P}-root *,.${P}-sheet,.${P}-scrim{
    animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important}
}

${FULL_BLEED}
`;
}
