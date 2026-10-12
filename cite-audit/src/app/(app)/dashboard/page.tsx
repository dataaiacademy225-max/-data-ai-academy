import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { COUNTRIES } from "@/lib/validation/countries";
import { listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Tableau de bord" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  const hasDemo = projects.some((p) => p.isDemo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vos projets et leur dernier audit.</p>
        </div>
        <Link href="/projects/new" className={buttonVariants({ variant: "accent" })}>
          Nouveau projet
        </Link>
      </div>

      {hasDemo && (
        <p className="rounded-md border border-accent/60 bg-accent/10 p-3 text-sm">
          Les projets marqués <strong>Démo</strong> contiennent des données fictives de démonstration. Ils ne
          décrivent aucune entreprise réelle et ne sont pas des résultats d&apos;audit.
        </p>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun projet pour l&apos;instant</CardTitle>
            <CardDescription>
              Créez un projet avec l&apos;adresse de votre site, votre secteur et votre cible. Vous pourrez ensuite
              lancer un audit CITE (Clarifier, Indexer, Tunnel, Enclencher).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/projects/new" className={buttonVariants()}>
              Créer mon premier projet
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const lastAudit = project.audits[0];
            return (
              <li key={project.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">
                        <Link href={`/projects/${project.id}`} className="hover:underline">
                          {project.companyName}
                        </Link>
                      </CardTitle>
                      {project.isDemo && <Badge variant="demo">Démo</Badge>}
                    </div>
                    <CardDescription className="break-all">{project.siteUrl}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>
                      {project.sector} · {project.city ? `${project.city}, ` : ""}
                      {countryName(project.country)}
                    </p>
                    <p className="text-muted-foreground">
                      {lastAudit
                        ? lastAudit.scoreTotal !== null
                          ? `Dernier score CITE : ${lastAudit.scoreTotal}/100`
                          : "Dernier audit : score non vérifié"
                        : "Aucun audit lancé"}
                      {" · "}créé le {dateFormat.format(project.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
