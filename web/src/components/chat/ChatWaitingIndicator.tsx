import { Icon } from "../Icon";

/**
 * Keep the status available to assistive technology without visible copy.
 *
 * `caption`, while the model searches the web (task-615): the same dot,
 * followed by a globe and the caption. It goes with the first word of the
 * answer, since the indicator does.
 */
export function ChatWaitingIndicator({ label, caption }: { label: string; caption?: string | null }) {
  return (
    <span className="chat-waiting-row" role="status" aria-label={caption ?? label}>
      <span className="chat-waiting" aria-hidden="true">
        <span className="chat-waiting-dot" />
      </span>
      {caption && (
        <span className="chat-waiting-caption" aria-hidden="true">
          <Icon name="globe-outline" size={14} />
          {caption}
        </span>
      )}
    </span>
  );
}
