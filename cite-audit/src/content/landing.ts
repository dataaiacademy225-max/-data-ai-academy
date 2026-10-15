/**
 * Textes de la page d'accueil publique. Aucune promesse de résultat : tous passent `findForbiddenWording`
 * (tests/unit/content/landing.test.ts). Les chiffres (critères, piliers, pages) viennent du code, pas d'ici.
 */

export const LANDING = {
  hero: {
    eyebrow: "GEO · Generative Engine Optimization",
    titleStart: "Rendez votre marque",
    titleHighlight: "lisible",
    titleEnd: "pour les moteurs de réponse.",
    lead:
      "ChatGPT, Perplexity et Gemini répondent désormais à la place d'une liste de liens. GriotCite audite les signaux observables de votre site qui peuvent renforcer la compréhension de votre marque par ces assistants et par Google, puis vous dit quoi corriger en premier.",
    disclaimer: "Résultat non garanti : une méthode transparente, pas une promesse.",
    ctaGuest: "Tester GriotCite",
    ctaUser: "Ouvrir mon tableau de bord",
    secondary: "Voir la méthode",
    access: "Accès sur invitation pendant la phase pilote.",
  },
  preview: {
    badge: "[DÉMO] Exemple fictif",
    company: "Cabinet exemple",
    sample: "Échantillon de 12 réponses : 5 mentions, 2 citations, 1 recommandation.",
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
