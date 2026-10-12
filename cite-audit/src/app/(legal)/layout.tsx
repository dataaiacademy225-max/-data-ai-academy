import type { ReactNode } from "react";
import Link from "next/link";
import { LegalLinks } from "@/components/legal/legal-document";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/" className="font-display text-lg font-bold">
            CITE <span className="text-accent">Audit</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <LegalLinks />
      </footer>
    </>
  );
}
