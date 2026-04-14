"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./Button";

type ButtonOnlyProps = Extract<ComponentProps<typeof Button>, { href?: undefined }>;

export type SubmitButtonProps = Omit<ButtonOnlyProps, "type"> & {
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Zapisywanie...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
