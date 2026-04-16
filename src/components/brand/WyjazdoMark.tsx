import Image from "next/image";

export function WyjazdoMark({ className, invert }: { className?: string; invert?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={32}
      height={32}
      className={`${className ?? ""}${invert ? " brightness-0 invert" : ""}`}
      aria-hidden
    />
  );
}
