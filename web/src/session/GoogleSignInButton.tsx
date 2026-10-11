import { useEffect, useRef } from "react";
import { Config } from "../config";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme";
import { loadScript } from "./loadScript";

/**
 * Google Identity Services: the button is drawn by Google, in an iframe, and
 * hands back an ID token. That token goes to /api/auth/google/native, whose
 * accepted audiences already include the Web client (`GOOGLE_CLIENT_ID`).
 *
 * The button is Google's own rather than the tonal button of the mockup: GIS
 * only returns an ID token through its rendered button or One Tap.
 */
const GIS_SRC = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup";
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

export function GoogleSignInButton({
  onIdToken,
  onError,
}: {
  onIdToken: (idToken: string) => void;
  onError: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const { locale } = useI18n();
  const { scheme } = useTheme();
  // The callbacks are read through refs: GIS keeps the first one it is given.
  const handlers = useRef({ onIdToken, onError });
  useEffect(() => {
    handlers.current = { onIdToken, onError };
  });

  useEffect(() => {
    let cancelled = false;
    loadScript(GIS_SRC)
      .then(() => {
        const google = window.google;
        if (cancelled || !google || !slot.current) return;
        google.accounts.id.initialize({
          client_id: Config.GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          callback: ({ credential }) => {
            if (credential) handlers.current.onIdToken(credential);
            else handlers.current.onError();
          },
        });
        slot.current.replaceChildren();
        google.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: scheme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 336,
          locale,
        });
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError();
      });
    return () => {
      cancelled = true;
    };
  }, [locale, scheme]);

  return <div ref={slot} className="gis-slot" />;
}
