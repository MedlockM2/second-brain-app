import { AuthCodePage } from "./pages/AuthCodePage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { useSyncExternalStore } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { AppShell } from "./components/AppShell";
import { useI18n } from "./i18n/I18nProvider";
import { AccountPage } from "./pages/AccountPage";
import { AuthPage } from "./pages/AuthPage";
import { DigestPage } from "./pages/DigestPage";
import { DigestPeriodPage } from "./pages/DigestPeriodPage";
import { FolderPage } from "./pages/FolderPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { MediaPage } from "./pages/MediaPage";
import { SearchPage } from "./pages/SearchPage";
import { UnsortedPage } from "./pages/UnsortedPage";
import { InstallPage } from "./pages/InstallPage";
import { ReadingLanguagePage } from "./pages/ReadingLanguagePage";
import { SessionProvider, useSession } from "./session/SessionProvider";

/** The width under which the app is not rendered at all (owner decision, point 1). */
const DESKTOP_QUERY = "(min-width: 900px)";

function subscribeWidth(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

export function App() {
  // A layout rule of the same SPA, not a server redirect: below 900 px neither
  // the session nor the router mounts, so no request leaves for the API either.
  const desktop = useSyncExternalStore(subscribeWidth, isDesktop);
  if (!desktop) return <InstallPage />;

  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<SignedOutOnly />}>
          <Route path="/forgot-password" element={<AuthCodePage recovery />} />
          <Route path="/verify-email" element={<AuthCodePage recovery={false} />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>
        <Route element={<RequireSession />}>
          <Route path="/welcome/language" element={<ReadingLanguagePage />} />
          <Route element={<RequireReadingLanguage />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="media/:mediaId" element={<MediaPage />} />
              <Route path="folders/:folderId" element={<FolderPage />} />
              <Route path="digest" element={<DigestPage />} />
              <Route path="digest/:period" element={<DigestPeriodPage />} />
              <Route path="unsorted" element={<UnsortedPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="account/:section" element={<AccountPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** While the cookie is exchanged, or when the API cannot be reached. */
function SessionGate() {
  const { t, tw } = useI18n();
  const { status, retry } = useSession();
  if (status === "unreachable") {
    return (
      <div className="center-page">
        <div className="card auth-card" role="alert">
          <p style={{ marginTop: 0 }}>{tw("session.unreachable")}</p>
          <button type="button" className="btn primary" onClick={retry}>
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }
  return <div className="loading">{t("common.loading")}</div>;
}

function RequireSession() {
  const { status } = useSession();
  const location = useLocation();
  if (status === "signedIn") return <Outlet />;
  if (status === "signedOut") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <SessionGate />;
}

function SignedOutOnly() {
  const { status } = useSession();
  const location = useLocation();
  if (status === "signedOut") return <Outlet />;
  if (status === "signedIn") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }
  return <SessionGate />;
}

/** An account that has never chosen a reading language chooses it first. */
function RequireReadingLanguage() {
  const { user } = useSession();
  if (!user?.reading_language) return <Navigate to="/welcome/language" replace />;
  return <Outlet />;
}
