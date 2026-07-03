# Build the whole workspace, then produce a slim runtime image that serves
# the API and the built SPA from one container.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Install with a warm cache layer first
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Bundle the API with its production deps only
RUN pnpm --filter @tickets/api --prod deploy --legacy /out \
  && cp -r apps/web/dist /out/public

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
EXPOSE 3000
CMD ["node", "dist/main.js"]
