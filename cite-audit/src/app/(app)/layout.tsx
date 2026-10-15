import type { ReactNode } from "react";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDesignatedOwner, isOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { signOutAction } from "@/server/actions/auth";
import { resendVerificationEmailAction } from "@/server/actions/password";
import { listProjects } from "@/server/services/projects";
import { NavLinks } from "@/components/app-shell/nav-links";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { LegalLinks } from "@/components/legal/legal-document";
import { BrandName } from "@/components/brand-name";

const SIDEBAR_PROJECTS = 6;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const projects = (await listProjects(user.id))
    .slice(0, SIDEBAR_PROJECTS)
    .map(({ id, companyName, isDemo }) => ({ id, companyName, isDemo }));
  const owner = isOwner(user);

  const signOut = (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
        <LogOutIcon className="size-4" aria-hidden="true" />
        Se déconnecter
      </Button>
    </form>
  );
  const ownerBadge = owner && (
    <span
      className="rounded-full border border-accent/60 bg-accent/10 px-2 py-0.5 text-xs font-medium"
      title="Compte propriétaire : pas de limite d'audits par jour"
    >
      <span aria-hidden="true">★ </span>Propriétaire
    </span>
  );

  return (
    <div className="theme-premium flex min-h-full flex-1">
      {/* Navigation latérale (grand écran) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-[#05080e]/80 backdrop-blur-xl lg:flex print:hidden">
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="font-display text-lg font-bold tracking-tight">
            <BrandName />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks variant="sidebar" projects={projects} />
        </div>
        <div className="space-y-3 border-t border-border/70 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] text-xs font-semibold uppercase"
            >
              {(user.name || user.email).slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name || user.email}</p>
              <p className="truncate text-xs text-muted-foreground" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
          {ownerBadge && <div>{ownerBadge}</div>}
          {signOut}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre du haut (mobile et tablette) */}
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/dashboard" className="font-display text-lg font-bold">
              <BrandName />
            </Link>
            <div className="flex items-center gap-2">
              {ownerBadge}
              {signOut}
            </div>
          </div>
          <div className="px-4">
            <NavLinks variant="bar" />
          </div>
        </header>
        {!user.emailVerified && <VerifyEmailBanner action={resendVerificationEmailAction} />}
        {isDesignatedOwner(user) && !user.twoFactorEnabled && (
          <div role="status" className="border-b border-border bg-accent/10">
            <p className="mx-auto max-w-6xl px-4 py-2 text-sm lg:px-8">
              <span aria-hidden="true">🔐 </span>
              Compte propriétaire : activez la double authentification pour débloquer les audits illimités.{" "}
              <Link className="font-medium underline" href="/settings/account#double-authentification">
                Activer maintenant
              </Link>
            </p>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Le score CITE est un indicateur interne Data &amp; AI Academy, basé sur des signaux observables. Ce
          n&apos;est pas une mesure de Google, ChatGPT, Perplexity ou Gemini.
          <LegalLinks className="mt-2" />
        </footer>
      </div>
    </div>
  );
}
