# Build context is the repo root (npm workspaces need the root package.json +
# lockfile). On Railway: set this service's Dockerfile path to
# "apps/web/Dockerfile" and its root directory to the repo root.
#
# VITE_API_BASE_URL is baked into the bundle at BUILD time (Vite env vars are
# static), so it must be set as a build-time variable on this service, pointing
# at the deployed API's public URL + "/api", e.g. https://my-api.up.railway.app/api

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/web apps/web
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace apps/web

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14

COPY --from=build /repo/apps/web/dist ./dist

EXPOSE 4173
# -s enables SPA fallback (unknown paths -> index.html) so client-side routes
# like /automations/new work on a hard refresh. Listens on Railway's $PORT.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-4173}"]
