// Styles for the group switcher.
//
// Neutrals derive from the inherited `currentColor`, because the widget is dropped
// into a host page whose theme it can't know. A row list, not a card grid: one
// option is live at a time, which is the shape of a workspace switcher.

export function styles(p: string, accent: string, accentFallbackRgb: string): string {
  return `
  .${p}{
    --${p}-accent:${accent};
    --${p}-accent-rgb:${accentFallbackRgb};

    --${p}-line:rgba(17,20,24,.14);
    --${p}-line-strong:rgba(17,20,24,.26);
    --${p}-surface:rgba(17,20,24,.035);
    --${p}-muted:rgba(17,20,24,.62);
    --${p}-tint-soft:rgba(var(--${p}-accent-rgb),.05);

    --${p}-ease:cubic-bezier(.22,1,.36,1);
    --${p}-step:180ms;

    font:inherit;
    color:inherit;
    display:block;
    container-type:inline-size;
  }

  /* Preferred ramp: fractions of the host's own text color. */
  @supports (color:color-mix(in oklab,currentColor 10%,transparent)){
    .${p}{
      --${p}-line:color-mix(in oklab,currentColor 16%,transparent);
      --${p}-line-strong:color-mix(in oklab,currentColor 30%,transparent);
      --${p}-surface:color-mix(in oklab,currentColor 4%,transparent);
      --${p}-muted:color-mix(in oklab,currentColor 68%,transparent);
      --${p}-tint-soft:color-mix(in oklab,var(--${p}-accent) 6%,transparent);
    }
  }

  .${p} *{box-sizing:border-box;}

  .${p}-list{
    display:grid;grid-template-columns:1fr;gap:6px;
    margin:0;padding:0;list-style:none;
  }
  .${p}-list > li{display:flex;}

  /* Wide enough that two rows still read as rows, not as squeezed cards. */
  @container (min-width:720px){
    .${p}-list{grid-template-columns:1fr 1fr;}
  }
  @supports not (container-type:inline-size){
    @media (min-width:900px){.${p}-list{grid-template-columns:1fr 1fr;}}
  }

  .${p}-row{
    display:flex;align-items:center;gap:14px;
    width:100%;min-height:64px;
    padding:12px 14px;margin:0;
    font:inherit;color:inherit;text-align:left;
    background:transparent;
    border:1px solid var(--${p}-line);
    border-radius:10px;
    cursor:pointer;
    transition:
      background-color var(--${p}-step) var(--${p}-ease),
      border-color var(--${p}-step) var(--${p}-ease);
  }
  .${p}-row:hover:not(:disabled){
    background:var(--${p}-surface);
    border-color:var(--${p}-line-strong);
  }
  .${p}-row:active:not(:disabled){background:var(--${p}-tint-soft);}
  .${p}-row:focus-visible{outline:2px solid var(--${p}-accent);outline-offset:2px;}
  .${p}-row[aria-current="true"]{
    background:var(--${p}-tint-soft);
    border-color:var(--${p}-accent);
    cursor:default;
  }
  /* Only the row being switched to keeps full contrast while it works. */
  .${p}-list[data-busy="true"] .${p}-row:not([aria-busy="true"]){opacity:.45;}

  /* The icon tile doubles as the selection indicator, so nothing shifts. */
  .${p}-mark{
    flex:0 0 auto;
    display:flex;align-items:center;justify-content:center;
    width:40px;height:40px;
    border-radius:9px;overflow:hidden;
    background:var(--${p}-surface);
    transition:
      background-color var(--${p}-step) var(--${p}-ease),
      color var(--${p}-step) var(--${p}-ease);
  }
  .${p}-row[aria-current="true"] .${p}-mark{
    background:var(--${p}-accent);
    color:var(--${p}-accent-on);
  }
  .${p}-mark svg{width:19px;height:19px;display:block;}
  .${p}-mark img{width:100%;height:100%;object-fit:cover;display:block;}

  .${p}-text{flex:1 1 auto;min-width:0;}
  .${p}-name{
    display:block;
    font-size:15px;font-weight:600;line-height:1.35;letter-spacing:-.006em;
    overflow-wrap:anywhere;
  }
  .${p}-desc{
    display:block;margin-top:3px;
    font-size:13px;line-height:1.45;
    color:var(--${p}-muted);
    overflow-wrap:anywhere;
  }

  .${p}-cue{
    flex:0 0 auto;
    display:flex;align-items:center;gap:5px;
    font-size:13px;font-weight:600;
    color:var(--${p}-muted);
  }
  .${p}-row[aria-current="true"] .${p}-cue{color:var(--${p}-accent);}
  .${p}-cue svg{width:15px;height:15px;}
  /* Hover reveals the action rather than repeating "Switch" down the list. */
  .${p}-cue-go{
    opacity:0;transform:translateX(-3px);
    transition:opacity var(--${p}-step) var(--${p}-ease),
               transform var(--${p}-step) var(--${p}-ease);
  }
  .${p}-row:hover:not(:disabled) .${p}-cue-go,
  .${p}-row:focus-visible .${p}-cue-go{opacity:1;transform:none;}
  /* Touch has no hover, so it stays visible there. */
  @media (hover:none){.${p}-cue-go{opacity:1;transform:none;}}

  .${p}-spin{display:flex;color:var(--${p}-accent);}
  .${p}-spin svg{width:16px;height:16px;animation:${p}-rot 900ms linear infinite;}
  @keyframes ${p}-rot{to{transform:rotate(360deg)}}

  /* Skeletons match the real row count, so the list never jumps. */
  .${p}-sk{pointer-events:none;}
  .${p}-sk .${p}-mark,
  .${p}-sk-line{background:var(--${p}-surface);border-radius:6px;}
  .${p}-sk-line{display:block;height:11px;}
  .${p}-sk-line + .${p}-sk-line{margin-top:8px;height:9px;}
  .${p}-sk-shimmer{animation:${p}-pulse 1.4s var(--${p}-ease) infinite;}
  @keyframes ${p}-pulse{0%,100%{opacity:1}50%{opacity:.45}}

  .${p}-note{
    display:flex;align-items:flex-start;gap:9px;
    padding:14px 15px;
    border:1px solid var(--${p}-line);border-radius:10px;
    font-size:13px;line-height:1.5;color:var(--${p}-muted);
  }
  .${p}-note svg{flex:0 0 auto;width:16px;height:16px;margin-top:2px;}
  .${p}-note strong{color:inherit;font-weight:600;}
  /* 12px mono optically matches the 13px sans around it. */
  .${p}-note code{
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:12px;
    padding:1px 4px;border-radius:4px;
    background:var(--${p}-surface);
  }
  .${p}-note-alert{
    color:var(--${p}-danger);
    border-color:rgba(var(--${p}-danger-rgb),.35);
    background:rgba(var(--${p}-danger-rgb),.05);
  }

  .${p}-status{margin-top:8px;}
  .${p}-status:empty{display:none;}

  .${p}-sr{
    position:absolute;width:1px;height:1px;
    padding:0;margin:-1px;overflow:hidden;
    clip:rect(0 0 0 0);white-space:nowrap;border:0;
  }

  /* Narrow: the label goes, the glyph and the full tap target stay. */
  @container (max-width:340px){
    .${p}-cue-label{display:none;}
    .${p}-row{gap:11px;padding:11px 12px;}
  }
  @supports not (container-type:inline-size){
    @media (max-width:340px){.${p}-cue-label{display:none;}}
  }

  @media (prefers-reduced-motion:reduce){
    .${p} *{transition-duration:1ms!important;}
    .${p}-cue-go{opacity:1;transform:none;}
    .${p}-sk-shimmer{animation:none;}
    .${p}-spin svg{animation-duration:2.4s;}
  }
`;
}
