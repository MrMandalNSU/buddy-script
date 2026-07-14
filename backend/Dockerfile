FROM node:24-bookworm-slim AS base
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    DATABASE_URL=postgresql://prisma:prisma@127.0.0.1:5432/prisma_build
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY eslint.config.js ./
COPY src ./src
RUN pnpm build && node --input-type=module -e "await import('./dist/generated/prisma/client.js')"

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/prisma ./prisma
RUN node --import tsx --input-type=module -e "await import('./src/generated/prisma/client.js'); await import('./prisma/seed-data.js'); await import('./src/modules/auth/password.service.js')"
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "-e", "const port=process.env.PORT||4000;fetch('http://127.0.0.1:'+port+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
