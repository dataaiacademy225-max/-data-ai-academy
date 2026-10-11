import type { CriterionStatus, Effort, Priority } from "@/server/scoring/types";
import { cn } from "@/lib/utils";

/**
 * Libellés et pastilles du rapport. Une couleur n'est jamais seule porteuse de sens :
 * chaque état a une icône ET un libellé (lisible en noir et blanc, à l'impression, en daltonisme).
 */

const PRIORITY: Record<Priority, { label: string; icon: string; className: string }> = {
  CRITIQUE: { label: "Critique", icon: "▲", className: "border-[#d03b3b] text-[#d03b3b]" },
  IMPORTANT: { label: "Important", icon: "●", className: "border-[#ec835a] text-foreground" },
  RECOMMANDE: { label: "Recommandé", icon: "○", className: "border-border text-muted-foreground" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const p = PRIORITY[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs font-semibold", p.className)}>
      <span aria-hidden="true">{p.icon}</span>
      {p.label}
    </span>
  );
}

const STATUS: Record<CriterionStatus, { label: string; icon: string; iconClass: string }> = {
  PASS: { label: "Validé", icon: "✓", iconClass: "text-[#0ca30c]" },
  PARTIAL: { label: "Partiel", icon: "~", iconClass: "text-[#ec835a]" },
  FAIL: { label: "À améliorer", icon: "✗", iconClass: "text-[#d03b3b]" },
  NOT_VERIFIED: { label: "Non vérifié", icon: "?", iconClass: "text-muted-foreground" },
  NOT_APPLICABLE: { label: "Sans objet", icon: "–", iconClass: "text-muted-foreground" },
};

export function StatusLabel({ status }: { status: CriterionStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex min-w-28 items-center gap-1.5 text-xs font-semibold">
      <span aria-hidden="true" className={cn("inline-flex size-5 items-center justify-center rounded-full border border-current text-[11px]", s.iconClass)}>
        {s.icon}
      </span>
      {s.label}
    </span>
  );
}

export const EFFORT_LABEL: Record<Effort, string> = { faible: "Effort faible", moyen: "Effort moyen", élevé: "Effort élevé" };

export const formatPoints = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
