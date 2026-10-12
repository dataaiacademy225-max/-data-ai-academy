import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClassName =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClassName, "h-10", className)} {...props} />;
}
