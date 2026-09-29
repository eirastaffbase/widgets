const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
let browser, server, origin;

before(async () => {
  server = http.createServer(async (req, res) => {
    const files = {
      "/": ["preview.html", "text/html"],
      "/preview.js": ["preview.js", "text/javascript"],
      "/dist/recognition-widget.js": ["dist/recognition-widget.js", "text/javascript"],
    };
    const file = files[req.url];
    if (!file) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", file[1]);
    res.end(await fs.readFile(path.join(root, file[0])));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH }
      : process.platform === "darwin" ? { channel: "chrome" } : {}),
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function fixture(t, options = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(options => { window.previewOptions = options; }, options);
  await page.route("https://cdn.jsdelivr.net/**", async route => {
    const url = new URL(route.request().url());
    const file = url.pathname.split("/dist/")[1];
    if (options.iconFailure || (options.fontFailure && file.startsWith("fonts/"))) return route.abort();
    assert.match(file, /^(tabler-icons\.min\.css|fonts\/tabler-icons\.(woff2?|ttf))$/);
    await route.fulfill({
      body: await fs.readFile(path.join(root, "node_modules/@tabler/icons-webfont/dist", file)),
      contentType: file.endsWith(".css") ? "text/css" : "font/woff2",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(origin);
  await page.locator("#recipSearch").waitFor({ state: "attached" });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, [], "No uncaught browser errors");
  });
  return page;
}

async function give(page) {
  await page.locator('[data-tab="give"]').first().click();
}

async function fill(page) {
  await give(page);
  await page.locator("#recipSearch").click();
  await page.locator('.rcw-opt[data-id="recipient"]').click();
  await page.locator(".rcw-ktype").first().click();
  await page.locator("#kudosMsg").fill('Thanks <team> & "friends"!');
}

async function send(page) {
  await page.locator("#submitBtn").click();
  await page.waitForFunction(() => {
    const root = window.preview.widget.shadowRoot || window.preview.widget;
    return !root.querySelector("#submitBtn .rcw-spin");
  });
}

async function mutations(page) {
  return page.evaluate(() => window.preview.calls.filter(call => call.method !== "GET"));
}

for (const shadow of [true, false]) {
  test(`suggestions, search, selection and dismissal in ${shadow ? "shadow" : "light"} DOM`, async t => {
    const page = await fixture(t, { shadow });
    await give(page);
    await page.locator("#recipSearch").click();
    await page.locator('.rcw-opt[data-id="recipient"]').waitFor();
    await page.waitForTimeout(180);
    assert.equal(await page.locator("#userDropdown").isVisible(), true);
    await page.locator("#recipSearch").fill("Taylor");
    await page.locator('.rcw-opt[data-id="other"]').waitFor();
    await page.waitForTimeout(180);
    assert.equal(await page.locator(".rcw-opt").count(), 1);
    await page.locator("#recipSearch").press("Escape");
    assert.equal(await page.locator("#userDropdown").isVisible(), false);
    await page.locator("#recipSearch").click();
    await page.locator('.rcw-opt[data-id="other"]').click();
    assert.equal(await page.locator("#recipCardName").textContent(), "Taylor Example");
    await page.locator("#recipChange").click();
    await page.locator(".rcw-opt").first().waitFor();
    await page.locator("#outside").click();
    assert.equal(await page.locator("#userDropdown").isVisible(), false);
  });
}

test("late directory completion and debounce cannot reopen a dismissed picker", async t => {
  const page = await fixture(t, { usersDelay: 500 });
  await give(page);
  await page.locator("#recipSearch").click();
  await page.locator("#recipSearch").fill("Alex");
  await page.locator("#outside").click();
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#userDropdown").isVisible(), false);
  await page.locator("#recipSearch").click();
  await page.locator(".rcw-opt").first().waitFor();
});

test("rerender and unmount dispose listeners, hovercards and pending picker work", async t => {
  const page = await fixture(t, { usersDelay: 250 });
  await give(page);
  await page.locator("#recipSearch").click();
  await page.evaluate(async () => {
    await window.preview.widget.renderBlock(window.preview.widget.container);
    await window.preview.widget.renderBlock(window.preview.widget.container);
  });
  assert.equal(await page.locator(".rcw-hovercard").count(), 1);
  await give(page);
  await page.locator("#recipSearch").click();
  await page.locator(".rcw-opt").first().waitFor();
  await page.evaluate(() => window.preview.widget.remove());
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".rcw-hovercard").count(), 0);
});

test("multiple shadow-root instances do not close their own opening click", async t => {
  const page = await fixture(t);
  await page.evaluate(async () => { await window.preview.mount().ready; });
  const widgets = page.locator("recognition-widget");
  for (let index = 0; index < 2; index++) {
    await widgets.nth(index).locator('[data-tab="give"]').click();
    await widgets.nth(index).locator("#recipSearch").click();
    await widgets.nth(index).locator(".rcw-opt").first().waitFor();
    assert.equal(await widgets.nth(index).locator("#userDropdown").isVisible(), true);
  }
});

test("403 preserves the draft and prevents all follow-up mutations", async t => {
  const page = await fixture(t, { postStatus: 403, points: true });
  await fill(page);
  await send(page);
  assert.match(await page.locator("#requestStatus").textContent(), /denied/);
  assert.equal(await page.locator("#kudosMsg").inputValue(), 'Thanks <team> & "friends"!');
  assert.equal(await page.locator("#recipId").inputValue(), "recipient");
  assert.equal(await page.locator(".rcw-ktype.selected").count(), 1);
  assert.match(await page.locator("#submitBtn").textContent(), /Recognize Alex/);
  assert.equal((await mutations(page)).length, 1);
  assert.equal(await page.locator("#toast").textContent(), "");
});

test("host method is bound, awaited, refreshed per mutation; publication retains metadata", async t => {
  const page = await fixture(t, { authDelay: 60, postDelay: 120 });
  await fill(page);
  await page.evaluate(() => {
    const button = window.preview.widget.shadowRoot.querySelector("#submitBtn");
    button.click();
    button.dispatchEvent(new MouseEvent("click"));
  });
  await page.waitForFunction(() => window.preview.posts.length === 1);
  await page.locator("#recipSearch").waitFor({ state: "visible" });
  const calls = await mutations(page);
  assert.equal(calls.filter(call => call.path.endsWith("/posts")).length, 1);
  assert.equal(calls.some(call => call.method === "PUT"), false, "points disabled");
  assert.equal(calls[0].headers["x-csrf-token"], "synthetic-session-token");
  assert.equal(calls[0].headers.authorization, undefined, "session, not integration author");
  assert.match(calls[0].body.contents.en_US.title, /^Sam Example recognized Alex Example · Teamwork$/);
  assert.equal(calls[0].body.contents.en_US.content, "<p>Thanks &lt;team&gt; &amp; &quot;friends&quot;!</p>");
  assert.deepEqual(calls[0].body.notificationChannels, []);
  assert.equal(calls[0].body.commentingEnabled, false);
  assert.equal(calls[0].body.likingEnabled, true);
  assert.equal(await page.evaluate(() => window.preview.calls.some(call => call.path.endsWith("/discover"))), false);
  await page.evaluate(() => { window.preview.authManager.token = "synthetic-next-session"; });
  await page.locator('[data-tab="wall"]').click();
  await page.locator(".rcw-like-btn").click();
  await page.waitForFunction(() => window.preview.calls.some(call => call.path === "/api/reactions" && call.method === "POST"));
  assert.equal((await mutations(page)).at(-1).headers["x-csrf-token"], "synthetic-next-session");
  assert.equal(await page.locator(".rcw-msg").textContent(), 'Thanks <team> & "friends"!');
  assert.equal(await page.locator(".rcw-edit-btn").count(), 1);
});

for (const mode of ["missing", "security"]) {
  test(`branch fallback when embedded auth is ${mode}`, async t => {
    const page = await fixture(t, { authMode: mode });
    await fill(page);
    await send(page);
    assert.equal((await mutations(page))[0].headers["x-csrf-token"], "synthetic-discovery-token");
    assert.equal(await page.evaluate(() => window.preview.calls.filter(call => call.path.endsWith("/discover")).length), 1);
  });
}

for (const mode of ["empty", "throw"]) {
  test(`${mode} host token fails explicitly without discovery or a tokenless write`, async t => {
    const page = await fixture(t, { authMode: mode });
    await fill(page);
    await send(page);
    assert.equal((await mutations(page)).length, 0);
    assert.equal(await page.evaluate(() => window.preview.calls.some(call => call.path.endsWith("/discover"))), false);
    assert.ok(await page.locator("#requestStatus").textContent());
  });
}

test("host readiness times out without sending a late mutation", async t => {
  const page = await fixture(t, { authDelay: 5400 });
  await fill(page);
  await send(page);
  await page.waitForTimeout(500);
  assert.equal((await mutations(page)).length, 0);
  assert.match(await page.locator("#requestStatus").textContent(), /not ready/);
});

test("failed discovery never sends a tokenless mutation", async t => {
  const page = await fixture(t, { authMode: "missing", discoveryStatus: 403 });
  await fill(page);
  await send(page);
  assert.equal((await mutations(page)).length, 0);
  assert.match(await page.locator("#requestStatus").textContent(), /denied/);
});

for (const options of [{ networkFailure: true }, { malformedPost: true }]) {
  test(`ambiguous response retains draft and never retries: ${JSON.stringify(options)}`, async t => {
    const page = await fixture(t, options);
    await fill(page);
    await send(page);
    assert.equal((await mutations(page)).length, 1);
    assert.match(await page.locator("#requestStatus").textContent(), /[Cc]heck the wall/);
    assert.ok(await page.locator("#kudosMsg").inputValue());
  });
}

test("downstream errors report partial success, not awarded points or a failed post", async t => {
  const page = await fixture(t, { points: true, pointsStatus: 403, notificationStatus: 500 });
  await fill(page);
  await send(page);
  assert.match(await page.locator("#requestStatus").textContent(), /Recognition posted.*Points could not.*notification/);
  assert.equal(await page.locator("#kudosMsg").inputValue(), "");
  const calls = await mutations(page);
  assert.equal(calls.filter(call => call.path.endsWith("/posts")).length, 1);
  assert.doesNotMatch(calls.find(call => call.path.endsWith("/notifications")).body.content.en_US.text, /awarded/);
});

test("wall refresh failure does not misreport publication failure", async t => {
  const page = await fixture(t, { refreshStatus: 503 });
  await fill(page);
  await send(page);
  assert.match(await page.locator("#requestStatus").textContent(), /Recognition sent.*wall could not refresh/);
  assert.equal(await page.locator("#kudosMsg").inputValue(), "");
});

test("SDK sender survives optional profile enrichment failure", async t => {
  const page = await fixture(t, { profileStatus: 403 });
  await fill(page);
  await send(page);
  assert.match((await mutations(page))[0].body.contents.en_US.title, /^Sam Example recognized/);
});

test("unresolved identity disables sending instead of inventing a sender", async t => {
  const page = await fixture(t, { identityFailure: true });
  await fill(page);
  assert.equal(await page.locator("#submitBtn").isDisabled(), true);
  assert.match(await page.locator("#requestStatus").textContent(), /identify your Staffbase account/);
});

test("failed edits preserve editor; failed likes roll back", async t => {
  const page = await fixture(t, { editStatus: 403, likeStatus: 403 });
  await fill(page);
  await send(page);
  await page.locator('[data-tab="wall"]').click();
  await page.locator(".rcw-like-btn").click();
  await page.waitForFunction(() => {
    const root = window.preview.widget.shadowRoot;
    return root.querySelector("#toast").textContent.includes("Couldn't update");
  });
  assert.doesNotMatch(await page.locator(".rcw-like-btn").getAttribute("class"), /liked/);
  await page.locator(".rcw-card").hover();
  await page.locator(".rcw-edit-btn").click();
  await page.locator(".rcw-edit-area").fill("Updated message");
  await page.locator(".rcw-save-btn").click();
  await page.waitForFunction(() => window.preview.widget.shadowRoot.querySelector("#requestStatus").textContent.includes("denied"));
  assert.equal(await page.locator(".rcw-edit-area").inputValue(), "Updated message");
});

for (const shadow of [true, false]) {
  test(`actual pinned Tabler font and custom icon render in ${shadow ? "shadow" : "light"} DOM`, async t => {
    const page = await fixture(t, { shadow, customIcon: true });
    await give(page);
    await page.waitForFunction(async () => {
      await document.fonts.ready;
      const root = window.preview.widget.shadowRoot || window.preview.widget;
      const icon = root.querySelector(".rcw-ktype-ic i");
      const style = getComputedStyle(icon, "::before");
      return style.content !== "none" && style.fontFamily.includes("tabler-icons") &&
        document.fonts.check('16px "tabler-icons"', "\ueb65");
    });
    assert.equal(await page.locator("#iconStatus").textContent(), "");
    const before = await page.locator(".rcw-ktype-ic i").evaluate(icon => getComputedStyle(icon, "::before").content);
    assert.notEqual(before, '""');
    await fill(page);
    await send(page);
    await page.locator('[data-tab="wall"]').click();
    assert.equal(await page.locator(".rcw-type-badge i").evaluate(icon => getComputedStyle(icon, "::before").content), before);
  });
}

for (const failure of ["iconFailure", "fontFailure"]) {
  test(`${failure} is explicitly reported`, async t => {
    const page = await fixture(t, { [failure]: true });
    await page.waitForFunction(() => window.preview.widget.shadowRoot.querySelector("#iconStatus").textContent.includes("could not load"));
    assert.match(await page.locator("#iconStatus").textContent(), /icons could not load/);
  });
}

test("responsive form and keyboard recipient selection", async t => {
  for (const width of [1280, 360]) {
    const page = await fixture(t);
    await page.setViewportSize({ width, height: 900 });
    await give(page);
    await page.locator("#recipSearch").focus();
    await page.locator(".rcw-opt").first().waitFor();
    await page.locator("#recipSearch").press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#recipId").inputValue(), "recipient");
    await page.locator(".rcw-ktype").first().click();
    await page.locator("#kudosMsg").fill("Thank you for helping the team.");
    assert.equal(await page.locator("#submitBtn").isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.WIDGET_SCREENSHOTS) {
      await page.screenshot({ path: path.join(process.env.WIDGET_SCREENSHOTS, `recognition-${width}.png`), fullPage: true });
    }
  }
});
