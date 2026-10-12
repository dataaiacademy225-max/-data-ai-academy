# Tarification et coûts (brouillon, non implémenté)

> Statut : **hypothèses de travail, octobre 2026**. Rien de ceci n'est codé. À valider auprès de 10 à 20 prospects et à recalculer chaque trimestre.
> Principe : chaque prix **inclut tous les coûts d'API**. Calcul fait dans le **cas le plus cher**.
> On vend l'audit, le plan d'action et le suivi, **jamais un résultat** : « maximiser vos chances d'être trouvé et cité, résultat non garanti ».

## 1. Formules envisagées

| Formule | Cible | Contenu | Prix HT indicatif |
|---|---|---|---|
| Découverte (gratuite) | Prospects | 1 audit/mois, synthèse + 3 actions prioritaires, pas de plan complet | 0 |
| Audit ponctuel | Clients sans abonnement | 1 audit complet, PDF, plan 30/90 jours sans suivi, 10 requêtes IA | ~25 000 FCFA (≈ 40 €) |
| Essentiel | Indépendants, TPE | 1 site, 4 audits/mois, plan 30/90 avec suivi des actions, historique, PDF, 10 requêtes IA/mois | ~15 000 FCFA/mois (≈ 25 €) |
| Pro | PME, SaaS B2B, cabinets | 3 sites, audits hebdomadaires, 50 requêtes IA/mois, concurrents | ~39 000 FCFA/mois (≈ 60 €) |
| Agence | Agences, consultants | 15 à 20 sites, plusieurs utilisateurs, marque blanche, 300 requêtes IA/mois | ~99 000 FCFA/mois (≈ 150 €) |

Leviers :
- **Programme 90 jours** : 3 mois payés d'avance, remise de 15 à 20 %. Cette durée correspond au plan d'action.
- **Accompagnement humain** (exécution du plan) : facturé à part, sur devis. Il n'est inclus dans aucune formule.
- **Pack de requêtes IA supplémentaires** au-delà du quota : par exemple 50 requêtes pour 3 000 FCFA (coût maximal ≈ 1 250 FCFA).

## 2. Coûts unitaires retenus

| Élément | Coût retenu | Base |
|---|---|---|
| Requête IA (Perplexity) | **0,04 $ ≈ 25 FCFA** | Estimateur du module (`src/lib/ai-pricing.ts`) : 0,005 à 0,018 $ par requête. Montant doublé, car les tarifs ne sont confirmés que par des sources tierces et la recherche web peut être facturée à part (Agent API) |
| Audit de site (15 pages) | ≈ 0 | Calcul sur notre serveur, sans API payante |
| PageSpeed (vitesse) | 0 | API Google gratuite, pas encore branchée |
| Hébergement (application, worker, PostgreSQL) | 30 à 60 $/mois au total | Coût fixe, réparti sur environ 50 clients payants |
| Frais de paiement (Mobile Money / carte) | **3,5 % du prix** | Hypothèse prudente, à confirmer auprès du prestataire |
| E-mails transactionnels | ≈ 0 | Volume faible |

Conversion : 1 $ ≈ 610 FCFA, compté large ; 1 € = 655,957 FCFA.

## 3. Coût maximal et marge par formule (par mois)

| Formule | Prix HT | Coût IA max | Hébergement | Frais de paiement | **Coût total max** | **Marge** |
|---|---|---|---|---|---|---|
| Découverte | 0 | 0 | ~150 | 0 | ~150 FCFA | coût d'acquisition |
| Audit ponctuel | 25 000 | 250 | ~200 | 875 | ~1 300 FCFA | ~95 % |
| Essentiel | 15 000 | 250 | ~600 | 525 | ~1 400 FCFA | ~90 % |
| Pro | 39 000 | 1 250 | ~1 200 | 1 365 | ~3 800 FCFA | ~90 % |
| Agence | 99 000 | 7 500 | ~4 000 | 3 465 | ~15 000 FCFA | ~85 % |

Le seul coût qui grandit avec l'usage est l'IA : il doit être **plafonné par formule**.

## 4. Règles pour que le calcul reste vrai

1. **Quota mensuel de requêtes IA par formule**, bloqué côté serveur. Aujourd'hui, seule une limite globale existe (`AI_MAX_QUERIES_PER_DAY`).
2. **Pas d'IA illimitée** : au-delà du quota, on propose un pack payant.
3. **Suivi du coût réel** : `AiVisibilityRun.actualCostUsd` enregistre le coût communiqué par l'API. Faire un relevé mensuel par client pour vérifier ces hypothèses.
4. **Si les tarifs de l'API augmentent**, réduire d'abord les quotas, et ne changer les prix qu'en dernier recours.
5. **Ajouter une IA** (OpenAI, Gemini…) multiplie le coût par requête : une même question posée à 3 IA coûte ≈ 3 fois plus. Refaire le calcul.
6. **Fiscalité** : les prix sont hors taxes ; la TVA ivoirienne de 18 % s'ajoute pour les clients concernés. Faire valider par l'expert-comptable selon le pays du client. Les factures et les CGV rappellent l'absence de garantie de résultat.

## 5. Paiement (à décider)

- **Mobile Money** (Orange Money, MTN MoMo, Moov, Wave) est indispensable en Côte d'Ivoire. Prestataires à comparer : CinetPay, PayDunya, Paystack, Flutterwave. Leurs frais et conditions ne sont pas encore vérifiés.
- **Abonnement prépayé** : rappel par e-mail ou WhatsApp avant l'échéance, puis lien de paiement. Sans paiement, l'accès est suspendu sans suppression des données (le prélèvement automatique est peu adapté au Mobile Money).
- **Carte et renouvellement automatique** pour les clients hors Afrique. Stripe exige une société dans un pays où il est disponible.

## 6. À implémenter le moment venu

- Modèle `Subscription` / `Plan` : formule, dates, statut, quotas.
- Quotas liés à la formule : sites, audits par mois, requêtes IA par mois.
- Page de prix.
- Intégration du prestataire de paiement choisi.
- Factures.
- Tableau de suivi du coût réel par client.
