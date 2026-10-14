import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/** An error belongs to one URL attempt, never permanently to a library item. */
export function useRecoverableImage(uri: string, identity: string, refreshSignal?: unknown) {
  const [retry, setRetry] = useState(0);
  const [failedAttempt, setFailedAttempt] = useState<{ key: string; signal: unknown } | null>(null);
  const attempt = `${identity}:${uri}:${retry}`;
  const failed = failedAttempt?.key === attempt && failedAttempt.signal === refreshSignal;
  const failedRef = useRef<{ key: string; signal: unknown } | null>(null);

  const resume = useCallback(() => {
    // One attempt per focus/foreground event, with no timer or retry loop.
    if (failedRef.current?.key === attempt && failedRef.current.signal === refreshSignal) {
      failedRef.current = null;
      setRetry((value) => value + 1);
    }
  }, [attempt, refreshSignal]);
  // The callback must stay stable when retry changes: otherwise focus would
  // itself restart the effect after every image error.
  const resumeRef = useRef(resume);
  useEffect(() => { resumeRef.current = resume; }, [resume]);
  useFocusEffect(useCallback(() => { resumeRef.current(); }, []));
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") resumeRef.current();
    });
    return () => listener.remove();
  }, []);

  return {
    showImage: uri.length > 0 && !failed,
    // Keep healthy images mounted across signed-URL rotation.
    attempt: `${identity}:${retry}`,
    onError: () => {
      failedRef.current = { key: attempt, signal: refreshSignal };
      setFailedAttempt({ key: attempt, signal: refreshSignal });
    },
  };
}
