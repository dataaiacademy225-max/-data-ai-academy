import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Libellé + aide + erreurs d'un champ, reliés au champ pour les lecteurs d'écran. */
export function FormField({
  id,
  label,
  hint,
  errors,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(facultatif)</span>}
      </Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors?.map((message) => (
        <p key={message} id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {message}
        </p>
      ))}
    </div>
  );
}
