# CITE Audit — Dossier de conception (v0.1)

> Statut : **validé**. Étape 1 (socle) en place. Le schéma de référence est `prisma/schema.prisma` ; la §3.2 ci-dessous est la proposition initiale.
>
> Écarts retenus à l'étape 1 : modèles nommés `PageAnalysis` et `AiQueryResult` ; concurrents (`competitors`, JSON) et requêtes GEO (`geoQueries`, tableau) stockés sur `Project` plutôt qu'en tables séparées ; `isDemo` sur `Project` et `Audit` (clé étrangère composite) pour isoler les données de démonstration ; `CriterionResult` et `ApiCredential` arriveront aux étapes 3 et 5 ; `cacheComponents` de Next.js 16 désactivé (rendu dynamique classique, plus simple pour des pages authentifiées).
>
> Écarts retenus pour le scoring (implémenté, barème `cite-1.0.0`) : seuil de couverture minimale de 50 % par pilier en plus du seuil « indicatif » de 70 % ; score global seulement si les 4 piliers sont notés ; contenu rendu par JavaScript → critères de contenu « non vérifiés » ; T2 exige au moins 3 pages analysées ; T5 mesure l'accès en un clic aux offres et au contact (taille du menu non mesurée) ; résultats par critère stockés dans `Audit.reportSnapshot` (pas encore de table `CriterionResult`).
>
> CITE Audit mesure des signaux observables. Il ne garantit aucune position dans Google ni aucune citation ou recommandation par une IA. Le score CITE est un indicateur interne à Data & AI Academy.

Sommaire

1. [Architecture technique](#1-architecture-technique)
2. [Arborescence](#2-arborescence)
3. [Modèle de données](#3-modèle-de-données)
4. [Routes](#4-routes)
5. [Parcours utilisateur](#5-parcours-utilisateur)
6. [Calcul du score CITE](#6-calcul-du-score-cite)
7. [Risques techniques et légaux](#7-risques-techniques-et-légaux)
8. [Plan de développement en 5 étapes](#8-plan-de-développement-en-5-étapes)
9. [Décisions à valider](#9-décisions-à-valider)

---

## 1. Architecture technique

### 1.1 Constat sur l'existant

Le dépôt contient uniquement le site vitrine statique (`index.html`). Aucun projet applicatif : on part de zéro, dans un sous-dossier `cite-audit/` pour ne pas toucher au site servi à la racine.

### 1.2 Vue d'ensemble

```
            Navigateur (UI Next.js, aucun secret)
                         │ HTTPS
                         ▼
┌──────────────────── App web Next.js ─────────────────────┐
│ Pages (App Router)  ·  Route handlers /api/*  ·  Auth     │
│ Contrôle d'accès serveur (userId) · validation Zod        │
│ Services métier : projets, audits, rapports, clés API     │
└───────────────┬───────────────────────────┬──────────────┘
                │ Prisma                    │ crée un Audit (status=QUEUED)
                ▼                           ▼
          ┌──────────┐            ┌────────────────────────┐
          │PostgreSQL│◄───────────│ Worker Node (process   │
          │ données  │  résultats │ séparé)                │
          │ + file   │            │ 1. safeFetch (anti-SSRF)│
          │ d'attente│            │ 2. robots + sitemap    │
          └──────────┘            │ 3. découverte ≤ N pages│
                                  │ 4. extraction (cheerio)│
                                  │ 5. moteur de scoring   │
                                  │ 6. signaux GEO         │
                                  │ 7. requêtes IA (opt.)  │
                                  └──────────┬─────────────┘
                                             │ HTTPS sortant contrôlé
                          ┌──────────────────┼───────────────────┐
                          ▼                  ▼                   ▼
                   Site audité        PageSpeed API (opt.)   API IA (opt., clé
                                                              de l'utilisateur)
```

### 1.3 Choix et justification

| Besoin | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript strict** | Une seule base de code pour l'UI et l'API, rendu serveur, écosystème mature. |
| UI | **Tailwind CSS + shadcn/ui** | Composants accessibles copiés dans le projet (pas de dépendance lourde), cohérent avec le Tailwind du site vitrine. |
| Base de données | **PostgreSQL + Prisma** | Relationnel adapté (utilisateur → projets → audits → résultats), migrations versionnées, typage généré. |
| Authentification | **Better Auth** (e-mail + mot de passe, sessions en base) | Adaptateur Prisma natif, hachage des mots de passe, limitation de tentatives, vérification e-mail et OAuth activables plus tard. Alternative : Auth.js. |
| Validation | **Zod** | Mêmes schémas pour les formulaires, l'API et les variables d'environnement. |
| Tâches longues | **Worker Node séparé + file d'attente dans PostgreSQL** (`SELECT … FOR UPDATE SKIP LOCKED`) | Un audit dure 30 à 90 s : il ne doit pas tourner dans une requête HTTP. Pas de Redis ni de service en plus pour le MVP. |
| Parsing HTML | **cheerio** | Rapide, sans navigateur, n'exécute aucun script du site audité. |
| robots.txt | **robots-parser** | Petite bibliothèque éprouvée ; réécrire ce parseur serait une source de bugs. |
| PDF | **@react-pdf/renderer** | PDF généré en pur JavaScript (pas de Chromium à déployer), mise en page contrôlée. |
| Vitesse | **API PageSpeed Insights** (optionnelle, clé serveur) | Seule source fiable de Core Web Vitals sans lancer de navigateur. Sans clé : critère « non vérifié ». |
| Requêtes IA | **Adaptateurs par fournisseur** (format compatible OpenAI, Perplexity, Anthropic, Gemini) | Interface unique `AiProvider.ask()`, clé fournie et chiffrée par l'utilisateur. |
| Tests | **Vitest** (unitaires + intégration avec PostgreSQL de test), **Playwright** plus tard pour le E2E | Vitest est rapide et natif TypeScript ; Chromium est déjà disponible pour Playwright. |
| Dev local | **docker compose** (PostgreSQL uniquement) | Démarrage en une commande. |

Dépendances volontairement **évitées** : Redis/BullMQ, ORM secondaire, bibliothèque d'état client, Puppeteer côté serveur (MVP), SDK de chaque fournisseur IA (simple `fetch` vers leurs API REST).

### 1.4 Principes de conception

- **Moteur d'analyse déterministe.** Le score est calculé par des règles lisibles, pas par un LLM. Même page → même score. Chaque point attribué est justifié par une preuve stockée.
- **Règles versionnées.** Chaque audit enregistre `scoringVersion`. Si les règles évoluent, les anciens audits restent lisibles et comparables.
- **Trois états par critère** : `PASS` / `PARTIAL` / `FAIL`, plus `NOT_APPLICABLE` (le critère n'a pas de sens ici) et `NOT_VERIFIED` (on n'a pas pu mesurer). On ne transforme jamais un « non vérifié » en échec.
- **Le rapport est un instantané.** À la fin d'un audit, un `reportSnapshot` JSON figé est stocké : le PDF et la page web sont générés depuis cet instantané, donc identiques et reproductibles.
- **Textes de recommandation centralisés** dans un catalogue (`scoring/catalog/*.ts`) relu par un humain, avec un test qui bloque les formulations interdites.

---

## 2. Arborescence

```
cite-audit/
├── docs/
│   └── ARCHITECTURE.md              ← ce document
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx     ← page d'accueil minimale → /login
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (app)/                   ← layout protégé (session obligatoire)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [projectId]/
│   │   │   │       ├── page.tsx                 ← vue projet + historique
│   │   │   │       ├── settings/page.tsx        ← édition / suppression
│   │   │   │       └── audits/[auditId]/
│   │   │   │           ├── page.tsx             ← résultats (onglets C/I/T/E/GEO/IA)
│   │   │   │           └── report/page.tsx      ← rapport complet (web)
│   │   │   └── settings/
│   │   │       ├── account/page.tsx
│   │   │       └── api-keys/page.tsx
│   │   └── api/
│   │       ├── auth/[...all]/route.ts
│   │       ├── projects/route.ts
│   │       ├── projects/[projectId]/route.ts
│   │       ├── projects/[projectId]/audits/route.ts
│   │       ├── audits/[auditId]/route.ts
│   │       ├── audits/[auditId]/pdf/route.ts
│   │       ├── audits/[auditId]/ai-queries/route.ts
│   │       ├── credentials/route.ts
│   │       └── credentials/[credentialId]/route.ts
│   ├── components/
│   │   ├── ui/                      ← shadcn/ui
│   │   ├── audit/                   ← ScoreGauge, PillarCard, CriterionRow, FindingCard…
│   │   └── project/                 ← ProjectForm, AuditHistory…
│   ├── lib/
│   │   ├── env.ts                   ← variables d'environnement validées (Zod)
│   │   ├── db.ts                    ← client Prisma
│   │   ├── auth.ts                  ← config Better Auth + getSessionOrThrow()
│   │   ├── crypto.ts                ← chiffrement AES-256-GCM des clés API
│   │   ├── logger.ts                ← logs structurés avec masquage
│   │   └── validation/              ← schémas Zod partagés (project, audit…)
│   ├── server/
│   │   ├── services/                ← logique métier + contrôle d'accès
│   │   │   ├── projects.ts
│   │   │   ├── audits.ts
│   │   │   └── credentials.ts
│   │   ├── crawler/
│   │   │   ├── ssrf-guard.ts        ← validation URL + IP
│   │   │   ├── safe-fetch.ts        ← timeouts, taille max, redirections contrôlées
│   │   │   ├── robots.ts
│   │   │   ├── sitemap.ts
│   │   │   ├── discover.ts          ← sélection des pages à analyser
│   │   │   └── extract.ts           ← HTML → PageFacts (données observées)
│   │   ├── scoring/
│   │   │   ├── types.ts             ← Criterion, CriterionResult, Finding
│   │   │   ├── engine.ts            ← exécute les critères, agrège, calcule la couverture
│   │   │   ├── criteria/
│   │   │   │   ├── clarifier.ts
│   │   │   │   ├── indexer.ts
│   │   │   │   ├── tunnel.ts
│   │   │   │   └── enclencher.ts
│   │   │   ├── catalog/             ← textes constat / impact / recommandation (FR)
│   │   │   └── wording-guard.ts     ← liste des formulations interdites
│   │   ├── geo/
│   │   │   └── signals.ts           ← module GEO (indice séparé)
│   │   ├── ai-queries/
│   │   │   ├── providers/
│   │   │   │   ├── types.ts
│   │   │   │   ├── openai-compatible.ts
│   │   │   │   ├── perplexity.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   └── gemini.ts
│   │   │   ├── analyze-response.ts  ← mention / recommandation / position / concurrents
│   │   │   ├── sources.ts           ← extraction des sources réellement retournées
│   │   │   └── masking.ts           ← masquage e-mails, téléphones, noms, clés
│   │   ├── report/
│   │   │   ├── build-snapshot.ts    ← synthèse, forces/faiblesses, plans 30/90 j
│   │   │   └── pdf/ReportDocument.tsx
│   │   └── jobs/
│   │       └── queue.ts             ← enqueue / claim / complete / fail
│   └── worker/
│       └── index.ts                 ← boucle du worker
├── tests/
│   ├── unit/                        ← ssrf-guard, extract, critères, scoring, masking…
│   ├── integration/                 ← API + base de test + serveur HTTP local de fixtures
│   └── fixtures/sites/              ← sites HTML de test (bon, moyen, mauvais, SPA)
├── docker-compose.yml               ← PostgreSQL local
├── .env.example
├── package.json
└── README.md
```

---

## 3. Modèle de données

### 3.1 Schéma relationnel

```
User 1─n Project 1─n Audit 1─n PageAnalysis
  │          │          ├──1─n CriterionResult   (CITE + GEO)
  │          │          ├──1─n Finding
  │          │          └──1─n AiQueryResult
  │          (concurrents et requêtes GEO : champs JSON / tableau du projet)
  └──1─n ApiCredential
(+ tables Session / Account / Verification gérées par Better Auth)
```

Toutes les suppressions sont en **cascade** depuis `Project` (et depuis `User`) : supprimer un projet efface ses audits, pages, résultats, requêtes IA et rapports.

### 3.2 Schéma Prisma (proposition)

```prisma
enum AuditStatus     { QUEUED RUNNING SUCCEEDED PARTIAL FAILED CANCELED }
enum Pillar          { CLARIFIER INDEXER TUNNEL ENCLENCHER GEO }
enum CriterionStatus { PASS PARTIAL FAIL NOT_APPLICABLE NOT_VERIFIED }
enum Priority        { CRITIQUE IMPORTANT RECOMMANDE }
enum Confidence      { HIGH MEDIUM LOW }
enum AiProviderKind  { OPENAI_COMPATIBLE PERPLEXITY ANTHROPIC GEMINI }

model User {
  id            String          @id @default(cuid())
  email         String          @unique
  name          String?
  emailVerified Boolean         @default(false)
  createdAt     DateTime        @default(now())
  projects      Project[]
  credentials   ApiCredential[]
  // sessions / accounts : tables Better Auth
}

model Project {
  id            String       @id @default(cuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyName   String
  brandAliases  String[]     // variantes du nom pour la détection (ex. "Data & AI Academy", "DAIA")
  siteUrl       String       // URL normalisée https://…
  domain        String       // hôte, sert de périmètre au crawl
  sector        String
  country       String       // ISO 3166-1 alpha-2
  city          String?
  primaryTarget String       // ex. "DSI de PME B2B"
  ownershipAttestedAt DateTime // case « je suis autorisé à auditer ce site »
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  competitors   Competitor[]
  geoQueries    GeoQuery[]
  audits        Audit[]
  @@index([userId])
}

model Competitor {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  url       String?
  aliases   String[]
}

model GeoQuery {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  text      String  // max 300 caractères
  locale    String  @default("fr")
}

model Audit {
  id              String      @id @default(cuid())
  projectId       String
  project         Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  status          AuditStatus @default(QUEUED)
  scoringVersion  String      // ex. "cite-1.0.0"
  // file d'attente
  attempts        Int         @default(0)
  lockedAt        DateTime?
  queuedAt        DateTime    @default(now())
  startedAt       DateTime?
  finishedAt      DateTime?
  // résultats
  scoreTotal      Int?        // 0–100
  scoreClarifier  Float?      // /25
  scoreIndexer    Float?      // /30
  scoreTunnel     Float?      // /25
  scoreEnclencher Float?      // /20
  geoIndex        Int?        // 0–100, indice séparé
  coverage        Float?      // part des points effectivement vérifiés (0–1)
  inputSnapshot   Json        // copie des données projet au lancement (URL, cible, concurrents, requêtes)
  reportSnapshot  Json?       // rapport figé (synthèse, plans, limites)
  errorCode       String?     // code interne, jamais de trace brute
  pages           PageAnalysis[]
  criteria        CriterionResult[]
  findings        Finding[]
  aiResults       AiQueryResult[]
  @@index([projectId, queuedAt])
  @@index([status, queuedAt])
}

model PageAnalysis {
  id            String   @id @default(cuid())
  auditId       String
  audit         Audit    @relation(fields: [auditId], references: [id], onDelete: Cascade)
  requestedUrl  String
  finalUrl      String?
  httpStatus    Int?
  redirectChain Json     // [{url, status}]
  pageType      String?  // home | offer | about | contact | case-study | blog | faq | other
  robotsAllowed Boolean
  bytes         Int?
  fetchMs       Int?
  facts         Json?    // PageFacts extraits : title, meta, h1[], h2[], wordCount, liens, JSON-LD, OG, images, CTA, contacts…
  fetchError    String?  // TIMEOUT | TOO_LARGE | BLOCKED_SSRF | ROBOTS_DISALLOWED | HTTP_ERROR | NOT_HTML
  @@index([auditId])
}

model CriterionResult {
  id          String          @id @default(cuid())
  auditId     String
  audit       Audit           @relation(fields: [auditId], references: [id], onDelete: Cascade)
  pillar      Pillar
  code        String          // ex. "C1", "I9", "GEO4"
  maxPoints   Float
  points      Float
  status      CriterionStatus
  confidence  Confidence      // fiabilité de la mesure (règle exacte = HIGH, heuristique texte = MEDIUM/LOW)
  evidence    Json            // [{url, selector?, excerpt?, value?}] — uniquement ce qui a été observé
  missing     String[]        // éléments manquants, en clair
  @@unique([auditId, code])
}

model Finding {
  id             String   @id @default(cuid())
  auditId        String
  audit          Audit    @relation(fields: [auditId], references: [id], onDelete: Cascade)
  pillar         Pillar
  criterionCode  String
  priority       Priority
  observation    String   // constat
  evidence       Json     // preuve(s) + URL(s) concernées
  impact         String   // impact potentiel (formulation prudente)
  recommendation String   // action concrète, compréhensible par un dirigeant
  effort         String?  // faible | moyen | élevé (sert au plan 30/90 j)
  dismissedAt    DateTime? // l'utilisateur peut marquer « faux positif »
  @@index([auditId, priority])
}

model ApiCredential {
  id         String         @id @default(cuid())
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider   AiProviderKind
  label      String
  baseUrl    String?        // pour les API compatibles OpenAI (validé anti-SSRF)
  ciphertext Bytes          // AES-256-GCM
  iv         Bytes
  authTag    Bytes
  keyVersion Int            // permet la rotation de la clé maître
  last4      String
  lastValidatedAt DateTime?
  createdAt  DateTime       @default(now())
  @@index([userId])
}

model AiQueryResult {
  id                  String     @id @default(cuid())
  auditId             String
  audit               Audit      @relation(fields: [auditId], references: [id], onDelete: Cascade)
  query               String     // requête envoyée (après masquage éventuel)
  askedAt             DateTime   @default(now())
  provider            AiProviderKind
  model               String     // identifiant renvoyé par l'API, pas celui supposé
  brandDetected       String?    // alias effectivement trouvé, ou null
  brandMentioned      Boolean
  brandRecommended    Boolean    // uniquement si formulation explicite de recommandation
  approxPosition      Int?       // rang approximatif de la 1re mention (1 = premier élément cité)
  positionRatio       Float?     // position du 1er caractère / longueur de la réponse
  competitorsMentioned Json      // [{name, mentioned, recommended}]
  sources             Json       // [{url, title?, origin: "API_CITATIONS" | "URL_IN_TEXT"}]
  rawResponse         String     // réponse texte brute, jamais modifiée
  rawPayload          Json?      // payload API complet (optionnel, pour audit)
  confidence          Float      // 0–1, fiabilité de l'analyse automatique
  errorCode           String?
  errorMessage        String?    // message nettoyé, sans clé ni en-tête
  @@index([auditId])
}
```

Points d'attention :

- **Pas de HTML brut stocké** : seulement les faits extraits et de courts extraits servant de preuve (≤ 300 caractères). Moins de volume, moins de risque juridique.
- `inputSnapshot` fige les paramètres du projet au moment de l'audit : si la cible change ensuite, l'historique reste cohérent.
- `rawResponse` est stocké tel quel ; le **masquage** s'applique à l'affichage et à l'export (option « masquer les informations sensibles »), jamais en réécrivant la donnée.

---

## 4. Routes

### 4.1 Pages

| Route | Rôle | Accès |
|---|---|---|
| `/` | Présentation courte + liens connexion/inscription | public |
| `/signup`, `/login` | Création de compte, connexion | public |
| `/dashboard` | Liste des projets, dernier score de chacun, audits en cours | connecté |
| `/projects/new` | Formulaire de création de projet | connecté |
| `/projects/[projectId]` | Fiche projet, bouton « Lancer un audit », historique + courbe des scores | propriétaire |
| `/projects/[projectId]/settings` | Modifier, supprimer le projet et toutes ses données | propriétaire |
| `/projects/[projectId]/audits/[auditId]` | Résultats : synthèse, onglets Clarifier / Indexer / Tunnel / Enclencher / GEO / Requêtes IA, liste des problèmes filtrable | propriétaire |
| `/projects/[projectId]/audits/[auditId]/report` | Rapport complet (version web du PDF) | propriétaire |
| `/settings/api-keys` | Ajouter / tester / supprimer une clé API IA | connecté |
| `/settings/account` | Profil, suppression du compte | connecté |

### 4.2 API (route handlers REST)

| Méthode | Route | Action |
|---|---|---|
| `*` | `/api/auth/[...all]` | Better Auth (inscription, connexion, déconnexion, session) |
| `GET` | `/api/projects` | Projets de l'utilisateur |
| `POST` | `/api/projects` | Créer un projet (Zod) |
| `GET` / `PATCH` / `DELETE` | `/api/projects/:projectId` | Lire / modifier / supprimer (cascade) |
| `GET` | `/api/projects/:projectId/audits` | Historique des audits |
| `POST` | `/api/projects/:projectId/audits` | Lancer un audit → `202 { auditId }` (quota + 1 audit actif max par projet) |
| `GET` | `/api/audits/:auditId` | Statut + progression + résultats |
| `DELETE` | `/api/audits/:auditId` | Supprimer un audit |
| `GET` | `/api/audits/:auditId/pdf?mask=true` | Télécharger le rapport PDF |
| `POST` | `/api/audits/:auditId/ai-queries` | Lancer le module requêtes IA (clé requise) |
| `PATCH` | `/api/findings/:findingId` | Marquer / démarquer « faux positif » |
| `GET` / `POST` | `/api/credentials` | Lister (sans secret) / ajouter une clé chiffrée |
| `DELETE` | `/api/credentials/:credentialId` | Supprimer une clé |
| `POST` | `/api/credentials/:credentialId/test` | Vérifier la validité de la clé |

Règles communes : session obligatoire (sauf auth), chaque requête Prisma filtre par `project.userId = session.userId` (une ressource d'un autre utilisateur renvoie `404`, pas `403`, pour ne rien révéler), corps validé par Zod, réponses d'erreur génériques, limitation de débit sur l'auth et le lancement d'audits.

Les formulaires peuvent appeler ces mêmes services via des server actions ; la logique et le contrôle d'accès restent dans `src/server/services/`, jamais dans les composants.

---

## 5. Parcours utilisateur

```
Inscription ─► Tableau de bord vide ─► « Créer mon premier projet »
                                             │
             Formulaire projet : entreprise, URL, secteur, pays/ville,
             cible principale, concurrents (opt.), requêtes GEO (opt.),
             case « je suis autorisé à auditer ce site »
                                             │
                                  Fiche projet ─► « Lancer l'audit »
                                             │
             Écran de progression (polling 2 s) :
             robots.txt ✓ · sitemap ✓ · 8 pages trouvées · analyse 5/8…
                                             │
             Résultats (lecture < 1 min) :
             ┌ Score CITE 62/100 (indicateur interne) + couverture 92 %
             ├ 3 forces · 3 faiblesses · 3 actions prioritaires
             └ Avertissement sur les limites
                                             │
             Détail par pilier : critères, points, éléments manquants,
             preuves (URL + extrait), problèmes triés par priorité
                                             │
             Onglet GEO : indice de signaux GEO (séparé du score CITE)
             Onglet Requêtes IA : si aucune clé → explication + lien
             vers /settings/api-keys ; sinon lancement et tableau des réponses
                                             │
             Export PDF (option « masquer les informations sensibles »)
                                             │
             Corrections sur le site ─► nouvel audit ─► comparaison avec
             l'audit précédent dans l'historique (évolution par pilier)
```

---

## 6. Calcul du score CITE

### 6.1 Règles générales

- **Score global = Clarifier (25) + Indexer (30) + Tunnel (25) + Enclencher (20) = 100.**
- Chaque critère a un nombre de points maximum, une règle de mesure, un niveau de confiance et une priorité en cas d'échec.
- `PASS` = 100 % des points, `PARTIAL` = au prorata défini par la règle, `FAIL` = 0.
- `NOT_APPLICABLE` (ex. aucune image → critère alt sans objet ; aucune requête GEO fournie → T2) : le critère est retiré et les points du pilier sont **redistribués proportionnellement** sur les critères restants.
- `NOT_VERIFIED` (ex. page bloquée par un pare-feu, PageSpeed sans clé) : même traitement, mais la **couverture** baisse et est affichée. Si la couverture d'un pilier est < 70 %, son score est marqué « indicatif ».
- Formule d'un pilier : `score_pilier = max_pilier × Σ points obtenus / Σ points max des critères évalués`.
- Arrondi à 0,5 près par pilier, entier pour le total.
- Le score n'utilise **jamais** les réponses des IA (non déterministes, dépendantes du modèle et de la date).
- Mention obligatoire à côté du score : « Indicateur interne Data & AI Academy, basé sur des signaux observables. Ce n'est pas une mesure de Google, ChatGPT, Perplexity ou Gemini. »

Pages analysées (MVP, max 15) : accueil + pages découvertes via le menu, le pied de page et le sitemap, classées par type (offre/service, à propos, contact, études de cas/références, FAQ, blog) avec priorité aux types utiles à l'audit.

### 6.2 C — Clarifier (25 points)

*Question : un visiteur comprend-il en 10 secondes qui vous aidez, à quoi, et avec quel résultat ?* Zone analysée : « zone héro » = H1 + premier paragraphe + premier bouton, approximée par les ~150 premiers mots visibles de l'accueil.

| Code | Critère | Pts | Mesure | Confiance | Priorité si échec |
|---|---|---|---|---|---|
| C1 | H1 unique et explicite | 5 | 1 seul H1 ; 3 à 15 mots ; pas générique (« Bienvenue », « Accueil », nom seul) | Haute | Critique |
| C2 | Offre énoncée dès la zone héro | 5 | Présence de termes d'offre (secteur déclaré + vocabulaire de service extrait des pages offre) dans la zone héro | Moyenne | Critique |
| C3 | Cible nommée | 4 | Termes de la cible principale déclarée (ou synonymes listés) présents dans la zone héro ; partiel si seulement plus bas sur la page | Moyenne | Important |
| C4 | Problème ou résultat exprimé | 4 | Formulation de bénéfice (verbe de résultat, chiffre, « pour… », « sans… ») détectée dans la zone héro | Basse | Important |
| C5 | Cohérence title / meta / H1 | 4 | Recouvrement des termes clés entre title, meta description et H1 | Haute | Important |
| C6 | Lisibilité | 3 | Longueur moyenne des phrases, part de mots longs, indice de lisibilité FR (Kandel-Moles) / EN (Flesch) | Moyenne | Recommandé |

Les critères à confiance moyenne ou basse affichent l'extrait analysé pour que l'utilisateur juge lui-même et puisse marquer un faux positif.

### 6.3 I — Indexer (30 points)

*Question : Google et les IA peuvent-ils accéder à votre contenu et comprendre qui vous êtes ?*

| Code | Critère | Pts | Mesure | Confiance | Priorité si échec |
|---|---|---|---|---|---|
| I1 | Accès HTTP | 2 | Accueil en 200, HTTPS, ≤ 1 redirection, pas de `noindex` | Haute | Critique |
| I2 | robots.txt | 3 | Accessible ; ne bloque ni l'accueil ni les pages clés ; statut des robots IA connus (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended) signalé à titre informatif | Haute | Critique si blocage total, sinon Important |
| I3 | sitemap.xml | 2 | Trouvé (robots.txt ou `/sitemap.xml`), XML valide, URLs du domaine, répondant en 200 sur échantillon | Haute | Important |
| I4 | Balises title | 3 | Présentes, 30–65 caractères, uniques entre pages | Haute | Important |
| I5 | Meta descriptions | 2 | Présentes, 70–160 caractères, uniques | Haute | Recommandé |
| I6 | Structure des titres | 2 | 1 H1 par page, H2 présents, pas de saut de niveau majeur | Haute | Recommandé |
| I7 | Canonical | 2 | Présent, absolu, cohérent (auto-référent ou vers une page valide en 200) | Haute | Important |
| I8 | Contenu accessible sans JavaScript | 2 | ≥ 200 mots visibles dans le HTML initial de l'accueil et des pages offre | Haute | Critique si < 50 mots |
| I9 | Données structurées d'entité | 4 | JSON-LD valide ; `Organization` / `ProfessionalService` / `LocalBusiness` avec `name`, `url`, `logo`, `sameAs`, adresse si local | Haute | Important |
| I10 | Open Graph | 1 | `og:title`, `og:description`, `og:image` | Haute | Recommandé |
| I11 | Textes alternatifs | 2 | Part des images de contenu avec `alt` non vide (≥ 90 % = PASS) | Haute | Recommandé |
| I12 | Maillage interne et liens cassés | 2 | Pages clés atteignables depuis l'accueil ; liens internes échantillonnés sans 4xx/5xx | Haute | Important |
| I13 | Cohérence de l'identité de marque | 2 | Même nom dans title, `og:site_name`, JSON-LD, pied de page ; même ville/pays que déclaré | Moyenne | Important |
| I14 | Performance | 1 | Core Web Vitals via PageSpeed (LCP, CLS, INP) ; sans clé → `NOT_VERIFIED` | Haute | Recommandé |

### 6.4 T — Tunnel (25 points)

*Question : le visiteur qui arrive avec un besoin trouve-t-il la bonne page, des preuves et une prochaine étape claire ?*

| Code | Critère | Pts | Mesure | Confiance | Priorité si échec |
|---|---|---|---|---|---|
| T1 | Pages d'offre dédiées | 5 | Au moins une page par offre principale, atteignable depuis le menu, avec un H1 propre | Moyenne | Critique |
| T2 | Cohérence intention / page | 4 | Pour chaque requête GEO fournie, existence d'une page dont title/H1/H2 couvrent ses termes principaux ; `NOT_APPLICABLE` sans requête | Moyenne | Important |
| T3 | Éléments de preuve | 5 | Témoignages nommés, logos clients, études de cas, chiffres de résultats, certifications, avis — comptés par type distinct | Moyenne | Critique si aucun |
| T4 | Appel à l'action visible | 4 | CTA dans la zone héro de l'accueil et des pages offre ; libellé explicite (pas seulement « En savoir plus ») | Moyenne | Important |
| T5 | Clarté de la navigation | 3 | Menu principal ≤ 7 entrées ; offre et contact à 1 clic | Haute | Recommandé |
| T6 | Qui est derrière | 4 | Page « À propos » ; personnes nommées avec rôle ; expertise ou parcours visible | Moyenne | Important |

### 6.5 E — Enclencher (20 points)

*Question : le visiteur convaincu peut-il passer à l'action facilement ?*

| Code | Critère | Pts | Mesure | Confiance | Priorité si échec |
|---|---|---|---|---|---|
| E1 | Coordonnées | 4 | E-mail, téléphone, adresse ou ville visibles ; page contact | Haute | Critique si aucun moyen de contact |
| E2 | Formulaire ou prise de RDV | 5 | Formulaire ≤ 6 champs, ou lien de réservation (Calendly, Cal.com, Google Agenda…) | Haute | Critique |
| E3 | CTA principal cohérent | 3 | Même action principale répétée (haut, milieu, bas de page) | Moyenne | Important |
| E4 | Étape d'entrée à faible engagement | 3 | Diagnostic, audit offert, ressource téléchargeable, essai, devis | Moyenne | Recommandé |
| E5 | Réassurance au moment de l'action | 3 | Mention de confidentialité près du formulaire, délai de réponse, mentions légales / politique de confidentialité | Haute | Important |
| E6 | Canaux alternatifs | 2 | WhatsApp, LinkedIn, chat, téléphone cliquable (`tel:`) | Haute | Recommandé |

### 6.6 Module GEO (indice séparé, sur 100)

Affiché à part, **non inclus dans le score CITE** pour éviter de compter deux fois les mêmes signaux et pour garder le score CITE stable. Libellé : « Indice de signaux GEO — signaux observables pouvant aider une IA à comprendre et citer votre marque. Résultat non garanti. »

| Code | Signal | Pts |
|---|---|---|
| GEO1 | Clarté de l'entité (qui, quoi, où en une phrase sur l'accueil et l'« À propos ») | 10 |
| GEO2 | Cohérence nom / offre / localisation entre pages, JSON-LD et profils `sameAs` déclarés | 10 |
| GEO3 | Pages expertes (contenus approfondis ≥ 800 mots sur un sujet métier) | 10 |
| GEO4 | Preuves et études de cas détaillées (contexte, action, résultat chiffré) | 10 |
| GEO5 | Mentions externes : liens `sameAs` et profils publics déclarés, accessibles et cohérents ¹ | 8 |
| GEO6 | Citations de sources fiables (liens sortants vers études, institutions, données) | 8 |
| GEO7 | Données structurées de contenu (`FAQPage`, `Article` avec `author`, `Person`, `Service`) | 8 |
| GEO8 | Page FAQ ou blocs questions/réponses | 8 |
| GEO9 | Réponses directes aux questions des prospects (H2 en forme de question suivi d'une réponse courte) | 8 |
| GEO10 | Auteurs identifiés (nom, rôle, page auteur) | 8 |
| GEO11 | Lien marque ↔ fondateur ↔ expertise (page fondateur, `Person` relié à `Organization`, LinkedIn) | 7 |
| GEO12 | Profondeur globale des contenus (volume et diversité des pages) | 5 |

¹ MVP : on vérifie uniquement les profils **déclarés** sur le site (liens `sameAs`, liens du pied de page) — existence et cohérence du nom. Pas de recherche de mentions sur le web ni de collecte LinkedIn (CGU), signalé comme « non vérifié » dans les limites.

### 6.7 Module requêtes IA (hors score)

Pour chaque requête et chaque modèle configuré :

1. **Masquage optionnel** de la requête avant envoi (e-mails, téléphones, noms de personnes listés par l'utilisateur).
2. Appel API serveur avec la clé déchiffrée en mémoire, timeout 60 s, réponse limitée en taille.
3. Stockage de la **réponse brute inchangée** + `model` tel que renvoyé par l'API.
4. Analyse déterministe :
   - **Mention** = un alias de la marque ou le domaine apparaît (normalisation casse/accents, frontières de mots).
   - **Recommandation** = mention **et** formulation explicite de recommandation dans la même phrase/élément de liste (« je recommande », « meilleur choix », « vous pouvez faire appel à », classement en tête d'une liste de recommandations). Sinon `false`. Une mention n'est jamais comptée comme recommandation.
   - **Position approximative** = rang de l'élément de liste (ou du paragraphe) contenant la 1re mention, + ratio de position dans le texte.
   - **Concurrents** = même détection sur la liste des concurrents du projet.
   - **Sources** = uniquement celles renvoyées dans le champ structuré de l'API (ex. citations Perplexity) ou les URLs littéralement présentes dans le texte, avec leur origine. Aucune source n'est inventée ni déduite.
   - **Score de confiance** (0–1) de l'analyse : élevé si correspondance exacte du nom, plus bas si alias ambigu (nom commun) ou réponse tronquée.
5. Avertissement affiché : « Les réponses via API peuvent différer de celles de l'interface grand public (recherche web, personnalisation, date). Instantané à une date donnée, non représentatif de toutes les réponses possibles. »

### 6.8 Priorités et rapport

- **Critique** : empêche d'être trouvé ou contacté (site inaccessible, `noindex`, contenu invisible sans JS, aucune offre lisible, aucun moyen de contact).
- **Important** : réduit nettement la compréhension ou la conversion.
- **Recommandé** : optimisation utile mais non bloquante.

Synthèse exécutive générée de façon déterministe :
- **3 forces** = critères `PASS` aux plus gros poids ;
- **3 faiblesses** = critères avec le plus de points perdus (priorité critique d'abord) ;
- **3 actions prioritaires** = tri par `priorité × points récupérables / effort`.

Plan **30 jours** = problèmes critiques + importants à effort faible ou moyen. Plan **90 jours** = le reste des importants + recommandés + chantiers de fond (pages expertes, études de cas, FAQ).

Section **Limites et éléments non vérifiés** = liste automatique des critères `NOT_VERIFIED` et des pages non analysées (robots.txt, pare-feu, timeout, contenu JavaScript), plus les limites permanentes de la méthode.

---

## 7. Risques techniques et légaux

### 7.1 Techniques

| Risque | Conséquence | Mesure |
|---|---|---|
| **SSRF** (l'utilisateur saisit une URL interne, ou un site redirige vers une IP privée / DNS rebinding) | Accès au réseau interne, aux métadonnées cloud | `ssrf-guard` : schémas http/https seuls, ports 80/443, résolution DNS puis blocage des plages privées, loopback, link-local (169.254.0.0/16), CGNAT, multicast, IPv6 ULA/link-local, IPv4 mappé en IPv6 ; connexion épinglée sur l'IP vérifiée ; contrôle refait à **chaque** redirection (max 5) ; même contrôle pour les `baseUrl` d'API IA |
| Pages énormes ou lentes | Saturation mémoire / worker bloqué | Timeout 10 s par requête, 120 s par audit, 2 Mo max par page (lecture en flux, arrêt au-delà), types de contenu HTML/XML uniquement, 15 pages max |
| Sites rendus en JavaScript (SPA) | Contenu invisible → faux échecs | Détection (« peu de texte + bundle JS ») → critères marqués `NOT_VERIFIED` avec explication, et signal I8 ; rendu navigateur en phase 2 |
| Pare-feu anti-bot (Cloudflare, etc.) | 403/429 | User-Agent identifiable (`CITE-Audit/1.0 (+url)`), 1 requête à la fois par domaine, délai 500 ms ; échec → « non vérifié », jamais imputé au site |
| Heuristiques de texte imparfaites (FR/EN, formulations créatives) | Faux positifs/négatifs sur C2–C4, T3, T4 | Niveau de confiance affiché, extrait visible, bouton « faux positif », jeu de fixtures de test, versionnement des règles |
| **Injection de prompt** via le contenu des sites ou des réponses IA | Manipulation d'une analyse LLM | MVP : aucun contenu crawlé n'est envoyé à un LLM ; analyse des réponses IA déterministe. Si un LLM est ajouté plus tard : contenu encadré comme donnée, sortie JSON validée par Zod, aucun outil disponible |
| **XSS** via contenu crawlé ou réponses IA | Exécution de script chez l'utilisateur | Affichage en texte uniquement (échappement React, aucun `dangerouslySetInnerHTML`), CSP stricte, extraits tronqués |
| Fuite de clés API | Facturation frauduleuse | Chiffrement AES-256-GCM, clé maître hors base, déchiffrement uniquement dans le worker, jamais renvoyée au client, jamais loguée |
| Accès aux données d'un autre utilisateur (IDOR) | Fuite de données | Contrôle `userId` dans chaque service, tests d'intégration dédiés « utilisateur A ne voit pas B » |
| Abus (audits en masse, sites tiers) | Coûts, plaintes | Quotas par compte (ex. 10 audits/jour), 1 audit actif par projet, limitation de débit sur l'API |
| Non-déterminisme et coût des IA | Résultats instables, factures | Hors score, horodatés, modèle enregistré, nombre de requêtes plafonné (ex. 20 par lancement), coût estimé affiché avant envoi |

### 7.2 Légaux et éthiques

| Risque | Mesure |
|---|---|
| **Pratique commerciale trompeuse** (promettre un classement ou une citation) | Formulations encadrées, test automatique qui bloque les phrases interdites dans le catalogue et l'UI, avertissement dans chaque rapport, CGU explicites |
| Utilisation des marques Google, ChatGPT, Perplexity, Gemini | Usage purement descriptif, aucun logo, mention « non affilié » |
| Audit de sites tiers (concurrents, sites non détenus) | Case d'attestation à la création du projet ; concurrents utilisés **uniquement** comme noms dans l'analyse des réponses IA (pas de crawl des concurrents au MVP) ; respect de robots.txt ; pages publiques uniquement, aucune authentification contournée |
| Données personnelles (RGPD pour clients européens, **loi ivoirienne n° 2013-450** / ARTCI pour la Côte d'Ivoire) | Minimisation (pas de HTML brut stocké, extraits courts), politique de confidentialité, durée de conservation définie, suppression projet/compte effective (cascade), registre des traitements, hébergement documenté |
| Transfert de données vers les fournisseurs IA (hors UE/CI) | Envoi uniquement des requêtes saisies, masquage proposé, information claire avant activation, clé appartenant à l'utilisateur |
| CGU des fournisseurs IA | Uniquement les **API officielles**, jamais de scraping des interfaces grand public |
| Responsabilité sur les recommandations | Mention « conseils indicatifs, à valider selon votre contexte », pas de garantie de résultat dans les CGV |

---

## 8. Plan de développement en 5 étapes

Chaque étape se termine par : lint + typecheck + tests au vert, démonstration testable, résumé des fichiers modifiés.

### Étape 1 — Fondations, comptes et projets
- Initialisation Next.js + TypeScript strict + Tailwind + shadcn/ui, ESLint, Vitest, docker compose PostgreSQL, `.env.example`, `env.ts`.
- Schéma Prisma (User, Project, Competitor, GeoQuery, tables auth) + migration.
- Better Auth : inscription, connexion, déconnexion, layout protégé.
- CRUD projets (création, édition, suppression en cascade) + tableau de bord.
- **Tester** : `docker compose up -d && pnpm dev`, créer un compte, un projet, le supprimer ; tests d'isolation entre deux utilisateurs.

### Étape 2 — Collecte sécurisée des pages
- `ssrf-guard`, `safe-fetch`, robots.txt, sitemap, découverte des pages, `extract` (PageFacts).
- File d'attente PostgreSQL + worker ; lancement d'audit (`POST`), statut et progression.
- **Tester** : tests unitaires anti-SSRF (IP privées, redirections piégées, DNS), fixtures HTML servies par un serveur local, audit lancé depuis l'UI sur un vrai site public avec écran de progression.

### Étape 3 — Moteur de score CITE, problèmes et résultats
- Critères C1–C6, I1–I14, T1–T6, E1–E6, agrégation, couverture, priorités.
- Catalogue de textes (constat / impact / recommandation) + garde-fou des formulations interdites.
- Page de résultats : score, sous-scores, critères, éléments manquants, problèmes filtrables, historique et comparaison.
- **Tester** : tests unitaires par critère sur fixtures (bon / moyen / mauvais site), test de non-régression du score, vérification manuelle sur 3 sites réels.

### Étape 4 — Rapport, plan d'action et module GEO
- `build-snapshot` : synthèse (score, 3 forces, 3 faiblesses, 3 actions, avertissement), plans 30/90 jours, limites.
- Indice GEO (GEO1–GEO12) et onglet dédié.
- Rapport web + export PDF en 10 sections, option de masquage.
- **Tester** : génération du PDF sur un audit de fixture, relecture du ton, test sur l'absence de formulations interdites dans le PDF.

### Étape 5 — Requêtes IA et durcissement
- Clés API chiffrées (ajout, test, suppression), adaptateurs fournisseurs, analyse des réponses, masquage, quotas et estimation du coût.
- Durcissement : limitation de débit, en-têtes de sécurité / CSP, logs masqués, suppression de compte, revue de sécurité complète.
- **Tester** : tests unitaires de l'analyse (mention ≠ recommandation, sources non inventées) sur réponses enregistrées, test d'intégration avec un faux fournisseur local, essai réel avec une clé de test.

Hors MVP (phase 2) : rendu JavaScript via navigateur headless, recherche de mentions externes, équipes/multi-utilisateurs, paiement, marque blanche agences, audits planifiés, comparaison concurrentielle crawlée.

---

## 9. Décisions à valider

1. **Emplacement** : SaaS dans `cite-audit/` à côté du site vitrine (recommandé) ou dépôt séparé ?
2. **Authentification** : Better Auth (recommandé) ou Auth.js ?
3. **Hébergement cible** : le worker nécessite un processus permanent. Recommandé : une plateforme qui fait tourner des conteneurs (VPS + Docker, Railway, Render, Fly.io) avec PostgreSQL managé. Vercel seul conviendrait mal au worker.
4. **Indice GEO séparé** du score CITE (recommandé) ou intégré au score ?
5. **Limites MVP** : 15 pages par audit, 10 audits par jour et par compte, 20 requêtes IA par lancement — à ajuster.
6. **Langue** : interface et rapport en français uniquement au MVP, analyse des sites en français et en anglais.
7. **Fournisseurs IA prioritaires** pour l'étape 5 (ex. Perplexity + OpenAI d'abord).
