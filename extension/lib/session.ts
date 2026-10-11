import { API_BASE_URL } from "./config";

/**
 * The extension's session (task-485): the refresh token of its own
 * `browser_extension` lineage, renewed at every use, dead after 90 days without
 * one and a year after the pairing at the latest.
 *
 * - The refresh token lives in `storage.local` (it must survive a browser
 *   restart), the access token in `storage.session` (memory, gone with the
 *   browser). Both are closed to content scripts — the extension has none, but
 *   the access level says so rather than relying on it.
 * - Every rotation goes through `refresh()`. The popup and the background are
 *   separate contexts and may race on the same single-use token; the API's
 *   60-second replay window answers both with the same pair.
 * - A 401 on /refresh means the lineage is over (expired or unlinked): the
 *   tokens are dropped and `expired` is set, so the popup asks to pair again.
 */
// No expiry is kept here: the idle window slides at every use and /refresh does
// not say where it now ends, so a local date would go stale. The server decides
// (a 401), and the popup learns it from there.
type StoredRefresh = { token: string };
type StoredAccess = { token: string; expiresAtMs: number };

const REFRESH_KEY = "refresh";
const EXPIRED_KEY = "expired";
const ACCESS_KEY = "access";
/** A token is rotated this long before it expires. */
const BUFFER_MS = 30_000;

export class NotLinkedError extends Error {
  constructor() {
    super("not_linked");
  }
}

const storageReady = Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
]);

async function readRefresh(): Promise<StoredRefresh | null> {
  await storageReady;
  const stored = await chrome.storage.local.get(REFRESH_KEY);
  return (stored[REFRESH_KEY] as StoredRefresh | undefined) ?? null;
}

/** Keep the refresh token a pairing handed over, and forget any old session. */
export async function savePairing(refreshToken: string): Promise<void> {
  await storageReady;
  await chrome.storage.local.set({ [REFRESH_KEY]: { token: refreshToken } satisfies StoredRefresh });
  await chrome.storage.local.remove("folderId");
  await chrome.storage.local.remove(EXPIRED_KEY);
  await chrome.storage.session.remove(ACCESS_KEY);
}

async function forget(expired: boolean): Promise<void> {
  await chrome.storage.local.remove(REFRESH_KEY);
  await chrome.storage.session.remove(ACCESS_KEY);
  await chrome.storage.local.remove("folderId");
  if (expired) await chrome.storage.local.set({ [EXPIRED_KEY]: true });
  else await chrome.storage.local.remove(EXPIRED_KEY);
}

export type LinkState = "linked" | "unlinked" | "expired";

export async function linkState(): Promise<LinkState> {
  if (await readRefresh()) return "linked";
  const stored = await chrome.storage.local.get(EXPIRED_KEY);
  return stored[EXPIRED_KEY] ? "expired" : "unlinked";
}

let inflight: Promise<string> | null = null;

export function refresh(): Promise<string> {
  inflight ??= (async () => {
    const current = await readRefresh();
    if (!current) throw new NotLinkedError();
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.token }),
    });
    if (response.status === 401) {
      await forget(true);
      throw new NotLinkedError();
    }
    if (!response.ok) throw new Error(`refresh_failed_${response.status}`);
    const body = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
    await chrome.storage.local.set({ [REFRESH_KEY]: { token: body.refresh_token } satisfies StoredRefresh });
    await chrome.storage.session.set({
      [ACCESS_KEY]: { token: body.access_token, expiresAtMs: Date.now() + body.expires_in * 1000 } satisfies StoredAccess,
    });
    return body.access_token;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function accessToken(): Promise<string> {
  const stored = await chrome.storage.session.get(ACCESS_KEY);
  const access = stored[ACCESS_KEY] as StoredAccess | undefined;
  if (access && access.expiresAtMs - BUFFER_MS > Date.now()) return access.token;
  return refresh();
}

/** "Sign out": revoke this extension's lineage (/logout), then forget it here. */
export async function signOut(): Promise<void> {
  try {
    const bearer = await accessToken();
    // accessToken may rotate it: logout must present the current head.
    const current = await readRefresh();
    if (current) {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ refresh_token: current.token }),
      });
      if (!response.ok && response.status !== 401) throw new Error("logout_failed");
    }
  } catch (error) {
    if (!(error instanceof NotLinkedError)) throw error;
  }
  await forget(false);
}
