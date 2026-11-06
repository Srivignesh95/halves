"use client";

import { useEffect, useRef, useState } from "react";
import { shrinkPhoto } from "@/lib/image-client";
import { Button, Flash } from "./ui";

/**
 * The photo attached to an expense. Keeps a hidden file input named "receiptPhoto" in sync, so the
 * photo goes up with the rest of the form when you press Save. "removeReceipt" asks to delete the saved one.
 */
export function ReceiptPhotoField({ existingUrl, photo, onPhoto }: { existingUrl: string | null; photo: Blob | null; onPhoto: (b: Blob | null) => void }) {
  const fileInput = useRef<HTMLInputElement>(null); // carries the photo in the form
  const picker = useRef<HTMLInputElement>(null); // the visible "choose a photo" input
  const [removeExisting, setRemoveExisting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const input = fileInput.current;
    if (!input) return;
    const dt = new DataTransfer();
    if (photo) dt.items.add(new File([photo], "receipt.jpg", { type: photo.type || "image/jpeg" }));
    input.files = dt.files;
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    setRemoveExisting(false);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function pick(file?: File) {
    setError(null);
    if (!file) return;
    setBusy(true);
    try {
      onPhoto(await shrinkPhoto(file, 2000));
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === "unreadable" ? "That photo couldn't be opened. Try a JPEG or PNG." : msg);
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }

  const shown = preview ?? (existingUrl && !removeExisting ? existingUrl : null);
  return (
    <div>
      <span className="label">Receipt photo (optional)</span>
      <input ref={fileInput} type="file" name="receiptPhoto" className="hidden" tabIndex={-1} aria-hidden />
      {removeExisting && <input type="hidden" name="removeReceipt" value="1" />}
      <input ref={picker} id="attach-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-3">
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Receipt photo" className="h-20 w-16 rounded-md object-cover shadow-[0_0_0_1px_rgb(var(--c-border))]" />
        )}
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => picker.current?.click()}>
          {busy ? "Preparing…" : shown ? "Replace photo" : "Attach a photo"}
        </Button>
        {shown && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { onPhoto(null); if (existingUrl) setRemoveExisting(true); }}>
            Remove
          </Button>
        )}
      </div>
      {error && <div className="mt-2"><Flash kind="error">{error}</Flash></div>}
    </div>
  );
}
