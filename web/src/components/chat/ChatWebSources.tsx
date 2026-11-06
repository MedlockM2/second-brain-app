import { webDomain, webTitle } from "@media-summarizer/core/chat/webSources";
import type { ChatWebSource } from "@media-summarizer/core/types/chat";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon } from "../Icon";

/**
 * "Web pages consulted" under an answer (task-615, option B of the
 * `chat_web_sources` mockup): one row per cited page, its title then its site,
 * each opening the page in a new tab. Nothing when the answer cites none.
 */
export function ChatWebSources({ sources }: { sources: readonly ChatWebSource[] }) {
  const { t } = useI18n();
  if (sources.length === 0) return null;
  return (
    <section className="web-sources" aria-label={t("chat.thread.webSourcesTitle")}>
      <h4 className="web-sources-head">
        <Icon name="globe-outline" size={14} />
        {t("chat.thread.webSourcesTitle")}
      </h4>
      {sources.map((source) => (
        <a
          key={source.url}
          className="web-source"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("chat.thread.openWebSourceA11y", { title: webTitle(source) })}
        >
          <span className="web-source-title">{webTitle(source)}</span>
          <span className="web-source-domain">{webDomain(source.url)}</span>
        </a>
      ))}
    </section>
  );
}
