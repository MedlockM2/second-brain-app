import type { Folder } from "../types/organization";

/** Same comparison as the folder API; display spelling is preserved. */
export function folderNameKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function nextFolderName(base: string, siblings: Pick<Folder, "name">[]): string {
  const used = new Set(siblings.map((folder) => folderNameKey(folder.name)));
  if (!used.has(folderNameKey(base))) return base;
  let number = 2;
  while (used.has(folderNameKey(`${base} ${number}`))) number += 1;
  return `${base} ${number}`;
}

export function isFolderNameConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "FOLDER_NAME_CONFLICT";
}
