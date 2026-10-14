import { Badge } from "@/components/ui/badge";
import { AreaChart } from "@/components/ui/area-chart";

// Données FICTIVES de démonstration : elles ne décrivent aucune entreprise ni aucun audit réel.
const DEMO_DATA = [
  { mois: "mai", "Score CITE": 41, "Critères mesurés (%)": 72 },
  { mois: "juin", "Score CITE": 44, "Critères mesurés (%)": 75 },
  { mois: "juil.", "Score CITE": 49, "Critères mesurés (%)": 81 },
  { mois: "août", "Score CITE": 53, "Critères mesurés (%)": 84 },
  { mois: "sept.", "Score CITE": 58, "Critères mesurés (%)": 90 },
  { mois: "oct.", "Score CITE": 62, "Critères mesurés (%)": 93 },
];

/** Exemple de graphique de zone avec des données fictives, clairement signalées. */
export function AreaChartDemo() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Évolution du score CITE sur six mois</p>
        <Badge variant="demo">[DÉMO] données fictives</Badge>
      </div>
      <AreaChart
        data={DEMO_DATA}
        index="mois"
        categories={["Score CITE", "Critères mesurés (%)"]}
        yDomain={[0, 100]}
        label="Exemple fictif : évolution du score CITE et de la part des critères mesurés, de mai à octobre."
      />
      <p className="text-xs text-muted-foreground">
        Le score CITE est un indicateur interne Data &amp; AI Academy, pas une mesure de Google ni d&apos;une IA.
      </p>
    </div>
  );
}
