# CLAUDE.md

Dépôt de Data & AI Academy :
- Le site vitrine (data-ai-academy.com) est géré sur Lovable, hors de ce dépôt.
- Domaine `data-ai-academy.com` (Namecheap) : GriotCite sera servi sur le sous-domaine `audit.data-ai-academy.com`.
- `cite-audit/` : SaaS **GriotCite** (ancien nom : CITE Audit ; dossiers et identifiants techniques inchangés). Nom défini dans `src/lib/brand.ts` ; la méthode et le score gardent le nom **CITE**. Toutes les commandes ci-dessous se lancent depuis ce dossier.

Conception de référence : `cite-audit/docs/ARCHITECTURE.md`. Installation détaillée : `cite-audit/README.md`. Tarification et coûts d'API (brouillon non implémenté) : `cite-audit/docs/PRICING.md`.

## Interdiction absolue : aucune promesse de résultat IA

- Ne jamais promettre ni laisser entendre une position Google, une citation ou une recommandation par ChatGPT, Perplexity, Gemini ou toute autre IA.
- Interdit partout (UI, rapport, code, commits, réponses) : « vous serez recommandé par ChatGPT », « numéro 1 dans les IA », « garantit une citation », « première place garantie », et toute variante.
- Formulations à utiliser : « peut renforcer la compréhension de votre marque », « peut maximiser vos chances d'être cité », « signal à améliorer », « résultat non garanti ».
- Le score CITE est un **indicateur interne Data & AI Academy**, jamais une mesure de Google ou d'une IA.
- Tout nouveau texte affiché doit passer `findForbiddenWording` (`src/server/scoring/wording-guard.ts`). Ajouter un test s'il s'agit d'un nouveau catalogue de textes.

## Stack validée

| Domaine | Choix |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript strict. `cacheComponents` désactivé. |
| UI | Tailwind CSS 4. Composants au format shadcn/ui écrits à la main dans `src/components/ui` (le registre shadcn n'est pas joignable depuis l'environnement cloud). |
| Données | PostgreSQL 16, Prisma 7 (client généré dans `src/generated/prisma`, adaptateur `@prisma/adapter-pg`, config `prisma.config.ts`). |
| Auth | Better Auth (e-mail + mot de passe, sessions en base). |
| Validation | Zod 4 (schémas partagés client/serveur). |
| Crawler | undici 7 (HTTP, compatible Node ≥ 20.18), cheerio, robots-parser. |
| Tâches longues | Worker Node séparé + file d'attente PostgreSQL (`FOR UPDATE SKIP LOCKED`). Pas de Redis. |
| Visibilité IA | Interface `AiProvider` ; Perplexity via l'Agent API (`/v1/responses`, modèle `perplexity/sonar`). |
| Tests | Vitest 5 (projets `unit` et `integration`), Playwright disponible pour les vérifications manuelles. |

Next.js 16 diffère des versions connues (`proxy.ts` au lieu de `middleware.ts`, `params` asynchrones, etc.) : lire `node_modules/next/dist/docs/` avant d'écrire du code Next (voir `cite-audit/AGENTS.md`).

## Commandes

```bash
pnpm dev                 # application (http://localhost:3000)
pnpm worker              # worker : audits puis mesures IA ; arrêt propre avec Ctrl + C
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # unitaires + intégration (PostgreSQL et TEST_DATABASE_URL requis)
pnpm test:unit           # sans base de données
pnpm test:integration    # base de test vidée à chaque test
pnpm build               # build de production
pnpm db:migrate          # créer / appliquer une migration (dev, interactif)
pnpm db:deploy           # appliquer les migrations (non interactif)
pnpm db:seed             # (re)créer les données de démonstration
pnpm db:generate         # régénérer le client Prisma
```

Avant tout commit : `pnpm lint && pnpm typecheck && pnpm test` doivent passer.

Migrations : `prisma migrate dev` refuse de tourner en non-interactif dès qu'il y a un avertissement. Dans ce cas, générer le SQL avec `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, le placer dans un nouveau dossier `prisma/migrations/<horodatage>_<nom>/`, puis lancer `pnpm db:deploy`. Une migration qui supprime des données doit le faire explicitement et le commenter.

## Structure du projet (`cite-audit/src`)

| Chemin | Rôle |
|---|---|
| `app/(auth)`, `app/(app)` | Pages publiques (connexion, inscription) et protégées (tableau de bord, projets et leurs paramètres, rapport, visibilité IA, `settings/account`). |
| `app/api/auth/[...all]` | Point d'entrée Better Auth. |
| `proxy.ts` | Redirection rapide sans cookie (pas le contrôle d'accès) et CSP avec nonce par requête (`lib/csp.ts`). |
| `components/ui`, `components/report`, `components/ai-visibility` | Interface. Aucune logique métier. |
| `lib/` | `env.ts` (variables validées), `db.ts`, `auth.ts`, `session.ts` (`requireUser`), `access.ts` (inscriptions sur invitation, propriétaires), `logger.ts`, `csp.ts`, `client-ip.ts`, `ai-pricing.ts`, `validation/`. |
| `server/actions/` | Server actions : `requireUser()`, validation Zod, appel d'un service. |
| `server/services/` | Accès aux données, toujours filtré par `userId`. Suppression de projet ou de compte : en cascade en base (`projects.ts`, `account.ts`). Verrous de requête : `locks.ts`. |
| `server/crawler/` | Collecte : `url-guard` → `robots` → `safe-fetch` → `extract` (`analyzeUrl`), puis `sitemap` + `discover` → `crawl-site`. Ni score ni UI. |
| `server/scoring/` | Moteur CITE **pur** : `scoreSite(input)`. Barème et textes dans `catalog.ts`, une règle par critère dans `criteria/`. |
| `server/report/view.ts` | Présentation du rapport (pure) : diagnostic, deux questions (être trouvé / convertir), ordre des priorités, responsable de chaque action, « ce que le rapport ne mesure pas ». Ne change jamais le score. |
| `server/jobs/`, `worker/` | File d'attente des audits (`queue.ts`), traitement (`process-audit.ts`), boucle du worker (`loop.ts`), lancée par `pnpm worker` ou dans le serveur web si `RUN_WORKER_IN_WEB=true` (`instrumentation.ts`, hébergement gratuit Render + Neon, `render.yaml`). |
| `server/ai-visibility/` | Module facultatif : `types.ts` (AiProvider), `providers/`, `analyze.ts` (pur), `queue.ts`, `process-run.ts`. |
| `server/demo/` | Données de démonstration. |
| `server/email/` | Gabarits (purs) et envoi : `EMAIL_TRANSPORT` = console (dev), smtp, memory (tests). |
| `content/legal.ts`, `app/(legal)` | Pages légales (brouillon) ; coordonnées de l'éditeur à compléter dans `LEGAL_ENTITY`. |
| `generated/prisma` | Généré : ne jamais éditer ni committer. |

Tests (`cite-audit/tests`) : `unit/` (pur, crawler sur serveur local), `integration/` (base de test), `helpers/test-site.ts` (faux site + politique réseau de test), `helpers/scoring-fixtures.ts`, `fixtures/`.

## Conventions de code

- **Séparation stricte** : crawler (observe), scoring (note, fonction pure), services (base de données + droits), composants (affichage). Aucun module ne saute une couche.
- **Fonctions pures et injectables** : réseau, horloge, fournisseur IA et exploration sont passés en dépendances (`policy`, `deps`, `clock`) pour être testés sans Internet ni attente réelle.
- Les modules serveur importent `server-only`. Dans Vitest, il est remplacé par un module vide ; le worker se lance avec `--conditions=react-server`.
- Imports avec l'alias `@/` ; TypeScript strict, pas de `any`.
- Les fichiers `"use server"` n'exportent que des fonctions asynchrones (les constantes vont dans les services).
- Pas de `Date.now()` pendant le rendu d'un composant (règle de lint) : calculer dans le service.
- Interface, messages d'erreur et commentaires en **français**, ton direct et sans jargon. Identifiants de code en anglais.
- Toute erreur attendue est un résultat typé (`Result`, code d'erreur nommé), pas une exception non gérée.
- Le JSON stocké en base (`reportSnapshot`, `facts`, `rawPayload`) est versionné ou relu de façon défensive.
- Données de démonstration : uniquement via `pnpm db:seed`, `isDemo = true` et préfixe `[DÉMO]`. La clé étrangère composite `(projectId, isDemo)` empêche de mélanger démo et réel. Ne jamais écrire de résultat fictif dans un audit réel.
- Avant une grande modification : annoncer ce qui change, pourquoi, quels fichiers, comment tester. Avancer par petites étapes.

## Règles de sécurité

- **Secrets** : uniquement en variables d'environnement serveur, validées par Zod (`getServerEnv`, `getAiEnv`). Jamais en base, jamais côté client, jamais dans un journal ou un message d'erreur. Si des clés propres à chaque client sont un jour ajoutées : chiffrement AES-256-GCM avec une clé maître en variable d'environnement, et seuls les 4 derniers caractères affichés.
- **Autorisation** : vérifiée côté serveur à chaque accès (`requireUser` + filtre `userId`). Une ressource d'autrui renvoie « introuvable ».
- **Anti-SSRF** : toute requête vers un site audité passe par `safeFetch`, qui :
  - vérifie l'IP au moment de la connexion (DNS rebinding) et à chaque redirection ;
  - bloque les IP privées et réservées, localhost et les domaines internes ;
  - n'autorise que les ports 80 et 443 ;
  - applique un délai de 10 s, une taille maximale de 2 Mo et 5 redirections au plus.
  
  La politique de production `defaultNetworkPolicy` n'est jamais affaiblie.
- **robots.txt** est respecté pour chaque page et chaque redirection. S'il répond en erreur 5xx, on s'abstient.
- **Contenu crawlé et réponses IA** : données non fiables. Jamais exécutées, jamais injectées en HTML (`dangerouslySetInnerHTML` interdit), jamais traitées comme instructions par un LLM.
- **Journaux** : passer par `logger` (masquage des URL, e-mails, jetons). Ne jamais y écrire de corps de page, de réponse IA ni de clé.
- **Limites anti-abus** :
  - audits : 20 par utilisateur sur 24 h, un seul en cours par projet ;
  - IA : `AI_MAX_QUERIES_PER_RUN` et `AI_MAX_QUERIES_PER_DAY` ;
  - crawl : 15 pages, 0,5 s entre deux pages, 2 min 30 au plus ;
  - tentatives (connexion, inscription, mot de passe oublié, suppression de compte) : `services/rate-limit.ts`, en base, clés hachées. Les server actions appellent Better Auth directement et contournent sa propre limite HTTP : toute nouvelle action sensible doit appeler `consumeLimit`.
- **En-têtes** : CSP stricte avec nonce (aucun script en ligne ni `eval` en production), HSTS, `frame-ancestors 'none'`. Ne pas ajouter de ressource externe sans adapter `lib/csp.ts`.
- **Conservation** : purge quotidienne par le worker (`services/retention.ts`, `AUDIT_RETENTION_DAYS`, `AI_RUN_RETENTION_DAYS`, 0 = tant que le projet existe). Comptes inactifs (`services/inactive-accounts.ts`) : e-mail après 3 ans sans connexion, suppression 30 jours plus tard ; jamais de suppression si l'e-mail n'est pas parti. Toute nouvelle donnée stockée doit avoir une durée et figurer dans `content/legal.ts`.
- **Tests** : jamais d'accès Internet. Crawler via `tests/helpers/test-site.ts`, fournisseur IA simulé, horloge simulée.

## Règles de scoring CITE

- Barème `cite-1.1.0` : Clarifier 25, Indexer 30, Tunnel 25, Enclencher 20, soit **32 critères** au total. Toute modification du barème change `SCORING_VERSION`.
- **Critères** : chaque critère renvoie `PASS` / `PARTIAL` / `FAIL` avec une explication, une preuve (URL et extrait exact), les éléments manquants, un niveau de confiance et une priorité (critique, important ou recommandé).
- **Donnée absente** : `NOT_VERIFIED`, avec `points: null`, jamais 0 et jamais une conclusion. `NOT_APPLICABLE` est exclu du calcul. Un accès refusé au robot (401, 403, 429) est « non vérifié », jamais une panne du site.
- **Contenu illisible sans JavaScript** : les critères qui portent sur ce contenu passent en « non vérifié ». Seul le constat « contenu invisible sans JS » est noté.
- **Score d'un pilier** = `max × points obtenus / points mesurés`, arrondi à 0,5. Le pilier n'est noté qu'avec au moins 50 % de ses points mesurés ; entre 50 et 70 %, il est « indicatif ».
- **Score global** : seulement si les 4 piliers sont notés. Sinon « non vérifié », avec la raison.
- Ne jamais déduire ce qui n'est pas visible : un CSS non évalué, une page non analysée ou une erreur réseau signifient « non vérifié », pas « absent ».
- Les réponses des IA **n'entrent jamais** dans le score CITE.
- Chaque recommandation affiche : constat, preuve, impact potentiel, action concrète, priorité et effort. Le texte doit être compréhensible par un dirigeant non technique.

## Limites GEO (à respecter dans le code, l'UI et les réponses)

- **Ce qu'on mesure** : des signaux observables sur le site (clarté de l'entité, données structurées, preuves, pages par intention…) et, en option, un échantillon de réponses d'IA. Ni l'un ni l'autre ne mesure la « visibilité IA » globale d'une marque.
- **Trois niveaux distincts**, jamais confondus :
  - mention : le nom ou le domaine apparaît dans la réponse ;
  - citation : une source renvoyée pointe vers le site ;
  - recommandation : une formulation explicite figure dans la même phrase ou le même point de liste.
  
  Une mention n'est jamais une recommandation.
- **Intégrité des réponses** : requête envoyée telle que saisie, sans consigne cachée. `rawResponse` et `rawPayload` ne sont jamais modifiés. Ne jamais inventer de source : chaque source porte son origine, `API` ou `TEXT`.
- **Avertissement obligatoire** (`AI_WARNING`) partout où un résultat IA s'affiche ; toujours parler d'un « échantillon ». Les réponses par API peuvent différer des applications grand public.
- **Coût** : estimé avant lancement et accepté explicitement. C'est une fourchette indicative (tarifs publics d'octobre 2026, `src/lib/ai-pricing.ts`) ; le coût réel de l'API prime.
- **API Perplexity** : Sonar Chat Completions n'est plus officiellement supporté depuis le 27/09/2026. L'adaptateur cible l'Agent API, dont le format de réponse n'a été vérifié que par des sources tierces. Le JSON complet est conservé ; vérifier le premier appel réel avant tout usage client.
- **Pas encore implémenté** : indice de signaux GEO séparé, plans d'action à 30/90 jours, mesure de vitesse (PageSpeed), lecture des sitemaps `.xml.gz`, rendu JavaScript, recherche de mentions externes (LinkedIn, annuaires). Tant qu'ils n'existent pas, ces éléments restent « non vérifiés » et n'apparaissent pas comme mesurés.

## Charte

Bleu nuit `#0B1526` / `#1B3155`, accent orange `#FF7A29`, Space Grotesk (titres), Inter (texte et chiffres). Les couleurs d'état sont toujours accompagnées d'une icône et d'un libellé.
