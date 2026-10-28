import { capacityLines } from "@media-summarizer/core/budget/presentation";
import type { EntitlementStatus } from "@media-summarizer/core/types/entitlements";
import { getFriendlyErrorMessage } from "@media-summarizer/core/errors/friendlyError";
import { LOCALE_ENDONYMS, SUPPORTED_LOCALES } from "@media-summarizer/core/i18n/locales";
import { formatDate, formatNumber, type TranslationKey } from "@media-summarizer/core/i18n/runtime";
import type {
  AuthUser,
  ExtensionTokenResponse,
  LinkedExtension,
  LinkedExtensionsResponse,
  PairingCodeResponse,
} from "@media-summarizer/core/types/auth";
import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { apiRequest } from "../api";
import { Dialog } from "../components/Dialog";
import { Icon, type IconName } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Config } from "../config";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";
import { useTheme, type ThemePreference } from "../theme";

/**
 * My account, adapted to the desktop (owner's mockup, captures 15 and 16): the
 * mobile menu card becomes a settings sidebar — same rows, same order, the two
 * red rows at the bottom — and each row opens in the pane on the right
 * (`/account/:section`). The Extension row is the web's own.
 *
 * No web payment (owner decision, point 3): the plan card has no way to a
 * subscription while the beta (task-429) is on; that is task-491's, after the
 * B-01 benchmark.
 */
type Section = "plan" | "reading" | "ui" | "theme" | "extension" | "bug" | "delete";
const SECTIONS: readonly Section[] = ["plan", "reading", "ui", "theme", "extension", "bug", "delete"];

type Entitlement = EntitlementStatus;

/** Tier names are product names: never translated (the mobile `subscriptionDisplay`). */
const TIER_LABELS = { S: "Reader", M: "Mix", L: "Audio-Heavy" } as const;

export function AccountPage() {
  const { section: raw } = useParams();
  const section = (raw ?? "plan") as Section;
  const { t, tw, preference: uiPreference } = useI18n();
  const { user, signOut } = useSession();
  const { preference: themePreference } = useTheme();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [entitlementFailed, setEntitlementFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiRequest<Entitlement>("/api/entitlements/status")
      .then(setEntitlement)
      .catch(() => setEntitlementFailed(true));
  }, []);

  if (!SECTIONS.includes(section)) return <Navigate to="/account" replace />;

  const planName = !entitlement
    ? null
    : !entitlement.is_active
      ? t("account.plan.none")
      : entitlement.is_beta_access
        ? t("account.plan.betaAccess")
        : entitlement.is_free_trial
          ? t("account.plan.freeTrial")
          : entitlement.subscription_tier
            ? TIER_LABELS[entitlement.subscription_tier]
            : t("account.plan.active");

  const item = (key: Section | null, icon: IconName, label: string, sub?: string | null, opts?: { danger?: boolean; onClick?: () => void; href?: string }) => {
    const content = (
      <>
        <span className="acc-ico">
          <Icon name={icon} size={18} />
        </span>
        <span className="grow">
          <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{label}</span>
          {sub && <span className="small muted ell" style={{ display: "block" }}>{sub}</span>}
        </span>
      </>
    );
    const className = `acc-item${key === section ? " on" : ""}${opts?.danger ? " danger" : ""}`;
    if (opts?.onClick) {
      return (
        <button type="button" className={className} onClick={opts.onClick}>
          {content}
        </button>
      );
    }
    return (
      <Link to={key === "plan" ? "/account" : `/account/${key}`} className={className} aria-current={key === section ? "page" : undefined}>
        {content}
      </Link>
    );
  };

  const readingName = user?.reading_language && (LOCALE_ENDONYMS as Record<string, string>)[user.reading_language];
  const uiName = uiPreference === "browser" ? tw("ui.followBrowser") : LOCALE_ENDONYMS[uiPreference];
  const themeName = t(themePreference === "system" ? "theme.followDevice" : themePreference === "dark" ? "theme.dark" : "theme.light");

  return (
    <main className="page">
      <div className="acc">
        <nav className="acc-nav" aria-label={tw("nav.account")}>
          <div className="acc-id">
            <span className="avatar">{(user?.email ?? "?").slice(0, 1).toUpperCase()}</span>
            <span className="grow">
              <span className="small muted" style={{ display: "block" }}>{tw("account.signedInAs")}</span>
              <span className="ell" style={{ display: "block" }}>{user?.email}</span>
            </span>
          </div>
          {item(
            "plan",
            "card-outline",
            tw("account.planTitle"),
            planName && entitlement ? planName : null,
          )}
          <div className="caps acc-cap">{tw("account.settings")}</div>
          {item("reading", "language-outline", t("readingLanguage.title"), readingName || t("account.notSet"))}
          {item("ui", "globe-outline", t("uiLanguage.title"), uiName)}
          {item("theme", themePreference === "dark" ? "moon-outline" : "sunny-outline", t("theme.title"), themeName)}
          {item("extension", "extension-puzzle-outline", tw("account.extension"), tw("account.extensionRow"))}
          <div className="caps acc-cap">{tw("account.help")}</div>
          {item(null, "bulb-outline", t("account.featureRequests"), tw("account.suggestionsRow"), {
            onClick: () => void openFeedback(() => toast.show(t("account.feedbackUnavailableBody"))),
          })}
          {item("bug", "bug-outline", t("account.reportBug"))}
          <div className="acc-sep" />
          {item(null, "log-out-outline", t("account.signOut"), null, { danger: true, onClick: () => setSigningOut(true) })}
          {item("delete", "trash-outline", t("deleteAccount.title"), null, { danger: true })}
        </nav>

        <section className="acc-main">
          {section === "plan" && <PlanPane entitlement={entitlement} failed={entitlementFailed} planName={planName} />}
          {section === "reading" && <ReadingLanguagePane />}
          {section === "ui" && <UiLanguagePane />}
          {section === "theme" && <ThemePane />}
          {section === "extension" && <ExtensionPane />}
          {section === "bug" && <BugReportPane onSent={() => toast.show(t("bugReport.submitted"))} />}
          {section === "delete" && <DeleteAccountPane />}
        </section>
      </div>

      {signingOut && (
        <Dialog
          title={t("account.signOut")}
          onClose={() => setSigningOut(false)}
          footer={
            <>
              <button type="button" className="btn ghost" onClick={() => setSigningOut(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn primary" autoFocus onClick={() => void signOut()}>
                {t("account.signOutAction")}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{t("account.signOutConfirm")}</p>
        </Dialog>
      )}
      {toast.node}
    </main>
  );
}

/**
 * The feedback board, signed in through the API (the mobile `FeedbackService`),
 * or the bare board when the API cannot sign. The tab is opened before the
 * request so the browser does not block it as a pop-up.
 */
async function openFeedback(onUnavailable: () => void) {
  const tab = window.open("about:blank", "_blank");
  try {
    const response = await apiRequest<{ url: string }>("/api/feedback/token");
    if (tab) tab.location.href = response.url;
    else window.open(response.url, "_blank", "noopener");
  } catch {
    if (Config.FEEDBACK_URL && tab) tab.location.href = Config.FEEDBACK_URL;
    else {
      tab?.close();
      onUnavailable();
    }
  }
}

function Pane({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <>
      <h1 className="display">{title}</h1>
      {intro && <p className="subtle">{intro}</p>}
      {children}
    </>
  );
}

function PlanPane({ entitlement, failed, planName }: { entitlement: Entitlement | null; failed: boolean; planName: string | null }) {
  const { t, tw } = useI18n();
  if (!entitlement) {
    return (
      <Pane title={tw("account.planTitle")}>
        <p className="subtle">{failed ? t("account.plan.unavailable") : t("account.plan.checking")}</p>
      </Pane>
    );
  }
  const resetLabel: TranslationKey = entitlement.is_beta_access
    ? "subscription.resetLabel.resets"
    : entitlement.is_free_trial
      ? "subscription.resetLabel.trialEnds"
      : entitlement.auto_renew_status === true
        ? "subscription.resetLabel.resets"
        : entitlement.auto_renew_status === false
          ? "subscription.resetLabel.ends"
          : "subscription.resetLabel.periodEnds";
  const resets = entitlement.budget.resets_at ? new Date(entitlement.budget.resets_at) : null;
  const ratio = Math.max(0, Math.min(1, (entitlement.budget.consumed_percent ?? 0) / 100));
  const rule = t("budget.uses");
  return (
    <Pane title={tw("account.planTitle")}>
      {/* No way to a subscription from here while the beta is on (task-429). */}
      <div className="card plan-card">
        <div className="caps">{t("account.plan.heading")}</div>
        <div className="row" style={{ margin: "6px 0 16px" }}>
          <span className="headline grow">{planName}</span>
        </div>
        {entitlement.is_active ? (
          <>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="grow">
                <div className="caps">{t("budget.consumed")}</div>
                <div
                  aria-label={t("budget.consumed")}
                >
                  <span className="display">{entitlement.budget.consumed_percent === null ? t("account.plan.unavailable") : `${formatNumber(entitlement.budget.consumed_percent)}%`}</span>

                </div>
                {entitlement.budget.consumed_percent !== null && <div className="gauge">
                  <i style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
                </div>}
              </div>
              <div style={{ textAlign: "end", paddingInlineStart: 24 }}>
                <div className="caps">{t(resetLabel)}</div>
                <div style={{ fontWeight: 500 }}>
                  {resets && !Number.isNaN(resets.getTime()) ? formatDate(resets, { day: "numeric", month: "short", year: "numeric" }) : t("account.plan.unknownDate")}
                </div>
              </div>
            </div>
            {capacityLines(entitlement.budget).map((line) => <p key={line} className="small subtle">{line}</p>)}
            <p className="small subtle" style={{ marginBottom: 0 }}>
              {rule}
            </p>
          </>
        ) : (
          <p className="small subtle" style={{ margin: 0 }}>{t("account.plan.noneHint")}</p>
        )}
      </div>
    </Pane>
  );
}

function ReadingLanguagePane() {
  const { t } = useI18n();
  const { user, setUser } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableAt = user?.reading_language_change_available_at ? new Date(user.reading_language_change_available_at) : null;
  // The API sets this date only while a change is barred (once a month, task-396).
  const barred = availableAt !== null;
  const limitText = (date: Date | null) =>
    date ? t("readingLanguage.changeLimit", { date: formatDate(date, { day: "numeric", month: "long", year: "numeric" }) }) : t("readingLanguage.changeLimitNoDate");

  const pick = async (code: string) => {
    if (busy || code === user?.reading_language) return;
    setBusy(true);
    setError(null);
    try {
      setUser(await apiRequest<AuthUser>("/api/auth/me", { method: "PATCH", body: { reading_language: code } }));
    } catch (caught) {
      const refusal = caught as { status?: number; details?: { available_at?: string } };
      setError(
        refusal.status === 429
          ? limitText(refusal.details?.available_at ? new Date(refusal.details.available_at) : null)
          : getFriendlyErrorMessage(caught, { fallback: t("readingLanguage.saveFailed") }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pane title={t("readingLanguage.title")} intro={t("readingLanguage.disclaimer")}>
      {barred && (
        <div className="banner" style={{ marginBottom: 12 }}>
          <Icon name="time-outline" size={18} />
          <span>{limitText(availableAt)}</span>
        </div>
      )}
      {error && (
        <div className="banner-err" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div role="radiogroup" aria-label={t("readingLanguage.title")}>
        {SUPPORTED_LOCALES.map((code) => {
          const on = user?.reading_language === code;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? "frow on" : "frow"}
              lang={code}
              disabled={busy || (barred && !on)}
              aria-label={t("readingLanguage.selectA11y", { language: LOCALE_ENDONYMS[code] })}
              onClick={() => void pick(code)}
            >
              <span className="grow">{LOCALE_ENDONYMS[code]}</span>
              {on && <Icon name="checkmark" size={18} />}
            </button>
          );
        })}
      </div>
    </Pane>
  );
}

function UiLanguagePane() {
  const { t, tw, preference, setPreference } = useI18n();
  const options: { value: typeof preference; label: string }[] = [
    { value: "browser", label: tw("ui.followBrowser") },
    ...SUPPORTED_LOCALES.map((code) => ({ value: code, label: LOCALE_ENDONYMS[code] })),
  ];
  return (
    <Pane title={t("uiLanguage.title")} intro={t("uiLanguage.disclaimer")}>
      <div role="radiogroup" aria-label={t("uiLanguage.title")}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            className={preference === option.value ? "frow on" : "frow"}
            lang={option.value === "browser" ? undefined : option.value}
            onClick={() => setPreference(option.value)}
          >
            <span className="grow">{option.label}</span>
            {preference === option.value && <Icon name="checkmark" size={18} />}
          </button>
        ))}
      </div>
    </Pane>
  );
}

function ThemePane() {
  const { t } = useI18n();
  const { preference, setPreference } = useTheme();
  const options: { value: ThemePreference; label: TranslationKey; icon: IconName }[] = [
    { value: "system", label: "theme.followDevice", icon: "sunny-outline" },
    { value: "light", label: "theme.light", icon: "sunny-outline" },
    { value: "dark", label: "theme.dark", icon: "moon-outline" },
  ];
  return (
    <Pane title={t("theme.title")} intro={t("theme.disclaimer")}>
      <div role="radiogroup" aria-label={t("theme.title")}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            className={preference === option.value ? "frow on" : "frow"}
            onClick={() => setPreference(option.value)}
          >
            <Icon name={option.icon} size={18} />
            <span className="grow">{t(option.label)}</span>
            {preference === option.value && <Icon name="checkmark" size={18} />}
          </button>
        ))}
      </div>
    </Pane>
  );
}

/**
 * The extension (task-487): link the one in this browser in one click, list the
 * linked ones and unlink them, or show a rescue code.
 *
 * One click asks the API for a token of the extension's own lineage and hands
 * it over through `externally_connectable` — which only this origin may use —
 * to each configured extension id (one per store); the first that answers
 * wins. When none answers (not installed, another browser profile), the rescue
 * code is the way.
 */
type ChromeRuntime = {
  sendMessage: (id: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: unknown;
};

function sendToExtension(id: string, message: unknown): Promise<boolean> {
  const runtime = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 2000);
    try {
      runtime.sendMessage(id, message, (response) => {
        window.clearTimeout(timer);
        // Reading lastError is what tells Chrome the failure was handled.
        resolve(!runtime.lastError && (response as { ok?: boolean } | undefined)?.ok === true);
      });
    } catch {
      window.clearTimeout(timer);
      resolve(false);
    }
  });
}

/** "Chrome · macOS": how the list names this browser. */
function browserLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

function ExtensionPane() {
  const { t, tw } = useI18n();
  const [linked, setLinked] = useState<LinkedExtension[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [outcome, setOutcome] = useState<"linked" | "not-found" | "failed" | null>(null);
  const [code, setCode] = useState<PairingCodeResponse | null>(null);
  const [round, setRound] = useState(0);
  const [failed, setFailed] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<LinkedExtensionsResponse>("/api/auth/extension-tokens")
      .then((response) => { if (active) { setLinked(response.extensions); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [round]);

  useEffect(() => {
    if (!code) return;
    const timer = window.setTimeout(() => setCode(null), Math.max(0, new Date(code.expires_at).getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [code]);

  const link = async () => {
    setLinking(true);
    setOutcome(null);
    try {
      const issued = await apiRequest<ExtensionTokenResponse>("/api/auth/extension-tokens", {
        method: "POST",
        body: { client_label: browserLabel() },
      });
      // Stop at the first acknowledgement so two installed copies do not
      // intentionally share one rotating lineage.
      let accepted = false;
      for (const id of Config.EXTENSION_IDS) {
        if (await sendToExtension(id, { type: "pair", token: issued.refresh_token })) {
          accepted = true;
          break;
        }
      }
      if (accepted) {
        setOutcome("linked");
      } else {
        // Nobody took the token: unlink the lineage rather than leave it orphaned.
        await apiRequest(`/api/auth/extension-tokens/${encodeURIComponent(issued.lineage_id)}`, { method: "DELETE" }).catch(() => undefined);
        setOutcome("not-found");
      }
    } catch {
      setOutcome("failed");
    } finally {
      setLinking(false);
      setRound((n) => n + 1);
    }
  };

  const unlink = async (lineageId: string) => {
    setFailed(false);
    try {
      await apiRequest(`/api/auth/extension-tokens/${encodeURIComponent(lineageId)}`, { method: "DELETE" });
      setRound((n) => n + 1);
    } catch {
      setFailed(true);
    }
  };

  const showCode = async () => {
    setCodeBusy(true);
    setFailed(false);
    try {
      setCode(await apiRequest<PairingCodeResponse>("/api/auth/extension-tokens/pairing-code", { method: "POST" }));
    } catch {
      setFailed(true);
    } finally {
      setCodeBusy(false);
    }
  };

  const date = (iso: string) => formatDate(new Date(iso), { day: "numeric", month: "short", year: "numeric" });

  return (
    <Pane title={tw("account.extension")} intro={tw("account.extensionBody")}>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <button type="button" className="btn primary" disabled={linking} onClick={() => void link()}>
          <Icon name="extension-puzzle-outline" size={18} />
          {linking ? tw("ext.linking") : tw("ext.link")}
        </button>
        {Config.SITE_URL && (
          <a className="btn tonal" href={`${Config.SITE_URL}/extension`} target="_blank" rel="noopener noreferrer">
            {tw("account.extensionInstall")}
          </a>
        )}
      </div>
      {outcome && (
        <p className={outcome === "linked" ? "small subtle" : "banner-err"} role="status" style={{ marginTop: 12 }}>
          {outcome === "linked" ? tw("ext.linkedNow") : outcome === "not-found" ? tw("ext.notFound") : t("common.somethingWentWrong")}
        </p>
      )}

      <h2 className="caps" style={{ margin: "24px 0 6px" }}>
        {tw("ext.listTitle")}
      </h2>
      {failed && <p className="banner-err" role="alert">{t("common.somethingWentWrong")}</p>}
      {linked && linked.length === 0 && <p className="small muted">{tw("ext.none")}</p>}
      {(linked ?? []).map((extension) => (
        <div key={extension.lineage_id} className="frow">
          <Icon name="globe-outline" size={18} />
          <span className="grow">
            <span style={{ display: "block" }}>{extension.client_label ?? tw("account.extension")}</span>
            <span className="small muted">
              {tw("ext.pairedOn", { paired: date(extension.paired_at), used: date(extension.last_used_at) })}
            </span>
          </span>
          <button type="button" className="btn ghost" onClick={() => void unlink(extension.lineage_id)}>
            {tw("ext.unlink")}
          </button>
        </div>
      ))}

      <h2 className="caps" style={{ margin: "24px 0 6px" }}>
        {tw("ext.codeTitle")}
      </h2>
      {code ? (
        <div className="card" style={{ padding: 20, display: "flex", gap: 20, alignItems: "center" }}>
          <div className="display" style={{ letterSpacing: 6 }} aria-label={code.code.split("").join(" ")}>
            {code.code.slice(0, 3)} {code.code.slice(3)}
          </div>
          <div className="small subtle">{tw("ext.codeHint")}</div>
        </div>
      ) : (
        <button type="button" className="btn tonal" disabled={codeBusy} onClick={() => void showCode()}>
          {tw("ext.showCode")}
        </button>
      )}
    </Pane>
  );
}

/** "Report a bug" as an inline form: `POST /api/bug-reports`, as from the mobile Account tab. */
function BugReportPane({ onSent }: { onSent: () => void }) {
  const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async () => {
    if (!subject.trim() || !description.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await apiRequest("/api/bug-reports", {
        method: "POST",
        body: { subject: subject.trim(), description: description.trim(), source_platform: "web" },
      });
      setSubject("");
      setDescription("");
      onSent();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pane title={t("account.reportBug")}>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="field" style={{ borderRadius: "var(--r-md)" }}>
          <span className="visually-hidden">{t("bugReport.subject")}</span>
          <input maxLength={200} placeholder={t("bugReport.subjectPlaceholder")} value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label>
          <span className="visually-hidden">{t("bugReport.description")}</span>
          <textarea className="textarea" maxLength={5000} placeholder={t("bugReport.descriptionPlaceholder")} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {failed && (
          <div className="banner-err" role="alert">
            {t("bugReport.submitFailed")}
          </div>
        )}
        <div>
          <button type="submit" className="btn primary" disabled={busy || !subject.trim() || !description.trim()}>
            {busy ? t("bugReport.submitting") : t("bugReport.submit")}
          </button>
        </div>
      </form>
    </Pane>
  );
}

/** `DELETE /api/account`, behind the warning, the acknowledgement and a last confirmation. */
function DeleteAccountPane() {
  const { t, tw } = useI18n();
  const { signOut } = useSession();
  const navigate = useNavigate();
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const erase = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await apiRequest("/api/account", { method: "DELETE" });
      // The account is gone: the session closes on this browser, the rest
      // fall on their next refresh.
      await signOut().catch(() => undefined);
      navigate("/login", { replace: true });
    } catch {
      setFailed(true);
      setBusy(false);
      setConfirming(false);
    }
  };
  const erased: TranslationKey[] = [
    "deleteAccount.erased.library",
    "deleteAccount.erased.artifacts",
    "deleteAccount.erased.digests",
    "deleteAccount.erased.search",
    "deleteAccount.erased.identity",
  ];
  return (
    <Pane title={t("deleteAccount.title")}>
      <div className="banner-err" style={{ margin: "12px 0" }}>
        <Icon name="alert-circle-outline" size={18} />
        <span>
          <strong>{t("deleteAccount.warningTitle")}</strong> — {t("deleteAccount.warningBody")}
        </span>
      </div>
      <h2 className="caps" style={{ margin: "16px 0 4px" }}>
        {t("deleteAccount.erasedHeading")}
      </h2>
      <ul className="bullets">
        {erased.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <div className="callout" style={{ marginTop: 16 }}>
        <strong>{t("deleteAccount.subscriptionHeading")}</strong>
        <p className="small">{tw("deleteAccount.subscriptionAny")}</p>
      </div>
      <label className="row" style={{ margin: "16px 0" }}>
        <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} aria-label={t("deleteAccount.acknowledgeA11y")} />
        <span>{t("deleteAccount.acknowledge")}</span>
      </label>
      {failed && (
        <div className="banner-err" role="alert" style={{ marginBottom: 12 }}>
          {t("deleteAccount.failed")}
        </div>
      )}
      <button
        type="button"
        className="btn primary"
        style={{ background: "var(--error)", color: "var(--on-error)" }}
        disabled={!acknowledged || busy}
        aria-label={t("deleteAccount.submitA11y")}
        onClick={() => setConfirming(true)}
      >
        {t("deleteAccount.submit")}
      </button>
      {confirming && (
        <Dialog
          title={t("deleteAccount.confirmTitle")}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn primary" style={{ background: "var(--error)", color: "var(--on-error)" }} disabled={busy} onClick={() => void erase()}>
                {t("deleteAccount.confirmAction")}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{t("deleteAccount.confirmBody")}</p>
        </Dialog>
      )}
    </Pane>
  );
}
