import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import {
  THEMES,
  type Theme,
  type ThemeColors,
  type ThemeMode,
} from "../constants/theme";
import type { TranslationKey } from "../i18n";

/**
 * How the palette in force reaches the ~800 places that draw a colour.
 *
 * **What `useColorScheme` gives us, and what it cannot give us.** React Native's
 * `useColorScheme()` is a subscription to `Appearance`: it reports the *device's*
 * light/dark setting and re-renders its callers when the user flips it in
 * Settings or when the OS crosses its sunset schedule. That is one of the three
 * states the setting has to offer, and it is the only one no amount of our own
 * code could compute. It is therefore the input to this provider, not a
 * replacement for it, because it cannot do three other things this app needs:
 *
 * - **It knows nothing of the user's choice.** "Force light" and "force dark"
 *   are *ours*, stored on the device; `useColorScheme` only ever answers what the
 *   phone asks for, so something above it has to decide whether the phone gets
 *   the last word.
 * - **It hands back a word, not a palette.** `"dark"` is not a set of tokens. The
 *   mapping from a mode to `ThemeColors`, and the memoisation that keeps a style
 *   sheet from being rebuilt on every render, have to live somewhere.
 * - **It is a hook, so it cannot reach a `StyleSheet.create` at module scope.**
 *   This is the real work of this file. Every screen in the app built its sheet
 *   once, at module load, from a static `Colors` import — a snapshot that by
 *   construction cannot change afterwards. `useColorScheme` returning `"dark"`
 *   would not have repainted a single one of them.
 *
 * **The mechanism: a context, plus a style-sheet factory per file.** A screen no
 * longer calls `StyleSheet.create` at module scope; it exports a
 * `makeStyles(theme)` and calls `useThemedStyles(makeStyles)`, which rebuilds the
 * sheet when — and only when — the theme object changes identity. The factory
 * destructures `{ colors: Colors, shadows: Shadows }`, which is why ~800 call
 * sites inside those sheets are byte-for-byte what they were.
 *
 * Three alternatives were available and each fails on something:
 *
 * - **A mutable module-level palette** (`Colors.background` reassigned on
 *   switch). Reactive to nothing: the sheets are already built, and React has no
 *   reason to re-render.
 * - **`DynamicColorIOS` / `PlatformColor`.** A colour that resolves per trait
 *   collection *is* the ideal shape here — but `DynamicColorIOS` is iOS-only and
 *   `PlatformColor` names system palettes, not ours. Either one would put a
 *   `Platform.OS` fork on the theme path and leave Android to be solved twice.
 * - **A styling library** (`unistyles`, `restyle`, Tamagui). A dependency, a
 *   Babel/Metro plugin in several cases, and a second styling idiom alongside
 *   `StyleSheet` — for a problem that `useMemo` over a context already solves.
 */

const THEME_PREFERENCE_KEY = "ui_theme";

/**
 * What the user picked, which is not the same thing as what is drawn.
 *
 * `"system"` is the default and is deliberately offered first: a theme setting
 * without it is the state everyone expects and nobody asks for out loud. The
 * TestFlight request that prompted this asked for "Clair ou Sombre"; honouring
 * only those two would have locked a phone on auto-dark into whichever one the
 * user last tapped.
 */
export type ThemePreference = ThemeMode | "system";

/** The three rows of the setting screen, in the order it lists them. */
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
];

/**
 * What each state is called. Here rather than on the setting screen because two
 * surfaces name the three states — the screen's rows and the Account row's
 * subtitle — and a user who reads "Sombre" in the menu has to find "Sombre" on
 * the screen it opens.
 */
export const THEME_PREFERENCE_LABEL_KEYS: Record<
  ThemePreference,
  TranslationKey
> = {
  system: "theme.followDevice",
  light: "theme.light",
  dark: "theme.dark",
};

function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * The stored choice, on the device and nowhere else.
 *
 * Same reasoning, and the same store, as the interface language: the backend
 * renders no chrome, so it has no business knowing what the chrome looks like.
 * SecureStore is the app's only key/value store (AsyncStorage was removed in
 * V1), so it holds this the way it holds `ui_locale` and the usage-warning
 * dismissal.
 */
const ThemePreferenceStore = {
  async read(): Promise<ThemePreference> {
    try {
      const stored = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
      return stored && isThemePreference(stored) ? stored : "system";
    } catch {
      return "system";
    }
  },

  async write(preference: ThemePreference): Promise<void> {
    try {
      if (preference === "system") {
        await SecureStore.deleteItemAsync(THEME_PREFERENCE_KEY);
      } else {
        await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
      }
    } catch {
      // Best effort, as for the locale override: falling back to the device
      // appearance next launch is a smaller failure than crashing a settings
      // screen on a keychain refusal.
    }
  },
} as const;

interface ThemeContextValue {
  /** The palette and shadows being drawn right now. */
  theme: Theme;
  /** The user's explicit choice; `"system"` hands it back to the device. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /**
   * What the device currently asks for. The setting screen names it next to the
   * "follow the device" row, so the effect of that row is visible before the tap.
   */
  deviceMode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The device's own setting, live: flipping appearance in iOS Settings or
  // crossing Android's auto-dark schedule re-renders this provider, and a user
  // on `"system"` follows it without touching the app.
  const deviceScheme = useColorScheme();
  const deviceMode: ThemeMode = deviceScheme === "dark" ? "dark" : "light";

  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  // Gated like `I18nProvider` is, and for the same reason: the stored choice is
  // read asynchronously, and rendering before it lands would paint the app in
  // one appearance and swap it under the user. The native splash screen is held
  // from module scope in `app/_layout.tsx`, so this gate is covered.
  const [isPreferenceLoaded, setIsPreferenceLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void ThemePreferenceStore.read().then((stored) => {
      if (!active) return;
      setPreferenceState(stored);
      setIsPreferenceLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const mode: ThemeMode = preference === "system" ? deviceMode : preference;
  const theme = THEMES[mode];

  // The native root view sits under every React view and shows through during a
  // navigation transition and while a modal is being presented. Left on the
  // light `#fcf9f6` from `app.config.ts`, it flashes beige between two dark
  // screens.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {
      // Nothing to do: a root view that keeps its build-time colour is a
      // cosmetic flash during transitions, not a failure worth surfacing.
    });
  }, [theme.colors.background]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void ThemePreferenceStore.write(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference, deviceMode }),
    [theme, preference, setPreference, deviceMode],
  );

  if (!isPreferenceLoaded) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * The theme in force.
 *
 * Falls back to the device appearance when there is no provider above, instead
 * of throwing the way `useTranslation` does — and that is not a convenience. The
 * startup error screen is rendered by `StartupErrorGate` and by the root
 * `ErrorBoundary`, both of which sit *above* every provider by design, so that
 * they can replace a tree whose providers are exactly what failed. A crash
 * screen cannot know the user's stored choice; it can know what the phone asks
 * for, and that is what this gives it.
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (context) return context.theme;

  // `Appearance.getColorScheme()` and not `useColorScheme()`, which would be
  // the hook for this: the hook subscribes, and this function is called by
  // every component in the app, so it would install sixty subscriptions to
  // serve a branch only the crash screen ever takes. A crash screen does not
  // have to follow an appearance the user flips while it is on screen.
  return THEMES[Appearance.getColorScheme() === "dark" ? "dark" : "light"];
}

/**
 * The palette in force, for the colours a component passes as props rather than
 * through a style sheet — an `Ionicons` `color`, an `ActivityIndicator` `color`,
 * a `placeholderTextColor`.
 *
 * Call sites bind it as `const Colors = useThemeColors()`, which is what keeps
 * every `Colors.textMuted` in the app reading as it always did.
 */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

/**
 * Builds a component's style sheet from the theme in force, and rebuilds it only
 * when the theme changes.
 *
 * `factory` is a module-level constant in every call site, so the memo's only
 * real input is the theme object — and there are exactly two of those for the
 * whole life of the process (`THEMES.light` and `THEMES.dark`), so `styles` only
 * ever changes identity when the mode does. In between it is referentially
 * stable, which is what the sheets built at module scope used to give for free.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

/**
 * The setting itself: the stored choice, the setter, and what the device asks
 * for. Only the theme settings screen needs it, and it throws without a
 * provider — unlike `useTheme`, nothing can usefully guess a *choice*.
 */
export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  deviceMode: ThemeMode;
} {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used within a ThemeProvider");
  }
  return {
    preference: context.preference,
    setPreference: context.setPreference,
    deviceMode: context.deviceMode,
  };
}
