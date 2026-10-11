# CITE Audit

SaaS d'audit des signaux observables qui peuvent influencer la visibilité d'une entreprise dans Google et les assistants IA (méthode CITE : Clarifier, Indexer, Tunnel, Enclencher). Marque : Data & AI Academy.

> Aucun audit ne garantit une position dans Google ni une citation ou recommandation par une IA. Le score CITE est un indicateur interne.

Conception complète : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## État actuel : socle, exploration du site (worker), scoring CITE et rapport

- Inscription, connexion, déconnexion (Better Auth, sessions en base).
- Tableau de bord (vide ou liste des projets).
- Création de projet avec validation client et serveur (Zod).
- Modèles : `User`, `Project`, `Audit`, `PageAnalysis`, `Finding`, `AiQueryResult` (+ tables d'authentification).
- Données de démonstration isolées (compte `demo@example.com`, projets et audits `isDemo`).

- Module d'analyse d'une URL (`src/server/crawler`, côté serveur uniquement) : blocage des adresses locales/privées (y compris via DNS ou redirection), robots.txt, délai de 10 s, 2 Mo maximum, 5 redirections maximum, extraction des faits (title, meta, H1/H2, texte visible, liens, canonical, robots, JSON-LD, Open Graph, CTA, preuves).

- Moteur de scoring CITE (`src/server/scoring`, fonction pure `scoreSite`) : 32 critères, score sur 100 et par pilier (25 / 30 / 25 / 20), forces, faiblesses, recommandations triées par priorité. Chaque point est justifié (explication + preuve) ; une donnée non analysée donne « non vérifié », jamais une conclusion.
- Exploration de 10 à 15 pages par audit (`src/server/crawler/crawl-site.ts`) : accueil, plan du site (robots.txt puis `/sitemap.xml`), sélection des pages clés (contact, à propos, offres, études de cas, FAQ, articles), pause de 0,5 s entre deux pages, durée maximale 2 min 30, liens cassés constatés.
- File d'attente PostgreSQL + worker séparé (`pnpm worker`) : un audit n'est jamais traité deux fois, un audit abandonné est repris (3 tentatives maximum), progression affichée en direct.
- Historique des audits, rapport lisible par un dirigeant (synthèse, plan d'action, détail des critères, limites) imprimable en PDF depuis le navigateur.

Pas encore : vitesse (PageSpeed), indice GEO, plans à 30/90 jours, export PDF serveur, requêtes IA.

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
