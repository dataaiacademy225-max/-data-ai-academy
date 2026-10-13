# Image unique pour l'application web, le worker et les migrations.
#   web     : docker run …                     (commande par défaut)
#   worker  : docker run … node --import tsx --conditions=react-server src/worker/index.ts
#   migrer  : docker run … pnpm db:deploy
#   tout-en-un (Render) : docker run … sh scripts/start-with-migrations.sh
# Web et worker sont lancés par node directement (pas par pnpm, qui ne transmet pas le signal d'arrêt) :
# le worker termine ainsi proprement l'audit en cours quand le conteneur est arrêté.
# Aucun secret n'est copié dans l'image : tout passe par les variables d'environnement au lancement.

FROM node:26-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# `prisma generate` (postinstall) exige une URL de base, sans s'y connecter : valeur factice limitée à cette étape.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# pnpm est téléchargé une fois pour toutes, dans un dossier lisible par l'utilisateur « node »,
# pour ne pas dépendre du réseau au démarrage.
ENV COREPACK_HOME=/opt/corepack
RUN corepack prepare --activate pnpm@10.28.0 && chmod -R a+rX /opt/corepack
COPY --from=build --chown=node:node /app /app
# Utilisateur sans privilèges.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start"]
