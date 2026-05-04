"use client";

import { useEffect, useRef } from "react";
import { ImageUpload } from "@/components/ui";
import { GalleryUpload } from "@/components/dashboard/GalleryUpload";
import { WizardFooter } from "./StepTitle";

type Props = {
  defaultCoverUrl: string | null;
  defaultGalleryPhotos: { url: string; position: number }[];
  pending?: boolean;
  onBack: () => void;
  onNext: (coverUrl: string, galleryPhotosJson: string) => void;
  onSkip: () => void;
};

export function StepPhotos({ defaultCoverUrl, defaultGalleryPhotos, pending, onBack, onNext, onSkip }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onNext(String(fd.get("coverUrl") ?? ""), String(fd.get("galleryPhotos") ?? "[]"));
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-[#1E3A5F] outline-none md:text-4xl">
        Pokaż jak to wygląda
      </h1>
      <p className="mt-3 text-sm text-[#6B7280] md:text-base">
        Okładka to główne zdjęcie wydarzenia. Galeria pokazuje miejsce, atmosferę, poprzednie edycje. Możesz dodać później.
      </p>
      <div className="mt-7 space-y-6">
        <ImageUpload name="coverUrl" label="Zdjęcie okładki" defaultValue={defaultCoverUrl ?? undefined} aspect="cover" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Galeria zdjęć</p>
          <p className="text-sm text-muted-foreground">Dodaj do 5 zdjęć.</p>
          <GalleryUpload name="galleryPhotos" defaultValue={defaultGalleryPhotos} max={5} />
        </div>
      </div>
      <WizardFooter onBack={onBack} pending={pending} showSkip onSkip={onSkip} />
    </form>
  );
}
