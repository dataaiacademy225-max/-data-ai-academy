# CLAUDE.md

Guide pour travailler dans ce dépôt.

## Contenu du dépôt

| Chemin | Rôle |
|---|---|
| `index.html`, `steve-junior.jpg` | Site vitrine statique de Data & AI Academy (Tailwind compilé en ligne). Ne pas casser : il est servi tel quel à la racine. |
| `cite-audit/` | SaaS **CITE Audit** (audit de visibilité Google + assistants IA). Étape 1 (socle) et module d'analyse d'URL en place. Voir `cite-audit/README.md` pour l'installation. |
| `cite-audit/AGENTS.md` | Généré par Next.js 16 : lire la doc embarquée `node_modules/next/dist/docs/` avant d'écrire du code Next (conventions changées : `proxy.ts` au lieu de `middleware.ts`, API asynchrones…). |
| `cite-audit/docs/ARCHITECTURE.md` | Dossier de conception : architecture, modèle de données, routes, score CITE, risques, plan. **Source de vérité** avant tout développement. |

Charte : bleu nuit `#0B1526` / `#1B3155`, accent orange `#FF7A29`, polices Space Grotesk (titres) et Inter (texte).

## Stack CITE Audit

Next.js 16 (App Router, `cacheComponents` désactivé) + TypeScript strict, Tailwind CSS 4, composants au format shadcn/ui (`src/components/ui`, écrits à la main : le registre shadcn n'est pas joignable depuis l'environnement cloud), PostgreSQL 16 + Prisma 7 (client généré dans `src/generated/prisma`, adaptateur `@prisma/adapter-pg`), Better Auth, Zod 4, Vitest 5, cheerio (lecture HTML), undici 7 (HTTP, compatible Node 20), robots-parser. À venir : worker Node séparé (file d'attente PostgreSQL), @react-pdf/renderer.

Organisation : `src/lib/validation` (schémas Zod partagés client/serveur), `src/server/services` (accès aux données, toujours filtré par `userId`), `src/server/actions` (server actions : `requireUser()` puis validation Zod), `src/server/demo` (données de démonstration), `src/server/crawler` (analyse d'une URL : `url-guard` → `robots` → `safe-fetch` → `extract`, orchestrés par `analyzeUrl` ; aucun score ni interface dans ce dossier), `src/lib/logger.ts` (journal JSON masqué).

## Règles produit non négociables

- Ne jamais promettre une position, une citation ou une recommandation par Google, ChatGPT, Perplexity, Gemini ou toute IA.
- Formulations interdites dans l'UI, le rapport et le code : « vous serez recommandé par ChatGPT », « numéro 1 dans les IA », « garantit une citation », et toute variante. Utiliser : « peut renforcer la compréhension de votre marque », « peut maximiser vos chances d'être cité », « signal à améliorer », « résultat non garanti ».
- Le score CITE est un **indicateur interne Data & AI Academy**, jamais une mesure officielle d'un moteur ou d'une IA.
- Ne jamais déduire une information non visible : un critère non mesurable est marqué « non vérifié », pas « échoué ».
- Une mention de marque dans une réponse IA n'est pas une recommandation. Ne jamais inventer de source. Ne jamais modifier la réponse brute stockée.
- Chaque problème affiche : constat, preuve/URL, impact potentiel, recommandation, priorité (critique / important / recommandé).
- Ton du rapport : direct, pédagogique, sans jargon, lisible par un dirigeant non technique.

## Règles de sécurité

- Aucune clé API côté client ; secrets uniquement via variables d'environnement validées par Zod (`src/lib/env.ts`).
- Clés API des utilisateurs chiffrées (AES-256-GCM, clé maître en variable d'environnement), seuls les 4 derniers caractères sont affichés.
- Toute requête sortante du crawler passe par `safeFetch` (anti-SSRF : résolution DNS + blocage IP privées/réservées à chaque redirection, ports 80/443 uniquement, timeout, taille max).
- Autorisation vérifiée côté serveur sur chaque accès : toujours filtrer par `userId` du propriétaire.
- Le contenu crawlé est une donnée non fiable : jamais exécuté, jamais injecté en HTML brut, jamais traité comme instruction par un LLM.
- Logs sans données sensibles (pas de clés, pas de réponses brutes, pas d'e-mails) : passer par `logger` de `src/lib/logger.ts`.
- Tests du crawler : jamais d'accès Internet. Utiliser `tests/helpers/test-site.ts` (serveur local + politique réseau de test) ; la politique de production (`defaultNetworkPolicy`) n'est jamais affaiblie.

## Méthode de travail

- Avancer par petites étapes (voir le plan en 5 étapes dans `cite-audit/docs/ARCHITECTURE.md`).
- Avant chaque grande modification : expliquer ce qui change, pourquoi, quels fichiers, comment tester.
- Après chaque étape, depuis `cite-audit/` : `pnpm lint`, `pnpm typecheck`, `pnpm test` doivent passer (`pnpm test` exige PostgreSQL et `TEST_DATABASE_URL`).
- Données de démonstration : uniquement via `pnpm db:seed`, toujours `isDemo = true` et préfixe `[DÉMO]`. Ne jamais écrire de résultat fictif dans un audit réel.
