import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isDesignatedOwner, isOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { signOutAction } from "@/server/actions/auth";
import { resendVerificationEmailAction } from "@/server/actions/password";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { LegalLinks } from "@/components/legal/legal-document";
import { BrandName } from "@/components/brand-name";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="theme-premium flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="font-display text-lg font-bold">
            <BrandName />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            {isOwner(user) && (
              <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-medium" title="Compte propriétaire : pas de limite d'audits par jour">
                <span aria-hidden="true">★ </span>Propriétaire
              </span>
            )}
            <Link href="/settings/account" className="text-muted-foreground hover:text-foreground hover:underline">
              Mon compte
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Se déconnecter
              </Button>
            </form>
          </div>
        </div>
      </header>
      {!user.emailVerified && <VerifyEmailBanner action={resendVerificationEmailAction} />}
      {isDesignatedOwner(user) && !user.twoFactorEnabled && (
        <div role="status" className="border-b border-border bg-accent/10">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm">
            <span aria-hidden="true">🔐 </span>
            Compte propriétaire : activez la double authentification pour débloquer les audits illimités.{" "}
            <Link className="font-medium underline" href="/settings/account#double-authentification">
              Activer maintenant
            </Link>
          </p>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Le score CITE est un indicateur interne Data &amp; AI Academy, basé sur des signaux observables. Ce
        n&apos;est pas une mesure de Google, ChatGPT, Perplexity ou Gemini.
        <LegalLinks className="mt-2" />
      </footer>
    </div>
  );
}
