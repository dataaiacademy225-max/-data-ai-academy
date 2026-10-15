import { Stagger, StaggerItem } from "@/components/premium/fade-in";
import { SpotlightCard } from "@/components/premium/spotlight-card";
import type { ProviderSample, SampleSummary } from "@/server/ai-visibility/summary";
import type { AiProviderId } from "@/server/ai-visibility/types";

// Assistants présentés. Seul Perplexity est interrogé par GriotCite aujourd'hui (API officielle).
const ASSISTANTS: { id: AiProviderId; name: string; initial: string; available: boolean }[] = [
  { id: "PERPLEXITY", name: "Perplexity", initial: "P", available: true },
  { id: "OPENAI_COMPATIBLE", name: "ChatGPT", initial: "C", available: false },
  { id: "GEMINI", name: "Gemini", initial: "G", available: false },
];

const LEVELS: { key: keyof Pick<ProviderSample, "mentioned" | "cited" | "recommended">; label: string; hint: string }[] = [
  { key: "mentioned", label: "Mentions", hint: "Le nom ou le domaine apparaît dans la réponse." },
  { key: "cited", label: "Citations", hint: "Une source renvoyée pointe vers votre site." },
  { key: "recommended", label: "Recommandations", hint: "Formulation explicite dans la même phrase." },
];

/** Échantillon de réponses d'IA par assistant : comptes réels, jamais un score. */
export function AiSampleCards({ summary }: { summary: SampleSummary }) {
  return (
    <Stagger className="grid gap-4 md:grid-cols-3">
      {ASSISTANTS.map((assistant) => {
        const sample = summary.byProvider[assistant.id];
        return (
          <StaggerItem key={assistant.id}>
            <SpotlightCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] font-display text-sm font-semibold"
                  >
                    {assistant.initial}
                  </span>
                  <p className="font-display font-semibold">{assistant.name}</p>
                </div>
                <StatusChip sample={sample} available={assistant.available} demo={summary.scope === "demo"} />
              </div>

              {sample ? (
                <dl className="mt-5 space-y-3">
                  {LEVELS.map((level) => {
                    const value = sample[level.key];
                    const ratio = sample.analyzed ? value / sample.analyzed : 0;
                    return (
                      <div key={level.key} title={level.hint}>
                        <div className="flex items-baseline justify-between text-sm">
                          <dt className="text-muted-foreground">{level.label}</dt>
                          <dd className="font-medium tabular-nums">
                            {value} <span className="text-muted-foreground">/ {sample.analyzed}</span>
                          </dd>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ff7a29] to-[#ffb380]"
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  {assistant.available
                    ? "Aucune requête analysée pour l'instant. Lancez un échantillon depuis un projet."
                    : "Non mesuré : GriotCite n'interroge pas encore cet assistant."}
                </p>
              )}
            </SpotlightCard>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

function StatusChip({ sample, available, demo }: { sample?: ProviderSample; available: boolean; demo: boolean }) {
  const label = sample ? (demo ? "Démo" : `${sample.analyzed} requêtes`) : available ? "En attente" : "Non mesuré";
  const tone = sample
    ? "border-[#ff7a29]/40 bg-[#ff7a29]/10 text-[#ffb380]"
    : "border-white/10 bg-white/[0.03] text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${sample ? "bg-[#ff7a29]" : "bg-white/30"}`} />
      {label}
    </span>
  );
}
