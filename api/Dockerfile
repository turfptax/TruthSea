# TruthSea Event Indexer — Railway/Fly.io deployment
# This runs the persistent event indexer that syncs Base Sepolia → Postgres

FROM node:20-slim

# Prisma needs OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Build
RUN npx tsc

# Run indexer by default (override with CMD for API server)
CMD ["node", "dist/indexer/sync.js"]
