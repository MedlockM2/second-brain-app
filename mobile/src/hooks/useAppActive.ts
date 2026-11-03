import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Background reads must not count as content the user actually saw. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}
