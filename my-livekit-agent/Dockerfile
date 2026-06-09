# syntax=docker/dockerfile:1
# LiveKit Cloud agent image for NovaTel voice worker.
# Build: docker build -t novatel-agent .
# Run:   docker run --env-file .env novatel-agent

FROM node:22-slim AS base
WORKDIR /app

FROM base AS build

RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm run download-files

FROM base

RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG UID=10001
RUN adduser \
  --disabled-password \
  --gecos "" \
  --home "/app" \
  --shell "/sbin/nologin" \
  --uid "${UID}" \
  appuser

COPY --from=build --chown=appuser:appuser /app /app

USER appuser
ENV NODE_ENV=production

CMD ["node", "dist/agent.js", "start"]
