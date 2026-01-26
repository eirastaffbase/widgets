(() => {
  console.log('[Switcher] Global script loaded.');
  const MESSAGE_TYPE = 'staffbase-industry-switch';
  const INDUSTRY_GROUP_IDS = new Set([
    '69672894afdf7d24c5feaafd',
    '69672db75cff0a6a031724d7',
    '69672f84a2c10951567a0552',
    '69535e6338dc171a511fecbe',
    '69672fbaafdf7d24c5feef0c',
    '69673076a2c10951567a0db5'
  ]);
  const DISCOVER_ENDPOINT = '/auth/discover';
  const USER_ENDPOINT = '/api/users/me';
  const DISCOVER_ACCEPT = 'application/vnd.staffbase.auth.discovery.v2+json';
  const USER_ACCEPT = 'application/vnd.staffbase.accessors.user.v2+json';
  const ALLOWED_MESSAGE_ORIGINS = new Set([
    window.location.origin,
    'https://eirastaffbase.github.io'
  ]);

  let isProcessing = false;

  function isAllowedOrigin(origin) {
    if (origin === 'null') return true;
    if (ALLOWED_MESSAGE_ORIGINS.has(origin)) return true;
    console.warn('[Switcher] Blocked message origin:', origin);
    return false;
  }

  function normalizeDestination(destination) {
    if (!destination) return '';
    try {
      const url = new URL(destination, window.location.origin);
      if (url.origin !== window.location.origin) return '';
      if (!url.pathname.startsWith('/content/page/')) return '';
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return '';
    }
  }

  async function fetchDiscover() {
    const response = await fetch(DISCOVER_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'accept': DISCOVER_ACCEPT
      }
    });

    if (!response.ok) {
      console.warn('[Switcher] Discovery request failed:', response.status);
      throw new Error('Failed to load discovery information.');
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
      headers: {
        'accept': USER_ACCEPT
      }
    });

    if (!response.ok) {
      console.warn('[Switcher] User fetch failed:', response.status);
      throw new Error('Failed to load user information.');
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
      // Fall back to /api/users/me when discovery is unavailable.
    }

    const user = await fetchUserFallback();
    return { user, csrfToken: '' };
  }

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

    console.log('[Switcher] Updating group membership.', { groupId, action });
    const response = await fetch(`/api/groups/${groupId}/members`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify({ userIds: [userId] })
    });

    if (!response.ok) {
      console.warn('[Switcher] Group update failed.', {
        groupId,
        action,
        status: response.status
      });
      throw new Error(`Failed to ${action} group membership.`);
    }
    console.log('[Switcher] Group update success.', { groupId, action });
  }

  async function switchToGroup(targetGroupId) {
    const result = await getUserAndToken();
    const user = result.user;
    const csrfToken = result.csrfToken;

    if (!user || !user.id) {
      throw new Error('Missing user context.');
    }

    const currentGroupIds = Array.isArray(user.groupIDs) ? user.groupIDs : [];
    const groupsToRemove = currentGroupIds.filter(
      (groupId) => INDUSTRY_GROUP_IDS.has(groupId) && groupId !== targetGroupId
    );
    const needsAdd = !currentGroupIds.includes(targetGroupId);

    console.log('[Switcher] Current industry groups:', {
      groupsToRemove,
      needsAdd
    });
    if (!groupsToRemove.length && !needsAdd) return;

    if (groupsToRemove.length) {
      const removals = groupsToRemove.map((groupId) =>
        updateGroupMembership(groupId, 'remove', user.id, csrfToken)
      );
      await Promise.allSettled(removals);
    }

    if (needsAdd) {
      await updateGroupMembership(targetGroupId, 'add', user.id, csrfToken);
    }
  }

  window.addEventListener('message', (event) => {
    if (!event || !event.data || event.data.type !== MESSAGE_TYPE) return;
    console.log('[Switcher] Message received.', {
      origin: event.origin,
      data: event.data
    });
    if (!isAllowedOrigin(event.origin)) return;

    const targetGroupId = String(event.data.groupId || '');
    if (!INDUSTRY_GROUP_IDS.has(targetGroupId)) {
      console.warn('[Switcher] Unknown groupId:', targetGroupId);
      return;
    }

    const destination = normalizeDestination(event.data.destination);
    if (!destination) {
      console.warn('[Switcher] Destination rejected:', event.data.destination);
      return;
    }

    if (isProcessing) {
      console.warn('[Switcher] Already processing a request.');
      return;
    }
    isProcessing = true;
    console.log('[Switcher] Processing request:', {
      groupId: targetGroupId,
      destination
    });

    switchToGroup(targetGroupId)
      .catch((error) => {
        console.error('Industry switch failed:', error);
      })
      .finally(() => {
        console.log('[Switcher] Navigating to:', destination);
        window.location.href = destination;
        isProcessing = false;
      });
  });
})();
