/**
 * Staffbase Industry Switcher — Parent Shell Script
 * ==================================================
 * Inject this via Staffbase Custom JavaScript.
 *
 * HOW IT WORKS (the walkie-talkie analogy):
 *   1. The portal iframe (hosted on cdcruz-sbse.github.io) is one radio.
 *   2. This script is the other radio, running in the Staffbase app shell.
 *   3. When a user taps a link in the portal, the iframe posts a message
 *      with { type, groupId, destination }.
 *   4. This script catches that message, switches the user's group
 *      membership via API, then navigates the top-level page to the
 *      destination — which the iframe can't do on its own.
 *
 * WHAT CHANGED FROM THE ORIGINAL:
 *   - ALLOWED_MESSAGE_ORIGINS updated to cdcruz-sbse.github.io
 *   - Added cache: 'no-store' on discovery/user fetches (prevents
 *     stale data in mobile webviews with aggressive caching)
 *   - Navigation delay of 150ms on mobile to let pending API calls
 *     flush before the page unloads
 *   - Longer isProcessing timeout (5s) to prevent double-taps on
 *     slower mobile connections
 */
(() => {
  'use strict';

  console.log('[Switcher] Parent shell script loaded.');

  /* ============================================
     CONSTANTS
     ============================================ */
  const MESSAGE_TYPE = 'staffbase-industry-switch';

  const INDUSTRY_GROUP_IDS = new Set([
    '69672894afdf7d24c5feaafd', // Manufacturing
    '69672db75cff0a6a031724d7', // Education
    '69672f84a2c10951567a0552', // Financial Services
    '69535e6338dc171a511fecbe', // Healthcare
    '69672fbaafdf7d24c5feef0c', // Retail
    '69673076a2c10951567a0db5'  // Futures
  ]);

  const DISCOVER_ENDPOINT = '/auth/discover';
  const USER_ENDPOINT = '/api/users/me';
  const DISCOVER_ACCEPT = 'application/vnd.staffbase.auth.discovery.v2+json';
  const USER_ACCEPT = 'application/vnd.staffbase.accessors.user.v2+json';

  // Origins allowed to send messages to this listener.
  // The portal iframe is hosted on GitHub Pages; the Staffbase
  // app shell is the current origin.
  const ALLOWED_MESSAGE_ORIGINS = new Set([
    window.location.origin,
    'https://cdcruz-sbse.github.io'
  ]);

  /* ============================================
     STATE
     ============================================ */
  let isProcessing = false;

  /* ============================================
     MOBILE DETECTION
     ============================================ */
  function isMobileDevice() {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const smallScreen = window.innerWidth <= 1024;
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    return hasTouch && (smallScreen || mobileUA);
  }

  /* ============================================
     ORIGIN VALIDATION
     ============================================ */
  function isAllowedOrigin(origin) {
    // Sandboxed iframes report origin as 'null' (string)
    if (origin === 'null') return true;
    if (ALLOWED_MESSAGE_ORIGINS.has(origin)) return true;
    console.warn('[Switcher] Blocked message from origin:', origin);
    return false;
  }

  /* ============================================
     DESTINATION VALIDATION
     Ensures we only navigate to safe /content/page/ paths.
     ============================================ */
  function normalizeDestination(destination) {
    if (!destination) return '';

    // Handle relative app paths (mobile webview sends these)
    if (typeof destination === 'string' && destination.startsWith('/content/page/')) {
      return destination;
    }

    // Handle full URLs
    try {
      const url = new URL(destination, window.location.origin);
      if (url.origin !== window.location.origin) return '';
      if (!url.pathname.startsWith('/content/page/')) return '';
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return '';
    }
  }

  /* ============================================
     DISCOVERY + USER FETCH
     Gets the current user and CSRF token.
     Tries /auth/discover first (one call for both),
     falls back to /api/users/me.
     ============================================ */
  async function fetchDiscover() {
    const response = await fetch(DISCOVER_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'accept': DISCOVER_ACCEPT }
    });

    if (!response.ok) {
      console.warn('[Switcher] Discovery failed:', response.status);
      throw new Error('Discovery unavailable.');
    }

    const payload = await response.json();
    console.log('[Switcher] Discovery loaded.');
    return payload;
  }

  async function fetchUserFallback() {
    const response = await fetch(USER_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'accept': USER_ACCEPT }
    });

    if (!response.ok) {
      console.warn('[Switcher] User fetch failed:', response.status);
      throw new Error('User fetch failed.');
    }

    const payload = await response.json();
    console.log('[Switcher] User loaded from fallback.');
    return payload;
  }

  async function getUserAndToken() {
    try {
      const discovery = await fetchDiscover();
      if (discovery && discovery.user) {
        return {
          user: discovery.user,
          csrfToken: discovery.csrfToken || ''
        };
      }
    } catch (error) {
      console.warn('[Switcher] Discovery unavailable, using fallback.');
    }

    const user = await fetchUserFallback();
    return { user, csrfToken: '' };
  }

  /* ============================================
     GROUP MEMBERSHIP API
     ============================================ */
  async function updateGroupMembership(groupId, action, userId, csrfToken) {
    const isAdd = action === 'add';
    const mediaType = isAdd
      ? 'application/vnd.staffbase.accessors.group.members-add.v1+json'
      : 'application/vnd.staffbase.accessors.group.members-remove.v1+json';

    const headers = {
      'accept': mediaType,
      'content-type': mediaType
    };
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    console.log('[Switcher] Updating group:', { groupId, action });
    const response = await fetch(`/api/groups/${groupId}/members`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify({ userIds: [userId] })
    });

    if (!response.ok) {
      console.warn('[Switcher] Group update failed:', {
        groupId,
        action,
        status: response.status
      });
      throw new Error(`Failed to ${action} group membership.`);
    }
    console.log('[Switcher] Group update success:', { groupId, action });
  }

  /* ============================================
     SWITCH GROUP
     Removes old industry groups, adds the new one.
     ============================================ */
  async function switchToGroup(targetGroupId) {
    const { user, csrfToken } = await getUserAndToken();

    if (!user || !user.id) {
      throw new Error('Missing user context.');
    }

    const currentIds = Array.isArray(user.groupIDs) ? user.groupIDs : [];
    const toRemove = currentIds.filter(
      (gid) => INDUSTRY_GROUP_IDS.has(gid) && gid !== targetGroupId
    );
    const needsAdd = !currentIds.includes(targetGroupId);

    console.log('[Switcher] Group state:', { toRemove, needsAdd });
    if (!toRemove.length && !needsAdd) return;

    if (toRemove.length) {
      const removals = toRemove.map((gid) =>
        updateGroupMembership(gid, 'remove', user.id, csrfToken)
      );
      await Promise.allSettled(removals);
    }

    if (needsAdd) {
      await updateGroupMembership(targetGroupId, 'add', user.id, csrfToken);
    }
  }

  /* ============================================
     MESSAGE LISTENER
     This is the core — listens for postMessage
     from the portal iframe and acts on it.
     ============================================ */
  window.addEventListener('message', (event) => {
    // Ignore unrelated messages
    if (!event || !event.data || event.data.type !== MESSAGE_TYPE) return;

    console.log('[Switcher] Message received:', {
      origin: event.origin,
      data: event.data
    });

    // Validate origin
    if (!isAllowedOrigin(event.origin)) return;

    // Validate groupId
    const targetGroupId = String(event.data.groupId || '');
    if (!INDUSTRY_GROUP_IDS.has(targetGroupId)) {
      console.warn('[Switcher] Unknown groupId:', targetGroupId);
      return;
    }

    // Validate destination
    const destination = normalizeDestination(event.data.destination);
    if (!destination) {
      console.warn('[Switcher] Destination rejected:', event.data.destination);
      return;
    }

    // Prevent double-processing (especially important on mobile
    // where double-taps and slow networks can cause re-fires)
    if (isProcessing) {
      console.warn('[Switcher] Already processing a request.');
      return;
    }

    isProcessing = true;
    console.log('[Switcher] Processing:', { groupId: targetGroupId, destination });

    switchToGroup(targetGroupId)
      .catch((error) => {
        console.error('[Switcher] Switch failed:', error);
      })
      .finally(() => {
        console.log('[Switcher] Navigating to:', destination);

        // On mobile webviews, add a small delay to let pending
        // API responses settle before the page unloads.
        // Without this, Android WebView sometimes kills in-flight
        // requests during navigation.
        if (isMobileDevice()) {
          setTimeout(() => {
            window.location.href = destination;
          }, 150);
        } else {
          window.location.href = destination;
        }

        // Safety reset — if navigation was somehow blocked
        // (e.g. by a beforeunload handler), unlock after 5s
        setTimeout(() => {
          isProcessing = false;
        }, 5000);
      });
  });
})();
