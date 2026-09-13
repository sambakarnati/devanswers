# DevAnswers

A Stack Overflow–style Q&A app: post questions, answer them, vote, tag, bookmark, and get AI-assisted question improvement and answer summarization via Gemini.

The repo holds two independent Node projects — there is no root `package.json` or workspace tooling, so `cd` into each before running commands.

- `devanswers-backend/` — Express 5 + MongoDB (Mongoose) REST API
- `devanswers-frontend/` — React 19 + Vite SPA, Redux Toolkit for state

## Features

- Questions and answers with Markdown-friendly bodies, tags, and comma-separated tag search
- Upvote/downvote on both questions and answers
- Bookmarking questions
- Edit/delete your own posts (author or admin only)
- JWT-based auth (register/login)
- AI-assisted question improvement and answer summarization (Google Gemini)

## Prerequisites

- Node.js (a recent LTS version)
- A MongoDB instance (local, or a hosted cluster such as MongoDB Atlas)
- A Google Gemini API key for the AI features

## Getting started

### Backend (`devanswers-backend/`)

```bash
cd devanswers-backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, etc.
npm install
npm run populate       # optional: wipes and reseeds MongoDB with sample data
npm run dev            # nodemon main.js — dev server, default PORT=5011 here
```

Environment variables (see `.env.example`): `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRATION`, `GEMINI_API_KEY`, `PORT`.

### Frontend (`devanswers-frontend/`)

```bash
cd devanswers-frontend
cp .env.example .env   # set VITE_API_BASE_URL if the backend isn't on the default port
npm install
npm run dev            # vite dev server
```

`VITE_API_BASE_URL` falls back to `http://localhost:5011/api` if unset — point it at wherever the backend is actually running.

## Testing

```bash
# backend
cd devanswers-backend && npm test        # vitest — unit + integration (in-memory MongoDB)

# frontend
cd devanswers-frontend && npm test       # vitest — jsdom + MSW-mocked API
cd devanswers-frontend && npm run lint
```

## Architecture

Backend is layered with a single direction of dependency: **routes → controllers → services → models**. Controllers stay thin (no try/catch — Express 5 forwards rejected promises to the error handler automatically); services hold the business logic and raise errors via `createAppError`. See `CLAUDE.md` for a fuller architectural walkthrough of both projects, including state management, AI integration, and testing conventions.

## Docker

Both projects ship a `Dockerfile` for containerized deployment.

```bash
# Backend — image listens on 8080; secrets are supplied at run time, never baked in
cd devanswers-backend
docker build -t devanswers-backend .
docker run -d --name devanswers-backend --restart unless-stopped \
  --env-file .env -p 8080:8080 devanswers-backend

# Frontend — Vite inlines env vars at BUILD time, so pass the API URL as a build arg
cd devanswers-frontend
docker build --build-arg VITE_API_BASE_URL=http://<backend-host>:8080/api \
  -t devanswers-frontend .
docker run -d --name devanswers-frontend --restart unless-stopped \
  -p 3000:3000 devanswers-frontend
```

## Specs

Feature specs and their implementation plans live under `specs/` (e.g. `001-bookmarks.md`, `002-edit-posts.md`).
