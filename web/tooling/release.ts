import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";

const KEYS = ["VITE_API_BASE_URL", "VITE_CHAT_STREAM_URL", "VITE_SITE_URL",
  "VITE_APP_STORE_URL", "VITE_PLAY_STORE_URL", "VITE_FEEDBACK_URL", "VITE_EXTENSION_IDS"] as const;

/** Build-time public settings, deliberately separate from credentials and deploy access. */
export function validatePublicConfig(env: Record<string, string>, compilationOnly: boolean) {
  const config = Object.fromEntries(KEYS.map((key) => [key, env[key] ?? ""]));
  for (const key of Object.keys(env)) {
    if (!KEYS.includes(key as typeof KEYS[number])) throw new Error(`Unknown public setting: ${key}`);
  }
  if (!config.VITE_API_BASE_URL) throw new Error("VITE_API_BASE_URL is required before building web.");
  for (const [key, value] of Object.entries(config)) {
    if (!value) continue;
    if (value !== value.trim()) throw new Error(`${key} must not contain surrounding whitespace.`);
    if (key === "VITE_EXTENSION_IDS") {
      const ids = value.split(",").map((id) => id.trim());
      if (ids.some((id) => !/^[a-p]{32}$/.test(id)) || new Set(ids).size !== ids.length) {
        throw new Error("VITE_EXTENSION_IDS must contain unique Chrome/Edge IDs (32 letters a-p).");
      }
      continue;
    }
    let url: URL;
    try { url = new URL(value); } catch { throw new Error(`${key} must be an absolute URL.`); }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.hash ||
      (url.search && ["VITE_API_BASE_URL", "VITE_CHAT_STREAM_URL", "VITE_SITE_URL"].includes(key)) ||
      (url.protocol !== "https:" && !(compilationOnly && loopback && url.protocol === "http:")) ||
      (!compilationOnly && loopback)) {
      throw new Error(`${key} must be a public HTTPS URL without credentials, query or fragment.`);
    }
    if (key === "VITE_SITE_URL" && url.pathname !== "/") {
      throw new Error("VITE_SITE_URL must be the public site's origin, without a path.");
    }
    if (key === "VITE_CHAT_STREAM_URL" && !url.pathname.replace(/\/+$/, "").endsWith("/v1")) {
      throw new Error("VITE_CHAT_STREAM_URL must end in /v1 (the Terraform chat_stream_url output).");
    }
    const storeHosts: Record<string, string[]> = {
      VITE_APP_STORE_URL: ["testflight.apple.com", "apps.apple.com"],
      VITE_PLAY_STORE_URL: ["play.google.com"],
    };
    if (storeHosts[key] && !storeHosts[key].includes(url.hostname)) {
      throw new Error(`${key} must point to its Apple/Google distribution service.`);
    }
  }
  return config;
}

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Identifies the exact output, including public configuration, without a timestamp. */
export function releaseManifest(mode: string, publicConfig: Record<string, string>): Plugin {
  let publicDir = "";
  return {
    name: "deepn-web-release",
    configResolved(config) { publicDir = config.publicDir; },
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const files = Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b)).map(([path, file]) => ({
          path, sha256: sha256(file.type === "chunk" ? file.code : file.source),
        }));
        function includePublic(dir: string, prefix = "") {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = prefix + entry.name;
            if (entry.isDirectory()) includePublic(join(dir, entry.name), path + "/");
            else {
              if (files.some((file) => file.path === path) || path === "release.json") {
                throw new Error(`Public file collides with build output: ${path}`);
              }
              files.push({ path, sha256: sha256(readFileSync(join(dir, entry.name))) });
            }
          }
        }
        if (publicDir) includePublic(publicDir);
        files.sort((a, b) => a.path.localeCompare(b.path));
        const manifest = {
          schemaVersion: 1,
          mode,
          distributable: mode !== "ci",
          revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          publicConfig,
          files,
        };
        const releaseId = sha256(JSON.stringify(manifest));
        this.emitFile({ type: "asset", fileName: "release.json",
          source: JSON.stringify({ ...manifest, releaseId }, null, 2) + "\n" });
      },
    },
  };
}
