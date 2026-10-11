# CITE Audit

SaaS d'audit des signaux observables qui peuvent influencer la visibilité d'une entreprise dans Google et les assistants IA (méthode CITE : Clarifier, Indexer, Tunnel, Enclencher). Marque : Data & AI Academy.

> Aucun audit ne garantit une position dans Google ni une citation ou recommandation par une IA. Le score CITE est un indicateur interne.

Conception complète : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## État actuel : étape 1 (socle)

- Inscription, connexion, déconnexion (Better Auth, sessions en base).
- Tableau de bord (vide ou liste des projets).
- Création de projet avec validation client et serveur (Zod).
- Modèles : `User`, `Project`, `Audit`, `PageAnalysis`, `Finding`, `AiQueryResult` (+ tables d'authentification).
- Données de démonstration isolées (compte `demo@example.com`, projets et audits `isDemo`).

Pas encore : crawler, calcul du score, rapport PDF, requêtes IA.

## Prérequis

- Node.js 20.9 ou plus récent (testé avec 22)
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
