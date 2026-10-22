# Multi-stage / Hardened Node.js Dockerfile
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

# Production Image
FROM node:20-alpine

# Set node environment
ENV NODE_ENV=production
ENV LOG_DIR=/var/log/app

WORKDIR /usr/src/app

# Hardening: Create non-root user and group (UID 10001)
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

# Create logs directory and assign ownership
RUN mkdir -p /var/log/app && \
    chown -R appuser:appgroup /var/log/app /usr/src/app

# Copy dependencies and application code
COPY --chown=appuser:appgroup --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

# Ensure app directory permissions
RUN chmod -R 755 /usr/src/app

# Security: Switch to non-root user
USER appuser

# Expose service port
EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start Application
CMD ["node", "server.js"]
