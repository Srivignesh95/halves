// Browser-only helpers for photos: open anything (including iPhone HEIC) and shrink it before upload.

function loadImage(src: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(src);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("unreadable"));
    i.src = url;
  }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 0));
}

/** iPhone photos are often HEIC, which only Safari can open. Spot them by name, type or their first bytes. */
async function isHeic(file: File) {
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const head = new TextDecoder().decode(await file.slice(4, 12).arrayBuffer());
  return /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(head);
}

/** Open any photo the browser can, converting HEIC first when needed. */
export async function decodeImage(file: File, onConverting: () => void = () => {}): Promise<HTMLImageElement> {
  try {
    return await loadImage(file);
  } catch {
    if (!(await isHeic(file))) throw new Error("That file isn't a photo we can open. Try a JPEG or PNG.");
    onConverting();
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return loadImage(Array.isArray(out) ? out[0] : out);
  }
}

/** Draw (part of) an image onto a canvas of the given size and return a JPEG. */
export function toJpeg(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, w: number, h: number, quality = 0.86): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo."))), "image/jpeg", quality));
}

/** Shrink so the long edge is at most `maxEdge` pixels, keeping the whole image. */
export async function shrinkPhoto(file: File, maxEdge: number, onConverting?: () => void): Promise<Blob> {
  const img = await decodeImage(file, onConverting);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  return toJpeg(img, 0, 0, img.naturalWidth, img.naturalHeight, w, h, 0.85);
}

/** Crop the middle square and shrink to size x size. */
export async function squarePhoto(file: File, size: number, onConverting?: () => void): Promise<Blob> {
  const img = await decodeImage(file, onConverting);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  return toJpeg(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, size, size);
}
