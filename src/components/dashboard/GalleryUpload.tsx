"use client";

import { useCallback, useRef, useState } from "react";

interface GalleryPhoto {
  url: string;
  position: number;
}

interface GalleryUploadProps {
  name: string;
  defaultValue?: GalleryPhoto[];
  max?: number;
  error?: string;
}

export function GalleryUpload({
  name,
  defaultValue = [],
  max = 5,
  error,
}: GalleryUploadProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(
    () => [...defaultValue].sort((a, b) => a.position - b.position),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (photos.length >= max) return;
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
        setPhotos((prev) => [
          ...prev,
          { url: data.url!, position: prev.length },
        ]);
      } catch {
        setUploadError("Nie udało się przesłać pliku");
      } finally {
        setUploading(false);
      }
    },
    [photos.length, max],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, position: i })),
    );
  }, []);

  const movePhoto = useCallback((index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((p, i) => ({ ...p, position: i }));
    });
  }, []);

  const displayError = uploadError ?? error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Galeria zdjęć
        </label>
        <span className="text-xs text-muted-foreground">
          {photos.length} / {max} zdjęć
        </span>
      </div>

      {/* Hidden input carries the JSON value into the form */}
      <input type="hidden" name={name} value={JSON.stringify(photos)} />

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30" />
            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => movePhoto(index, -1)}
                disabled={index === 0}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-xs text-white transition-colors hover:bg-black/80 disabled:opacity-30"
                title="Przesuń w lewo"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => movePhoto(index, 1)}
                disabled={index === photos.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-xs text-white transition-colors hover:bg-black/80 disabled:opacity-30"
                title="Przesuń w prawo"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-xs text-white transition-colors hover:bg-red-600"
                title="Usuń"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
          >
            {uploading ? (
              <span className="text-sm">Przesyłanie...</span>
            ) : (
              <>
                <span className="text-2xl leading-none">+</span>
                <span className="mt-1 text-xs">Dodaj zdjęcie</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
        className="sr-only"
        tabIndex={-1}
      />

      {displayError && (
        <p className="mt-1 text-sm text-destructive">{displayError}</p>
      )}
    </div>
  );
}
