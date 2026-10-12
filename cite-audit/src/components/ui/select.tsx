import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClassName } from "@/components/ui/input";

/** Select natif stylé (accessible et sans dépendance). */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClassName, "h-10", className)} {...props} />;
}
