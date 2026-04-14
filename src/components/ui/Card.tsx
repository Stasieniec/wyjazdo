import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ padding = "md", className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-background ${paddings[padding]} ${className}`}
      {...props}
    />
  );
}
