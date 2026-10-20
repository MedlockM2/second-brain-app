import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";
import { completeSocialSignIn, pendingLink } from "../session/cognito";
export function AuthCallbackPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { status } = useSession();
  const [failed, setFailed] = useState<TranslationKey | null>(null);
  useEffect(() => {
    if (status === "restoring") return;
    void completeSocialSignIn().then((outcome) => {
      if (outcome === "done") navigate("/", { replace: true });
    }).catch((caught: unknown) => {
      // A refused address goes back to sign-in, which explains the link to make.
      if (pendingLink()) navigate("/login", { replace: true });
      else setFailed(authErrorKey(caught));
    });
  }, [navigate, status]);
  // A failed link leaves the session open: the way out is the app, not sign-in.
  const exit = status === "signedIn" ? "/" : "/login";
  return <div className="center-page"><div className="card auth-card">
    {failed ? <><p role="alert">{t(failed)}</p><Link to={exit}>{t(exit === "/" ? "common.continue" : "auth.backToLogin")}</Link></> : <p role="status">{t("common.loading")}</p>}
  </div></div>;
}
