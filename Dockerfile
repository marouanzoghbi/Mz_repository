# Single-service production build: compiles the API and the web dashboard,
# then serves both from one Express process (apps/api/src/app.ts serves the
# web build as static files + SPA fallback when apps/api/public/index.html
# exists). One image, one deploy, one domain — no CORS/cross-origin wiring
# needed. See docs/DEPLOY_RENDER.md.
#
# For a two-service deploy instead (API and web scaled/hosted separately),
# use apps/api/Dockerfile and apps/web/Dockerfile with docs/DEPLOY_RAILWAY.md.

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/web apps/web

RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api
RUN npm run build --workspace apps/web

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/apps/web/dist ./apps/api/public

EXPOSE 4000
# Applies any pending Prisma migrations against DATABASE_URL, then starts the
# server. Safe to run on every deploy: it's a no-op once the schema is current.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
