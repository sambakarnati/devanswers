# syntax=docker/dockerfile:1

# ---- build: compile the Vite SPA to static files ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines env vars at BUILD time, so the API base URL must be passed here
# (not at `docker run`):
#   docker build --build-arg VITE_API_BASE_URL=http://localhost:8080/api -t devanswers-frontend .
ARG VITE_API_BASE_URL=http://localhost:8080/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- runtime: serve the built files with nginx ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
