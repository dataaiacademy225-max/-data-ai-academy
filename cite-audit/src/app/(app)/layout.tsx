import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { signOutAction } from "@/server/actions/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="font-display text-lg font-bold">
            CITE <span className="text-accent">Audit</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Se déconnecter
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Le score CITE est un indicateur interne Data &amp; AI Academy, basé sur des signaux observables. Ce
        n&apos;est pas une mesure de Google, ChatGPT, Perplexity ou Gemini.
      </footer>
    </>
  );
}
