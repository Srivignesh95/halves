"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { removeAvatar, uploadAvatar } from "@/app/actions/avatar";
import { Button, Flash } from "./ui";
import type { ActionState } from "./forms";

const SIZE = 256;

/** Crop the middle square and shrink to 256x256 JPEG in the browser, so uploads are tiny (about 20 KB). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't a photo we can read."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo."))), "image/jpeg", 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarUploader({ userId, name, version, hasPhoto }: { userId: string; name: string; version: number; hasPhoto: boolean }) {
  const [state, upload, uploading] = useActionState(uploadAvatar, undefined as ActionState);
  const [removed, remove, removing] = useActionState(removeAvatar, undefined as ActionState);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = uploading || removing;
  const message = localError ? { error: localError } : (state ?? removed);

  async function onPick(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    try {
      const blob = await toSquareJpeg(file);
      setPreview(URL.createObjectURL(blob));
      const data = new FormData();
      data.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      startTransition(() => upload(data));
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview ?? `/api/avatar/${userId}?v=${version}`}
        alt={`${name}'s profile photo`}
        width={88}
        height={88}
        className={`rounded-full object-cover shadow-[0_0_0_4px_rgb(var(--glass)/0.9),0_8px_24px_-8px_rgb(22_20_31/0.35)] ${busy ? "opacity-60" : ""}`}
        style={{ width: 88, height: 88 }}
      />
      <div className="space-y-2">
        <input ref={input} id="photo" type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => input.current?.click()} disabled={busy} aria-busy={uploading}>
            {hasPhoto || preview ? "Change photo" : "Upload photo"}
          </Button>
          {(hasPhoto || preview) && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setPreview(null); startTransition(() => remove()); }}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">Any photo works. We crop it to a square and keep a small copy.</p>
        {message?.error && <Flash kind="error">{message.error}</Flash>}
        {message?.ok && !busy && <Flash kind="ok">{message.ok}</Flash>}
      </div>
    </div>
  );
}
