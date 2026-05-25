# Step 1: Build the Next.js project
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source files and build
COPY . .
RUN npm run build

# Step 2: Run the built Next.js server
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Set standard Cloud Run port environment variable fallback
ENV PORT=8080

# Copy only necessary runtime assets
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Next.js automatically honors the PORT env var when running 'next start'
EXPOSE 8080

CMD ["npm", "start"]
