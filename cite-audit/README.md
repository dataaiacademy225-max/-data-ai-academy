# GriotCite

SaaS d'audit des signaux observables qui peuvent influencer la visibilité d'une entreprise dans Google et les assistants IA, selon la méthode CITE (Clarifier, Indexer, Tunnel, Enclencher). Marque : Data & AI Academy. Ancien nom : CITE Audit (le dossier `cite-audit/` garde ce nom).

> Aucun audit ne garantit une position dans Google ni une citation ou recommandation par une IA. Le score CITE est un indicateur interne.

Conception complète : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## État actuel : socle, exploration du site (worker), scoring CITE et rapport

- Inscription, connexion, déconnexion (Better Auth, sessions en base).
- Tableau de bord (vide ou liste des projets).
- Création, modification et suppression de projet avec validation client et serveur (Zod). La suppression exige de retaper le nom de l'entreprise et efface en cascade audits, pages, recommandations et mesures IA.
- Page « Mon compte » : suppression définitive du compte et de toutes ses données (mot de passe + mot SUPPRIMER).
- Modèles : `User`, `Project`, `Audit`, `PageAnalysis`, `Finding`, `AiQueryResult` (+ tables d'authentification).
- Données de démonstration isolées (compte `demo@example.com`, projets et audits `isDemo`).

- Module d'analyse d'une URL (`src/server/crawler`, côté serveur uniquement) : blocage des adresses locales/privées (y compris via DNS ou redirection), robots.txt, délai de 10 s, 2 Mo maximum, 5 redirections maximum, extraction des faits (title, meta, H1/H2, texte visible, liens, canonical, robots, JSON-LD, Open Graph, CTA, preuves).

- Moteur de scoring CITE (`src/server/scoring`, fonction pure `scoreSite`) : 32 critères, score sur 100 et par pilier (25 / 30 / 25 / 20), forces, faiblesses, recommandations triées par priorité. Chaque point est justifié (explication + preuve) ; une donnée non analysée donne « non vérifié », jamais une conclusion.
- Exploration de 10 à 15 pages par audit (`src/server/crawler/crawl-site.ts`) : accueil, plan du site (robots.txt puis `/sitemap.xml`), sélection des pages clés (contact, à propos, offres, études de cas, FAQ, articles), pause de 0,5 s entre deux pages, durée maximale 2 min 30, liens cassés constatés.
- File d'attente PostgreSQL + worker séparé (`pnpm worker`) : un audit n'est jamais traité deux fois, un audit abandonné est repris (3 tentatives maximum), progression affichée en direct.
- Historique des audits, rapport lisible par un dirigeant (synthèse, plan d'action, détail des critères, limites) imprimable en PDF depuis le navigateur.

- Module facultatif de **visibilité IA** (`src/server/ai-visibility`) : interface `AiProvider` (Perplexity aujourd'hui), requêtes de prospects envoyées telles quelles, réponse brute et JSON complet conservés sans modification, sources renvoyées, distinction **mention / citation / recommandation**, concurrents détectés, statut et erreurs par requête. File d'attente traitée par le worker, reprise après arrêt sans renvoyer les requêtes déjà répondues, gestion du « rate limit » (429, Retry-After, 3 essais), espacement des appels, journalisation, limites par lancement et par 24 h, estimation du coût à accepter avant tout envoi.

- Sécurité : limites de tentatives en base (connexion, inscription, mot de passe oublié, suppression de compte), CSP avec nonce, HSTS.
- E-mails : confirmation d'adresse et mot de passe oublié (SMTP, ou affichage dans le terminal en développement).
- Purge quotidienne des données expirées par le worker (durées réglables).
- Pages légales en **brouillon** (`src/content/legal.ts`, champs `[À COMPLÉTER]`, validation par un juriste requise).
- `Dockerfile`, `docker-compose.prod.yml` et CI GitHub Actions (`.github/workflows/cite-audit-ci.yml`).

Pas encore : vitesse (PageSpeed), indice GEO, plans à 30/90 jours, export PDF serveur, clés API propres à chaque client.

### Activer la visibilité IA

Renseigner dans `.env` du serveur (jamais côté navigateur) puis redémarrer l'application et le worker :

```bash
PERPLEXITY_API_KEY="pplx-…"
PERPLEXITY_API_MODE="agent"   # Agent API /v1/responses (par défaut) ; "chat" = ancien format
# PERPLEXITY_BASE_URL="https://api.perplexity.ai"  # facultatif, https uniquement (proxy ou test)
AI_MAX_QUERIES_PER_RUN=10     # requêtes par lancement (20 max)
AI_MAX_QUERIES_PER_DAY=50     # requêtes par utilisateur sur 24 h
AI_MIN_INTERVAL_MS=1500       # délai minimal entre deux appels
```

Sans clé, le module est simplement désactivé. Perplexity a arrêté le support officiel de Sonar Chat Completions le 27/09/2026 : l'adaptateur utilise l'Agent API et lit plusieurs formats de réponse ; vérifier le premier résultat réel (la réponse JSON complète est conservée) et les tarifs (estimation fondée sur les tarifs publics d'octobre 2026).

Limites connues du module d'analyse : le JavaScript des pages n'est pas exécuté (les sites rendus côté client sont signalés `likelyClientRendered`) et un texte masqué par une feuille de style n'est pas détecté. Les CTA et preuves sont des repérages automatiques, chacun accompagné de l'extrait exact pour vérification.

## Prérequis

- Node.js 20.18 ou plus récent (testé avec 22)
- pnpm 10 (`corepack enable`)
- PostgreSQL 16 : via Docker (`docker compose up -d`) ou installé localement

## Installation

```bash
cd cite-audit
cp .env.example .env
# Renseigner BETTER_AUTH_SECRET (openssl rand -base64 32) et DEMO_PASSWORD (10 caractères min.)

docker compose up -d        # PostgreSQL + base de test (ignorer si PostgreSQL local)
pnpm install                # génère aussi le client Prisma
pnpm db:migrate             # crée les tables
pnpm db:seed                # facultatif : données de démonstration
pnpm dev                    # http://localhost:3000
pnpm worker                 # dans un 2e terminal : traite les audits en file d'attente
```

Sans Docker, créer l'utilisateur et les deux bases à la main :

```sql
CREATE ROLE cite WITH LOGIN PASSWORD 'cite' CREATEDB;
CREATE DATABASE cite_audit OWNER cite;
CREATE DATABASE cite_audit_test OWNER cite;
```

## Déploiement (Docker)

```bash
cp .env.example .env.production   # remplir : secrets forts, BETTER_AUTH_URL en https, POSTGRES_PASSWORD, EMAIL_TRANSPORT=smtp + SMTP_URL
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Le fichier lance PostgreSQL (sans port public), les migrations, l'application (127.0.0.1:3000) et le worker. Placer devant un proxy inverse HTTPS (Caddy, Nginx ou celui de l'hébergeur) qui **ajoute** l'adresse du visiteur à droite de `X-Forwarded-For` et pose `X-Forwarded-Proto`. Les limites de tentatives lisent l'entrée posée par ce proxy (`TRUSTED_PROXY_COUNT`, 1 par défaut), jamais celles que le visiteur peut écrire lui-même. Sauvegarder le volume `pgdata` régulièrement.

## Hébergement gratuit (Render + Neon)

Pour un usage personnel ou une bêta, sans frais :
- **Render** (offre gratuite) : un seul service web, défini par `render.yaml` à la racine du dépôt. Le worker tourne dans l'application (`RUN_WORKER_IN_WEB=true`) ; les migrations s'appliquent au démarrage.
- **Neon** (offre gratuite) : la base PostgreSQL. Utiliser l'URL « direct » (sans `-pooler`).
- Limites : le service s'endort après 15 min sans visite (réveil d'environ 1 min) ; les tâches quotidiennes ne tournent que lorsqu'il est éveillé. Pour des clients payants, passer à une offre payante avec un worker séparé (`pnpm worker`).
- Accès : `SIGNUP_MODE=invite` (défaut) et `OWNER_EMAILS` ; le compte propriétaire n'a pas de limite d'audits par jour une fois son adresse confirmée (ce qui exige un envoi d'e-mails réel, `SMTP_URL`) et la double authentification activée dans « Mon compte ».

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm worker` | Worker qui exécute les audits (à lancer à côté de l'application ; arrêt propre avec Ctrl + C) |
| `pnpm build` / `pnpm start` | Build et serveur de production |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Tous les tests (unitaires + intégration) |
| `pnpm test:unit` | Tests unitaires (sans base de données) |
| `pnpm test:integration` | Tests d'intégration sur `TEST_DATABASE_URL` (base vidée à chaque test) |
| `pnpm db:migrate` | Créer / appliquer une migration (dev) |
| `pnpm db:deploy` | Appliquer les migrations (production) |
| `pnpm db:seed` | (Re)créer les données de démonstration |

## Données de démonstration

`pnpm db:seed` crée un compte `demo@example.com` (mot de passe : `DEMO_PASSWORD`) avec deux projets et un audit fictifs, tous marqués `[DÉMO]` et `isDemo = true`.

- Une clé étrangère composite empêche en base de rattacher un audit de démonstration à un projet réel, et inversement.
- Les projets créés depuis l'interface sont toujours réels (`isDemo = false`, non modifiable par le formulaire).
- Le seed ne supprime que le compte démo et refuse de s'exécuter si ce compte possède un projet réel ou si `NODE_ENV=production`.
