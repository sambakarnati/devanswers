# syntax=docker/dockerfile:1

# ---- deps: install production dependencies only ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY main.js server.js db.js ./
COPY src ./src

# No .env is baked into the image — supply secrets at run time, e.g.
#   docker run --env-file devanswers-backend/.env -p 8080:8080 devanswers-backend
# Required vars: MONGODB_URI, JWT_SECRET, JWT_EXPIRATION, GEMINI_API_KEY

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 8080

CMD ["node", "main.js"]
