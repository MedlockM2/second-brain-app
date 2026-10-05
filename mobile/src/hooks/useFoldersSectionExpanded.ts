import { useCallback, useEffect, useRef, useState } from "react";
import { FoldersSectionPreference } from "../lib/foldersSectionPreference";

interface FoldersSectionExpanded {
  /** Whether the folders grid of the library tab is shown under its heading. */
  expanded: boolean;
  /** Folds an unfolded grid, unfolds a folded one, and remembers the choice. */
  toggle: () => void;
}

/**
 * The fold of the folders section on the library tab, kept across launches.
 *
 * It starts unfolded and only folds once the stored choice says so, rather than
 * waiting on the read before drawing anything: unfolded is the default, and a
 * keychain read is over long before the folders request that fills the grid,
 * so there is no grid on screen yet for the stored choice to fold under the
 * user's eyes.
 *
 * A tap that lands before the read resolves wins over it. The read only says
 * what the user chose last time; a tap is what they chose now, and letting a
 * late read undo it would flip the section back on its own.
 */
export function useFoldersSectionExpanded(): FoldersSectionExpanded {
  const [expanded, setExpanded] = useState(true);
  const touchedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void FoldersSectionPreference.isCollapsed().then((collapsed) => {
      if (active && !touchedRef.current) setExpanded(!collapsed);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback(() => {
    touchedRef.current = true;
    const next = !expanded;
    setExpanded(next);
    void FoldersSectionPreference.setCollapsed(!next);
  }, [expanded]);

  return { expanded, toggle };
}
