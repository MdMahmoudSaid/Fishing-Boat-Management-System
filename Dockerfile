# Image de production pour le VPS — utilisée par le service `app` de
# docker-compose.yml. Build multi-étapes : seule l'étape finale (runner)
# constitue l'image livrée, grâce à `output: "standalone"` (next.config.mjs)
# qui ne trace que les fichiers réellement nécessaires à l'exécution — pas
# besoin d'installer node_modules en entier dans l'image finale.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* est inlinée dans le bundle JS côté client au moment du build
# (pas lisible depuis process.env au runtime) — doit donc être fournie ici en
# argument de build, pas seulement comme variable d'environnement du
# conteneur final. Voir docs/GETTING_STARTED.md §12.
ARG NEXT_PUBLIC_POWERSYNC_URL
ENV NEXT_PUBLIC_POWERSYNC_URL=${NEXT_PUBLIC_POWERSYNC_URL}
ENV NODE_ENV=production

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root : bonne pratique, limite l'impact d'une éventuelle
# faille dans une dépendance du serveur Next.js.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
