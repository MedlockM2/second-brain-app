import { useState } from "react";
import { Config } from "../config";
import { useI18n } from "../i18n/I18nProvider";
import { loadScript } from "./loadScript";

/**
 * Sign in with Apple JS, in a popup. Apple returns an identity token (and, on
 * the very first sign-in only, the user's name and email), which goes to
 * /api/auth/apple/native like the mobile one. The Services ID must be accepted
 * by the API's Apple verification (`APPLE_CLIENT_ID`), and Apple only serves it
 * on a verified domain: the button stays hidden until it is configured.
 */
const APPLE_SRC =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

type AppleSignInResponse = {
  authorization: { id_token: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (options: {
          clientId: string;
          scope: string;
          redirectURI: string;
          state: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

export type AppleCredential = { identityToken: string; user?: AppleSignInResponse["user"] };

export function AppleSignInButton({
  onCredential,
  onError,
}: {
  onCredential: (credential: AppleCredential) => void;
  onError: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await loadScript(APPLE_SRC);
      const apple = window.AppleID;
      if (!apple) throw new Error("Sign in with Apple JS did not load");
      // The state comes back with the answer: a mismatch means the popup's
      // answer is not the one this click asked for.
      const state = crypto.randomUUID();
      apple.auth.init({
        clientId: Config.APPLE_SERVICES_ID,
        scope: "name email",
        redirectURI: Config.APPLE_REDIRECT_URI,
        state,
        usePopup: true,
      });
      const response = await apple.auth.signIn();
      if (response.authorization.state !== state) throw new Error("Apple state mismatch");
      onCredential({ identityToken: response.authorization.id_token, user: response.user });
    } catch (error) {
      // Closing the popup is the person changing their mind, not a failure.
      if ((error as { error?: string } | null)?.error !== "popup_closed_by_user") onError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn tonal" onClick={signIn} disabled={busy}>
      {t("auth.signInWithApple")}
    </button>
  );
}
