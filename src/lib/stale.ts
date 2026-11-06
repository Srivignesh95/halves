// After a new deploy, a page opened before it still calls the old server actions, which no longer exist.
// The fix is simply to load the new version of the page.

export function isStaleDeployError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /Server Action .* was not found|failed-to-find-server-action|Failed to find Server Action/i.test(msg);
}

/** Reload once to pick up the new version. Guarded so a real problem can't cause a reload loop. */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem("halves:reloaded") || 0);
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem("halves:reloaded", String(Date.now()));
  } catch {
    /* storage blocked: still reload once */
  }
  window.location.reload();
  return true;
}
