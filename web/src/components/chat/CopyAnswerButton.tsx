import { withWebLinks } from "@media-summarizer/core/chat/webSources";
import type { ChatWebSource } from "@media-summarizer/core/types/chat";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon } from "../Icon";

/**
 * Write directly from the click so the browser retains the user activation. A web
 * citation is copied as a Markdown link to its page, never as a bare `[W1]`.
 */
export function CopyAnswerButton({ text, webSources }: { text: string; webSources?: readonly ChatWebSource[] | null }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state !== "copied" && state !== "failed") return;
    const timer = setTimeout(() => setState("idle"), state === "copied" ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    setState("copying");
    try {
      await navigator.clipboard.writeText(withWebLinks(text, webSources));
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="chat-copy">
      <button
        type="button"
        className="icon-btn"
        onClick={() => void copy()}
        disabled={state === "copying"}
        aria-label={t("chat.thread.copy")}
        title={t("chat.thread.copy")}
      >
        <Icon name={state === "copied" ? "checkmark" : "copy-outline"} size={18} />
      </button>
      <span role="status" className={state === "failed" ? "small chat-copy-error" : "visually-hidden"}>
        {state === "copied" ? t("chat.thread.copied") : state === "failed" ? t("chat.thread.copyFailed") : ""}
      </span>
    </div>
  );
}
