import { useCallback, useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { pageContainerKey } from "../config/sidebarVisibility";

/**
 * Returns a visibility check for independently configurable page tiles/cards.
 * This is presentation-only, matching sidebar visibility: it does not alter
 * routes, permissions, API access, or the underlying records.
 */
export function usePageContainerVisibility(pageId: string) {
  const { user } = useAuth();
  const hiddenKeys = useMemo(
    () => new Set(user?.hiddenSidebarItems ?? []),
    [user?.hiddenSidebarItems]
  );

  return useCallback(
    (containerId: string) => !hiddenKeys.has(pageContainerKey(pageId, containerId)),
    [hiddenKeys, pageId]
  );
}
