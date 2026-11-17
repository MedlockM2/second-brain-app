import { browser } from "wxt/browser";
import type { ArtifactContentResponse, ArtifactListResponse, ArtifactSummary } from "@media-summarizer/core/types/artifacts";
import type { ChatConversationDetail, ChatConversationList } from "@media-summarizer/core/types/chat";
import type {
  ArtifactType,
  IngestUrlResponse,
  ListMediaResponse,
  MediaItemContract,
  MediaListItem,
  MediaStatusResponse,
  RawContentResponse,
} from "@media-summarizer/core/types/media";
import type { Folder, FolderListResponse } from "@media-summarizer/core/types/organization";
import type { IngestSharedContentResponse } from "@media-summarizer/core/types/sharedContent";
import { API_BASE_URL } from "./config";
import { clientLabel } from "./i18n";
import { responseError } from "./errors";
import { accessToken, expireSession, NotLinkedError, refresh, savePairing } from "./session";

/**
 * The calls the extension makes — exactly the routes its token's scope allows
 * (`EXTENSION_ROUTES`, docs/CANONICAL_MEDIA_API_CONTRACT.md, "The browser
 * extension's token"): saving, finding the saves of a page, moving one to a
 * folder, and what the side panel reads — a media's state, preview and full
 * text, its notebook, a conversation about it.
 */
const SOURCE_APP = "browser-extension";

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
    });
  const response = await send(await accessToken());
  // Refused mid-flight (an expiry read as still valid): one access renewal, one replay.
  return response.status === 401 ? send(await refresh()) : response;
}

async function expectOk(response: Response): Promise<Response> {
  if (response.status === 401) {
    await expireSession();
    throw new NotLinkedError();
  }
  if (!response.ok) throw await responseError(response);
  return response;
}

async function getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await (await expectOk(await authed(path, init))).json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const locale = () => browser.i18n.getUILanguage();

export async function listFolders(): Promise<Folder[]> {
  return (await getJson<FolderListResponse>("/api/folders")).folders;
}

export async function createFolder(name: string): Promise<Folder> {
  return getJson<Folder>("/api/folders", post({ name, creation_id: crypto.randomUUID() }));
}

/**
 * Save an address. `pageHtml` is the page as the reader's browser drew it
 * (`lib/page.ts`); the server reads it instead of downloading the page when the
 * address is a web page.
 */
export async function savePage(url: string, folderId: string | null, pageHtml: string | null = null): Promise<string> {
  const body = { url, source_app: SOURCE_APP, locale: locale(), folder_id: folderId, ...(pageHtml ? { page_html: pageHtml } : {}) };
  return (await getJson<IngestUrlResponse>("/api/media/ingest-url", post(body))).media_item_id;
}

/** A selection becomes a note that keeps the address of its page (task-486). */
export async function saveSelection(text: string, sourceUrl: string | null, folderId: string | null): Promise<string> {
  const body = {
    share_type: "text",
    source_platform: "notes",
    source_app: SOURCE_APP,
    idempotency_key: `selection-${crypto.randomUUID()}`,
    text,
    source_url: sourceUrl && /^https?:\/\//.test(sourceUrl) ? sourceUrl : null,
    locale: locale(),
    folder_id: folderId,
  };
  return (await getJson<IngestSharedContentResponse>("/api/media/ingest-shared-content", post(body))).media_item_id;
}

/** The latest save of this address, or `null`: what makes the side panel say "already in your library". */
export async function savedItem(url: string): Promise<MediaListItem | null> {
  const params = new URLSearchParams({ url, limit: "1" });
  return (await getJson<ListMediaResponse>(`/api/media?${params.toString()}`)).items[0] ?? null;
}

export async function mediaItem(mediaItemId: string): Promise<MediaItemContract> {
  return (await getJson<MediaStatusResponse>(`/api/media/${encodeURIComponent(mediaItemId)}`)).media_item;
}

/** Move a save to a folder; `null` is Unsorted. */
export async function moveMedia(mediaItemId: string, folderId: string | null): Promise<void> {
  await expectOk(await authed(`/api/media/${encodeURIComponent(mediaItemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ folder_id: folderId }),
  }));
}

/** A media's notebook: every entry, in flight or done, newest first. */
export async function listArtifacts(mediaItemId: string): Promise<ArtifactSummary[]> {
  const params = new URLSearchParams({ scope: "media", scope_id: mediaItemId, limit: "50" });
  return (await getJson<ArtifactListResponse>(`/api/artifacts?${params.toString()}`)).artifacts;
}

/** A generation with the default options: the panel has no "Customize" screen. */
export async function createArtifact(mediaItemId: string, artifactType: ArtifactType): Promise<void> {
  await expectOk(await authed("/api/artifacts", post({ scope: "media", scope_id: mediaItemId, artifact_type: artifactType })));
}

export async function retryArtifact(artifactId: string): Promise<void> {
  await expectOk(await authed(`/api/artifacts/${encodeURIComponent(artifactId)}/retry`, { method: "POST" }));
}

export async function artifactContent(artifactId: string): Promise<ArtifactContentResponse> {
  return getJson<ArtifactContentResponse>(`/api/artifacts/${encodeURIComponent(artifactId)}/content`);
}

/** The full text, in the reading language when a translation exists, or the original on demand. */
export async function rawContent(mediaItemId: string, original = false): Promise<RawContentResponse> {
  return getJson<RawContentResponse>(`/api/media/${encodeURIComponent(mediaItemId)}/raw-content${original ? "?variant=original" : ""}`);
}

const conversationPath = (conversationId: string) => `/api/chat/conversations/${encodeURIComponent(conversationId)}`;

/** The id of the latest conversation about a media, to pick it up where it was left. */
export async function latestConversationId(mediaItemId: string): Promise<string | null> {
  const params = new URLSearchParams({ scope: "media", scope_id: mediaItemId, limit: "1" });
  const { conversations } = await getJson<ChatConversationList>(`/api/chat/conversations?${params.toString()}`);
  return conversations[0]?.conversation_id ?? null;
}

export async function openConversation(mediaItemId: string): Promise<ChatConversationDetail> {
  return getJson<ChatConversationDetail>("/api/chat/conversations", post({ scope: "media", scope_id: mediaItemId }));
}

export async function conversation(conversationId: string): Promise<ChatConversationDetail> {
  return getJson<ChatConversationDetail>(conversationPath(conversationId));
}

/** The same `clientRequestId` on a retry of one question: the server answers the turn it already made. */
export async function sendTurn(conversationId: string, question: string, clientRequestId: string): Promise<void> {
  await expectOk(await authed(`${conversationPath(conversationId)}/turns`, post({ question, client_request_id: clientRequestId })));
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

/** The folder last saved into, used by the next save. */
export async function lastFolderId(): Promise<string | null> {
  const stored = await browser.storage.local.get("folderId");
  return (stored.folderId as string | undefined) ?? null;
}

export async function rememberFolder(folderId: string | null): Promise<void> {
  await browser.storage.local.set({ folderId });
}
