import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal/legal-document";
import { BrandName } from "@/components/brand-name";
import { HeroBackground } from "@/components/premium/hero-background";
import { APP_NAME } from "@/lib/brand";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="theme-premium relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <HeroBackground />
      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="bg-gradient-to-b from-white to-white/60 bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent">
            <BrandName />
          </p>
          <p className="text-sm text-muted-foreground">par Data &amp; AI Academy</p>
        </div>
        {/* Carte du formulaire : verre dépoli et liseré lumineux, sans déplacement au survol. */}
        <div className="rounded-xl shadow-[0_30px_80px_-30px_rgb(255_122_41/0.3)] [&>*]:border-white/10 [&>*]:bg-card/80 [&>*]:backdrop-blur-xl">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {APP_NAME} mesure des signaux observables. Aucune position dans Google ni aucune citation par une IA
          n&apos;est garantie.
        </p>
        <LegalLinks className="text-center text-xs text-muted-foreground" />
      </div>
    </main>
  );
}
