# Feature Spec: Bookmarks

## Problem / motivation

Logged-in users have no way to save a question for later. Once a user navigates away
from a question in the list or finishes reading it, the only way back is to search or
scroll until they find it again. This is friction for the common workflow of "I found
something useful, I want to come back to it" — e.g. a user researching a topic across
multiple questions, or someone who wants to track a question they asked a
clarifying-follow-up on but haven't fully answered yet.

Bookmarks let a logged-in user mark a question as saved with one click, and see the
full list of everything they've saved from their profile page, without changing what
any other user sees on that question (bookmarks are private, and do not affect
`voteCount`, ordering, or any other public signal).

## User stories

1. As a logged-in user, I want to bookmark a question from the question list or the
   question detail page, so I can find it again later without searching.
2. As a logged-in user, I want to un-bookmark a question I previously saved, so my
   saved list only contains things I still care about.
3. As a logged-in user, I want to see all my bookmarked questions from my profile page,
   so I have one place to revisit everything I've saved.
4. As a logged-in user, I want to see at a glance (via a filled vs. outline icon) which
   questions I've already bookmarked, whether I'm looking at the question list or the
   question detail page.
5. As a visitor who isn't logged in, I want to be told to log in if I try to bookmark a
   question, so I understand why the action didn't do anything.

## Acceptance criteria

1. **Toggle on**: Given a logged-in user viewing a question they have not bookmarked,
   when they click the bookmark control, then the question is added to their bookmarks
   and the control immediately shows the "bookmarked" (filled) state.
2. **Toggle off**: Given a logged-in user viewing a question they have already
   bookmarked, when they click the bookmark control, then the question is removed from
   their bookmarks and the control immediately shows the "not bookmarked" (outline)
   state.
3. **Idempotent per click**: Each click toggles exactly once — clicking bookmark then
   un-bookmark then bookmark again on the same question results in the question being
   bookmarked (present exactly once in the user's list, no duplicates).
4. **Own questions are bookmarkable**: A user can bookmark a question they themselves
   authored; the toggle behaves identically to bookmarking someone else's question.
5. **Persists across sessions**: A bookmark set by a user is still present (survives
   logout/login, page reload) until explicitly toggled off.
6. **Private**: Bookmarking or un-bookmarking a question does not change that question's
   `voteCount`, does not appear on any other user's view of the question, and is not
   exposed via any endpoint keyed by another user's id.
7. **Requires auth**: An unauthenticated request to bookmark/un-bookmark a question is
   rejected with `401` and no state change; the frontend bookmark control for a logged
   -out visitor either prompts for login (matching the existing `VoteButtons` auth-guard
   pattern) or is not rendered as clickable.
8. **Profile listing**: Given a logged-in user with N bookmarked questions, when they
   open their profile page, then they see all N questions listed (title, and enough
   metadata to identify/open each one), and the list is empty (with an empty-state
   message) when N is 0.
9. **Listing reflects current questions**: If a bookmarked question is deleted, it no
   longer appears in the user's bookmark list (removed automatically, or filtered out
   at read time — orphaned references must not surface as broken entries or crash the
   listing).
10. **Bookmarking a nonexistent question** returns `404` and does not modify the user's
    bookmark array.
11. **Bookmark state is per-user**: two different logged-in users bookmarking the same
    question do not affect each other's bookmark state or count.

## API contract

All endpoints are mounted under the existing `/api` prefix. Auth follows the existing
`authenticate` middleware (`src/middleware/authHandler.js`), which populates
`req.user = { id, isAdmin }` from the JWT `Authorization: Bearer <token>` header.

### `POST /api/questions/:id/bookmark`

Toggles the bookmark state of question `:id` for the logged-in user. Mirrors the
existing `POST /api/questions/:id/upvote` / `downvote` sibling routes in
`src/routes/questions.js`, added alongside them with the same `authenticate` guard.

- **Auth**: required.
- **Request body**: none.
- **Success `200`**:
  ```json
  {
    "success": true,
    "message": "Question bookmarked successfully",
    "data": { "bookmarked": true }
  }
  ```
  (`"message"` reads `"Question bookmark removed successfully"` and `"bookmarked": false`
  on the toggle-off branch of the same call.)
- **Error responses** (shape per existing `errorHandler`: `{ success: false, message }`):
  - `401` — no/invalid token (existing `authenticate` behavior, unchanged).
  - `404` — no question with id `:id` exists (`createAppError("Question not found", 404)`).

### `GET /api/questions/bookmarked`

Returns the logged-in user's bookmarked questions, populated the same way
`GET /api/questions` populates list results (author, tags), most-recently-bookmarked
first.

> **Route ordering note**: this path must be registered in `src/routes/questions.js`
> **before** `GET /:id`, otherwise Express matches `"bookmarked"` against the `:id`
> param and this route is unreachable. This follows the file's existing
> most-specific-first convention.

- **Auth**: required.
- **Query params**: none for v1 (see Out of scope — no pagination).
- **Success `200`**:
  ```json
  {
    "success": true,
    "message": "Bookmarked questions retrieved successfully",
    "data": [
      {
        "_id": "...",
        "title": "...",
        "description": "...",
        "tags": [{ "_id": "...", "name": "..." }],
        "author": { "_id": "...", "name": "..." },
        "voteCount": 0,
        "views": 0,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
  ```
- **Error responses**:
  - `401` — no/invalid token.

### Existing `GET /api/questions/:id` and `GET /api/questions`

No shape change proposed for v1 (see Out of scope: no `isBookmarked` flag baked into
list/detail responses server-side). The frontend derives "is this question bookmarked"
client-side from the bookmarked-ids list fetched once per session (see UI changes).

## Data model changes

### `src/models/User.js`

Add one field, following the existing `{ type: [{ type: ObjectId, ref: ... }], default: [] }`
array-of-reference convention already used for `Question.upvotes`/`downvotes`:

```js
bookmarkedQuestions: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  default: [],
},
```

No changes to `Question.js` or `Answer.js` — bookmarks are one-directional
(User → Question) per the chosen data-model direction, unlike votes which are stored on
the target document. This keeps "list my bookmarks" a single `User.findById(...).populate(...)`
with no new index needed on `Question`.

No new collection is introduced.

## UI changes

### Components

- **`src/components/Shared/BookmarkButton.jsx`** (new): a small icon button
  (outline/filled bookmark icon) mirroring the auth-guard idiom in
  `src/components/Shared/VoteButtons.jsx` (`isAuthenticated` check → alert/prompt if
  logged out; `e.preventDefault()`/`stopPropagation()` since it lives inside clickable
  cards) but with **no** self-bookmark restriction (per acceptance criterion 4). Takes
  `questionId`, `isBookmarked`, `onToggle` props.
- **`src/components/Question/QuestionCard.jsx`** (edit): render `BookmarkButton` in the
  stats column, alongside the existing vote controls and answer-count.
- **`src/components/Question/QuestionContent.jsx`** (edit, question-detail page header):
  render `BookmarkButton` next to the existing vote controls.
- **`src/pages/Profile/Profile.jsx`** (edit): add a "Bookmarked Questions" section that
  lists the user's bookmarks (reusing `QuestionCard` per entry) with an empty-state
  message when there are none. Fetches via a new thunk on mount, the same way the
  existing (currently dead-end) stats fetch does.

### Redux

- **`src/reducers/questionSlice.js`** (edit):
  - New state: `bookmarkedQuestionIds: []` (a `Set`-like array of ids the current user
    has bookmarked, hydrated once after login/app load) and `bookmarkedQuestions: []`
    (the full populated list, for the Profile page) plus matching loading/error fields
    — following the existing `questions`/`currentQuestion`/`loading`/`error` shape.
  - New thunk `toggleBookmarkQuestion({ questionId })`, modeled directly on the existing
    `voteQuestion` thunk: reads `getState().user.userInfo.token`, calls the new
    `questionService.toggleBookmarkQuestion(questionId, token)`, and on success updates
    `bookmarkedQuestionIds` (add/remove `questionId`) — same `try/catch` →
    `rejectWithValue(error.response?.data?.message || error.message || "Bookmark failed")`
    pattern as every other thunk in this slice.
  - New thunk `fetchBookmarkedQuestions()`, modeled on `fetchQuestions`, populating
    `bookmarkedQuestions` for the Profile page.
- No changes to `src/reducers/userSlice.js` — bookmark ids live in `questionSlice`
  rather than persisted `userInfo`/`localStorage`, since they need to reflect live
  toggles and full question data, not just auth/session state.

### Services / config

- **`src/config/config.js`**: add to `QUESTION_API`:
  ```js
  BOOKMARK: (id) => `/questions/${id}/bookmark`,
  GET_BOOKMARKED: "/questions/bookmarked",
  ```
- **`src/services/questionService.js`**: add `toggleBookmarkQuestion(questionId, token)`
  and `getBookmarkedQuestions(token)`, following the existing
  `axiosInstance.<verb>(URL, ..., { headers: { Authorization: \`Bearer ${token}\` } })`
  → `res.data.data` pattern used by `upvoteQuestion`/`downvoteQuestion`.

### Routes

No new frontend route. The bookmarks list lives inside the existing `/profile` route
(`src/App.jsx`), as a new section rather than a separate page.

## Edge cases & error handling

- **Double-click / rapid toggling**: the toggle is a single atomic array
  push/pull-and-save per request (mirroring `handleVote`'s approach); two concurrent
  toggle requests for the same user+question racing is a known, accepted limitation
  (see Out of scope) rather than something this feature adds new protection for beyond
  what `handleVote` already lacks.
- **Bookmarking a question that gets deleted afterward**: the question id remains in
  `User.bookmarkedQuestions` until cleaned up; `GET /api/questions/bookmarked` must
  `populate()` and filter out entries that fail to resolve (deleted question) rather
  than return null/broken entries (acceptance criterion 9). Deleting a question does
  **not** proactively pull itself out of every user's `bookmarkedQuestions` array in v1
  (see Out of scope) — the filter-at-read-time approach is the chosen mitigation.
- **Unauthenticated toggle attempt**: rejected `401` by the existing `authenticate`
  middleware before reaching the controller/service — no special-casing needed.
- **Toggling a question id that doesn't exist**: service must check existence (e.g.
  `Question.exists({ _id: id })` or check the result of the array-mutation query) and
  throw `createAppError("Question not found", 404)` before touching `User`.
- **Malformed `:id` (invalid ObjectId)**: falls through to the existing error handling
  Mongoose/`errorHandler` already applies elsewhere in the codebase for malformed ids
  on `Question`/`Answer` routes — no new handling proposed, for consistency.
- **User with a very large bookmark list**: no pagination in v1 (see Out of scope);
  acceptable for the current expected scale of the app (same assumption `GET /api/questions`
  already makes with no pagination).

## Out of scope

- Public bookmark counts or "N people bookmarked this" indicators on questions.
- Bookmarking answers, tags, or users — only questions are bookmarkable in this pass.
- Pagination, sorting, or filtering of the bookmarks list (mirrors current
  `GET /api/questions` behavior — no pagination exists there either).
- Folders/labels/collections for organizing bookmarks.
- Proactively removing a question id from every user's `bookmarkedQuestions` array when
  that question is deleted (handled by filter-at-read-time instead, see Edge cases).
- Race-condition locking on concurrent toggle requests for the same user+question
  (same limitation as the existing `handleVote` implementation).
- Fixing the existing dead `/auth/stats/:userId` endpoint referenced by `Profile.jsx` —
  noted here as a pre-existing gap discovered during research, not something this
  feature depends on or fixes. The new "Bookmarked Questions" section is additive to
  the Profile page and does not touch the existing (currently non-functional) stats
  section.

## Test plan

### Backend — unit (`tests/unit/services/`)

New `tests/unit/services/bookmarkService.test.js` (or additions to
`questionService.test.js`, matching wherever the toggle logic lives), mocking `User`
and `Question` models per the existing `vi.mock(...)` convention:

- toggling a not-yet-bookmarked question adds its id to `bookmarkedQuestions` and
  returns `{ bookmarked: true }`.
- toggling an already-bookmarked question removes it and returns `{ bookmarked: false }`.
- toggling twice in a row does not create a duplicate entry.
- toggling a nonexistent question id throws via `createAppError(..., 404)`.
- fetching bookmarked questions for a user with an orphaned (deleted) question
  reference filters it out rather than throwing or returning a null entry.

### Backend — integration (`tests/integration/bookmark.test.js`, new)

Following `tests/integration/vote.test.js`'s conventions exactly (in-memory Mongo via
`tests/setup.js`, register+login helper for a real JWT, `supertest` against the real
`app`):

- `POST /api/questions/:id/bookmark` without a token → `401`.
- `POST /api/questions/:id/bookmark` with a valid token on an existing question → `200`,
  `data.bookmarked === true`; a second call on the same question → `200`,
  `data.bookmarked === false`.
- `POST /api/questions/:id/bookmark` with a valid token on a nonexistent question id →
  `404`.
- `GET /api/questions/bookmarked` without a token → `401`.
- `GET /api/questions/bookmarked` after bookmarking two questions returns exactly those
  two, populated with `author`/`tags`.
- Two different logged-in users bookmarking the same question: each user's
  `GET /api/questions/bookmarked` reflects only their own toggle, confirming
  per-user isolation (acceptance criterion 11).
- A user bookmarking their own authored question succeeds (acceptance criterion 4).

### Frontend — unit (`tests/unit/components/`, `tests/unit/reducers/`)

- `BookmarkButton.test.jsx`: renders outline icon when `isBookmarked=false`, filled icon
  when `true`; clicking calls `onToggle`; clicking while logged out shows the
  login-required prompt and does not call `onToggle` (mirroring
  `VoteButtons.test.jsx`'s logged-out-guard test, if one exists — otherwise modeled on
  its `handleVote` guard behavior).
- `questionSlice.test.js` additions: `toggleBookmarkQuestion.fulfilled` adds/removes the
  id from `bookmarkedQuestionIds`; `.rejected` sets the slice's error state via the
  established `rejectWithValue` fallback-message chain; `fetchBookmarkedQuestions.fulfilled`
  populates `bookmarkedQuestions`.

### Frontend — integration (`tests/integration/`, new `bookmark.test.jsx`)

Following the MSW-backed convention in `tests/mocks/handlers.js` (add handlers for
`POST /questions/:id/bookmark` and `GET /questions/bookmarked`) plus existing
`tests/mocks/mockData.js` fixtures:

- Rendering a question list with a mocked logged-in user shows bookmark icons in their
  correct initial (bookmarked/not) state per fixture data.
- Clicking a bookmark icon on `QuestionCard` toggles its visual state after the mocked
  request resolves.
- Rendering `Profile.jsx` for a user with mocked bookmarked questions shows them listed;
  rendering it for a user with none shows the empty-state message (per
  `tests/unit/pages/profile.test.jsx`'s existing store-mocking pattern).
