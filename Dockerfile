# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install first, keyed only off the manifests, so source edits don't bust
# the dependency-install cache layer.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/web packages/web

# packages/shared ships as TS source for tsx/Vite in dev (fast, no build
# step needed there); the runtime image can't run tsx, so it gets compiled
# here and re-pointed at the compiled output — an image-local patch only,
# the committed package.json is untouched.
RUN npm run build -w @gatefold/shared && node -e " \
  const fs = require('node:fs'); \
  const p = 'packages/shared/package.json'; \
  const j = JSON.parse(fs.readFileSync(p, 'utf8')); \
  j.main = 'dist/index.js'; \
  j.types = 'dist/index.d.ts'; \
  delete j.exports; \
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n'); \
  "

RUN npm run build -w @gatefold/server
RUN npm run build -w @gatefold/web

# Drop tsx/vite/typescript/etc. — nothing past this line needs them.
RUN npm prune --omit=dev

# ---- runtime ----------------------------------------------------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini su-exec
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8888
ENV CONFIG_DIR=/config

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /config \
 && chown -R node:node /app /config \
 && chmod +x /docker-entrypoint.sh

EXPOSE 8888
VOLUME /config

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8888/api/health || exit 1

# Stays root here — the entrypoint fixes /config ownership (it may be a
# freshly bind-mounted host dir with different uid/gid) and drops to `node`
# itself before exec'ing the app.
ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "packages/server/dist/index.js"]
