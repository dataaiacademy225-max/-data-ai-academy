/** Avertissement affiché partout où des résultats de visibilité IA apparaissent. */
export const AI_WARNING =
  "Les résultats peuvent varier selon le modèle, la date, la formulation et le contexte. Cette mesure est indicative et ne constitue pas une garantie de recommandation.";

export function AiWarning() {
  return (
    <p role="note" className="rounded-md border border-accent/60 bg-accent/10 p-3 text-sm">
      <strong>Avertissement : </strong>
      {AI_WARNING}
    </p>
  );
}
