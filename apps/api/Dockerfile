# Build context is the repo root (npm workspaces need the root package.json +
# lockfile). On Railway: set this service's Dockerfile path to
# "apps/api/Dockerfile" and its root directory to the repo root.

FROM node:20-alpine AS build
# Prisma's engine binaries are dynamically linked against OpenSSL, which
# Alpine doesn't ship by default — without it, prisma generate/migrate fail
# with a cryptic "Could not parse schema engine response" error.
RUN apk add --no-cache openssl
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api

EXPOSE 4000
# Applies any pending Prisma migrations against DATABASE_URL, then starts the
# server. Safe to run on every deploy: it's a no-op once the schema is current.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
