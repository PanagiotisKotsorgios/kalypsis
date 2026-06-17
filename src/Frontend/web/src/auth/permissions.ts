import { useAuth, type Role } from "./AuthContext";

/**
 * Feature gate for the current user. Returns true when the user's effective
 * permission set (issued by the backend at login) includes the given code.
 * PlatformAdmin / PlatformEmployee always pass — they're allowed everywhere
 * for support purposes (the backend mirrors this rule).
 */
export function usePermission(code: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "PlatformAdmin" || user.role === "PlatformEmployee") return true;
  return (user.permissions ?? []).includes(code);
}

/** True when the user has any one of the codes. */
export function useAnyPermission(...codes: string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === "PlatformAdmin" || user.role === "PlatformEmployee") return true;
  const set = new Set(user.permissions ?? []);
  return codes.some((c) => set.has(c));
}

export type { Role };
