import { APP_NAME } from "@/lib/brand";

/**
 * Pages légales : BROUILLON à faire valider par un juriste avant toute ouverture au public.
 * Les informations sur l'éditeur sont regroupées ici. Tant qu'un champ contient « À COMPLÉTER »,
 * un bandeau « brouillon » s'affiche sur chaque page légale.
 * Le contenu décrit le fonctionnement réel de l'application : le mettre à jour à chaque changement
 * de traitement de données (nouveau prestataire, nouvelle donnée collectée, nouvelle durée).
 */

// Éditeur actuel : une personne physique qui exploite la marque commerciale « Data & AI Academy »
// (pas encore de société immatriculée). Après immatriculation : remplacer `legalStatus`
// et renseigner `registration` (RCCM, compte contribuable) ; vide = ligne non affichée.
export const LEGAL_ENTITY = {
  publisherName: "Steve Junior Kouakou",
  legalStatus: "personne physique exploitant la marque commerciale Data & AI Academy",
  registration: "",
  address: "[À COMPLÉTER : adresse postale, Abidjan, Côte d'Ivoire]",
  contactEmail: "steve@data-ai-academy.com",
  host: "[À COMPLÉTER : nom, adresse et pays de l'hébergeur]",
  emailProvider: "[À COMPLÉTER : prestataire d'envoi d'e-mails et pays]",
  jurisdiction: "[À COMPLÉTER : tribunal compétent, par exemple Abidjan]",
  /** Obligatoire si l'éditeur n'est pas établi dans l'UE et vise des utilisateurs européens (article 27 du RGPD). */
  euRepresentative: "[À COMPLÉTER : représentant dans l'Union européenne (article 27 du RGPD), nom et adresse]",
  updatedAt: "12 octobre 2026",
} as const;

const PLACEHOLDER = "À COMPLÉTER";

export function hasPlaceholders(entity: Record<string, string> = LEGAL_ENTITY): boolean {
  return Object.values(entity).some((v) => v.includes(PLACEHOLDER));
}

export type LegalSection = { title: string; paragraphs: string[]; list?: string[] };
export type LegalPage = { title: string; intro: string; sections: LegalSection[] };
export type LegalSlug = "mentions-legales" | "confidentialite" | "conditions";

/** Ligne « durée de conservation » d'un historique (audits ou mesures IA). */
function historyRetention(label: string, days: number, latest: string): string {
  if (days === 0) return `${label} : gardés tant que le projet et le compte existent, puis supprimés avec eux.`;
  return `${label} : ${formatRetention(days)} ; ${latest}`;
}

export function formatRetention(days: number): string {
  if (days === 0) return "sans limite de durée, jusqu'à la suppression du projet ou du compte";
  if (days % 365 === 0) return days === 365 ? "1 an" : `${days / 365} ans`;
  return `${days} jours`;
}

export type LegalParams = {
  auditRetentionDays: number;
  aiRunRetentionDays: number;
  /** Comptes inactifs : avertissement après N jours sans connexion (0 = jamais), suppression après le délai de grâce. */
  inactiveAccountDays?: number;
  inactiveAccountGraceDays?: number;
};

function inactiveAccountRule(days: number, graceDays: number): string {
  if (days === 0) return "Compte inactif : aucune suppression automatique ; le compte reste actif jusqu'à sa suppression par vous.";
  return `Compte inactif : après ${formatRetention(days)} sans connexion, vous recevez un e-mail d'avertissement. Sans reconnexion dans les ${graceDays} jours qui suivent, le compte et toutes ses données sont définitivement supprimés.`;
}

export function legalPages(params: LegalParams): Record<LegalSlug, LegalPage> {
  const inactiveDays = params.inactiveAccountDays ?? 1095;
  const graceDays = params.inactiveAccountGraceDays ?? 30;
  const e = LEGAL_ENTITY;
  return {
    "mentions-legales": {
      title: "Mentions légales",
      intro: `Informations sur l'éditeur et l'hébergeur du service ${APP_NAME}.`,
      sections: [
        {
          title: "Éditeur",
          paragraphs: [`${e.publisherName}, ${e.legalStatus}.`, ...(e.registration ? [e.registration] : []), `Adresse : ${e.address}.`, `Contact : ${e.contactEmail}.`],
        },
        { title: "Directeur de la publication", paragraphs: [e.publisherName] },
        { title: "Représentant dans l'Union européenne", paragraphs: [e.euRepresentative] },
        { title: "Hébergement", paragraphs: [e.host] },
        {
          title: "Nature du service",
          paragraphs: [
            `${APP_NAME} analyse des signaux observables sur un site internet. Le score CITE est un indicateur interne de Data & AI Academy : ce n'est pas une mesure de Google, de ChatGPT, de Perplexity, de Gemini ou d'une autre IA.`,
            "Aucune position dans un moteur de recherche ni aucune citation ou recommandation par une IA n'est garantie.",
          ],
        },
      ],
    },
    confidentialite: {
      title: "Politique de confidentialité",
      intro:
        `Cette page explique quelles données ${APP_NAME} collecte, pourquoi, combien de temps elles sont gardées et comment exercer vos droits.`,
      sections: [
        {
          title: "Responsable du traitement",
          paragraphs: [`${e.publisherName}, ${e.legalStatus}, ${e.address}. Contact pour toute question sur vos données : ${e.contactEmail}.`],
        },
        {
          title: "Données collectées",
          paragraphs: ["Nous collectons uniquement ce qui est nécessaire au service :"],
          list: [
            "Compte : nom, adresse e-mail, mot de passe (enregistré sous forme chiffrée irréversible, jamais en clair), confirmation de l'adresse.",
            "Double authentification (si vous l'activez) : clé secrète de l'application d'authentification et codes de secours, enregistrés chiffrés.",
            "Sessions de connexion : adresse IP et navigateur utilisés, pour sécuriser votre compte.",
            "Projets : nom de l'entreprise, adresse du site, secteur, pays, ville, cible, concurrents et requêtes que vous saisissez.",
            "Résultats d'audit : informations publiques relevées sur les pages analysées (titres, textes, liens, extraits). Ces pages peuvent contenir des coordonnées publiées par le site lui-même.",
            "Mesures de visibilité IA (module facultatif) : les requêtes envoyées et les réponses complètes reçues.",
            "Demande d'accès (formulaire public) : nom, adresse e-mail, et si vous les indiquez, entreprise, adresse du site et message. L'adresse du site n'est ni visitée ni analysée.",
            "Sécurité : compteurs de tentatives (connexion, inscription, mot de passe oublié, demande d'accès) et journaux techniques dont les adresses e-mail, liens et jetons sont masqués.",
          ],
        },
        {
          title: "Pourquoi nous utilisons ces données",
          paragraphs: [
            "Fournir le service (création du compte, audits, rapports, mesures IA), sécuriser l'accès (limites de tentatives, détection d'abus) et vous envoyer les e-mails indispensables (confirmation d'adresse, changement de mot de passe, fin d'audit), et étudier les demandes d'accès. Aucune donnée n'est vendue ni utilisée pour de la publicité.",
          ],
        },
        {
          title: "Bases légales",
          paragraphs: ["Chaque traitement repose sur une base prévue par la loi :"],
          list: [
            "Exécution du contrat (les conditions d'utilisation) : compte, projets, audits, mesures IA, e-mails de service.",
            "Mesures précontractuelles prises à votre demande, avec votre accord : traitement des demandes d'accès.",
            "Intérêt légitime : sécurité du service (limites de tentatives, journaux techniques, prévention des abus).",
            "Obligation légale : conservation des factures et données comptables, lorsque des services payants seront proposés.",
          ],
        },
        {
          title: "Durées de conservation",
          paragraphs: ["Une purge automatique des données expirées s'exécute chaque jour :"],
          list: [
            "Compte et projets : jusqu'à leur suppression par vous (bouton « Supprimer » dans les paramètres du projet ou dans « Mon compte »). La suppression est immédiate et définitive.",
            inactiveAccountRule(inactiveDays, graceDays),
            historyRetention("Audits", params.auditRetentionDays, "le dernier audit de chaque projet est toujours gardé."),
            historyRetention("Mesures de visibilité IA et réponses reçues", params.aiRunRetentionDays, "la dernière mesure de chaque projet est toujours gardée."),
            "Sessions de connexion : 7 jours au plus. Lien de changement de mot de passe : 1 heure. Lien de confirmation d'adresse : 24 heures.",
            "Double authentification : clé et codes de secours conservés jusqu'à sa désactivation ou la suppression du compte. Vérification du code après le mot de passe : 10 minutes au plus.",
            "Demandes d'accès : 12 mois après leur envoi, puis suppression automatique.",
            "Compteurs de tentatives : 24 heures au plus.",
            "Copies de sauvegarde de la base, chiffrées : 30 jours, puis suppression automatique. Une donnée que vous supprimez peut donc subsister jusqu'à 30 jours dans ces copies, sans être utilisée.",
          ],
        },
        {
          title: "Destinataires et prestataires",
          paragraphs: ["Vos données ne sont accessibles qu'à vous et, pour la maintenance, à l'équipe de Data & AI Academy. Prestataires techniques :"],
          list: [
            `Hébergement de l'application et de la base de données : ${e.host}.`,
            `Envoi des e-mails : ${e.emailProvider}.`,
            "Copies de sauvegarde chiffrées : GitHub (GitHub, Inc., filiale de Microsoft, États-Unis). Le fichier est chiffré avant d'être déposé ; GitHub ne peut pas le lire.",
            "Module facultatif de visibilité IA : les requêtes saisies sont envoyées à Perplexity AI (États-Unis), uniquement quand vous lancez une mesure et après avoir accepté son coût estimé. Aucune autre donnée de votre compte n'est transmise.",
          ],
        },
        {
          title: "Utilisateurs concernés et transferts internationaux",
          paragraphs: [
            `${APP_NAME} s'adresse aux entreprises des pays francophones d'Afrique et d'Europe. Les données sont traitées conformément à la loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel, à la loi applicable dans le pays de l'utilisateur et, pour les utilisateurs situés dans l'Union européenne, au Règlement général sur la protection des données (RGPD).`,
            `Représentant dans l'Union européenne : ${e.euRepresentative}.`,
            "Certains prestataires peuvent être situés dans un autre pays que le vôtre. Ces transferts sont encadrés par des garanties adaptées (clauses contractuelles types de la Commission européenne ou décision d'adéquation). [À COMPLÉTER : garanties retenues, après choix des prestataires.]",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            `${APP_NAME} utilise uniquement des cookies strictement nécessaires : le cookie de session, qui vous garde connecté, et, si la double authentification est active, un cookie temporaire (10 minutes) entre le mot de passe et le code. Aucun cookie publicitaire ni de mesure d'audience n'est utilisé ; aucun consentement n'est donc demandé.`,
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            `Vous pouvez accéder à vos données, les corriger (paramètres du projet), les supprimer (« Mon compte ») ou vous opposer à un traitement en écrivant à ${e.contactEmail}. Réponse sous 30 jours au plus.`,
            "Vous pouvez aussi saisir l'autorité de protection des données de votre pays : par exemple l'ARTCI en Côte d'Ivoire, la CDP au Sénégal, la CNIL en France, l'APD en Belgique ou le PFPDT en Suisse.",
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
            `${APP_NAME} analyse des signaux observables sur un site internet selon la méthode CITE (Clarifier, Indexer, Tunnel, Enclencher) et produit un rapport et des recommandations. Un module facultatif mesure un échantillon de réponses d'IA à des requêtes que vous choisissez.`,
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
