import type { AuthUser } from "@media-summarizer/core/types/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  accessTokenExpiresAt,
  closeSession,
  onSessionEvent,
  openSession,
  refreshAccessToken,
  SESSION_EXPIRED_CODE,
  type SignInRoute,
} from "./sessionStore";

/**
 * - `restoring`: the page just loaded and the cookie is being exchanged.
 * - `unreachable`: the API could not be reached; the session may still be alive.
 * - `signedOut` / `signedIn`: what it says.
 */
export type SessionStatus = "restoring" | "unreachable" | "signedOut" | "signedIn";

type Session = {
  status: SessionStatus;
  user: AuthUser | null;
  signIn: (route: SignInRoute, body: unknown) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  /** Replace the profile after a change the API answered with (e.g. PATCH /api/auth/me). */
  setUser: (user: AuthUser) => void;
  retry: () => void;
};

const SessionContext = createContext<Session | null>(null);

/** How long before expiry the access token is rotated, so screens never wait on it. */
const PROACTIVE_REFRESH_MS = 60_000;

function isSessionExpired(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === SESSION_EXPIRED_CODE;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("restoring");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event.type === "closed") {
          setUser(null);
          setStatus("signedOut");
        } else {
          setUser(event.user);
          setStatus("signedIn");
        }
      }),
    [],
  );

  // A page load has no access token: the cookie, if any, reopens the session.
  useEffect(() => {
    refreshAccessToken().catch((error: unknown) => {
      setStatus(isSessionExpired(error) ? "signedOut" : "unreachable");
    });
  }, [attempt]);

  // Rotate a minute before expiry. A failure here is not fatal: the API client
  // rotates again on the next 401.
  useEffect(() => {
    if (status !== "signedIn") return;
    const delay = Math.max(0, accessTokenExpiresAt() - Date.now() - PROACTIVE_REFRESH_MS);
    const timer = window.setTimeout(() => {
      refreshAccessToken().catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [status, user]);

  const retry = useCallback(() => {
    setStatus("restoring");
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      signIn: openSession,
      signOut: closeSession,
      setUser,
      retry,
    }),
    [status, user, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
