#!/bin/sh
# Démarrage en un seul conteneur (Render gratuit, sans étape « pre-deploy ») : migrations, puis application.
# Pas de pnpm ici : node est lancé directement, sans dépendre du réseau au démarrage.
set -e
node node_modules/prisma/build/index.js migrate deploy
exec node node_modules/next/dist/bin/next start
