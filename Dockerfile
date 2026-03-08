# Multi-stage build for UFO Atlas application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY website/package*.json ./website/

# Install dependencies
RUN npm ci
RUN cd website && npm ci

# Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/website/node_modules ./website/node_modules

# Copy source code
COPY . .

# Build TypeScript backend
RUN npm run build

# Build frontend
RUN cd website && npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/website/dist ./website/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Expose ports
EXPOSE 3000 5173

# Start the application
CMD ["node", "dist/admin/api-server.js"]
