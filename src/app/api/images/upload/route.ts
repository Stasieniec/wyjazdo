import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { newId } from "@/lib/ids";

// 12 MB. The client resizes + re-encodes to WebP before upload so most files
// arrive well under 1 MB; the cap exists for clients that fall back to raw upload.
const MAX_SIZE = 12 * 1024 * 1024;

// Web-renderable formats. The client converts most inputs to WebP, but we accept
// the broader set so HEIC/AVIF/BMP/TIFF can fall through if the browser can't
// process client-side. A future job could re-encode HEIC server-side to ensure
// non-Safari users can view them.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Ten format zdjęcia nie jest obsługiwany. Spróbuj JPG, PNG, WebP albo HEIC z iPhone'a." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    const mb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return NextResponse.json(
      { error: `Plik ma ${mb} MB, a maksymalny rozmiar to 12 MB. Spróbuj zapisać zdjęcie w mniejszej jakości.` },
      { status: 400 },
    );
  }

  const ext = EXT_BY_TYPE[file.type] ?? "bin";
  const key = `${userId}/${newId()}.${ext}`;

  const { env } = getCloudflareContext();
  const bucket = env.R2_IMAGES;
  if (!bucket) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const url = `/api/images/${key}`;

  return NextResponse.json({ url });
}
