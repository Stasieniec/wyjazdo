import Image from "next/image";

export function WyjazdoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={32}
      height={32}
      className={className}
      aria-hidden
    />
  );
}
