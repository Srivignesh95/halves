"use client";

import { useEffect } from "react";
import { isStaleDeployError, reloadForNewVersion } from "@/lib/stale";
import { Button } from "@/components/ui";

/** Shown when something on an app page throws. A new deploy just needs a reload, so do that quietly. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleDeployError(error);
  useEffect(() => {
    if (stale) reloadForNewVersion();
  }, [stale]);
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <h1 className="text-lg font-bold">{stale ? "Halves was just updated" : "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-muted">{stale ? "Loading the new version…" : "Try again. If it keeps happening, reload the page."}</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={() => (stale ? window.location.reload() : reset())}>{stale ? "Reload now" : "Try again"}</Button>
      </div>
    </div>
  );
}
