FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Label with OCI standard fields — used by aibom lineage to trace
# a running container back to its source commit and AIBOM.
ARG GIT_SHA
ARG GIT_REPO
LABEL org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="${GIT_REPO}" \
      org.opencontainers.image.created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

CMD ["node", "dist/research-agent.js"]
