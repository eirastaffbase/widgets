// ─────────────────────────────────────────────────────────────────────────────
// Mixed Feed — one chronological feed of social posts and news, filterable.
//
// Staffbase ships a social wall and a news feed as two separate widgets with two
// separate looks. This merges any set of channels into a single stream, sorted
// by publish date, with All / News / Social filter chips. The split is derived
// from each channel's `contentType` (articles → News, updates/pictures →
// Social), so an admin only ever pastes channel IDs — nothing has to be
// classified by hand.
//
// Presentation intent: generic and modern, not branded. The cards are neutral
// white-on-grey; only accents (chips, the like heart, buttons) take the brand
// color, which is resolved per viewer — a group override first, the tenant's
// theming API second. That way the same widget looks native in every brand of a
// multibrand tenant without an admin editing anything per branch.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock, WidgetApi,
} from "@staffbase/widget-sdk";
import { JSONSchema7 } from "json-schema";

import { isRtl, makeT } from "../tasks/shared/i18n";
import {
  createPost, escapeHtml, fetchChannels, fetchComments, fetchLikeState, fetchPost,
  fetchUser, makeApiOpts, postComment, sessionOpts, setLike,
} from "./api";
import { parseOverrides, resolveBrand } from "./branding";
import { P, buildCss } from "./css";
import {
  loadFeed, parseChannelIds, pickLocalized, resolveUiLocale, sanitizeHtml, toChannel, toFeedPost, toPlainText,
} from "./feed";
import { ICONS } from "./icons";
import { AVAILABLE_LOCALES, BUNDLES } from "./strings";
import {
  avatarHtml, cardHtml, commentHtml, heroHtml, makeFormatters, skeletonHtml, stateHtml,
} from "./render";
import {
  ApiComment, Brand, Channel, Comment, FeedPost, FilterKey, OptsFactory, Viewer,
} from "./types";

const DEFAULT_BASE_URL = "https://app.staffbase.com/api";

/** Default pin for viewers outside every configured brand group: the tenant's
 *  highlighted corporate article. */
const DEFAULT_PINNED_POST = "6a8ca3f089ac527b38d85714";

/** Shipped as the default so the multibrand behaviour is demonstrable out of the
 *  box: El Globo staff get the maroon brand, 5px corners and a Globo pin;
 *  everyone else falls through to the theming API. */
const DEFAULT_BRAND_OVERRIDES = [
  {
    groupId: "6a42ed4319053625a91b37c2",
    label: "El Globo",
    color: "#8B374A",
    radius: "5px",
    pinnedPostId: "6a42efaf17470228967cf4e6",
  },
];

const FILTERS: FilterKey[] = ["all", "news", "social"];

const factory: BlockFactory = (BaseBlockClass, widgetApi: WidgetApi) => {
  return class MixedFeed extends BaseBlockClass implements BaseBlock {
    /**
     * The host calls renderBlock once per attribute change, so several async
     * renders can be in flight at once. Without a generation token the render
     * that started first — before the host had applied every attribute — can
     * resolve last and overwrite a newer, more complete one, silently dropping
     * whatever config arrived late (the composer was disappearing this way).
     */
    private seq = 0;
    /** Undo hooks for listeners bound to targets that outlive a render. */
    private teardown: Array<() => void> = [];

    private runTeardown(): void {
      this.teardown.splice(0).forEach(fn => { try { fn(); } catch { /* noop */ } });
    }

    /** Listeners on `window`/`document` outlive the element, so a widget that is
     *  removed from the page (navigation, the editor swapping blocks) would keep
     *  them forever. Bumping `seq` also makes any in-flight render bail instead
     *  of painting into a detached tree. */
    disconnectedCallback(): void {
      this.seq++;
      this.runTeardown();
      const base = (BaseBlockClass as any)?.prototype;
      if (typeof base?.disconnectedCallback === "function") base.disconnectedCallback.call(this);
    }

    async renderBlock(container: HTMLElement): Promise<void> {
      const mine = ++this.seq;
      const stale = (): boolean => mine !== this.seq;

      // `container`, `window` and `document` survive the innerHTML rewrite
      // below, so handlers from the previous render would stack and fire once
      // per render — double-toggling likes. Drop them first.
      this.runTeardown();
      const on = (
        target: EventTarget, type: string, fn: EventListenerOrEventListenerObject,
      ): void => {
        target.addEventListener(type, fn);
        this.teardown.push(() => target.removeEventListener(type, fn));
      };

      const attr = (n: string): string => this.getAttribute(n) || "";
      const bool = (n: string, dflt: boolean): boolean => {
        const v = this.getAttribute(n);
        return v == null || v === "" ? dflt : v === "true";
      };

      const debug = attr("debug") === "true";
      const log = (...a: any[]) => { if (debug) console.log("[mixed-feed]", ...a); };

      const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
      const token = attr("apitoken");
      const channelIds = parseChannelIds(attr("channelids"));
      const composeChannelId = attr("composechannelid").trim();
      const perChannelLimit = Math.max(1, Math.min(100, parseInt(attr("postlimit") || "12", 10) || 12));
      const totalLimit = Math.max(1, Math.min(200, parseInt(attr("totallimit") || "30", 10) || 30));
      const showActions = bool("showsocialactions", true);
      const showCompose = bool("showcomposer", true) && !!composeChannelId;
      const fullWidthMobile = bool("fullwidthmobile", true);
      const background = attr("backgroundcolor");

      const apiOpts = makeApiOpts(token);
      // Reads prefer the service token (it can see every channel regardless of
      // the viewer's own permissions on this endpoint) and fall back to the
      // session, which is the only identity available when no token is set.
      const readLadder: OptsFactory[] = token ? [apiOpts, sessionOpts] : [sessionOpts];

      // ── Viewer ────────────────────────────────────────────────────────
      let viewer: Viewer = { id: "", name: "", avatarUrl: "", groupIds: [], language: "" };
      try {
        const prof: any = await widgetApi.getUserInformation();
        viewer = {
          id: String(prof?.id || ""),
          name: [prof?.firstName, prof?.lastName].filter(Boolean).join(" "),
          avatarUrl: "",
          groupIds: (prof?.groupIDs || prof?.groupIds || []).map(String),
          language: String(prof?.language || prof?.locale || ""),
        };
        log("viewer", viewer.id, "groups", viewer.groupIds.length);
      } catch (e: any) {
        log("getUserInformation failed —", e && e.message);
      }

      // ── Locale ────────────────────────────────────────────────────────
      const locale = resolveUiLocale(attr("language"), viewer.language);
      const t = makeT(BUNDLES, locale);
      const when = makeFormatters(locale);
      const rtl = isRtl(locale);
      log("locale", locale);

      // ── Brand ─────────────────────────────────────────────────────────
      const overridesRaw = attr("brandoverrides");
      const brand: Brand = await resolveBrand({
        baseUrl,
        apiToken: token,
        overrides: overridesRaw
          ? parseOverrides(overridesRaw, log)
          : DEFAULT_BRAND_OVERRIDES,
        viewerGroupIds: viewer.groupIds,
        useThemeColor: bool("usethemecolors", true),
        fallbackColor: attr("primarycolor"),
        fallbackRadius: attr("defaultradius"),
        fallbackPinnedPostId: attr("pinnedpostid") || DEFAULT_PINNED_POST,
        log,
      });
      log("brand", brand.color, brand.radius, brand.matchedLabel || "(theme)");

      // A newer render has taken over while we were awaiting the profile and
      // theme; leave the DOM to it.
      if (stale()) return;

      // ── Shell ─────────────────────────────────────────────────────────
      const rootClasses = [`${P}-root`, fullWidthMobile ? `${P}-bleed` : ""].filter(Boolean).join(" ");
      container.innerHTML = `<style>${buildCss(brand, background, rtl)}</style>
<div class="${rootClasses}"${rtl ? ' dir="rtl"' : ""}>
  <div class="${P}-head">
    <h2 class="${P}-title">${escapeHtml(attr("title") || t("widget.title"))}</h2>
    <button type="button" class="${P}-refresh" data-act="refresh" aria-label="${escapeHtml(t("state.retry"))}">${ICONS.refresh}</button>
  </div>
  <div class="${P}-hero-slot"></div>
  <div class="${P}-bar" role="tablist"></div>
  <div class="${P}-compose-slot"></div>
  <div class="${P}-feed">${skeletonHtml(6)}</div>
</div>
<div class="${P}-scrim" data-act="close-sheet"></div>
<div class="${P}-sheet" role="dialog" aria-modal="true">
  <div class="${P}-sheet-head">
    <span class="${P}-sheet-title"></span>
    <button type="button" class="${P}-sheet-x" data-act="close-sheet" aria-label="${escapeHtml(t("a11y.close"))}">${ICONS.close}</button>
  </div>
  <div class="${P}-sheet-body"></div>
  <div class="${P}-sheet-foot">
    <textarea class="${P}-in" rows="1"></textarea>
    <button type="button" class="${P}-send" data-act="send" disabled>${ICONS.send}</button>
  </div>
</div>`;

      const root = container.querySelector(`.${P}-root`) as HTMLElement;
      const heroSlot = container.querySelector(`.${P}-hero-slot`) as HTMLElement;
      const bar = container.querySelector(`.${P}-bar`) as HTMLElement;
      const composeSlot = container.querySelector(`.${P}-compose-slot`) as HTMLElement;
      const feedEl = container.querySelector(`.${P}-feed`) as HTMLElement;
      const refreshBtn = container.querySelector(`.${P}-refresh`) as HTMLButtonElement;

      const scrim = container.querySelector(`.${P}-scrim`) as HTMLElement;
      const sheet = container.querySelector(`.${P}-sheet`) as HTMLElement;
      const sheetTitle = container.querySelector(`.${P}-sheet-title`) as HTMLElement;
      const sheetBody = container.querySelector(`.${P}-sheet-body`) as HTMLElement;
      const sheetInput = container.querySelector(`.${P}-in`) as HTMLTextAreaElement;
      const sheetSend = container.querySelector(`.${P}-send`) as HTMLButtonElement;

      // ── State ─────────────────────────────────────────────────────────
      let posts: FeedPost[] = [];
      let pinned: FeedPost | null = null;
      let filter: FilterKey = "all";
      const liked = new Set<string>();
      /** "comments" targets a post; "compose" writes a new one. */
      let sheetMode: "comments" | "compose" | null = null;
      let sheetPostId = "";

      const visible = (): FeedPost[] =>
        posts.filter(p => (filter === "all" || p.kind === filter) && (!pinned || p.id !== pinned.id));

      // ── Load ──────────────────────────────────────────────────────────
      async function load(): Promise<void> {
        if (!channelIds.length) {
          heroSlot.innerHTML = "";
          bar.innerHTML = "";
          feedEl.innerHTML = stateHtml(t("state.configure"));
          return;
        }

        const rawChannels = await fetchChannels(baseUrl, readLadder, log);
        const channels: Channel[] = channelIds.map(id => {
          const raw = rawChannels.get(id);
          // A channel missing from the list is still fetched — it may simply be
          // outside the branch-wide listing — but it has no title or type, so it
          // defaults to News.
          return raw ? toChannel(raw, locale) : { id, title: "", kind: "news" as const, contentType: "" };
        });

        posts = await loadFeed({
          base: baseUrl, channels, perChannelLimit, totalLimit, ladder: readLadder, locale, log,
        });

        pinned = await resolvePinned(channels);
        if (stale()) return;
        if (showActions) void hydrateLikes();
        paint();
      }

      /** The hero post. Prefers the explicitly configured/brand-matched id; if
       *  that post is not in the loaded feed it is fetched directly, so an admin
       *  can pin something from a channel that is not even in the feed. Falls
       *  back to the newest `highlighted` post, then to the newest post. */
      async function resolvePinned(channels: Channel[]): Promise<FeedPost | null> {
        const wanted = brand.pinnedPostId;
        if (wanted) {
          const inFeed = posts.find(p => p.id === wanted);
          if (inFeed) return inFeed;

          const raw = await fetchPost(baseUrl, wanted, readLadder, log);
          if (raw) {
            const ch = channels.find(c => c.id === raw.channelID)
              || { id: raw.channelID || "", title: "", kind: "news" as const, contentType: String(raw.contentType || "") };
            const mapped = toFeedPost(raw, ch, locale);
            if (mapped) return mapped;
          }
          log("pinned post not resolvable:", wanted);
        }
        return posts.find(p => p.highlighted) || posts[0] || null;
      }

      /** Per-post like state, so the heart reflects the viewer rather than just
       *  a count. Runs after paint and repaints only the buttons it changes —
       *  the feed must not wait on a fan-out of reaction calls. */
      async function hydrateLikes(): Promise<void> {
        if (!viewer.id) return;
        const targets = posts.slice(0, 24);
        await Promise.all(targets.map(async p => {
          const state = await fetchLikeState(baseUrl, p.id, viewer.id, log);
          if (!state) return;
          p.likeCount = state.count;
          if (state.mine) liked.add(p.id); else liked.delete(p.id);
          paintLike(p);
        }));
      }

      // ── Paint ─────────────────────────────────────────────────────────
      function paint(): void {
        heroSlot.innerHTML = pinned ? heroHtml(pinned, t, when) : "";
        paintBar();
        paintCompose();

        const list = visible();
        feedEl.innerHTML = list.length
          ? `<div class="${P}-grid">${list.map(p => cardHtml(p, t, when, showActions, liked.has(p.id))).join("")}</div>`
          : stateHtml(posts.length ? t("state.emptyFiltered") : t("state.empty"));
      }

      function paintBar(): void {
        bar.innerHTML = FILTERS.map(key => {
          const n = key === "all" ? posts.length : posts.filter(p => p.kind === key).length;
          // A filter that can never match anything is noise, so it is omitted.
          if (!n && key !== "all") return "";
          return `<button type="button" role="tab" aria-selected="${filter === key}"
            class="${P}-chip${filter === key ? ` ${P}-on` : ""}" data-filter="${key}">
            ${escapeHtml(t(`filter.${key}`))}<span class="${P}-chip-n">${n}</span>
          </button>`;
        }).join("");
      }

      function paintCompose(): void {
        composeSlot.innerHTML = showCompose
          ? `<button type="button" class="${P}-compose" data-act="compose">
              ${avatarHtml(viewer.name, viewer.avatarUrl)}
              <span class="${P}-compose-ph">${escapeHtml(t("compose.placeholder"))}</span>
            </button>`
          : "";
      }

      function paintLike(post: FeedPost): void {
        const btn = feedEl.querySelector(`.${P}-like[data-id="${post.id}"]`) as HTMLElement | null;
        if (!btn) return;
        const on = liked.has(post.id);
        btn.classList.toggle(`${P}-on`, on);
        btn.setAttribute("aria-pressed", String(on));
        const icon = on ? ICONS.heartFilled : ICONS.heart;
        const count = post.likeCount ? String(post.likeCount) : "";
        btn.innerHTML = `${icon}<span class="${P}-act-n">${count}</span>`;
      }

      // ── Likes ─────────────────────────────────────────────────────────
      async function toggleLike(postId: string, btn: HTMLElement): Promise<void> {
        const post = posts.find(p => p.id === postId);
        if (!post || !viewer.id) return;

        const next = !liked.has(postId);
        // Optimistic: the tap must feel instant, and a failed write is reverted
        // below rather than blocking the interaction.
        if (next) liked.add(postId); else liked.delete(postId);
        post.likeCount = Math.max(0, post.likeCount + (next ? 1 : -1));
        paintLike(post);

        const fresh = feedEl.querySelector(`.${P}-like[data-id="${postId}"]`) as HTMLElement | null;
        if (fresh && next) {
          fresh.classList.add(`${P}-pop`);
          setTimeout(() => fresh.classList.remove(`${P}-pop`), 340);
        }

        const ok = await setLike(baseUrl, postId, next);
        if (!ok) {
          if (next) liked.delete(postId); else liked.add(postId);
          post.likeCount = Math.max(0, post.likeCount + (next ? -1 : 1));
          paintLike(post);
        }
      }

      // ── Sheet ─────────────────────────────────────────────────────────
      function openSheet(mode: "comments" | "compose", postId = ""): void {
        sheetMode = mode;
        sheetPostId = postId;
        sheetTitle.textContent = mode === "compose" ? t("compose.title") : t("social.comments");
        sheetInput.placeholder = mode === "compose" ? t("compose.placeholder") : t("social.commentPlaceholder");
        sheetInput.value = "";
        sheetSend.disabled = true;
        sheetBody.innerHTML = mode === "compose"
          ? ""
          : `<div class="${P}-cmt-empty"><span class="${P}-spin"></span></div>`;

        scrim.classList.add(`${P}-open`);
        sheet.classList.add(`${P}-open`);
        // Deferred so the sheet's entry transform finishes before the keyboard
        // animates up on iOS; focusing mid-transition fights the two animations.
        setTimeout(() => sheetInput.focus(), 320);

        if (mode === "comments") void loadCommentsInto(postId);
      }

      function closeSheet(): void {
        scrim.classList.remove(`${P}-open`);
        sheet.classList.remove(`${P}-open`);
        sheetMode = null;
        sheetPostId = "";
      }

      async function loadCommentsInto(postId: string): Promise<void> {
        const rows = await fetchComments(baseUrl, postId, readLadder, 500, log);
        if (sheetPostId !== postId) return; // the viewer moved on

        const mapped: Comment[] = rows.map(toComment)
          .sort((a, b) => a.createdAt - b.createdAt);

        sheetBody.innerHTML = mapped.length
          ? mapped.map(c => commentHtml(c, when)).join("")
          : `<div class="${P}-cmt-empty">${escapeHtml(t("social.noComments"))}</div>`;
        sheetBody.scrollTop = sheetBody.scrollHeight;
      }

      function toComment(c: ApiComment): Comment {
        const a = c.author || {};
        const raw = c.text || c.contents || c.content || "";
        return {
          id: c.id,
          html: sanitizeHtml(String(raw)),
          createdAt: Date.parse(c.created || c.published || "") || 0,
          author: {
            id: a.id || "",
            name: [a.firstName, a.lastName].filter(Boolean).join(" ") || "—",
            avatarUrl: a.avatar?.icon?.url || a.avatar?.thumb?.url || a.avatar?.original?.url || "",
          },
        };
      }

      function sheetError(message: string): void {
        const existing = sheet.querySelector(`.${P}-err`);
        if (existing) existing.remove();
        const el = document.createElement("div");
        el.className = `${P}-err`;
        el.textContent = message;
        sheetBody.appendChild(el);
        sheetBody.scrollTop = sheetBody.scrollHeight;
      }

      async function submitSheet(): Promise<void> {
        const text = sheetInput.value.trim();
        if (!text || !sheetMode) return;

        sheetSend.disabled = true;
        const mode = sheetMode;
        const postId = sheetPostId;

        if (mode === "comments") {
          const created = await postComment(baseUrl, postId, text);
          if (!created) { sheetError(t("social.commentFailed")); sheetSend.disabled = false; return; }

          sheetInput.value = "";
          const post = posts.find(p => p.id === postId);
          if (post) {
            post.commentCount += 1;
            const btn = feedEl.querySelector(`.${P}-act[data-act="comments"][data-id="${postId}"] .${P}-act-n`);
            if (btn) btn.textContent = String(post.commentCount);
          }
          await loadCommentsInto(postId);
          return;
        }

        const created = await createPost(baseUrl, composeChannelId, locale, text);
        if (!created) { sheetError(t("compose.failed")); sheetSend.disabled = false; return; }

        closeSheet();
        // Show it immediately rather than refetching: the new post is the one
        // thing the viewer is certain to look for straight after posting.
        const channel: Channel = { id: composeChannelId, title: "", kind: "social", contentType: "updates" };
        const mapped = toFeedPost({ ...created, contentType: created.contentType || "updates" }, channel, locale);
        if (mapped) {
          if (!mapped.author.name && viewer.name) mapped.author = { ...mapped.author, name: viewer.name, avatarUrl: viewer.avatarUrl };
          if (!mapped.publishedAt) mapped.publishedAt = Date.now();
          if (!mapped.excerpt) mapped.excerpt = text;
          posts.unshift(mapped);
          paint();
        } else {
          void load();
        }
      }

      // ── Events ────────────────────────────────────────────────────────
      // ── Full-bleed on phones ──────────────────────────────────────────
      // Measured rather than assumed. `calc(50% - 50vw)` has to guess the host's
      // padding, and guessing high is destructive: any ancestor with a clipping
      // overflow shears the overhang and eats the first character of every line.
      // So we measure the real gap to the widest edge we are actually allowed to
      // reach — the viewport, or the nearest clipping ancestor if one is
      // narrower — and stop exactly there.
      function bleedBounds(): { left: number; right: number } {
        let left = 0;
        let right = document.documentElement.clientWidth;

        for (let el = root.parentElement; el; el = el.parentElement) {
          const cs = getComputedStyle(el);
          const clips = /hidden|clip|auto|scroll/.test(cs.overflowX);
          if (!clips) continue;
          const r = el.getBoundingClientRect();
          // Stay inside the padding box; the border would cover us otherwise.
          left = Math.max(left, r.left + parseFloat(cs.borderLeftWidth || "0"));
          right = Math.min(right, r.right - parseFloat(cs.borderRightWidth || "0"));
          break;
        }
        return { left, right };
      }

      function applyBleed(): void {
        if (!fullWidthMobile || !root) return;
        root.style.setProperty("--bleed-l", "0px");
        root.style.setProperty("--bleed-r", "0px");
        if (window.innerWidth > 640) return;

        const rect = root.getBoundingClientRect();
        const bounds = bleedBounds();
        root.style.setProperty("--bleed-l", `-${Math.max(0, Math.round(rect.left - bounds.left))}px`);
        root.style.setProperty("--bleed-r", `-${Math.max(0, Math.round(bounds.right - rect.right))}px`);
      }

      applyBleed();
      let bleedTimer = 0;
      on(window, "resize", () => {
        clearTimeout(bleedTimer);
        bleedTimer = window.setTimeout(applyBleed, 120);
      });

      on(container, "click", (ev: Event) => {
        const target = ev.target as HTMLElement;

        const chip = target.closest(`.${P}-chip`) as HTMLElement | null;
        if (chip && chip.dataset.filter) {
          filter = chip.dataset.filter as FilterKey;
          paint();
          return;
        }

        const btn = target.closest("[data-act]") as HTMLElement | null;
        if (!btn) return;
        const act = btn.dataset.act;

        if (act === "like") { ev.preventDefault(); void toggleLike(btn.dataset.id || "", btn); return; }
        if (act === "comments") { ev.preventDefault(); openSheet("comments", btn.dataset.id || ""); return; }
        if (act === "compose") { ev.preventDefault(); openSheet("compose"); return; }
        if (act === "close-sheet") { ev.preventDefault(); closeSheet(); return; }
        if (act === "send") { ev.preventDefault(); void submitSheet(); return; }
        if (act === "refresh" || act === "retry") {
          ev.preventDefault();
          refreshBtn.classList.add(`${P}-busy`);
          void load().finally(() => refreshBtn.classList.remove(`${P}-busy`));
        }
      });

      sheetInput.addEventListener("input", () => {
        sheetSend.disabled = !sheetInput.value.trim();
        // Grow with the text, capped by the CSS max-height.
        sheetInput.style.height = "auto";
        sheetInput.style.height = `${sheetInput.scrollHeight}px`;
      });

      sheetInput.addEventListener("keydown", (ev: KeyboardEvent) => {
        // Enter sends; Shift+Enter is a newline. On touch keyboards Enter is a
        // literal newline key, so only the modifier-free desktop case submits.
        if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
          ev.preventDefault();
          void submitSheet();
        }
      });

      on(document, "keydown", ((ev: KeyboardEvent) => {
        if (ev.key === "Escape" && sheetMode) closeSheet();
      }) as EventListener);

      // The viewer's own avatar is not part of getUserInformation, so it is
      // fetched separately and painted in once it lands.
      if (viewer.id) {
        void fetchUser(baseUrl, viewer.id, readLadder, log).then(u => {
          if (!u || stale()) return;
          viewer = { ...viewer, name: viewer.name || u.name, avatarUrl: u.avatarUrl };
          paintCompose();
        });
      }

      try {
        await load();
      } catch (e: any) {
        log("load failed —", e && e.message);
        feedEl.innerHTML = stateHtml(t("state.error"), t("state.retry"), "retry");
      }

      // Referenced so the unused-import check stays honest about helpers that are
      // only used through the render layer.
      void root; void pickLocalized; void toPlainText;
    }

    static get observedAttributes(): string[] {
      return ATTRIBUTES;
    }
  };
};

// ── Configuration ────────────────────────────────────────────────────────────

const ATTRIBUTES = [
  "apitoken", "baseurl", "channelids", "title", "postlimit", "totallimit",
  "showsocialactions", "showcomposer", "composechannelid",
  "pinnedpostid", "brandoverrides", "usethemecolors", "primarycolor", "defaultradius",
  "language", "fullwidthmobile", "backgroundcolor", "debug",
];

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken: { type: "string", title: "API Token" },
    baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
    channelids: { type: "string", title: "Channel IDs" },
    title: { type: "string", title: "Widget Title" },
    postlimit: { type: "number", title: "Posts per Channel", default: 12 },
    totallimit: { type: "number", title: "Total Posts", default: 30 },
    language: {
      type: "string", title: "Language", default: "es_MX",
      enum: ["es_MX", "es_ES", "en_US", "de_DE", "auto"],
    },
    pinnedpostid: { type: "string", title: "Pinned Post ID", default: DEFAULT_PINNED_POST },
    brandoverrides: {
      type: "string", title: "Brand Overrides (JSON)",
      default: JSON.stringify(DEFAULT_BRAND_OVERRIDES, null, 2),
    },
    usethemecolors: { type: "boolean", title: "Use Theme Color", default: true },
    defaultradius: { type: "string", title: "Default Corner Radius", default: "14px" },
    showsocialactions: { type: "boolean", title: "Show Likes & Comments", default: true },
    showcomposer: { type: "boolean", title: "Show Composer", default: true },
    fullwidthmobile: { type: "boolean", title: "Full Width on Mobile", default: true },
    backgroundcolor: { type: "string", title: "Background Color", default: "" },
    debug: { type: "boolean", title: "Debug Logging", default: false },
  },
  dependencies: {
    // The manual color picker is only meaningful when the theming API is not
    // supplying the color.
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            primarycolor: { type: "string", title: "Primary Color", default: "#1F6FEB" },
          },
        },
        { properties: { usethemecolors: { const: true } } },
      ],
    },
    showcomposer: {
      oneOf: [
        {
          properties: {
            showcomposer: { const: true },
            composechannelid: { type: "string", title: "Composer Channel ID" },
          },
        },
        { properties: { showcomposer: { const: false } } },
      ],
    },
  },
} as JSONSchema7;

const uiSchema = {
  apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token (e.g. from *.staffbase.com or *.staffbase.rocks)" },
  baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
  channelids: {
    "ui:widget": "textarea",
    "ui:help": "Channel IDs to merge into the feed — comma-separated (recommended) or one per line. News vs. Social is detected automatically from each channel's content type (articles → News, updates & pictures → Social).",
  },
  title: { "ui:help": "Heading shown above the feed. Leave blank to use the translated default." },
  postlimit: { "ui:help": "How many posts to pull from each channel before merging (1–100)." },
  totallimit: { "ui:help": "Maximum number of posts shown after merging (1–200)." },
  language: { "ui:help": "Interface language. Defaults to Spanish (Mexico). Choose “auto” to follow the viewer's Staffbase language, then the browser, falling back to Spanish." },
  pinnedpostid: { "ui:help": "Post shown in the large hero card. Overridden per group below. Leave blank to pin the newest highlighted post." },
  brandoverrides: {
    "ui:widget": "textarea",
    "ui:help": 'JSON array of {"groupId","label","color","radius","pinnedPostId"}. The first entry matching one of the viewer\'s groups wins; everyone else gets the theme color and the defaults below.',
  },
  usethemecolors: { "ui:help": "Pull the accent color from the app's branding theme (uses the API Token) when no group override matches." },
  primarycolor: { "ui:widget": "color", "ui:help": "Accent color used for chips, buttons and the like heart." },
  defaultradius: { "ui:help": "Corner radius for viewers with no group override, e.g. 14px or 0." },
  showsocialactions: { "ui:help": "Show like and comment buttons on cards. Actions are performed as the logged-in user." },
  showcomposer: { "ui:help": "Show a “What's on your mind?” box that posts to the channel below." },
  composechannelid: { "ui:help": "Social channel new posts are published to. Required for the composer to appear." },
  fullwidthmobile: { "ui:help": "On phones, break out of the page's card padding so the feed spans the full screen width." },
  backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background — leave blank for transparent." },
  debug: { "ui:help": "Log channel/post/brand resolution to the browser console." },
};

const blockDefinition: BlockDefinition = {
  name: "mixed-feed",
  label: "Mixed Feed",
  attributes: ATTRIBUTES,
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzhCMzc0QSIvPjxnIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjM2IiB5PSIzOCIgd2lkdGg9Ijk5IiBoZWlnaHQ9IjQyIiByeD0iNiIvPjxyZWN0IHg9IjM2IiB5PSI5MCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQzIiByeD0iNiIvPjxyZWN0IHg9IjkxIiB5PSI5MCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQzIiByeD0iNiIvPjwvZz48L3N2Zz4=",
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Staffbase",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
