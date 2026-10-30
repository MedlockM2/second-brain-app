/** Keep the status available to assistive technology without visible copy. */
export function ChatWaitingIndicator({ label }: { label: string }) {
  return (
    <span className="chat-waiting" role="status" aria-label={label}>
      <span className="chat-waiting-dot" aria-hidden="true" />
    </span>
  );
}
