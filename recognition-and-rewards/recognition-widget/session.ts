type AuthManager = {
  getCsrfToken?: () => unknown;
  csrfToken?: unknown;
};

type HostWindow = Window & {
  we?: { authMgr?: AuthManager };
  csrfToken?: unknown;
};

export class RequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RequestError";
  }
}

export async function checkResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  const messages: Record<number, string> = {
    400: "Staffbase rejected this request. Check the recognition details.",
    401: "Your session has expired. Sign in again before retrying.",
    403: "Staffbase denied this request. Refresh your session and check channel permissions.",
    404: "The configured channel or post could not be found.",
    429: "Too many requests. Wait before trying again.",
  };
  throw new RequestError(messages[response.status] || "Staffbase could not complete this request.", response.status);
}

export function reportError(operation: string, error: unknown): void {
  // Do not log response bodies, host errors, request headers, or user profiles.
  console.error(`[recognition] ${operation}`, {
    kind: error instanceof Error ? error.name : "UnknownError",
    status: error instanceof RequestError ? error.status : undefined,
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof RequestError
    ? error.message
    : "The request could not be confirmed. Check the wall before trying again.";
}

function tokenString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RequestError("Your Staffbase session is not ready. Refresh the page and try again.")), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createSessionRequest(baseUrl: string, signal: AbortSignal) {
  let pendingToken: Promise<string> | undefined;

  async function resolveToken(): Promise<string> {
    let host: HostWindow | undefined;
    try {
      host = (window.top || window) as HostWindow;
      // Access can throw even though window.top itself is readable.
      const manager = host.we?.authMgr;
      if (typeof manager?.getCsrfToken === "function") {
        const token = tokenString(await withTimeout(Promise.resolve(manager.getCsrfToken())));
        if (!token) throw new RequestError("Your Staffbase session is not ready. Refresh the page and try again.");
        return token;
      }
      const legacyToken = tokenString(manager?.csrfToken) || tokenString(host.csrfToken);
      if (legacyToken) return legacyToken;
    } catch (error) {
      const securityError = error !== null && typeof error === "object" &&
        "name" in error && error.name === "SecurityError";
      if (!securityError) {
        if (error instanceof RequestError) throw error;
        reportError("Host authentication failed", error);
        throw new RequestError("Could not read your Staffbase session. Refresh the page before trying again.");
      }
      console.warn("[recognition] Host authentication is cross-origin; using same-origin branch discovery.");
    }

    // Compatibility path for embeds without access to the host auth manager.
    // Share only the in-flight request, never persist a token across sessions.
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    const timer = setTimeout(abort, 5000);
    try {
      const response = await checkResponse(await fetch(`${baseUrl}/branch/discover`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }));
      const data: unknown = await response.json();
      const token = data && typeof data === "object" && "csrfToken" in data
        ? tokenString(data.csrfToken) : "";
      if (!token) throw new RequestError("Staffbase did not provide a session token. Refresh the page or contact your administrator.");
      return token;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }

  return async function sessionRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = new URL(`${baseUrl}${path}`, window.location.href);
    const mutation = !["GET", "HEAD"].includes((options.method || "GET").toUpperCase());
    const headers = new Headers(options.headers);
    if (url.origin !== window.location.origin) {
      throw new RequestError("The widget API URL must use the same Staffbase site as your session.");
    }
    if (mutation) {
      if (!pendingToken) {
        pendingToken = resolveToken().finally(() => { pendingToken = undefined; });
      }
      headers.set("x-csrf-token", await pendingToken);
    }
    if (signal.aborted) throw new DOMException("Widget unmounted", "AbortError");
    return checkResponse(await fetch(url.href, {
      ...options, headers, credentials: "include", signal,
    }));
  };
}
