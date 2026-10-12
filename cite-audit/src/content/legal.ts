/**
 * Pages légales : BROUILLON à faire valider par un juriste avant toute ouverture au public.
 * Les informations sur l'éditeur sont regroupées ici. Tant qu'un champ contient « À COMPLÉTER »,
 * un bandeau « brouillon » s'affiche sur chaque page légale.
 * Le contenu décrit le fonctionnement réel de l'application : le mettre à jour à chaque changement
 * de traitement de données (nouveau prestataire, nouvelle donnée collectée, nouvelle durée).
 */

export const LEGAL_ENTITY = {
  companyName: "[À COMPLÉTER : raison sociale de Data & AI Academy]",
  legalForm: "[À COMPLÉTER : forme juridique et capital social]",
  registration: "[À COMPLÉTER : numéro RCCM et compte contribuable]",
  address: "[À COMPLÉTER : adresse du siège, Abidjan, Côte d'Ivoire]",
  contactEmail: "[À COMPLÉTER : adresse e-mail de contact]",
  publicationDirector: "[À COMPLÉTER : nom du directeur de la publication]",
  host: "[À COMPLÉTER : nom, adresse et pays de l'hébergeur]",
  emailProvider: "[À COMPLÉTER : prestataire d'envoi d'e-mails et pays]",
  jurisdiction: "[À COMPLÉTER : tribunal compétent, par exemple Abidjan]",
  updatedAt: "12 octobre 2026",
} as const;

const PLACEHOLDER = "À COMPLÉTER";

export function hasPlaceholders(entity: Record<string, string> = LEGAL_ENTITY): boolean {
  return Object.values(entity).some((v) => v.includes(PLACEHOLDER));
}

export type LegalSection = { title: string; paragraphs: string[]; list?: string[] };
export type LegalPage = { title: string; intro: string; sections: LegalSection[] };
export type LegalSlug = "mentions-legales" | "confidentialite" | "conditions";

export function formatRetention(days: number): string {
  if (days === 0) return "sans limite de durée, jusqu'à la suppression du projet ou du compte";
  if (days % 365 === 0) return days === 365 ? "1 an" : `${days / 365} ans`;
  return `${days} jours`;
}

export function legalPages(params: { auditRetentionDays: number; aiRunRetentionDays: number }): Record<LegalSlug, LegalPage> {
  const e = LEGAL_ENTITY;
  return {
    "mentions-legales": {
      title: "Mentions légales",
      intro: "Informations sur l'éditeur et l'hébergeur du service CITE Audit.",
      sections: [
        {
          title: "Éditeur",
          paragraphs: [`${e.companyName}, ${e.legalForm}.`, e.registration, `Siège : ${e.address}.`, `Contact : ${e.contactEmail}.`],
        },
        { title: "Directeur de la publication", paragraphs: [e.publicationDirector] },
        { title: "Hébergement", paragraphs: [e.host] },
        {
          title: "Nature du service",
          paragraphs: [
            "CITE Audit analyse des signaux observables sur un site internet. Le score CITE est un indicateur interne de Data & AI Academy : ce n'est pas une mesure de Google, de ChatGPT, de Perplexity, de Gemini ou d'une autre IA.",
            "Aucune position dans un moteur de recherche ni aucune citation ou recommandation par une IA n'est garantie.",
          ],
        },
      ],
    },
    confidentialite: {
      title: "Politique de confidentialité",
      intro:
        "Cette page explique quelles données CITE Audit collecte, pourquoi, combien de temps elles sont gardées et comment exercer vos droits.",
      sections: [
        {
          title: "Responsable du traitement",
          paragraphs: [`${e.companyName}, ${e.address}. Contact pour toute question sur vos données : ${e.contactEmail}.`],
        },
        {
          title: "Données collectées",
          paragraphs: ["Nous collectons uniquement ce qui est nécessaire au service :"],
          list: [
            "Compte : nom, adresse e-mail, mot de passe (enregistré sous forme chiffrée irréversible, jamais en clair), confirmation de l'adresse.",
            "Sessions de connexion : adresse IP et navigateur utilisés, pour sécuriser votre compte.",
            "Projets : nom de l'entreprise, adresse du site, secteur, pays, ville, cible, concurrents et requêtes que vous saisissez.",
            "Résultats d'audit : informations publiques relevées sur les pages analysées (titres, textes, liens, extraits). Ces pages peuvent contenir des coordonnées publiées par le site lui-même.",
            "Mesures de visibilité IA (module facultatif) : les requêtes envoyées et les réponses complètes reçues.",
            "Sécurité : compteurs de tentatives (connexion, inscription, mot de passe oublié) et journaux techniques dont les adresses e-mail, liens et jetons sont masqués.",
          ],
        },
        {
          title: "Pourquoi nous utilisons ces données",
          paragraphs: [
            "Fournir le service (création du compte, audits, rapports, mesures IA), sécuriser l'accès (limites de tentatives, détection d'abus) et vous envoyer les e-mails indispensables (confirmation d'adresse, changement de mot de passe). Aucune donnée n'est vendue ni utilisée pour de la publicité.",
          ],
        },
        {
          title: "Durées de conservation",
          paragraphs: ["Une purge automatique s'exécute chaque jour :"],
          list: [
            "Compte et projets : jusqu'à leur suppression par vous (bouton « Supprimer » dans les paramètres du projet ou dans « Mon compte »). La suppression est immédiate et définitive.",
            `Audits : ${formatRetention(params.auditRetentionDays)} ; le dernier audit de chaque projet est toujours gardé.`,
            `Mesures de visibilité IA et réponses reçues : ${formatRetention(params.aiRunRetentionDays)} ; la dernière mesure de chaque projet est toujours gardée.`,
            "Sessions de connexion : 7 jours au plus. Lien de changement de mot de passe : 1 heure. Lien de confirmation d'adresse : 24 heures.",
            "Compteurs de tentatives : 24 heures au plus.",
          ],
        },
        {
          title: "Destinataires et prestataires",
          paragraphs: ["Vos données ne sont accessibles qu'à vous et, pour la maintenance, à l'équipe de Data & AI Academy. Prestataires techniques :"],
          list: [
            `Hébergement de l'application et de la base de données : ${e.host}.`,
            `Envoi des e-mails : ${e.emailProvider}.`,
            "Module facultatif de visibilité IA : les requêtes saisies sont envoyées à Perplexity AI (États-Unis), uniquement quand vous lancez une mesure et après avoir accepté son coût estimé. Aucune autre donnée de votre compte n'est transmise.",
          ],
        },
        {
          title: "Transferts hors de Côte d'Ivoire",
          paragraphs: [
            "Certains prestataires peuvent être situés hors de Côte d'Ivoire. Ces transferts sont encadrés conformément à la loi n° 2013-450 relative à la protection des données à caractère personnel et, pour les utilisateurs situés dans l'Union européenne, au RGPD. [À COMPLÉTER : garanties retenues, après choix des prestataires.]",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "CITE Audit utilise uniquement un cookie de session, strictement nécessaire pour vous garder connecté. Aucun cookie publicitaire ni de mesure d'audience n'est utilisé ; aucun consentement n'est donc demandé.",
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            `Vous pouvez accéder à vos données, les corriger (paramètres du projet), les supprimer (« Mon compte ») ou vous opposer à un traitement en écrivant à ${e.contactEmail}. Réponse sous 30 jours au plus.`,
            "Vous pouvez saisir l'Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire (ARTCI) ou, si vous résidez dans l'Union européenne, l'autorité de protection des données de votre pays.",
          ],
        },
        {
          title: "Sécurité",
          paragraphs: [
            "Mots de passe chiffrés de façon irréversible, connexions chiffrées (HTTPS), séparation stricte des données entre comptes, vérification des droits à chaque accès, limites de tentatives et journaux sans données sensibles.",
          ],
        },
      ],
    },
    conditions: {
      title: "Conditions générales d'utilisation",
      intro: "En créant un compte, vous acceptez les présentes conditions.",
      sections: [
        {
          title: "Le service",
          paragraphs: [
            "CITE Audit analyse des signaux observables sur un site internet selon la méthode CITE (Clarifier, Indexer, Tunnel, Enclencher) et produit un rapport et des recommandations. Un module facultatif mesure un échantillon de réponses d'IA à des requêtes que vous choisissez.",
          ],
        },
        {
          title: "Aucune garantie de résultat",
          paragraphs: [
            "Le score CITE est un indicateur interne de Data & AI Academy, fondé sur des signaux observables. Ce n'est pas une mesure de Google ni d'une IA.",
            "Les recommandations peuvent renforcer la compréhension de votre marque et maximiser vos chances d'être trouvé et cité, mais aucune position dans un moteur de recherche ni aucune citation ou recommandation par une IA n'est garantie. Résultat non garanti.",
            "Les résultats de visibilité IA peuvent varier selon le modèle, la date, la formulation et le contexte. Cette mesure est indicative et ne constitue pas une garantie de recommandation. Les réponses obtenues par API peuvent différer de celles des applications grand public.",
          ],
        },
        {
          title: "Vos engagements",
          paragraphs: ["En utilisant le service, vous vous engagez à :"],
          list: [
            "n'analyser que des sites dont vous êtes propriétaire ou pour lesquels vous êtes mandaté ;",
            "fournir des informations exactes et garder votre mot de passe confidentiel ;",
            "ne pas contourner les limites d'usage, ni utiliser le service pour surcharger ou attaquer un site.",
          ],
        },
        {
          title: "Fonctionnement de l'analyse",
          paragraphs: [
            "L'analyse lit au plus 15 pages publiques par audit, respecte les règles robots.txt du site et fait une pause entre deux pages. Une page non analysée ou inaccessible est indiquée « non vérifiée », jamais « absente ».",
          ],
        },
        {
          title: "Limites d'usage",
          paragraphs: [
            "Pour protéger le service et les sites analysés : 20 audits par compte sur 24 heures, un seul audit en cours par projet, et un nombre limité de requêtes IA par mesure et par jour.",
          ],
        },
        {
          title: "Responsabilité",
          paragraphs: [
            "Le service est fourni avec soin, sans garantie de disponibilité permanente. Data & AI Academy ne peut être tenue responsable des décisions prises sur la base des rapports, ni des contenus publiés par les sites analysés ou générés par les IA interrogées.",
          ],
        },
        {
          title: "Suspension et suppression",
          paragraphs: [
            "Vous pouvez supprimer votre compte à tout moment depuis « Mon compte ». Data & AI Academy peut suspendre un compte en cas d'usage contraire à ces conditions, après en avoir informé l'utilisateur sauf urgence.",
          ],
        },
        {
          title: "Droit applicable",
          paragraphs: [`Les présentes conditions sont régies par le droit ivoirien. Tribunal compétent : ${e.jurisdiction}.`],
        },
      ],
    },
  };
}
