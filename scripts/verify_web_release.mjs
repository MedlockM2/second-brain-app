#!/usr/bin/env node
// Operational package verification; no network or credentials are used.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

const args = process.argv.slice(2);
const allowCompilation = args.includes("--compilation-only");
const root = realpathSync(args.find((arg) => !arg.startsWith("--")) ?? "web/dist");
const manifest = JSON.parse(readFileSync(resolve(root, "release.json"), "utf8"));
const { releaseId, ...content } = manifest;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (manifest.schemaVersion !== 1 || releaseId !== digest(JSON.stringify(content))) {
  throw new Error("Invalid release manifest or identity.");
}
if (!manifest.distributable && !allowCompilation) {
  throw new Error("Compilation-only build: distribution is forbidden. Build with the target environment's configuration.");
}
const expected = new Set(["release.json"]);
for (const entry of manifest.files) {
  const file = realpathSync(resolve(root, entry.path));
  const path = relative(root, file);
  if (path.startsWith("..") || isAbsolute(path) || expected.has(entry.path)) throw new Error("Invalid release path.");
  if (digest(readFileSync(file)) !== entry.sha256) throw new Error(`File checksum mismatch: ${entry.path}`);
  expected.add(entry.path);
}
if (!expected.has("index.html")) throw new Error("Release has no index.html.");
function inspect(dir, prefix = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error("Release contains a symbolic link.");
    if (entry.isDirectory()) inspect(resolve(dir, entry.name), path + "/");
    else if (!expected.delete(path)) throw new Error(`Untracked release file: ${path}`);
  }
}
inspect(root);
if (expected.size) throw new Error("Release files missing.");
console.log(`${manifest.distributable ? "Distribution package" : "COMPILATION ONLY"}: ${releaseId} (${manifest.mode})`);
