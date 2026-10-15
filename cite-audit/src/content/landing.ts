/**
 * Textes de la page d'accueil publique. Aucune promesse de résultat : tous passent `findForbiddenWording`
 * (tests/unit/content/landing.test.ts). Les chiffres (critères, piliers, pages) viennent du code, pas d'ici.
 */

import { APP_NAME } from "@/lib/brand";

export const LANDING = {
  hero: {
    tagline: "Audit SEO/GEO B2B — Méthode CITE",
    eyebrow: "GEO · Generative Engine Optimization",
    titleStart: "Découvrez pourquoi votre marque est",
    titleHighlight: "peu visible",
    titleEnd: "dans Google et les IA",
    lead: `${APP_NAME} analyse votre positionnement, votre SEO, vos contenus, vos preuves et votre tunnel pour vous fournir un plan d'action priorisé.`,
    transparency: `Aucune position ni recommandation n'est garantie : ${APP_NAME} vous aide à maximiser vos chances d'être trouvé, compris et cité.`,
    ctaPrimary: "Auditer mon site",
    ctaSecondary: "Voir un exemple de rapport",
    access: "Accès sur invitation pendant la phase pilote : sans compte, « Auditer mon site » ouvre la demande d'accès.",
    // Utilisés par la section d'appel finale (inchangée).
    disclaimer: "Résultat non garanti : une méthode transparente, pas une promesse.",
    ctaGuest: "Demander un accès",
    ctaUser: "Ouvrir mon tableau de bord",
  },
  preview: {
    badge: "[DÉMO] Exemple fictif",
    company: "Cabinet exemple",
    sample: "Échantillon de 12 réponses : 5 mentions, 2 citations, 1 recommandation.",
  },
  // Preuve : audit interne réel du site de Data & AI Academy (rapport GriotCite du 15 octobre 2026).
  // Valeurs recopiées du rapport, jamais estimées. À mettre à jour à chaque nouvel audit publié ici.
  proof: {
    badge: "Audit interne",
    title: `${APP_NAME} testé sur son propre site`,
    score: 89,
    site: "data-ai-academy.com",
    auditDate: "15 octobre 2026",
    pagesAnalyzed: 15,
    scoringVersion: "cite-1.1.0",
    pillars: [
      { label: "Clarifier", value: 17.5, max: 25 },
      { label: "Indexer", value: 27.5, max: 30 },
      { label: "Tunnel", value: 25, max: 25 },
      { label: "Enclencher", value: 18.5, max: 20 },
    ],
    summary: "89/100 lors d'un audit interne de Data & AI Academy.",
    scoreNote: "Indicateur interne Data & AI Academy, calculé par la méthode CITE : ce n'est pas une note de Google ni de ChatGPT.",
    aiObservation:
      "Lors de tests réalisés sur plusieurs requêtes, Data & AI Academy a également été recommandée dans certaines réponses de Google AI et ChatGPT.",
    aiObservationNote: `Tests manuels, distincts du score CITE : ${APP_NAME} n'interroge aujourd'hui que Perplexity, par son API officielle.`,
    /**
     * Période des tests manuels dans les IA, telle que rapportée par Steve Junior le 15/10/2026 :
     * première requête vers le 15 septembre, recommandation ChatGPT ~3 semaines plus tard, Google quelques jours après.
     * Aucun jour précis inventé. null = rien n'est affiché.
     */
    aiTestPeriod: "entre mi-septembre et mi-octobre 2026" as string | null,
    transparency:
      "Résultat observé à une date donnée. Les réponses peuvent varier selon la requête, la date, le modèle et la localisation. Ce score ne constitue pas une garantie de classement ou de recommandation.",
    cta: "Voir l'exemple de rapport",
    ctaNote: "L'exemple de rapport utilise des données fictives, signalées « [DÉMO] ».",
  },
  why: {
    title: "Pourquoi la GEO change la donne",
    lead: "Les assistants IA résument le web en une seule réponse. Ce qu'ils retiennent de vous dépend de ce qu'ils peuvent lire et vérifier.",
    items: [
      {
        title: "Les réponses remplacent les liens",
        text: "Un assistant synthétise plusieurs sources en quelques phrases. Les sources retenues ne sont pas toujours les mieux classées dans Google.",
      },
      {
        title: "La clarté devient un avantage",
        text: "Une entité clairement décrite, des données structurées et des preuves vérifiables peuvent maximiser vos chances d'être cité.",
      },
      {
        title: "Mesurer sans se raconter d'histoires",
        text: "GriotCite sépare ce qui est observé de ce qui ne l'est pas : une donnée absente reste « non vérifiée », jamais devinée.",
      },
    ],
  },
  method: {
    title: "La méthode CITE",
    lead: "Quatre piliers, des critères vérifiables, et pour chaque constat : la preuve, l'impact potentiel, l'action à mener et son effort.",
    note: "Le score CITE est un indicateur interne Data & AI Academy, jamais une mesure de Google ou d'une IA.",
  },
  sample: {
    title: "Un échantillon de réponses d'IA, en option",
    lead: "Posez vos questions clés à un assistant et voyez ce qu'il répond. Trois niveaux, jamais confondus :",
    levels: [
      { title: "Mention", text: "Le nom ou le domaine de votre marque apparaît dans la réponse." },
      { title: "Citation", text: "Une source renvoyée par l'assistant pointe vers votre site." },
      { title: "Recommandation", text: "Une formulation explicite vous conseille, dans la même phrase." },
    ],
    note: "Aujourd'hui : Perplexity, par son API officielle. ChatGPT et Gemini ne sont pas encore interrogés. Coût estimé et accepté avant chaque lancement.",
  },
  limits: {
    title: "Ce que GriotCite ne mesure pas",
    lead: "Un bon diagnostic dit aussi ce qu'il ne voit pas.",
    items: [
      "La visibilité globale de votre marque dans les assistants IA",
      "Votre position dans Google",
      "La vitesse de chargement des pages",
      "Le contenu affiché uniquement par JavaScript",
      "Les mentions de votre marque sur d'autres sites",
    ],
  },
  finalCta: {
    title: "Voyez ce que votre site dit vraiment de vous.",
    lead: "Un audit CITE prend quelques minutes. Vous repartez avec des priorités claires, compréhensibles par un dirigeant.",
  },
  footer:
    "GriotCite mesure des signaux observables. Aucune position dans Google ni aucune citation par une IA n'est garantie.",
} as const;
