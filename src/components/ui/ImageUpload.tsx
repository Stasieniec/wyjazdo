"use client";

import { useCallback, useId, useRef, useState } from "react";

interface ImageUploadProps {
  /** Hidden input name submitted with the form */
  name: string;
  label: string;
  /** Current image URL (for displaying existing image) */
  defaultValue?: string | null;
  /** "logo" = small square, "cover" = wide rectangle */
  aspect?: "logo" | "cover";
  error?: string;
}

export function ImageUpload({
  name,
  label,
  defaultValue,
  aspect = "cover",
  error,
}: ImageUploadProps) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const fileInputId = useId();

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/images/upload", { method: "POST", body });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Błąd przesyłania");
        return;
      }
      setUrl(data.url ?? "");
    } catch {
      setUploadError("Nie udało się przesłać pliku");
    } finally {
      setUploading(false);
    }
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const displayError = uploadError ?? error;
  const isLogo = aspect === "logo";

  return (
    <div>
      <label id={labelId} htmlFor={fileInputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>

      {/* Hidden input carries the URL value into the form */}
      <input type="hidden" name={name} value={url} />

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-labelledby={labelId}
        className={`mt-1 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${displayError ? "border-destructive" : "border-border hover:border-muted-foreground/50"} ${isLogo ? "h-24 w-24" : "h-40 w-full"}`}
      >
        {uploading ? (
          <span className="text-sm text-muted-foreground">Przesyłanie...</span>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className={`h-full w-full object-cover`}
          />
        ) : (
          <div className="px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Kliknij lub przeciągnij plik
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              JPEG, PNG, WebP · maks. 5 MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="sr-only"
        tabIndex={-1}
      />

      {url && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setUrl("");
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="mt-1.5 text-xs text-muted-foreground hover:text-destructive"
        >
          Usuń zdjęcie
        </button>
      )}

      {displayError && (
        <p className="mt-1 text-sm text-destructive">{displayError}</p>
      )}
    </div>
  );
}
