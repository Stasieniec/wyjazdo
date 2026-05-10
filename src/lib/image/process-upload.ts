/**
 * Client-side image processor: decodes any browser-supported format, resizes
 * to a max edge, and re-encodes to WebP. Run before uploading to keep R2 bytes
 * down and to normalize phone-camera HEIC / huge JPEGs into something every
 * browser can render.
 */

export type ProcessImageError = "decode_failed" | "canvas_unavailable" | "encode_failed";

export type ProcessImageOptions = {
  /** Max length of the longest edge in pixels. Defaults to 2400. */
  maxDim?: number;
  /** WebP quality 0..1. Defaults to 0.85. */
  quality?: number;
  /** Skip processing for files already smaller than this many bytes. Defaults to 1.5 MB. */
  passthroughBytes?: number;
};

const WEB_NATIVE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Decode + resize + re-encode `file` to WebP. Returns a new File ready to upload.
 *
 * Throws an Error with `.message` set to a `ProcessImageError` string if the
 * browser cannot decode the image (e.g., HEIC on Chrome) — callers should map
 * that to a friendly message.
 */
export async function processImageForUpload(
  file: File,
  options: ProcessImageOptions = {},
): Promise<File> {
  const { maxDim = 2400, quality = 0.85, passthroughBytes = 1_500_000 } = options;

  // Animated GIFs would be flattened by canvas — pass through.
  if (file.type === "image/gif") return file;

  const decoded = await decodeImage(file);
  const { width: srcWidth, height: srcHeight } = decoded;

  const isWebNative = WEB_NATIVE_TYPES.has(file.type);
  const fitsLimits = srcWidth <= maxDim && srcHeight <= maxDim;
  if (isWebNative && fitsLimits && file.size < passthroughBytes) {
    decoded.close();
    return file;
  }

  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const dstWidth = Math.max(1, Math.round(srcWidth * scale));
  const dstHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstWidth;
  canvas.height = dstHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.close();
    throw new Error("canvas_unavailable" satisfies ProcessImageError);
  }
  ctx.drawImage(decoded.source, 0, 0, dstWidth, dstHeight);
  decoded.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("encode_failed" satisfies ProcessImageError);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "zdjecie";
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

type Decoded = {
  width: number;
  height: number;
  source: CanvasImageSource;
  close: () => void;
};

async function decodeImage(file: File): Promise<Decoded> {
  // createImageBitmap is faster and decodes off-thread — but doesn't handle HEIC.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        close: () => bitmap.close(),
      };
    } catch {
      // fall through to <img> decode (handles HEIC on Safari, BMP/TIFF where supported)
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("decode_failed" satisfies ProcessImageError);
  }
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    source: img,
    close: () => URL.revokeObjectURL(url),
  };
}

/**
 * Map a thrown processing error to a user-facing Polish message.
 * Pass `err` from a `catch` block.
 */
export function processingErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : String(err);
  if (code === "decode_failed") {
    return "Nie udało się otworzyć tego zdjęcia. Jeśli to plik HEIC z iPhone'a, otwórz go w aplikacji Zdjęcia i zapisz jako JPG.";
  }
  if (code === "canvas_unavailable" || code === "encode_failed") {
    return "Twoja przeglądarka nie potrafi przetworzyć tego zdjęcia. Spróbuj inną przeglądarkę albo zapisz zdjęcie w formacie JPG.";
  }
  return "Nie udało się przygotować zdjęcia. Spróbuj inny plik.";
}
