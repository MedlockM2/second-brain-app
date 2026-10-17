export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  reading_language?: string | null;
  /**
   * ISO 8601 instant at which the reading language may be changed again, when a
   * change is currently barred by the backend's once-a-month guard-rail. Null
   * (or absent) means a change is possible now — the answer for every account
   * that has never changed its language. The interval itself lives on the
   * server only: the app renders the date it is given and computes nothing.
   */
  reading_language_change_available_at?: string | null;
  /**
   * IANA zone name of the device ("Europe/Paris"), never a UTC offset. Absent
   * until a foreground pass has reported one, which is a valid state: the
   * Digest waits for a known zone rather than assuming UTC.
   */
  iana_timezone?: string | null;
}

export interface TokenVerificationResponse {
  access_token: string;
  /** Cognito refresh token of a mobile session, returned by login, OAuth exchange and refresh. */
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

/**
 * A web session's answer to login, OAuth exchange and refresh,
 * sent with `X-Session-Transport: cookie`: the refresh token is an HttpOnly
 * cookie on the API host, never part of the body (docs/AUTHENTICATION_SETUP.md).
 */
export interface WebSessionResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface AuthError {
  message: string;
  field?: string;
  raw?: string;
  code?: string;
}

/** `POST /api/auth/extension-tokens` (and the rescue code's claim): a browser extension lineage. */
export interface ExtensionTokenResponse {
  lineage_id: string;
  refresh_token: string;
  expires_at: string;
}

/** One entry of `GET /api/auth/extension-tokens`: an extension linked to the account. */
export interface LinkedExtension {
  lineage_id: string;
  client_label?: string | null;
  paired_at: string;
  last_used_at: string;
  expires_at: string;
}

export interface LinkedExtensionsResponse {
  extensions: LinkedExtension[];
}

/** `POST /api/auth/extension-tokens/pairing-code`: six digits for the extension's popup. */
export interface PairingCodeResponse {
  code: string;
  expires_at: string;
}
