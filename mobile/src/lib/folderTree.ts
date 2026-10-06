import { t } from "../i18n";
import type { Folder } from "../types/organization";

/**
 * Label shown for the backend default folder, whose stored name is
 * `Uncategorized`. Only the display differs; the backend name is untouched.
 *
 * One source of truth, and a translated one: `folderPicker.unsorted`, which the
 * folder picker already renders. A hard-coded "Unsorted" here was reaching the
 * delete confirmation and the folder search of every locale, so a French user
 * read "passent dans Unsorted" and typing "non classé" matched nothing.
 *
 * A function rather than a constant because the catalogue is installed at
 * runtime: read once at module load it would freeze the fallback locale. `t`
 * lives outside React (see `i18n/runtime.ts`), so this module stays a plain one
 * — every other `lib/` copy module calls it the same way.
 */
export function getDefaultFolderLabel(): string {
  return t("folderPicker.unsorted");
}

export interface FolderNode extends Folder {
  children: FolderNode[];
  /** Number of media stored directly in this folder. */
  directMediaCount: number;
}

/**
 * Build a navigable tree of user folders from the flat folder list returned
 * by the backend.
 *
 * - The default folder (stored as `Uncategorized`, shown under
 *   `getDefaultFolderLabel()`) is kept so unsorted media stay reachable;
 *   callers decide how to surface it.
 * - `directCountById` lets the caller seed the per-folder media counts that
 *   were computed client-side (the folder list endpoint does not return them).
 */
export function buildFolderTree(
  folders: Folder[],
  directCountById?: Map<string, number>,
): {
  roots: FolderNode[];
  defaultFolder: FolderNode | null;
  nodeById: Map<string, FolderNode>;
} {
  const nodeById = new Map<string, FolderNode>();

  for (const folder of folders) {
    nodeById.set(folder.id, {
      ...folder,
      children: [],
      directMediaCount: directCountById?.get(folder.id) ?? 0,
    });
  }

  const roots: FolderNode[] = [];
  let defaultFolder: FolderNode | null = null;

  for (const node of nodeById.values()) {
    if (node.is_default) {
      defaultFolder = node;
    }
    const parentId = node.parent_folder_id ?? null;
    const parent = parentId ? nodeById.get(parentId) : null;
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else if (!node.is_default) {
      roots.push(node);
    }
  }

  const sortByName = (items: FolderNode[]) => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      if (item.children.length) sortByName(item.children);
    }
  };
  sortByName(roots);

  return { roots, defaultFolder, nodeById };
}

/**
 * The media of `media` that live under each of `children`, keyed by child id:
 * the rows stored in the child itself *and* in any of its descendants, in the
 * order `media` holds them.
 *
 * For a folder page, which already holds every one of those rows: the folder
 * filter of `GET /api/media` is inclusive of descendants, so what a subfolder
 * card shows about its content is a regrouping of the page's own response, not
 * a request per subfolder. A child that holds nothing is present with an empty
 * list, so a caller never has to tell "empty" from "missing".
 */
export function groupMediaBySubtree<T extends { folder_id?: string | null }>(
  children: readonly FolderNode[],
  media: readonly T[],
): Map<string, T[]> {
  // Every folder of every subtree, mapped to the child whose subtree it is in.
  const ownerByFolderId = new Map<string, string>();
  const claim = (node: FolderNode, ownerId: string) => {
    ownerByFolderId.set(node.id, ownerId);
    for (const child of node.children) claim(child, ownerId);
  };

  const grouped = new Map<string, T[]>();
  for (const child of children) {
    grouped.set(child.id, []);
    claim(child, child.id);
  }

  for (const item of media) {
    const ownerId = item.folder_id ? ownerByFolderId.get(item.folder_id) : null;
    if (ownerId) grouped.get(ownerId)?.push(item);
  }

  return grouped;
}

/** One user folder, named by the full trail down to it. */
export interface FolderPath {
  id: string;
  /** Leaf name, for a surface that only has room for one word. */
  name: string;
  /** `Parent / Child / Leaf`, the breadcrumb the folder picker shows. */
  path: string;
}

/** Separator of a folder breadcrumb, shared with the folder picker. */
const PATH_SEPARATOR = " / ";

/**
 * Every non-default folder as a flat, depth-first list of breadcrumbs.
 *
 * For the surfaces that ask "which folder?" and nothing else: a flat list is
 * answered in one glance where a tree has to be navigated, and the trail is what
 * separates two leaves that happen to share a name. Built on `buildFolderTree`
 * so the ordering (alphabetical, parents before their children) and the exclusion
 * of the default folder come from one place.
 */
export function flattenFolderPaths(
  folders: Folder[],
): FolderPath[] {
  const { roots } = buildFolderTree(folders);
  const flat: FolderPath[] = [];

  const walk = (nodes: FolderNode[], prefix: string) => {
    for (const node of nodes) {
      const path = prefix ? `${prefix}${PATH_SEPARATOR}${node.name}` : node.name;
      flat.push({ id: node.id, name: node.name, path });
      if (node.children.length) walk(node.children, path);
    }
  };
  walk(roots, "");

  return flat;
}
