/**
 * The navigation tour has been retired. These exports remain as no-op
 * compatibility shims for older callers, but no tour is mounted or started.
 */
export function tourIdFor(role: string) {
  return `role-${role}-v1`;
}

export function resetTourForRole(_role: string) {
  // Navigation tours are permanently disabled.
}

export function KalypsisOnboarding(_props: { forceOpen?: boolean; onDismiss?: () => void }) {
  return null;
}
