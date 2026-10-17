import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";
import { completeSocialSignIn } from "../session/cognito";
export function AuthCallbackPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { status } = useSession();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (status === "restoring") return;
    void completeSocialSignIn().then(() => navigate("/", { replace: true })).catch(() => setFailed(true)); }, [navigate, status]);
  return <div className="center-page"><div className="card auth-card">
    {failed ? <><p role="alert">{t("auth.unavailable")}</p><Link to="/login">{t("auth.backToLogin")}</Link></> : <p role="status">{t("common.loading")}</p>}
  </div></div>;
}
