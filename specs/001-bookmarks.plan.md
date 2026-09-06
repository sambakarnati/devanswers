# Implementation Plan: Bookmarks

Source spec: `specs/001-bookmarks.md`. Sequenced bottom-up (model → service →
controller → route → backend tests → Redux slice → frontend service → component →
wire-up → frontend tests) so each task only depends on ones above it. No code in this
plan — file/function targets only.

---

## 1. Data model

**Edit `devanswers-backend/src/models/User.js`**

- Add field to `userSchema`:
  ```
  bookmarkedQuestions: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    default: [],
  }
  ```
- No changes to `Question.js` or `Answer.js` (per spec's chosen data-model direction —
  bookmarks live only on `User`).

---

## 2. Service layer

**New `devanswers-backend/src/services/bookmarkService.js`**

- `toggleBookmarkService(questionId, userId)`:
  - Verify the question exists (`Question.exists({ _id: questionId })` or equivalent);
    throw `createAppError("Question not found", 404)` if not.
  - Load the `User` doc for `userId`.
  - Check `user.bookmarkedQuestions.includes(questionId)`:
    - present → `user.bookmarkedQuestions.pull(questionId)`, `bookmarked = false`.
    - absent → `user.bookmarkedQuestions.push(questionId)`, `bookmarked = true`.
  - `await user.save()`; return `{ bookmarked }`.
  - Mirrors `handleVote`'s `.includes`/`.pull`/`.push`/`.save()` shape but uses
    `createAppError` (not bare `new Error`, unlike `voteService.js`) per the spec's
    controller/service error convention.
- `getBookmarkedQuestionsService(userId)`:
  - `User.findById(userId).populate({ path: "bookmarkedQuestions", populate: ["author", "tags"] })`
    (match the population shape `GET /api/questions` already uses for `author`/`tags`).
  - Filter out any `null`/unresolved entries from the populated array (orphaned refs to
    deleted questions — spec edge case / acceptance criterion 9).
  - Sort most-recently-bookmarked first — since raw insertion order in a Mongoose array
    already reflects push order, reversing the populated array is sufficient; no extra
    timestamp field needed.
  - Return the filtered/ordered array.

No changes to `voteService.js`, `questionService.js`, or `userService.js` — kept as a
new, separate service file matching the "one concern per service file" pattern already
used (`voteService.js` is its own file despite being invoked from question/answer
controllers).

---

## 3. Controller layer

**New `devanswers-backend/src/controllers/bookmarkController.js`**

- `toggleBookmark(req, res)`:
  - `const { id } = req.params; const userId = req.user.id;`
  - `const { bookmarked } = await toggleBookmarkService(id, userId);`
  - `res.status(200).json({ success: true, message: bookmarked ? "Question bookmarked successfully" : "Question bookmark removed successfully", data: { bookmarked } });`
  - No try/catch (Express 5 auto-forwards, matching every other controller).
- `getBookmarkedQuestions(req, res)`:
  - `const userId = req.user.id;`
  - `const questions = await getBookmarkedQuestionsService(userId);`
  - `res.status(200).json({ success: true, message: "Bookmarked questions retrieved successfully", data: questions });`

Both are thin — identical shape to `upvoteQuestion`/`getAllQuestions` in
`questionController.js`.

---

## 4. Routes

**Edit `devanswers-backend/src/routes/questions.js`**

- Import `toggleBookmark`, `getBookmarkedQuestions` from the new controller.
- Add, **before** the existing `router.get("/:id", getQuestionById)` line (route-
  ordering requirement called out in the spec — otherwise Express matches
  `"bookmarked"` as an `:id` value):
  ```
  router.get("/bookmarked", authenticate, getBookmarkedQuestions);
  ```
- Add alongside the existing `/upvote`/`downvote` routes:
  ```
  router.post("/:id/bookmark", authenticate, toggleBookmark);
  ```
- No changes to `src/routes/index.js` (still mounted under the existing `/questions`
  sub-router — no new top-level resource/router file needed).

---

## 5. Backend tests

**New `devanswers-backend/tests/unit/services/bookmarkService.test.js`**

`vi.mock` the `User` and `Question` models per the existing
`questionService.test.js` convention. Cover:
- toggle on: not-yet-bookmarked question → added, returns `{ bookmarked: true }`.
- toggle off: already-bookmarked question → removed, returns `{ bookmarked: false }`.
- toggling twice does not duplicate the entry.
- nonexistent question id → throws via `createAppError(..., 404)`.
- `getBookmarkedQuestionsService` filters out an orphaned/deleted-question reference
  instead of returning a null entry or throwing.

**New `devanswers-backend/tests/integration/bookmark.test.js`**

Following `tests/integration/vote.test.js`'s conventions (`tests/setup.js` in-memory
Mongo, `supertest` against real `app`, register+login helper for a real JWT). Cover:
- `POST /api/questions/:id/bookmark` no token → `401`.
- `POST /api/questions/:id/bookmark` valid token, existing question → `200`,
  `data.bookmarked === true`; repeat call → `200`, `data.bookmarked === false`.
- `POST /api/questions/:id/bookmark` valid token, nonexistent question id → `404`.
- `GET /api/questions/bookmarked` no token → `401`.
- `GET /api/questions/bookmarked` after bookmarking two questions → exactly those two,
  populated with `author`/`tags`.
- two different logged-in users bookmarking the same question → each user's
  `GET /api/questions/bookmarked` reflects only their own toggle (per-user isolation).
- a user bookmarking their own authored question → succeeds.

Run in isolation before moving to frontend work:
```
cd devanswers-backend && npx vitest run tests/unit/services/bookmarkService.test.js tests/integration/bookmark.test.js
```

---

## 6. Redux slice

**Edit `devanswers-frontend/src/reducers/questionSlice.js`**

- New state fields on the slice's initial state: `bookmarkedQuestionIds: []`,
  `bookmarkedQuestions: []`, plus loading/error fields following the slice's existing
  naming convention for other async fields.
- New thunk `toggleBookmarkQuestion({ questionId })` (modeled on `voteQuestion`):
  - reads `const { token } = getState().user.userInfo || {};`
  - calls `questionService.toggleBookmarkQuestion(questionId, token)`
  - `try/catch` → `rejectWithValue(error.response?.data?.message || error.message || "Bookmark failed")`
  - returns `{ questionId, bookmarked }` on success.
- New thunk `fetchBookmarkedQuestions()` (modeled on `fetchQuestions`):
  - calls `questionService.getBookmarkedQuestions(token)`, returns the array.
- Extra reducers:
  - `toggleBookmarkQuestion.fulfilled` → add/remove `questionId` in
    `bookmarkedQuestionIds` based on `bookmarked`.
  - `fetchBookmarkedQuestions.fulfilled` → set `bookmarkedQuestions`.
  - both `.rejected` cases → set the corresponding error field, following the slice's
    existing `rejectWithValue` handling pattern.

No changes to `userSlice.js` (bookmark ids intentionally kept out of persisted
`userInfo`/`localStorage`, per spec).

---

## 7. Frontend service / config

**Edit `devanswers-frontend/src/config/config.js`**

- Add to `QUESTION_API`:
  ```
  BOOKMARK: (id) => `/questions/${id}/bookmark`,
  GET_BOOKMARKED: "/questions/bookmarked",
  ```

**Edit `devanswers-frontend/src/services/questionService.js`**

- `toggleBookmarkQuestion(questionId, token)`:
  `axiosInstance.post(QUESTION_API.BOOKMARK(questionId), {}, { headers: { Authorization: \`Bearer ${token}\` } })`
  → return `res.data.data`.
- `getBookmarkedQuestions(token)`:
  `axiosInstance.get(QUESTION_API.GET_BOOKMARKED, { headers: { Authorization: \`Bearer ${token}\` } })`
  → return `res.data.data`.

---

## 8. Components

**New `devanswers-frontend/src/components/Shared/BookmarkButton.jsx`**

- Props: `questionId`, `isBookmarked`, `onToggle`.
- Auth-guard idiom copied from `VoteButtons.jsx`: reads `isAuthenticated` via
  `useSelector((state) => state.user)`; on click, `e.preventDefault()` /
  `e.stopPropagation()`; if not authenticated, alert/prompt for login and return
  without calling `onToggle`. **No** self-bookmark restriction (unlike `VoteButtons`'
  self-vote guard) — per spec acceptance criterion 4.
- Renders outline icon when `!isBookmarked`, filled icon when `isBookmarked`.

---

## 9. Wire-up

**Edit `devanswers-frontend/src/components/Question/QuestionCard.jsx`**

- Render `BookmarkButton` in the stats column next to existing vote controls /
  answer-count icon.
- Derive `isBookmarked` from `bookmarkedQuestionIds` in the question slice via
  `useSelector`; `onToggle` dispatches `toggleBookmarkQuestion({ questionId })`.

**Edit `devanswers-frontend/src/components/Question/QuestionContent.jsx`**

- Same wiring as `QuestionCard`, placed next to the existing vote controls in the
  question-detail header.

**Edit `devanswers-frontend/src/pages/Profile/Profile.jsx`**

- On mount, dispatch `fetchBookmarkedQuestions()`.
- Add a "Bookmarked Questions" section rendering `bookmarkedQuestions` (from
  `state.question`) via `QuestionCard` per entry; render an empty-state message when
  the array is empty.
- Purely additive — no changes to the existing (currently non-functional) stats
  section, per spec's Out of scope note.

---

## 10. Frontend tests

**New `devanswers-frontend/tests/unit/components/BookmarkButton.test.jsx`**

- outline icon when `isBookmarked=false`; filled icon when `true`.
- clicking calls `onToggle` when authenticated.
- clicking while logged out shows the login-required prompt and does not call
  `onToggle` (mirrors `VoteButtons`' logged-out-guard test, if present).

**Edit `devanswers-frontend/tests/unit/reducers/questionSlice.test.js`** (or wherever
the slice's existing tests live)

- `toggleBookmarkQuestion.fulfilled` adds/removes the id from `bookmarkedQuestionIds`.
- `toggleBookmarkQuestion.rejected` sets error state via the fallback-message chain.
- `fetchBookmarkedQuestions.fulfilled` populates `bookmarkedQuestions`.

**Edit `devanswers-frontend/tests/mocks/handlers.js`**

- Add MSW handlers for `POST /questions/:id/bookmark` and `GET /questions/bookmarked`,
  matching the `{ data: ... }` response shape the rest of the handlers use.

**New `devanswers-frontend/tests/integration/bookmark.test.jsx`**

- question list with a mocked logged-in user shows bookmark icons in correct initial
  state per fixture data.
- clicking a bookmark icon on `QuestionCard` toggles its visual state after the mocked
  request resolves.
- `Profile.jsx` with mocked bookmarks shows them listed; with none, shows the
  empty-state message (per `tests/unit/pages/profile.test.jsx`'s existing
  store-mocking pattern).

Run before considering the feature done:
```
cd devanswers-frontend && npx vitest run tests/unit/components/BookmarkButton.test.jsx tests/unit/reducers/questionSlice.test.js tests/integration/bookmark.test.jsx
```

---

## Task checklist

- [ ] 1. `User.js` — add `bookmarkedQuestions` field
- [ ] 2. `bookmarkService.js` — `toggleBookmarkService`, `getBookmarkedQuestionsService`
- [ ] 3. `bookmarkController.js` — `toggleBookmark`, `getBookmarkedQuestions`
- [ ] 4. `routes/questions.js` — register `GET /bookmarked` (before `/:id`) and
      `POST /:id/bookmark`
- [ ] 5a. `tests/unit/services/bookmarkService.test.js`
- [ ] 5b. `tests/integration/bookmark.test.js`
- [ ] 6. `questionSlice.js` — state fields, `toggleBookmarkQuestion`,
      `fetchBookmarkedQuestions` thunks + reducers
- [ ] 7a. `config.js` — `BOOKMARK`, `GET_BOOKMARKED` path builders
- [ ] 7b. `questionService.js` — `toggleBookmarkQuestion`, `getBookmarkedQuestions`
- [ ] 8. `BookmarkButton.jsx` — new component
- [ ] 9a. `QuestionCard.jsx` — wire in `BookmarkButton`
- [ ] 9b. `QuestionContent.jsx` — wire in `BookmarkButton`
- [ ] 9c. `Profile.jsx` — "Bookmarked Questions" section
- [ ] 10a. `tests/unit/components/BookmarkButton.test.jsx`
- [ ] 10b. `questionSlice.test.js` additions
- [ ] 10c. `tests/mocks/handlers.js` — MSW handlers for bookmark endpoints
- [ ] 10d. `tests/integration/bookmark.test.jsx`
