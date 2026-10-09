/**
 * Fork flag controlling Manufact Cloud integration.
 * In this fork, Manufact cloud features (managed chat, signup/cloud buttons, etc.)
 * are disabled by default.
 */
export function isManufactDisabled(): boolean {
  if (typeof window !== "undefined") {
    const runtimeOverride = (
      window as Window & { __FORK_DISABLE_MANUFACT__?: boolean }
    ).__FORK_DISABLE_MANUFACT__;
    if (typeof runtimeOverride === "boolean") {
      return runtimeOverride;
    }
  }

  if (
    typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_FORK_DISABLE_MANUFACT === "false"
  ) {
    return false;
  }

  return true;
}
