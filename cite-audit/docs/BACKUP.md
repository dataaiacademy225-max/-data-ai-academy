# Sauvegardes de la base de données

GriotCite garde toutes ses données (comptes, projets, audits, rapports) dans une base PostgreSQL hébergée chez Neon.
Une copie complète est faite **chaque nuit vers 3 h 17 (heure d'Abidjan)** par GitHub Actions
(`.github/workflows/db-backup.yml`).

| Point | Fonctionnement |
|---|---|
| Contenu | Copie complète de la base (`pg_dump`, format compressé) |
| Chiffrement | AES-256 avec une phrase secrète connue du seul propriétaire. Le dépôt est public : sans la phrase, le fichier est illisible |
| Vérification | Chaque copie est déchiffrée et relue juste après sa création ; en cas d'échec, GitHub envoie un e-mail |
| Conservation | 30 jours, puis suppression automatique par GitHub |
| Coût | Gratuit |

## 1. Mise en service (une seule fois, environ 5 minutes)

1. Choisir une **phrase secrète** : 5 ou 6 mots au hasard, 24 caractères au moins
   (par exemple « baobab-lagune-tambour-mangue-velo-orage », mais pas celle-ci).
   La noter **hors de GitHub** (papier, gestionnaire de mots de passe).
   Sans elle, aucune sauvegarde ne peut être relue, ni par vous ni par personne.
2. Sur GitHub : dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, deux fois :
   - `BACKUP_DATABASE_URL` : le lien Neon, le même que `DATABASE_URL` sur Render ;
   - `BACKUP_PASSPHRASE` : la phrase secrète.
3. Premier essai : onglet **Actions** → **Sauvegarde de la base** → **Run workflow**.
   Au bout de 1 à 2 minutes, une coche verte et, en bas de la page de l'exécution, un fichier
   `griotcite-db-AAAA-MM-JJ_HHMM` dans « Artifacts ».

Tant que les secrets ne sont pas créés, l'exécution se termine avec un simple avertissement « Sauvegarde non configurée ».

## 2. Restaurer une sauvegarde

On ne restaure **jamais par-dessus** la base en service : la copie va dans une base neuve et vide,
on vérifie, puis on bascule l'application dessus. La base d'origine reste intacte tant qu'on ne l'a pas supprimée.

1. **Choisir la sauvegarde** : onglet **Actions** → **Sauvegarde de la base** → cliquer sur l'exécution voulue.
   Le numéro à retenir est dans l'adresse de la page : `…/actions/runs/NUMÉRO`.
2. **Créer une base vide chez Neon** : projet GriotCite → **Databases** → **New database**
   (par exemple `griotcite_restauree`), même branche et même rôle que la base actuelle.
   Copier son lien de connexion (bouton **Connect**, en choisissant cette nouvelle base).
3. **Déclarer cette base dans GitHub** : nouveau secret `RESTORE_DATABASE_URL` avec ce lien.
4. **Lancer la restauration** : onglet **Actions** → **Restauration de la base** → **Run workflow**,
   indiquer le NUMÉRO de l'étape 1 et taper `RESTAURER`.
   La restauration est refusée si `RESTORE_DATABASE_URL` désigne la base en service.
5. **Basculer l'application** : sur Render, service `cite-audit` → **Environment** → remplacer `DATABASE_URL`
   par le lien de la base restaurée → **Save Changes**. Render redémarre GriotCite (2 à 5 minutes).
6. **Vérifier** : se connecter, ouvrir quelques projets et rapports.
7. **Mettre à jour les secrets** : `BACKUP_DATABASE_URL` doit désormais pointer vers la base restaurée,
   pour que les sauvegardes suivantes copient la bonne base.

## 3. Bon à savoir

- Les liens collés dans les secrets sont nettoyés automatiquement (`.github/scripts/clean-database-url.py`) :
  espaces, retours à la ligne, guillemets, lien collé deux fois, paramètres en trop (seul `sslmode=require` est gardé).
  Chaque correction est signalée dans l'exécution, sans jamais afficher le lien.
- Une donnée supprimée dans l'application (projet, compte) peut subsister jusqu'à 30 jours dans les copies chiffrées,
  puis disparaît avec elles. C'est indiqué dans la politique de confidentialité.
- Amélioration possible : créer chez Neon un rôle en **lecture seule** réservé aux sauvegardes
  et l'utiliser dans `BACKUP_DATABASE_URL`. Même si ce secret fuitait, personne ne pourrait modifier les données.
- Neon garde aussi son propre historique court (restauration à un instant précis), utile pour une erreur
  remarquée dans les heures qui suivent.
