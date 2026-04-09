FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

USER node

EXPOSE 5000

CMD ["node", "dist/main.js"]
