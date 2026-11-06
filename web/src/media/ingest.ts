import { getFriendlyErrorMessage } from "@media-summarizer/core/errors/friendlyError";
import { getQuotaErrorCode, getQuotaErrorMessage } from "@media-summarizer/core/errors/quotaError";
import { getActiveLocale, t } from "@media-summarizer/core/i18n/runtime";
import type { IngestUrlResponse } from "@media-summarizer/core/types/media";
import {
  validateSharedNoteText,
  type IngestSharedContentResponse,
} from "@media-summarizer/core/types/sharedContent";
import {
  prepareLocalUploadFile,
  type UploadAudioResponse,
  type UploadDocumentResponse,
} from "@media-summarizer/core/types/upload";
import { apiRequest } from "../api";
import { startUploadTrace } from "../lib/crashReporting";

/**
 * Adding a source from the web, on the endpoints the mobile app uses.
 *
 * - A link: `POST /api/media/ingest-url`.
 * - A text with no link in it: a note, `POST /api/media/ingest-shared-content`
 *   (`share_type: "text"`, `source_platform: "notes"`), as the mobile app files
 *   a shared note.
 * - A file: `POST /api/media/upload-url` signs a PUT, the browser sends the
 *   bytes straight to S3 (the bucket answers the web app's origin, task-478),
 *   then `POST /api/media/upload` or `/upload-audio` hands over the key. The
 *   API never receives the bytes.
 *
 * `folderId` files the source on arrival; `null` leaves it in Unsorted.
 * Every failure is thrown as an `Error` whose message is ready to show.
 */
export const SOURCE_APP = "web-app";

export async function addLink(url: string, folderId: string | null): Promise<string> {
  try {
    const response = await apiRequest<IngestUrlResponse>("/api/media/ingest-url", {
      method: "POST",
      body: { url, source_app: SOURCE_APP, locale: getActiveLocale(), folder_id: folderId },
    });
    return response.media_item_id;
  } catch (error) {
    throw new Error(describeRefusal(error));
  }
}

export async function addNote(text: string, folderId: string | null): Promise<string> {
  const validated = validateSharedNoteText(text);
  if ("rejection" in validated) throw new Error(validated.rejection.message);
  try {
    const response = await apiRequest<IngestSharedContentResponse>("/api/media/ingest-shared-content", {
      method: "POST",
      body: {
        share_type: "text",
        source_platform: "notes",
        source_app: SOURCE_APP,
        idempotency_key: `note-text-${crypto.randomUUID()}`,
        text: validated.text,
        locale: getActiveLocale(),
        folder_id: folderId,
      },
    });
    return response.media_item_id;
  } catch (error) {
    throw new Error(describeRefusal(error));
  }
}

type UploadUrlResponse = { upload_url: string; upload_key: string; expires_in: number };

export async function addFile(file: File, folderId: string | null): Promise<string> {
  const prepared = prepareLocalUploadFile({ uri: "", name: file.name, mimeType: file.type, size: file.size });
  if ("rejection" in prepared) throw new Error(prepared.rejection.message);
  const { kind, mimeType } = prepared.file;

  // The trace of the direct upload (task-604): figures and enums, never the URL or the name.
  const trace = startUploadTrace({ "upload.target": kind, "upload.content_type": mimeType, "upload.bytes": file.size });
  const fail = (stage: string, message: string, status?: number): Error => {
    trace.set({ "upload.failure_stage": stage, "http.response.status_code": status });
    trace.end("error");
    return new Error(message);
  };

  let issued: UploadUrlResponse;
  try {
    issued = await trace.step("sign", () =>
      apiRequest<UploadUrlResponse>("/api/media/upload-url", {
        method: "POST",
        body: { target: kind, filename: file.name, content_type: mimeType, file_size: file.size },
      }),
    );
  } catch (error) {
    throw fail("sign", describeRefusal(error));
  }

  let put: Response;
  try {
    put = await trace.step("put", async () => {
      const response = await fetch(issued.upload_url, { method: "PUT", headers: { "Content-Type": mimeType }, body: file });
      if (!response.ok) throw response;
      return response;
    });
  } catch (caught) {
    if (caught instanceof Response) throw fail("put_rejected", t("upload.transferFailed.rejected"), caught.status);
    throw fail("put_network", t("upload.transferFailed.network"));
  }
  trace.set({ "http.response.status_code": put.status });
  trace.end("ok");

  try {
    const response = await apiRequest<UploadDocumentResponse | UploadAudioResponse>(
      kind === "audio" ? "/api/media/upload-audio" : "/api/media/upload",
      { method: "POST", body: { upload_key: issued.upload_key, folder_id: folderId } },
    );
    return response.media_item_id;
  } catch (error) {
    throw new Error(describeRefusal(error));
  }
}

/** A quota refusal names its figures; anything else gets the friendly wording of its code. */
function describeRefusal(error: unknown): string {
  const quota = getQuotaErrorCode(error);
  if (quota) return getQuotaErrorMessage(error, quota);
  return getFriendlyErrorMessage(error, { fallback: t("common.somethingWentWrong") });
}
