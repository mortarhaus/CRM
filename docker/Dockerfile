# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# node:24.21.0-alpine, pinned by index digest (see docs/DECISIONS.md).
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
RUN npm install -g pnpm@11.6.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm applies patchedDependencies at install (postgres.js and pg-boss, see docs/DECISIONS.md).
COPY patches ./patches
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @crm/web build

FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime
# The base digest above has musl 1.2.6-r2 and zlib 1.3.2-r0, which Trivy flags HIGH (CVE-2026-107891, CVE-2026-85091).
# Install the fixed Alpine builds, pinned exactly (UNI-14). Alpine keeps only the newest build per branch, so when it
# moves on this fails with "unable to select packages": re-pin, or re-pin the base image (docs/DECISIONS.md 2026-11-07).
RUN apk add --no-cache musl=1.2.6-r3 musl-utils=1.2.6-r3 zlib=1.4-r0
# The runtime runs only `node`; removing the bundled package managers shrinks the scanned surface.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=UTC
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/dist ./apps/web/dist
COPY --from=build /repo/apps/web/drizzle ./apps/web/drizzle
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
WORKDIR /app/apps/web
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["web"]
