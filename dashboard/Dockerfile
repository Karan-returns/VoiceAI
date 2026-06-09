# syntax=docker/dockerfile:1
# QA dashboard — Vite static build + Express API.
# Build: docker build -t novatel-dashboard .
# Run:   docker run -p 3456:3456 --env-file .env novatel-dashboard

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

ENV NODE_ENV=production
EXPOSE 3456

CMD ["npm", "start"]
