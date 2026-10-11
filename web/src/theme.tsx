import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * Light and dark themes (the tokens of `styles.css`).
 *
 * The default follows the device; the bar's button pins the opposite of what is
 * shown. The choice stays on this browser, as the mockup's settings page says:
 * it is a per-viewer convenience, never sent to the account.
 */
export type ThemePreference = "system" | "light" | "dark";
type Scheme = "light" | "dark";

const STORAGE_KEY = "deepn.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage blocked (private window, site data off): follow the device.
  }
  return "system";
}

function writePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The theme still applies for this visit.
  }
}

function subscribeDevice(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const deviceScheme = (): Scheme =>
  window.matchMedia(DARK_QUERY).matches ? "dark" : "light";

type Theme = {
  scheme: Scheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const device = useSyncExternalStore(subscribeDevice, deviceScheme);
  const scheme: Scheme = preference === "system" ? device : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      preference,
      setPreference,
      toggle: () => setPreference(scheme === "dark" ? "light" : "dark"),
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
