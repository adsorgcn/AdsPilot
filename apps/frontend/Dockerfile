FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Install workspace dependencies
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages ./packages

# Install root dependencies first
RUN npm install --no-audit --no-fund

# Then ensure frontend workspace dependencies are properly installed
RUN npm install --workspace=apps/frontend --no-audit --no-fund

FROM deps AS builder
WORKDIR /app

# Supabase环境变量
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG SUPABASE_SERVICE_KEY=""

# 其他配置
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_SITE_URL=""

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

COPY apps/frontend ./apps/frontend

RUN npm run --workspace apps/frontend build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080

# For monorepo: standalone output is in the app directory itself, not in a subdirectory
# Copy the entire standalone output (includes server.js and all pages)
COPY --from=builder /app/apps/frontend/.next/standalone ./
# Copy static files - these need to go into .next/static at the root of standalone
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
# Copy public files
COPY --from=builder /app/apps/frontend/public ./public

# Debug: List the dashboard files to verify they exist
RUN ls -la .next/server/app/dashboard/ || echo "WARNING: Dashboard files not found!"

EXPOSE 8080

# In standalone mode, server.js is generated at the root level of standalone output
CMD ["node", "server.js"]
