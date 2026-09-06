# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent Node projects, each with its own `package.json` — there is no root package.json or workspace tooling. Always `cd` into the relevant project before running commands.

- `devanswers-backend/` — Express 5 + MongoDB (Mongoose) REST API
- `devanswers-frontend/` — React 19 + Vite SPA, Redux Toolkit for state

## Commands

### Backend (`devanswers-backend/`)
```
npm run dev          # nodemon main.js — dev server (reads .env, default PORT=5011 here)
npm start            # node main.js — no reload
npm test             # vitest run — unit + integration tests
npx vitest run tests/unit/services/questionService.test.js   # single file
npx vitest run -t "should return all questions"               # single test by name
npm run populate     # node src/scripts/populate-db.js — wipes and reseeds MongoDB from src/scripts/seed-data.js
```
Requires `.env` (see `.env.example`): `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRATION`, `GEMINI_API_KEY`, `PORT`.

### Frontend (`devanswers-frontend/`)
```
npm run dev          # vite dev server
npm run build        # vite build
npm run lint         # eslint .
npm test             # vitest run (jsdom + MSW)
npx vitest run tests/unit/components/QuestionCard.test.jsx   # single file
```
`src/api/axiosInstance.js` reads the API base URL from `VITE_API_BASE_URL` (see `.env.example`), falling back to `http://localhost:5011/api` if unset — set it in `.env` if the backend runs elsewhere.

## Backend architecture

Layered, one direction of dependency: **routes → controllers → services → models**.

- `main.js` connects to MongoDB (`db.js`) then starts the HTTP server (`server.js`, which just wraps `app.listen`). `src/app.js` wires up helmet, rate limiting (100 req/15min), CORS, JSON body parsing, mounts the API router at `/api`, and the error handler last.
- `src/routes/index.js` mounts `auth`, `questions`, `answers`, `tags` sub-routers. Routes declare which endpoints need `authenticate` (JWT) middleware inline (see `src/routes/questions.js`) — public reads, protected writes/votes.
- Controllers (`src/controllers/*`) are thin: pull data from `req`, call one service function, shape the `{ success, message, data }` response. **They have no try/catch** — Express 5 auto-forwards rejected promises from async handlers to `errorHandler`, so don't add try/catch in new controllers either.
- Services (`src/services/*`) hold all business logic and Mongoose calls. Errors are raised via `createAppError(message, statusCode)` (`src/utils/createAppError.js`), which `src/middleware/errorHandler.js` turns into the JSON error response (adds `stack` only when `NODE_ENV=development`).
- Voting (upvote/downvote) for both Questions and Answers is unified through `src/services/voteService.js#handleVote(Model, id, userId, voteType)` — it toggles the user in/out of `upvotes`/`downvotes` arrays and recomputes `voteCount`. Reuse this instead of writing new vote logic.
- Tags: `createQuestionService`/`updateQuestionService` take a comma-separated `tags` string, split/trim it, and find-or-create each `Tag` doc — tags are stored as ObjectId refs on `Question`, not strings.
- AI features (question improvement, answer summarization) go through `src/utils/geminiClient.js`, which lazily constructs a singleton `GoogleGenAI` client from `GEMINI_API_KEY` and exposes `extractJSON(text)` to pull a JSON object out of the model's raw text response (the prompt asks for JSON-only, but responses aren't guaranteed clean). See `improveQuestionService` in `questionService.js` for the prompt-and-parse pattern to follow for new AI endpoints.
- Auth: `authHandler.js` verifies the `Authorization: Bearer <token>` JWT and attaches `req.user = { id, isAdmin }` (password excluded). Ownership checks (`question.author.toString() !== loggedInUser.id.toString()`) plus `isAdmin` gate updates/deletes in services, not middleware.

### Backend testing
- `tests/unit/**` mock models/services with `vi.mock(...)` and test one layer in isolation (see `tests/unit/services/questionService.test.js`).
- `tests/integration/**` boot the real Express `app` against an in-memory MongoDB (`tests/setup.js` uses `mongodb-memory-server`, `beforeAll`/`afterAll` globally) and drive it with `supertest`; they register+login a real user per test file to get a JWT rather than mocking auth.
- `vitest.config.js` sets `fileParallelism: false` (shared in-memory Mongo instance) and long timeouts (60s) for Mongo startup — keep that in mind if tests seem slow rather than hung.

## Frontend architecture

- Routing (`src/App.jsx`) nests most pages under `SideBarLayout` inside `BaseLayout`; `/login` and `/register` render outside the sidebar layout.
- State is Redux Toolkit (`src/store.js`): `user` (auth/session, persisted to `localStorage` under `userInfo`), `question` (questions/answers list + current question + loading/error), `theme`. Async API calls go through `createAsyncThunk` in `src/reducers/*Slice.js`, each with try/catch → `rejectWithValue(error.response?.data?.message || error.message || <fallback>)` — follow this pattern for new thunks rather than throwing raw errors.
- API calls: `src/services/*Service.js` wrap `axiosInstance` (`src/api/axiosInstance.js`) calls per resource, using path builders from `src/config/config.js` (`AUTH_API`, `QUESTION_API`, `ANSWER_API`, `TAG_API`, `USER_API`, `AI_API`). Add new endpoints there rather than inlining URL strings.
- Auth token is passed explicitly as a function arg into service calls (`Authorization: Bearer ${token}` header per-call), not via an axios interceptor — thunks read the token from `getState().user.userInfo.token`.
- `src/services/aiService.js` calls the backend's Gemini-backed endpoints (`improveQuestion`, `summarizeAnswers`) — used from the question-post and question-detail flows.

### Frontend testing
- Vitest + `@testing-library/react` + jsdom (`vite.config.js` test block). `tests/setup.js` starts an MSW server (`tests/mocks/server.js`, handlers in `tests/mocks/handlers.js`, fixtures in `tests/mocks/mockData.js`) so component/integration tests hit mocked HTTP responses instead of a real backend.
- `tests/unit/**` covers individual components/pages/reducers; `tests/integration/**` covers multi-component flows (auth, question, answer, tag) through rendered pages plus MSW.
