import { useCallback, useEffect, useState } from "react";

/** A short confirmation at the bottom of the window ("Moved to …"). */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const show = useCallback((text: string) => setMessage(text), []);
  const node = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
  return { show, node };
}
