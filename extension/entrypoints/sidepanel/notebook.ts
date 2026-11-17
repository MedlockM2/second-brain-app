import type { ArtifactSummary } from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import { artifactContent, createArtifact, listArtifacts, retryArtifact } from "../../lib/api";
import { failureMessage, saveFailure } from "../../lib/errors";
import { msg } from "../../lib/i18n";
import { icon } from "../../lib/icons";
import { contentTitle, drawArtifactBody, FORMATS, formatOf } from "./artifacts";
import { el, note, relativeTime, type Scope, sleep } from "./dom";

/**
 * The Cahier tab, as in the app (mockup `ai_tab_notebooklm`): the four formats
 * under "Generate", then one list — what is being generated, then the entries,
 * newest first — and an entry opened in place of the list.
 *
 * A tile generates with the default options: "Customize", renaming and deleting
 * stay in the app, which the last line opens.
 */
const POLL_MS = 3000;
const POLL_LIMIT = 200;

export interface NotebookView { element: HTMLElement; showList(): void }

export function mountNotebook(
  scope: Scope,
  mediaItemId: string,
  openInApp: () => void,
  onUnlinked: (error: unknown) => boolean,
): NotebookView {
  const root = el("div", { className: "notebook" });
  const status = el("p", { className: "status", attrs: { role: "status" } });
  const list = el("ul", { className: "alist", attrs: { "aria-live": "polite" } });
  let entries: ArtifactSummary[] = [];
  let following = false;
  let loaded = false;

  const inFlight = (entry: ArtifactSummary) => entry.status === "queued" || entry.status === "generating";

  const tiles = FORMATS.map((format) => {
    const tile = el("button", { className: `tile ${format.tone}`, attrs: { type: "button" } }, icon(format.icon, 18), msg(format.label));
    tile.onclick = () => void generate(format.type, tile);
    return tile;
  });
  const inApp = el("button", { className: "aside link", attrs: { type: "button" } }, msg("notebookInApp"), icon("open-outline", 13));
  inApp.onclick = openInApp;
  const listView = el("div", {}, el("h2", { text: msg("generateHeading") }), el("div", { className: "grid" }, ...tiles), status, list, inApp);

  async function generate(type: ArtifactType, tile: HTMLButtonElement): Promise<void> {
    tile.disabled = true;
    status.className = "status";
    status.textContent = "";
    try {
      await createArtifact(mediaItemId, type);
      await refresh();
    } catch (error) {
      if (onUnlinked(error) || !scope.alive) return;
      status.className = "status error";
      status.textContent = failureMessage(saveFailure(error), "artifactRefusalGeneric");
    } finally {
      tile.disabled = false;
    }
  }

  async function refresh(): Promise<void> {
    try {
      const next = await listArtifacts(mediaItemId);
      if (!scope.alive) return;
      entries = next;
      loaded = true;
      drawList();
      if (entries.some(inFlight)) void follow();
    } catch (error) {
      if (onUnlinked(error) || !scope.alive) return;
      if (!loaded) list.replaceChildren(el("li", {}, note(msg("notebookLoadFailed"), true)));
    }
  }

  /** Re-read the list while something is being generated, one loop at a time. */
  async function follow(): Promise<void> {
    if (following) return;
    following = true;
    try {
      for (let attempt = 0; attempt < POLL_LIMIT && scope.alive && entries.some(inFlight); attempt += 1) {
        await sleep(POLL_MS);
        if (!scope.alive) return;
        try {
          entries = await listArtifacts(mediaItemId);
          if (scope.alive) drawList();
        } catch (error) {
          if (onUnlinked(error)) return;
        }
      }
    } finally {
      following = false;
    }
  }

  function drawList(): void {
    const ordered = [...entries.filter(inFlight), ...entries.filter((entry) => !inFlight(entry))];
    list.replaceChildren(...ordered.map(row));
  }

  function row(entry: ArtifactSummary): HTMLElement {
    const format = formatOf(entry.artifact_type);
    const glyph = el("span", { className: `aic ${format.tone}` }, icon(format.icon, 17));
    if (inFlight(entry)) {
      glyph.append(el("i", { className: "spark" }, icon("sparkles", 10)));
      return el("li", { className: "arow gen" }, glyph, el("span", { className: "atx" },
        el("span", { className: "at", text: msg("generating") }),
        el("span", { className: "am", text: msg("generatingMeta").replace("{type}", msg(format.label)) })));
    }
    const failed = entry.status === "failed";
    const meta = failed ? `${msg("generationFailed")} · ${msg("generationRetry")}` : `${msg(format.label)} · ${relativeTime(entry.completed_at ?? entry.created_at)}`;
    const button = el("button", { className: failed ? "arow fail" : "arow", attrs: { type: "button" } }, glyph,
      el("span", { className: "atx" }, el("span", { className: "at", text: entry.title || msg(format.label) }), el("span", { className: "am", text: meta })),
      failed ? icon("refresh-outline", 16, "muted") : icon("chevron-down", 16, "muted fwd"));
    button.onclick = () => void (failed ? retry(entry, button) : open(entry));
    return el("li", {}, button);
  }

  async function retry(entry: ArtifactSummary, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    try {
      await retryArtifact(entry.artifact_id);
      await refresh();
    } catch (error) {
      if (onUnlinked(error) || !scope.alive) return;
      status.className = "status error";
      status.textContent = failureMessage(saveFailure(error), "artifactRefusalGeneric");
      button.disabled = false;
    }
  }

  async function open(entry: ArtifactSummary): Promise<void> {
    const format = formatOf(entry.artifact_type);
    const back = el("button", { className: "crumb", attrs: { type: "button" } }, icon("chevron-back", 16, "flip-rtl"), msg("tabNotebook"));
    back.onclick = showList;
    const body = el("div", {}, note(msg("loading")));
    root.replaceChildren(el("div", { className: "artifact" }, back,
      el("div", { className: `akick ${format.tone}` }, icon(format.icon, 14), msg(format.label).toUpperCase()),
      el("h2", { className: "atitle", text: entry.title || msg(format.label) }),
      el("p", { className: "ameta", text: relativeTime(entry.completed_at ?? entry.created_at) }), body));
    back.focus({ preventScroll: true });
    try {
      const payload = await artifactContent(entry.artifact_id);
      if (!scope.alive || !root.contains(body)) return;
      // The stored envelope is `payload.content`; the web passes the same to its body.
      const title = entry.title?.trim() || contentTitle(payload.content);
      if (title) (root.querySelector(".atitle") as HTMLElement).textContent = title;
      body.replaceChildren(drawArtifactBody(entry.artifact_type, payload.content, showList));
    } catch (error) {
      if (onUnlinked(error) || !scope.alive) return;
      body.replaceChildren(note(msg("artifactLoadFailed"), true));
    }
  }

  function showList(): void {
    root.replaceChildren(listView);
    if (loaded) drawList();
  }

  showList();
  void refresh();
  return { element: root, showList };
}
