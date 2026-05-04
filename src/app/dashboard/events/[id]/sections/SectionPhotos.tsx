"use client";

import { useActionState } from "react";
import { ImageUpload } from "@/components/ui";
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
import { saveSectionPhotosAction, type SectionResult } from "../section-actions";
import { SectionShell } from "./SectionShell";

type Props = {
  eventId: string;
  coverUrl: string | null;
  galleryPhotos: { url: string; position: number }[];
};

export function SectionPhotos({ eventId, coverUrl, galleryPhotos }: Props) {
  const [state, action] = useActionState<SectionResult | null, FormData>(
    saveSectionPhotosAction.bind(null, eventId),
    null,
  );
  const errors = state && "errors" in state ? state.errors : {};
  return (
    <SectionShell
      id="zdjecia"
      title="Zdjęcia"
      description="Okładka + galeria (do 5 zdjęć)."
      action={action}
      state={state}
    >
      <ImageUpload
        name="coverUrl"
        label="Zdjęcie okładki"
        defaultValue={coverUrl ?? undefined}
        aspect="cover"
        error={errors.coverUrl}
      />
      <GalleryUpload
        name="galleryPhotos"
        defaultValue={galleryPhotos}
        max={5}
        error={errors.galleryPhotos}
      />
    </SectionShell>
  );
}
