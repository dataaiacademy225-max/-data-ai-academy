import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal/legal-document";
import { BrandName } from "@/components/brand-name";
import { APP_NAME } from "@/lib/brand";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="font-display text-2xl font-bold">
            <BrandName />
          </p>
          <p className="text-sm text-muted-foreground">par Data &amp; AI Academy</p>
        </div>
        {children}
        <p className="text-center text-xs text-muted-foreground">
          {APP_NAME} mesure des signaux observables. Aucune position dans Google ni aucune citation par une IA
          n&apos;est garantie.
        </p>
        <LegalLinks className="text-center text-xs text-muted-foreground" />
      </div>
    </main>
  );
}
