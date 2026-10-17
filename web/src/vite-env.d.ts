/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CHAT_STREAM_URL?: string;
  readonly VITE_APP_STORE_URL?: string;
  readonly VITE_PLAY_STORE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_FEEDBACK_URL?: string;
  readonly VITE_EXTENSION_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
