// Shared lifecycle helpers for body-appended "portal" nodes (detail panels,
// sheets, modals, overlays) used by the task widgets.
//
// Why: the panels are appended to <body> so position:fixed escapes Staffbase's
// transformed/overflow-clipped containers. But the widget's <style> lives inside
// its own container — and in the new Staffbase client (notably mobile), page
// content renders inside a *shadow root*. Styles there don't reach <body>, so the
// portals render unstyled and permanently visible. Likewise
// document.querySelector() can't see a host inside a shadow root, so the old
// "is my owner still on the page?" sweep wrongly deleted live portals.
//
// Fix: (1) hoist a copy of the widget's <style> into <head>, tagged as a portal
// so it's cleaned up with the rest; (2) track hosts in a window-level registry
// (shared across separately bundled widgets) and check `isConnected`, which works
// through shadow boundaries.

const REGISTRY_KEY = "__sbPortalHosts";

function registry(): Map<string, Element> {
  const w = window as any;
  if (!(w[REGISTRY_KEY] instanceof Map)) w[REGISTRY_KEY] = new Map<string, Element>();
  return w[REGISTRY_KEY];
}

/** Register `host` as the owner of portal nodes tagged data-sb-portal=`id`. */
export function registerPortalHost(id: string, host: HTMLElement): void {
  host.dataset.sbPortalHost = id;
  registry().set(id, host);
}

/** Remove every portal node whose owning host has left the DOM. Shadow-DOM safe. */
export function sweepStalePortals(): void {
  const hosts = registry();
  document.querySelectorAll<HTMLElement>("[data-sb-portal]").forEach(node => {
    const owner = node.getAttribute("data-sb-portal");
    let host: Element | null | undefined = owner ? hosts.get(owner) : undefined;
    // Fallback for hosts registered by an older bundle that only set the attribute.
    if (!host && owner) host = document.querySelector(`[data-sb-portal-host="${owner}"]`);
    if (!host || !host.isConnected) {
      node.remove();
      if (owner) hosts.delete(owner);
    }
  });
}

/** Copy the container's first <style> into <head> so body-appended portals are
 *  styled even when the container lives in a shadow root. Returns the copy. */
export function hoistPortalStyles(container: HTMLElement, id: string): HTMLStyleElement | null {
  const src = container.querySelector("style");
  if (!src) return null;
  const copy = document.createElement("style");
  copy.textContent = src.textContent;
  copy.dataset.sbPortal = id;
  document.head.appendChild(copy);
  return copy;
}

/** Focus without letting the browser scroll the page to the element. On touch
 *  devices we skip auto-focus entirely: iOS jumps the viewport when an input in a
 *  fixed bottom sheet gains focus, and the keyboard covering the sheet is worse
 *  than one extra tap. Pass force=true for focus the user explicitly asked for. */
export function safeFocus(el: HTMLElement | null | undefined, force = false): void {
  if (!el) return;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (coarse && !force) return;
  try { el.focus({ preventScroll: true }); } catch { el.focus(); }
}
