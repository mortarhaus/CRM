import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// A native radio button in the accent colour, with the same focus ring as the other controls.
export function Radio({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="radio"
      className={cn(
        "size-5 shrink-0 accent-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  );
}
