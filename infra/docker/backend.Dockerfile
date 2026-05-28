# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY . .
RUN npm --workspace @afrogate/shared run build
RUN npm --workspace @afrogate/backend run build

FROM node:22-bookworm-slim AS production-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace @afrogate/backend --workspace @afrogate/shared --include-workspace-root=false

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=7000

COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=production-deps --chown=node:node /app/package.json ./package.json
COPY --from=production-deps --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=production-deps --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=production-deps --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/apps/backend/dist ./apps/backend/dist
COPY --from=build --chown=node:node /app/apps/backend/scripts ./apps/backend/scripts
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/infra/postgres ./infra/postgres

RUN mkdir -p /var/lib/afrogate && chown -R node:node /app /var/lib/afrogate

USER node
EXPOSE 7000

CMD ["node", "apps/backend/dist/main.js"]
