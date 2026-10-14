import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AreaChartDemo } from "@/components/ui-test/area-chart-demo";
import { DialogDemo } from "@/components/ui-test/dialog-demo";
import { isOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Test des composants" };

// Barème CITE réel (cite-1.1.0) : aucune donnée inventée.
const PILLARS = [
  { name: "Clarifier", question: "Un visiteur comprend-il ce que vous proposez ?", max: 25 },
  { name: "Indexer", question: "Google et les assistants IA peuvent-ils lire votre site ?", max: 30 },
  { name: "Tunnel", question: "Le visiteur trouve-t-il la bonne page et des preuves ?", max: 25 },
  { name: "Enclencher", question: "Un visiteur convaincu peut-il vous contacter facilement ?", max: 20 },
];

/** Page de vérification des composants d'interface. En production, réservée au propriétaire. */
export default async function UiTestPage() {
  const user = await requireUser();
  if (process.env.NODE_ENV === "production" && !isOwner(user)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Test des composants</h1>
        <p className="text-sm text-muted-foreground">Boutons, tableau, fenêtre de dialogue et graphique.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Boutons</CardTitle>
          <CardDescription>Toutes les variantes et tailles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button>Principal</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="outline">Contour</Button>
            <Button variant="ghost">Discret</Button>
            <Button variant="link">Lien</Button>
            <Button variant="destructive">
              <Trash2Icon className="size-4" aria-hidden="true" />
              Supprimer
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Petit</Button>
            <Button>Normal</Button>
            <Button size="lg">Grand</Button>
            <Button size="icon" variant="outline" aria-label="Rechercher">
              <SearchIcon className="size-4" aria-hidden="true" />
            </Button>
            <Button disabled>Désactivé</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tableau</CardTitle>
          <CardDescription>Le barème CITE par pilier.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Barème cite-1.1.0 : 32 critères au total.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Pilier</TableHead>
                <TableHead>Question posée</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PILLARS.map((pillar) => (
                <TableRow key={pillar.name}>
                  <TableCell className="font-medium">{pillar.name}</TableCell>
                  <TableCell>{pillar.question}</TableCell>
                  <TableCell className="text-right">{pillar.max}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">100</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fenêtre de dialogue</CardTitle>
          <CardDescription>Ouvrez la fenêtre puis confirmez ou annulez.</CardDescription>
        </CardHeader>
        <CardContent>
          <DialogDemo />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Graphique de zone</CardTitle>
          <CardDescription>Composant au format Tremor, construit sur Recharts.</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChartDemo />
        </CardContent>
      </Card>
    </div>
  );
}
