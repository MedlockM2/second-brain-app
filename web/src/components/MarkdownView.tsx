import { keepCitations, parseChatMarkdown, type Block, type ListItem, type Span } from "@media-summarizer/core/chat/markdown";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type { ChatSource } from "@media-summarizer/core/types/chat";
import { Fragment, useMemo, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";

/**
 * A chat answer or a source's text, drawn from its Markdown with the shared
 * reader (`@media-summarizer/core/chat/markdown`) — the web counterpart of the
 * mobile `MarkdownBody`: paragraphs, headings, lists, quotes, code, rules and
 * GFM tables.
 *
 * In an answer, a source tag (`[S1]`) becomes the short title of the media it
 * cites, a link that opens it. `showSources` is false in a media's own
 * conversation: its one source is the page on screen, so its tags are left out.
 * In `transcript` mode the text is a source's, not an answer: a tag stays
 * literal text and a leading "Speaker N:" is set in bold.
 */
const SHORT_TITLE_LENGTH = 28;
const EMPTY_SOURCES: ReadonlyMap<string, ChatSource> = new Map();

function shortTitle(title: string): string {
  if (title.length <= SHORT_TITLE_LENGTH) return title;
  const cut = title.slice(0, SHORT_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > SHORT_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,;:.|\-–—]+$/, "")}…`;
}

const sourceTitle = (source: ChatSource) => resolveMediaTitle({ title: source.title });

export function MarkdownView({
  text,
  live = false,
  sources = EMPTY_SOURCES,
  showSources = false,
  transcript = false,
  onOpenSource,
  className = "md",
}: {
  text: string;
  /** The answer is still being written: what is unfinished is held back. */
  live?: boolean;
  sources?: ReadonlyMap<string, ChatSource>;
  showSources?: boolean;
  transcript?: boolean;
  onOpenSource?: (source: ChatSource) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const blocks = useMemo(() => parseChatMarkdown(text, { live }), [text, live]);
  const keep = (ref: string) => transcript || (showSources && sources.has(ref));

  const renderSpans = (spans: readonly Span[]): ReactNode =>
    keepCitations(spans, keep).map((span, index, shown) => {
      if (span.kind === "text") {
        const speaker = transcript && index === 0 ? /^(Speaker\s+\d+)\s*:\s*/i.exec(span.text) : null;
        let node: ReactNode = speaker ? (
          <>
            <strong>{speaker[1]}: </strong>
            {span.text.slice(speaker[0].length)}
          </>
        ) : (
          span.text
        );
        if (span.code) node = <code>{node}</code>;
        if (span.italic) node = <em>{node}</em>;
        if (span.bold) node = <strong>{node}</strong>;
        return <Fragment key={index}>{node}</Fragment>;
      }
      if (transcript) return <Fragment key={index}>{span.refs.join(" ")}</Fragment>;
      const previous = shown[index - 1];
      const spaced = previous?.kind === "text" && !/\s$/.test(previous.text);
      return (
        <Fragment key={index}>
          {spaced ? " " : ""}
          {span.refs.map((ref) => {
            const source = sources.get(ref);
            if (!source) return null;
            const title = sourceTitle(source);
            return (
              <button
                key={ref}
                type="button"
                className="cite"
                title={title}
                aria-label={t("chat.thread.openSourceA11y", { title })}
                onClick={() => onOpenSource?.(source)}
              >
                {shortTitle(title)}
              </button>
            );
          })}
        </Fragment>
      );
    });

  const renderItems = (items: readonly ListItem[]): ReactNode => {
    // Items carry their depth; nest them back into lists for the page.
    const out: ReactNode[] = [];
    let index = 0;
    const level = (depth: number): ReactNode => {
      const ordered = items[index]?.ordered ?? false;
      const children: ReactNode[] = [];
      while (index < items.length && items[index].depth >= depth) {
        const item = items[index];
        if (item.depth > depth) {
          children.push(<li key={`n${index}`} className="nested">{level(item.depth)}</li>);
          continue;
        }
        index += 1;
        children.push(
          <li key={index} value={item.ordered ? item.number : undefined}>
            {renderSpans(item.spans)}
          </li>,
        );
      }
      return ordered ? <ol>{children}</ol> : <ul>{children}</ul>;
    };
    while (index < items.length) out.push(<Fragment key={index}>{level(items[index].depth)}</Fragment>);
    return out;
  };

  const renderBlock = (block: Block, key: number): ReactNode => {
    switch (block.kind) {
      case "paragraph":
        return <p key={key}>{renderSpans(block.spans)}</p>;
      case "heading": {
        const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
        return <Tag key={key}>{renderSpans(block.spans)}</Tag>;
      }
      case "list":
        return <Fragment key={key}>{renderItems(block.items)}</Fragment>;
      case "quote":
        return <blockquote key={key}>{block.blocks.map(renderBlock)}</blockquote>;
      case "code":
        return (
          <pre key={key}>
            <code>{block.text}</code>
          </pre>
        );
      case "rule":
        return <hr key={key} />;
      case "table":
        return (
          <div key={key} className="md-table">
            <table>
              <thead>
                <tr>
                  {block.header.map((cell, column) => (
                    <th key={column} style={{ textAlign: block.align[column] }}>
                      {renderSpans(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((cells, row) => (
                  <tr key={row}>
                    {cells.map((cell, column) => (
                      <td key={column} style={{ textAlign: block.align[column] }}>
                        {renderSpans(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return <div className={className}>{blocks.map(renderBlock)}</div>;
}
