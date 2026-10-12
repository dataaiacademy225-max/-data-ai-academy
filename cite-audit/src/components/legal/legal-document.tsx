import Link from "next/link";
import type { LegalPage } from "@/content/legal";

export function LegalDocument({ page, updatedAt, draft }: { page: LegalPage; updatedAt: string; draft: boolean }) {
  return (
    <article className="space-y-6">
      {draft && (
        <p role="note" className="rounded-md border border-accent bg-accent/10 p-3 text-sm">
          <span aria-hidden="true">⚠️ </span>
          <strong>Brouillon</strong> : document à compléter et à faire valider par un juriste avant l&apos;ouverture au public.
        </p>
      )}
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">{page.title}</h1>
        <p className="text-sm text-muted-foreground">Dernière mise à jour : {updatedAt}</p>
        <p>{page.intro}</p>
      </header>
      {page.sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="font-display text-lg font-semibold">{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p} className="text-sm leading-relaxed">
              {p}
            </p>
          ))}
          {section.list && (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Informations légales" className={className}>
      <Link href="/mentions-legales" className="hover:underline">
        Mentions légales
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/confidentialite" className="hover:underline">
        Confidentialité
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/conditions" className="hover:underline">
        Conditions d&apos;utilisation
      </Link>
    </nav>
  );
}
