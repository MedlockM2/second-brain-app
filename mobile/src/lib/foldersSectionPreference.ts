import * as SecureStore from "expo-secure-store";

const FOLDERS_COLLAPSED_KEY = "search_folders_collapsed";

/**
 * Remembers whether the user folded the folders grid of the library tab.
 *
 * Only the folded state is written: unfolded is the default, so it is stored as
 * the key's absence, the same shape the pseudo-locale flag uses. A device that
 * never touched the chevron therefore has nothing to read and opens unfolded.
 *
 * SecureStore is the app's only key/value store (AsyncStorage was removed in V1).
 * It is overkill for a boolean, but it is what keeps the choice across a restart,
 * which is the whole point of a section the user folds once and expects to find
 * folded.
 */
export const FoldersSectionPreference = {
  async isCollapsed(): Promise<boolean> {
    try {
      return (await SecureStore.getItemAsync(FOLDERS_COLLAPSED_KEY)) === "1";
    } catch {
      // A storage failure shows the folders: an unfolded grid is the screen as it
      // always was, a folded one the user never asked for would hide their folders.
      return false;
    }
  },

  async setCollapsed(collapsed: boolean): Promise<void> {
    try {
      if (collapsed) {
        await SecureStore.setItemAsync(FOLDERS_COLLAPSED_KEY, "1");
      } else {
        await SecureStore.deleteItemAsync(FOLDERS_COLLAPSED_KEY);
      }
    } catch {
      // Best effort: the grid coming back unfolded next launch is a smaller
      // failure than the library tab crashing on a keychain refusal.
    }
  },
} as const;
