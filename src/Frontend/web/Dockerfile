# syntax=docker/dockerfile:1.7

# =============================================================================
# Multi-stage Dockerfile for the Kalypsis Vite/React frontend.
# Stage 1 (deps + build): npm-ci then `vite build`. Vite's env is baked at
#   build-time, so VITE_API_BASE_URL needs to be passed as a build ARG when
#   the deploy target wants the browser to talk to a public API host.
# Stage 2 (runtime): nginx-alpine serving the static bundle + proxying /api
#   to the api container in the docker-compose network.
# =============================================================================

FROM node:22-alpine AS build
WORKDIR /app

# Cache npm install on a separate layer.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Allow the public API URL to be overridden at build time. When unset, the
# bundle uses the relative "/api" path and relies on nginx to proxy.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# Use 127.0.0.1 instead of `localhost` so the check never depends on the
# resolver's IPv4-vs-IPv6 preference inside the container. Combined with
# nginx's `listen [::]:80;` line in nginx.conf, the service stays green
# even if Coolify's proxy talks to it over either IP family.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
