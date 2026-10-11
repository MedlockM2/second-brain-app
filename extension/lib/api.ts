import { browser } from "wxt/browser";
import type { Folder, FolderListResponse } from "@media-summarizer/core/types/organization";
import { API_BASE_URL } from "./config";
import { clientLabel } from "./i18n";
import { accessToken, refresh, savePairing } from "./session";

/**
 * The few calls the extension makes — the ones its token's scope allows
 * (task-485): save a page, save a selection, list the folders. Same endpoints
 * and payloads as the apps (complement §11): no page content ever leaves the
 * browser, only its address or what the reader selected.
 */
const SOURCE_APP = "browser-extension";

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
    });
  const response = await send(await accessToken());
  // Refused mid-flight (an expiry read as still valid): one rotation, one replay.
  return response.status === 401 ? send(await refresh()) : response;
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  return response;
}

export async function listFolders(): Promise<Folder[]> {
  const response = await expectOk(await authed("/api/folders"));
  const body = (await response.json()) as FolderListResponse;
  return body.folders;
}

export async function savePage(url: string, folderId: string | null): Promise<void> {
  await expectOk(
    await authed("/api/media/ingest-url", {
      method: "POST",
      body: JSON.stringify({ url, source_app: SOURCE_APP, locale: browser.i18n.getUILanguage(), folder_id: folderId }),
    }),
  );
}

/** A selection becomes a note that keeps the address of its page (task-486). */
export async function saveSelection(text: string, sourceUrl: string | null, folderId: string | null): Promise<void> {
  await expectOk(
    await authed("/api/media/ingest-shared-content", {
      method: "POST",
      body: JSON.stringify({
        share_type: "text",
        source_platform: "notes",
        source_app: SOURCE_APP,
        idempotency_key: `selection-${crypto.randomUUID()}`,
        text,
        source_url: sourceUrl && /^https?:\/\//.test(sourceUrl) ? sourceUrl : null,
        locale: browser.i18n.getUILanguage(),
        folder_id: folderId,
      }),
    }),
  );
}

/** The rescue code: six digits shown by My account, with the account's email. */
export async function claimPairingCode(email: string, code: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/auth/extension-tokens/pairing-code/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), code: code.trim(), client_label: clientLabel() }),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { refresh_token: string };
  await savePairing(body.refresh_token);
  return true;
}

/** The folder last saved into, offered first next time. */
export async function lastFolderId(): Promise<string | null> {
  const stored = await browser.storage.local.get("folderId");
  return (stored.folderId as string | undefined) ?? null;
}

export async function rememberFolder(folderId: string | null): Promise<void> {
  await browser.storage.local.set({ folderId });
}
