import { browser } from "wxt/browser";
import { responseError } from "./errors";
import { API_BASE_URL } from "./config";

/**
 * The extension's session: the stable refresh grant of its own
 * `browser_extension` lineage, renewed at every use, dead after 90 days without
 * one and a year after the pairing at the latest.
 *
 * - The refresh token lives in `storage.local` (it must survive a browser
 *   restart), the access token in `storage.session` (memory, gone with the
 *   browser). Both are closed to content scripts — the extension has none, but
 *   the access level says so rather than relying on it.
 * - `refresh()` renews that grant’s idle deadline and gets a new five-minute
 *   access token. The grant itself stays the same; panel/background requests
 *   do not rotate a single-use token. `inflight` only coalesces local calls.
 * - A 401 on /refresh means the lineage is over (expired or unlinked): the
 *   tokens are dropped and `expired` is set, so the side panel asks to pair again.
 */
// No expiry is kept here: the idle window slides at every use and /refresh does
// not say where it now ends, so a local date would go stale. The server decides
// (a 401), and the side panel learns it from there.
type StoredRefresh = { token: string };
type StoredAccess = { token: string; expiresAtMs: number };
/** The account the grant belongs to, as `/api/auth/me` names it (TASK-634). */
export type LinkedAccount = { id: string; email: string };

const REFRESH_KEY = "refresh";
const ACCOUNT_KEY = "account";
/** The web account the reader chose to keep saving beside ("Keep current", TASK-638). */
const IGNORED_WEB_ACCOUNT_KEY = "ignoredWebAccount";
/** A re-pairing waits this long at most for the old grant to be revoked. */
const REVOKE_TIMEOUT_MS = 5000;
const EXPIRED_KEY = "expired";
const ACCESS_KEY = "access";
/** Obtain a fresh access token this long before it expires. */
const BUFFER_MS = 30_000;

export class NotLinkedError extends Error {
  readonly code = "session_expired";
  constructor() {
    super("not_linked");
  }
}

// Firefox does not offer Chromium's local access restriction. It has no content
// scripts in this extension; session storage is trusted-context-only by default.
let storageReady: Promise<unknown> | undefined;
function prepareStorage(): Promise<unknown> {
  return storageReady ??= import.meta.env.FIREFOX
    ? Promise.resolve()
    : Promise.all([
        browser.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
        browser.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
      ]);
}

async function readRefresh(): Promise<StoredRefresh | null> {
  await prepareStorage();
  const stored = await browser.storage.local.get(REFRESH_KEY);
  return (stored[REFRESH_KEY] as StoredRefresh | undefined) ?? null;
}

/**
 * Keep the stable grant handed over by pairing, and end the old session.
 *
 * Linking to another account used to overwrite the previous grant only here:
 * its lineage stayed valid on the server and listed on the old account. It is
 * now revoked first, at best — a revocation that fails or takes too long (no
 * network, the old grant already dead) never stands in the way of the new link.
 */
export async function savePairing(refreshToken: string): Promise<void> {
  await prepareStorage();
  const previous = await readRefresh();
  if (previous && previous.token !== refreshToken) await revoke(previous.token).catch(() => undefined);
  await browser.storage.local.set({ [REFRESH_KEY]: { token: refreshToken } satisfies StoredRefresh });
  await browser.storage.local.remove(["folderId", EXPIRED_KEY, ACCOUNT_KEY, IGNORED_WEB_ACCOUNT_KEY]);
  await browser.storage.session.remove(ACCESS_KEY);
}

/** Revoke one grant through /logout, which wants an access token of the same lineage. */
async function revoke(token: string): Promise<void> {
  const signal = AbortSignal.timeout(REVOKE_TIMEOUT_MS);
  const renewed = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: token }),
    signal,
  });
  if (!renewed.ok) return;
  const body = (await renewed.json()) as { access_token: string; refresh_token: string };
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${body.access_token}` },
    body: JSON.stringify({ refresh_token: body.refresh_token }),
    signal,
  });
}

/** The account this extension saves into: kept from `/api/auth/me`, asked again when unknown. */
export async function linkedAccount(): Promise<LinkedAccount | null> {
  if (!(await readRefresh())) return null;
  const stored = await browser.storage.local.get(ACCOUNT_KEY);
  const known = stored[ACCOUNT_KEY] as LinkedAccount | undefined;
  if (known?.id && known.email) return known;
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (response.status === 401) {
    await forget(true);
    throw new NotLinkedError();
  }
  if (!response.ok) throw await responseError(response);
  const me = (await response.json()) as { id: string; email: string };
  const account: LinkedAccount = { id: me.id, email: me.email };
  await browser.storage.local.set({ [ACCOUNT_KEY]: account });
  return account;
}

/**
 * The account signed in on the web, read from the web session's cookie by
 * `/api/auth/web-account` (TASK-638) — so on Firefox too, and right even when the
 * web app has not been opened since the account changed. The extension's own
 * session is not involved: the request carries no bearer, only the browser's
 * cookie for the API host, which `host_permissions` already covers.
 *
 * Any failure is no account: no network, a browser that does not send the cookie,
 * a 404 before the API carrying the route is deployed.
 */
export async function webAccount(): Promise<LinkedAccount | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/web-account`, { credentials: "include", cache: "no-store" });
    if (!response.ok) return null;
    const { account } = (await response.json()) as { account?: Partial<LinkedAccount> | null };
    return account?.id && account.email ? { id: account.id, email: account.email } : null;
  } catch {
    return null;
  }
}

export async function ignoredWebAccount(): Promise<string | null> {
  const stored = await browser.storage.local.get(IGNORED_WEB_ACCOUNT_KEY);
  return (stored[IGNORED_WEB_ACCOUNT_KEY] as string | undefined) ?? null;
}

/** "Keep current": no banner for this web account; another one brings it back. */
export async function ignoreWebAccount(id: string): Promise<void> {
  await browser.storage.local.set({ [IGNORED_WEB_ACCOUNT_KEY]: id });
}

async function forget(expired: boolean): Promise<void> {
  await browser.storage.local.remove(REFRESH_KEY);
  await browser.storage.session.remove(ACCESS_KEY);
  await browser.storage.local.remove(["folderId", ACCOUNT_KEY, IGNORED_WEB_ACCOUNT_KEY]);
  if (expired) await browser.storage.local.set({ [EXPIRED_KEY]: true });
  else await browser.storage.local.remove(EXPIRED_KEY);
}

/** A second rejected bearer response also ends this local session. */
export async function expireSession(): Promise<void> { await forget(true); }

export type LinkState = "linked" | "unlinked" | "expired";

export async function linkState(): Promise<LinkState> {
  if (await readRefresh()) return "linked";
  const stored = await browser.storage.local.get(EXPIRED_KEY);
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
    if (!response.ok) throw await responseError(response);
    const body = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
    await browser.storage.local.set({ [REFRESH_KEY]: { token: body.refresh_token } satisfies StoredRefresh });
    await browser.storage.session.set({
      [ACCESS_KEY]: { token: body.access_token, expiresAtMs: Date.now() + body.expires_in * 1000 } satisfies StoredAccess,
    });
    return body.access_token;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function accessToken(): Promise<string> {
  const stored = await browser.storage.session.get(ACCESS_KEY);
  const access = stored[ACCESS_KEY] as StoredAccess | undefined;
  if (access && access.expiresAtMs - BUFFER_MS > Date.now()) return access.token;
  return refresh();
}

/** "Sign out": revoke this extension's lineage (/logout), then forget it here. */
export async function signOut(): Promise<void> {
  try {
    const bearer = await accessToken();
    // Logout revokes the same stable grant used to renew access tokens.
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
