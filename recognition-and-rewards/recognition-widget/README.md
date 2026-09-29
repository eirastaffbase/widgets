# Recognition widget

Embedded Staffbase recognition wall, recipient picker, and recognition form.

## Authentication and posting

Set **Base URL** to the current tenant's API URL (including `/api`) and **Social Wall Channel ID** to the intended channel. Session requests must use the same origin as the page. The API token is used for directory/profile reads, optional points updates, notifications, and the existing wall-read fallback; it is **not** used to publish as an integration user.

Creation, edits, and likes use the logged-in browser session. The widget first calls the embedded host's `window.top.we.authMgr.getCsrfToken()` with the correct receiver and awaits its result, with a five-second readiness bound. Legacy host token properties are still supported. If the method is unavailable or top-window access raises `SecurityError`, it uses a same-origin `GET /api/branch/discover` and requires a non-empty `csrfToken` response. Discovery is shared only while in flight; tokens are never saved in localStorage or widget attributes.

An empty/timed-out token from an available host method is a visible session-not-ready error, not a reason to send an unprotected request. Unexpected host errors also stop publication. No legacy `/auth/discover` or guessed `discoverV3` route is used.

Post creation retains the existing JSON/HTML contract and explicit recognition title:

```text
Sender recognized Recipient · Type
Sender recognized Recipient · Type · +50pts
```

Messages are encoded as text inside HTML paragraphs. Comments remain disabled, likes enabled, and post push/email channels empty. The explicit title is required for wall parsing; do not replace the payload with a native block document without verifying that the server preserves this metadata and real-user authorship.

## Failure behavior

- Rejected posts keep the full draft and do not update points or notify the recipient.
- Network failures or unconfirmed creation responses never auto-retry: check the wall before retrying.
- Points/notification failures after creation report partial success; they do not claim the post failed or that unconfirmed points were awarded.
- A wall-refresh failure after publication is separate from publication failure.
- Missing SDK identity blocks sending rather than creating generic sender metadata. Optional profile enrichment can fail without discarding the SDK identity.
- Session/API errors are logged with operation, error kind, and HTTP status only, not raw responses or credentials.

## Embedded UI and icons

The picker uses composed event paths for outside clicks in shadow DOM. Delayed directory results cannot reopen a closed picker. Rerender and SDK `unmountBlock` clean up timers, requests, document listeners, and hovercards.

Reward types still accept arbitrary valid Tabler `ti-*` names. The pinned Tabler 3.19.0 stylesheet is loaded into both the document (font registration) and the widget shadow root (icon selectors). Normal DOM works too. Filters, tiles, and wall badges share these rules. The host must allow `https://cdn.jsdelivr.net` for styles and fonts; blocked stylesheet/font loads show an explicit notice. Chrome regression tests serve the matching pinned package locally, so tests do not depend on CDN availability.

## Build and regression checks

From this directory:

```sh
npm ci
npm run typecheck
npm test
```

Tests use Playwright and the installed Google Chrome on macOS. On other platforms, install Playwright Chromium with `npx playwright install chromium`, or set `CHROME_PATH` to an existing Chromium-compatible executable.

`npm test` builds the real widget and tests it with a synthetic Staffbase host/API in ordinary and shadow DOM. It creates no live posts or notifications. Coverage includes session token retrieval, discovery failures, picker lifecycle, HTTP rejection, partial success, edit/like failure, metadata, and actual Tabler font loading.

`preview.html` loads the actual `dist/recognition-widget.js` rather than a copied implementation. Serve this directory with a local HTTP server to use the in-memory preview; rebuild with `npm run build` after changes. Do not add real credentials to the preview.

## Deployment verification

Deploy the rebuilt `dist/recognition-widget.js` through the normal widget hosting process and confirm that the live page loads the new artifact rather than a cached copy. With an explicitly authorized test post, verify:

1. The host method supplies CSRF (or the tenant supports the branch-discovery fallback); do not paste token values into logs.
2. Creation succeeds with the existing JSON payload and returns the current user as author and the full recognition title.
3. A first click keeps the recipient suggestions open, and icons appear in the shadow root.
4. Comments/likes/notification settings and points-disabled behavior match configuration.

The automated suite validates the client behavior, not the tenant's live CSRF/discovery or payload contract. Successful native posting alone does not prove the widget's exact payload is accepted. Do not replay captured requests or create live test posts without authorization.
