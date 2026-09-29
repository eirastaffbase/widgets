/* Synthetic host/API shared by the preview and browser regression tests. */
(() => {
  const options = window.previewOptions || {};
  const users = [
    { id: "sender", firstName: "Sam", lastName: "Example" },
    { id: "recipient", firstName: "Alex", lastName: "Example", profile: { points: "10" } },
    { id: "other", firstName: "Taylor", lastName: "Example" },
  ];
  const calls = [];
  const posts = [];
  let reaction = false;
  let csrfCalls = 0;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
  const authManager = {
    token: "synthetic-session-token",
    async getCsrfToken() {
      if (this !== authManager) throw new Error("Auth manager receiver was lost");
      csrfCalls++;
      if (options.authDelay) await pause(options.authDelay);
      if (options.authMode === "throw") throw new Error("Synthetic auth failure");
      if (options.authMode === "security") throw new DOMException("Cross-origin", "SecurityError");
      return options.authMode === "empty" ? "" : this.token;
    },
  };
  if (options.authMode !== "missing") window.we = { authMgr: authManager };
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) {
      throw new Error("Preview blocked an unexpected API destination");
    }
    const method = init.method || "GET";
    const call = { path: url.pathname, method, headers: Object.fromEntries(new Headers(init.headers)), body: init.body && JSON.parse(init.body) };
    calls.push(call);
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (url.pathname === "/api/branch/discover") {
      if (options.discoveryDelay) await pause(options.discoveryDelay);
      return json(options.discoveryEmpty ? {} : { csrfToken: "synthetic-discovery-token" }, options.discoveryStatus || 200);
    }
    if (url.pathname === "/api/users") {
      if (options.usersDelay) await pause(options.usersDelay);
      return json({ data: users }, options.usersStatus || 200);
    }
    if (url.pathname.startsWith("/api/users/")) {
      if (method === "PUT") return json({}, options.pointsStatus || 200);
      return json(users.find(user => url.pathname.endsWith(user.id)) || {}, options.profileStatus || 200);
    }
    if (url.pathname.endsWith("/posts") && method === "POST") {
      if (options.postDelay) await pause(options.postDelay);
      if (options.networkFailure) throw new TypeError("Synthetic network failure");
      if (options.postStatus) return json({ message: "Access denied", ref: "ERROR_ACCESS_DENIED" }, options.postStatus);
      if (options.malformedPost) return json({});
      if (!call.headers["x-csrf-token"]) return json({}, 403);
      const post = { ...call.body, id: `post-${posts.length + 1}`, author: users[0], created: "2026-01-01T12:00:00Z" };
      posts.unshift(post);
      return json(post, 201);
    }
    if (url.pathname.endsWith("/posts") && method === "GET") {
      return json({ data: posts }, options.wallStatus || (posts.length && options.refreshStatus) || 200);
    }
    if (url.pathname.startsWith("/api/posts/") && method === "PUT") return json({}, options.editStatus || 200);
    if (url.pathname === "/api/branch/notifications") return json({}, options.notificationStatus || 200);
    if (url.pathname === "/api/reactions-count") return json({ data: [{ type: "LIKE", count: reaction ? 1 : 0 }] });
    if (url.pathname === "/api/reactions") {
      if (method === "GET") return json({ data: reaction ? [{ type: "LIKE" }] : [] });
      if (options.likeStatus) return json({}, options.likeStatus);
      reaction = method !== "DELETE";
      return json({});
    }
    if (url.pathname === "/api/theming/themes/primary") return json({});
    throw new Error(`Unexpected preview API route: ${method} ${url.pathname}`);
  };

  window.defineBlock = ({ blockDefinition }) => {
    class PreviewBase extends HTMLElement {
      unmountBlock() {}
      disconnectedCallback() { this.unmountBlock(this.container); }
    }
    const Widget = blockDefinition.factory(PreviewBase, {
      getUserInformation: async () => {
        if (options.identityFailure) throw new Error("Synthetic identity failure");
        return users[0];
      },
      getUserList: async () => {
        if (options.usersStatus) throw new Error("Synthetic directory failure");
        return { data: users };
      },
    });
    customElements.define("recognition-widget", Widget);
    function mount(shadow = options.shadow !== false) {
      const widget = document.createElement("recognition-widget");
      widget.setAttribute("baseurl", `${location.origin}/api`);
      widget.setAttribute("apitoken", "synthetic-preview-token");
      widget.setAttribute("channelid", "preview-channel");
      widget.setAttribute("enablepoints", String(!!options.points));
      if (options.customIcon) widget.setAttribute("rewardtypes", JSON.stringify([{ name: "Custom", icon: "ti-diamond", points: 5 }]));
      const root = shadow ? widget.attachShadow({ mode: "open" }) : widget;
      const container = document.createElement("div");
      root.appendChild(container);
      widget.container = container;
      document.querySelector("#preview").appendChild(widget);
      widget.ready = widget.renderBlock(container);
      return widget;
    }
    const widget = mount();
    window.preview = { widget, mount, users, calls, posts, options, authManager, get csrfCalls() { return csrfCalls; } };
  };
})();
