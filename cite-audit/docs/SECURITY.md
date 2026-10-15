# Dossier de sécurité — GriotCite

Document de synthèse des protections en place, des limites connues et des actions prévues.
Destiné à un auditeur externe (test d'intrusion) et, sous forme résumée, aux clients qui le demandent.
Chaque mesure renvoie au code qui la met en œuvre. Mis à jour le 14 octobre 2026.

## 1. Périmètre

| Élément | Détail |
|---|---|
| Application | Next.js 16 (App Router), React 19, TypeScript strict — `cite-audit/` |
| Adresse | https://audit.data-ai-academy.com |
| Hébergement | Render (conteneur Docker, Francfort) ; base PostgreSQL Neon (Francfort) |
| E-mails | Brevo (SMTP), domaine authentifié (DKIM, DMARC) |
| Tiers optionnel | Perplexity (module de visibilité IA, lancé à la demande de l'utilisateur) |
| Code source | Dépôt GitHub public `dataaiacademy225-max/-data-ai-academy` |

## 2. Authentification et sessions

| Mesure | Mise en œuvre |
|---|---|
| Mots de passe | 10 à 128 caractères, hachés par Better Auth (jamais stockés en clair) — `lib/auth.ts` |
| Confirmation d'adresse | Lien envoyé à l'inscription, valable 24 h |
| Mot de passe oublié | Lien valable 1 h, à usage unique ; toutes les sessions sont fermées après le changement |
| Sessions | En base, 7 jours au plus, cookie `httpOnly` / `secure` (en HTTPS) posé par Better Auth |
| Double authentification | TOTP (application) + 10 codes de secours à usage unique ; secret et codes **chiffrés** en base (`BETTER_AUTH_SECRET`). Après le mot de passe, aucune session n'existe tant que le code n'est pas vérifié (cookie temporaire de 10 min) — `lib/auth.ts`, `server/actions/two-factor.ts` |
| Verrouillage | 10 codes faux consécutifs → compte bloqué 15 min (Better Auth) |
| Inscriptions | Sur invitation par défaut (`SIGNUP_MODE=invite`), contrôlé aussi au niveau de Better Auth pour bloquer l'appel direct à l'API — `lib/access.ts` |
| Droits propriétaire | Adresse listée dans `OWNER_EMAILS` (variable serveur, jamais en base) **et** confirmée **et** double authentification active |
| Messages d'erreur | Identiques que le compte existe ou non (connexion, mot de passe oublié) |
| Opérations sensibles | Suppression de compte, activation ou désactivation de la double authentification, nouveaux codes de secours : mot de passe actuel redemandé |

## 3. Autorisation et isolation des données

- Chaque page, action et route protégée appelle `requireUser()` ; le contrôle est fait **côté serveur** (`lib/session.ts`).
  Le `proxy.ts` ne sert qu'à rediriger vite, il n'est pas le contrôle d'accès.
- Toutes les requêtes de données sont filtrées par `userId` (`server/services/`). Une ressource d'un autre utilisateur
  renvoie « introuvable », jamais « interdit » (pas d'indice d'existence).
- Les données de démonstration sont séparées par une clé étrangère composite `(projectId, isDemo)`.
- Suppression de projet ou de compte : en cascade en base (projets, audits, pages, recommandations, mesures IA,
  sessions, double authentification).

## 4. Protection contre les attaques web

| Risque | Protection |
|---|---|
| XSS | Échappement React ; `dangerouslySetInnerHTML` interdit (0 occurrence) ; contenu des sites audités et réponses IA traités comme du texte |
| Scripts injectés | CSP stricte avec **nonce par requête** : `script-src 'self' 'nonce-…' 'strict-dynamic'`, pas de `eval` en production, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` — `lib/csp.ts`, `proxy.ts` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| Rétrogradation HTTP | HSTS 2 ans (`includeSubDomains`), `upgrade-insecure-requests` |
| Autres en-têtes | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra, micro, géolocalisation coupés), `Cross-Origin-Opener-Policy: same-origin` — `next.config.ts` |
| CSRF | Server actions Next.js (vérification d'origine) ; cookies Better Auth `SameSite=Lax` |
| Injection SQL | Prisma (requêtes paramétrées) ; les quelques requêtes SQL écrites à la main (file d'attente, purge, limites) utilisent les gabarits paramétrés de Prisma, jamais de concaténation |
| Formulaire public de demande d'accès | Valeurs validées par Zod puis stockées et affichées comme du texte ; l'adresse de site saisie n'est jamais visitée (pas de SSRF) ; **aucun e-mail envoyé à l'adresse saisie** (le formulaire ne peut pas servir à écrire à un tiers) ; seuls les propriétaires (`OWNER_EMAILS`) sont prévenus, sans donnée saisie dans l'objet de l'e-mail ; liste réservée au propriétaire (`/settings/demandes-acces`, vérifié côté serveur) ; suppression automatique après 12 mois |
| Ressources externes | Aucune : polices servies par l'application, QR code de double authentification généré sur le serveur |

## 5. Crawler (récupération des sites audités)

Le crawler visite des adresses fournies par les utilisateurs : c'est la surface d'attaque principale (SSRF).
Toute requête passe par `safeFetch` (`server/crawler/safe-fetch.ts`) :

- **Adresses** : seuls `http`/`https`, ports 80 et 443 ; identifiants dans l'URL refusés — `url-guard.ts`.
- **IP** : IP privées, réservées, locales, de métadonnées cloud (169.254.169.254), IPv4 encapsulées dans IPv6 bloquées —
  `ip-policy.ts`.
- **DNS rebinding** : l'IP est vérifiée **au moment de la connexion** (résolution interne de l'agent HTTP),
  pas seulement avant ; idem à **chaque redirection**.
- **Limites** : 10 s par requête, 2 Mo par réponse (mesurés **après** décompression : une bombe de compression
  s'arrête à 2 Mo), 5 redirections, 15 pages par audit, 0,5 s entre deux pages, 2 min 30 par audit.
- **Discrétion** : aucun cookie ni identifiant envoyé ; User-Agent explicite (`GriotCite/0.1 …`) ;
  `robots.txt` respecté pour chaque page et chaque redirection (erreur 5xx → abstention).
- **Contenu** : jamais exécuté (analyse statique avec cheerio), jamais injecté en HTML, jamais donné comme consigne à un modèle.
- **Responsabilité** : l'utilisateur atteste être autorisé à faire auditer le site (`ownershipAttested`).

## 6. Limites anti-abus

| Action | Limite |
|---|---|
| Connexion | 10 essais / 15 min par adresse e-mail, 50 / 15 min par IP |
| Double authentification (connexion) | 20 essais / 15 min par IP, + verrouillage Better Auth |
| Réglages de double authentification | 10 / 15 min par utilisateur |
| Inscription | 10 / h par IP |
| Mot de passe oublié | 10 / h par IP, 3 / h par adresse |
| E-mail de confirmation | 3 / h par utilisateur |
| Suppression de compte | 5 / 15 min par utilisateur |
| Demande d'accès (formulaire public, sans compte) | 5 / h par IP, 3 / 24 h par adresse ; doublon de la même adresse dans les 24 h ignoré ; champ piège anti-robots — `server/services/access-requests.ts` |
| Audits | 20 / 24 h par utilisateur (sauf propriétaire), un seul en cours par projet |
| Module IA | `AI_MAX_QUERIES_PER_RUN` (10) et `AI_MAX_QUERIES_PER_DAY` (50) ; coût estimé et accepté avant chaque mesure |

Compteurs stockés en base avec des **clés hachées** (SHA-256 : ni e-mail ni IP en clair) — `server/services/rate-limit.ts`.
L'IP du client est lue à droite de `X-Forwarded-For` selon `TRUSTED_PROXY_COUNT` (non falsifiable par le client) — `lib/client-ip.ts`.

## 7. Secrets

- Uniquement en variables d'environnement serveur (Render, secrets GitHub), validées au démarrage par Zod — `lib/env.ts`.
- Jamais dans le code, la base, le navigateur, les journaux ou les messages d'erreur.
- Aucun secret dans l'image Docker ; conteneur exécuté par un utilisateur non privilégié.
- Secrets en place : `DATABASE_URL`, `BETTER_AUTH_SECRET` (généré par Render), `SMTP_URL`, `PERPLEXITY_API_KEY` (si le module IA est activé),
  `BACKUP_DATABASE_URL` / `BACKUP_PASSPHRASE` (sauvegardes).

## 8. Journaux

`lib/logger.ts` masque automatiquement les clés sensibles (mot de passe, secret, jeton, cookie, session, e-mail…)
et nettoie les URL (sans paramètres, identifiants ni ancre). Aucun corps de page, réponse IA ni clé n'est journalisé.

## 9. Données, conservation et sauvegardes

- Purge quotidienne : sessions, liens et compteurs expirés ; historique d'audits selon `AUDIT_RETENTION_DAYS` — `services/retention.ts`.
- Comptes inactifs : avertissement après 3 ans, suppression 30 jours plus tard (jamais sans e-mail parti) — `services/inactive-accounts.ts`.
- Sauvegardes : copie complète chaque nuit, **chiffrée AES-256** avant de quitter le serveur d'exécution,
  vérifiée, conservée 30 jours ; restauration uniquement dans une base neuve — `.github/workflows/db-backup.yml`,
  `db-restore.yml`, `docs/BACKUP.md`.
- Durées et prestataires détaillés dans la politique de confidentialité — `content/legal.ts`.

## 10. Chaîne de développement

| Contrôle | Détail |
|---|---|
| Tests automatiques | 412 tests (unitaires + intégration sur base PostgreSQL jetable), sans accès Internet : crawler testé contre un faux site local (SSRF, redirections, bombes de compression, robots.txt) |
| Intégration continue | Lint, types, tests, build et image Docker à chaque modification — `.github/workflows/cite-audit-ci.yml` |
| Analyse du code | CodeQL (GitHub) à chaque modification |
| Dépendances | Dependabot : alertes de sécurité et mises à jour hebdomadaires ; versions figées (`pnpm-lock.yaml`) |
| Revue | Toute modification passe par une demande de fusion validée par le propriétaire |

## 11. Limites connues (transparence)

| Limite | Impact | Action prévue |
|---|---|---|
| Aucun test d'intrusion externe réalisé | Les protections n'ont été vérifiées que par les tests internes | Faire réaliser un test d'intrusion avant l'ouverture au public |
| Dépôt de code public | La logique est lisible par tous (aucun secret n'y figure) | Décider s'il faut le passer en privé |
| Hébergement gratuit (Render, Neon) | Pas d'engagement de disponibilité ; mise en veille après 15 min d'inactivité | Passer à une offre payante à l'ouverture au public |
| Pas de pare-feu applicatif (WAF) ni d'anti-DDoS dédié | Protection limitée à celle de Render et aux limites de l'application | À évaluer selon le trafic |
| Pas de vérification des mots de passe compromis | Un mot de passe déjà divulgué ailleurs est accepté | Option Better Auth « Have I Been Pwned » à activer |
| Alerte `braces` (dépendance de l'outil de lint) sans correctif publié | Aucune en production (outil de développement seulement) | Dependabot la corrigera dès publication |
| Pas de journal d'audit des actions des comptes | Traçabilité limitée aux journaux techniques | À ajouter avant des clients entreprises |
| Format de réponse de l'API Perplexity vérifié seulement par des sources tierces | Mesures IA possiblement incomplètes au premier appel | Vérifier le premier appel réel (JSON complet conservé) |
| Pages légales incomplètes (adresse, hébergeur, juridiction, représentant UE) | Conformité à finaliser | Compléter `LEGAL_ENTITY` avant l'ouverture au public |

## 12. Signaler une faille

Écrire à **steve@data-ai-academy.com** avec l'objet « Sécurité GriotCite ». Merci de ne pas publier la faille
avant sa correction ; nous répondons sous 72 heures.
