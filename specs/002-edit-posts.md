# Feature Spec: Edit Your Posts

## Problem / motivation

Once a user posts a question or an answer, there is no way to fix it — a typo, a
missing detail, a wrong tag, or a clarification the user thinks of later all require
either living with the mistake or asking a moderator to intervene (no such moderator
flow exists either). This is friction for the ordinary editing workflow every Q&A site
supports: "I said this imperfectly, let me fix my own words."

The backend already has the ownership-checked update endpoints this needs
(`PUT /api/questions/:id`, `PUT /api/answers/:answerId` — see `updateQuestionService`/
`updateAnswerService` in `src/services/`), but nothing in the frontend calls them: no
edit affordance, no edit form, no thunk, no service wrapper. This feature closes that
gap end-to-end and tightens the backend's existing validation and "was this edited"
signal along the way (see Data model changes and Edge cases).

## User stories

1. As a logged-in user viewing a question I authored (on that question's own detail
   page), I want to edit its title, description, and tags, so I can fix mistakes or add
   detail without asking anyone else to do it.
2. As a logged-in user viewing an answer I authored (on the question page it belongs
   to), I want to edit its text, so I can correct or improve what I wrote.
3. As any user reading a question or answer, I want to see when it's been edited, so I
   know the content isn't exactly what it was when first posted.
4. As a user who opens the edit form by mistake, I want to cancel and discard my
   changes, so an accidental click doesn't cost me my original content.
5. As a user who is not the author of a question or answer, I should not be able to
   edit it — the affordance shouldn't even be there, and the server should refuse it if
   attempted directly.

## Acceptance criteria

1. **Affordance is question-page-only**: The edit pencil for a question appears only
   on that question's own detail page (`QuestionContent`, rendered from
   `QuestionDetail.jsx`). It does not appear on `QuestionCard` (home feed, tag pages, or
   the Profile bookmarks list) — those keep rendering questions read-only.
2. **Affordance is author-gated**: On the question detail page, the pencil next to the
   question shows only when `question.author._id` matches the logged-in user's id;
   likewise for each answer's pencil in `AnswerList`, gated on `answer.author._id`. A
   logged-out visitor, or a logged-in user viewing someone else's question/answer, sees
   no pencil at all (not a disabled one).
3. **Opening the form pre-fills current content**: Clicking the question pencil swaps
   the static title/description/tags for a form pre-filled with the question's current
   `title`, `description`, and comma-joined `tags` (by name). Clicking an answer's
   pencil swaps that answer's static text for a form pre-filled with its current
   `answerText`. Only one edit form is open at a time per question page (opening a
   second closes any other open one).
4. **Save persists and updates in place, no reload**: Submitting the question edit form
   calls `PUT /api/questions/:id`; on success, `QuestionContent` (and the page's
   in-memory `currentQuestion`) shows the new title/description/tags immediately with no
   full page reload. Submitting an answer edit form calls `PUT /api/answers/:answerId`;
   on success, that answer's entry in `AnswerList` shows the new text immediately, same
   no-reload behavior.
5. **Cancel discards changes**: Clicking Cancel closes the form and restores the static
   view showing the original (unmodified) content — no request is sent.
6. **Blank/invalid content is rejected, client and server side**:
   - Client: the Save button is disabled (or submission is blocked with an inline
     message) when title or description (question form) / answerText (answer form) is
     empty or all-whitespace after trimming. Tags may be empty (mirrors question
     creation, where tags are optional-in-practice today).
   - Server: `updateQuestionService` rejects an empty/whitespace-only `title` or
     `description` with `createAppError(..., 400)` before touching the database (today
     it does not — see Edge cases); `updateAnswerService` likewise rejects an
     empty/whitespace-only `answerText` with a `400`, not the current unguarded
     `ValidationError`-driven `500`.
7. **Ownership enforced server-side regardless of UI**: A `PUT` to either endpoint from
   an authenticated user who is not the author (and not an admin) is rejected `403`,
   with no change to the document — this already works today
   (`updateQuestionService`/`updateAnswerService`'s existing ownership check) and must
   keep working; this feature does not weaken it.
8. **"Edited" indicator appears only after a real edit**: A question or answer that has
   never been through a successful `PUT` shows no "edited" text anywhere. One that has
   shows an "edited" indicator (e.g. "edited 3 hours ago", reusing the existing
   `formatDate` helper) next to its timestamp, visible to **any** viewer (not just the
   author) — on the question detail page and in the answer list. This indicator must
   **not** be triggered by voting, bookmarking, or view-count increments on the same
   document (see Data model changes for why a plain `updatedAt` check doesn't satisfy
   this, and the new `editedAt` field that does).
9. **Nonexistent id**: Submitting an edit for a question/answer id that no longer
   exists (e.g. deleted in another tab) surfaces the existing `404` as a visible error
   to the user (e.g. alert, matching the existing `PostQuestion`/`AnswerForm` error
   pattern) rather than silently failing.

## API contract

Both endpoints already exist and are unchanged in shape; this feature adds the
frontend calls plus the validation/`editedAt` tightening below. All paths are under the
existing `/api` prefix, guarded by the existing `authenticate` middleware
(`req.user = { id, isAdmin }`).

### `PUT /api/questions/:id`

- **Auth**: required.
- **Request body**: `{ "title": string, "description": string, "tags": string }`
  (`tags` comma-separated, same convention as `POST /api/questions`).
- **Success `200`**:
  ```json
  {
    "success": true,
    "message": "Question updated successfully",
    "data": {
      "_id": "...",
      "title": "...",
      "description": "...",
      "tags": ["<tagId>", "..."],
      "editedAt": "2026-09-06T18:00:00.000Z",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```
  (`tags` here matches the existing `updateQuestionService` return shape — an array of
  ObjectIds, not populated `Tag` docs; the frontend already has `question.tags` as
  populated objects from the preceding `GET`, so the edit thunk re-fetches or merges as
  described in UI changes.)
- **Error responses** (unchanged shape, `{ success: false, message }`):
  - `400` — missing/blank `title` or `description` (**new** validation; see Acceptance
    criterion 6).
  - `401` — no/invalid token.
  - `403` — authenticated but not the author and not an admin.
  - `404` — no question with id `:id` exists.

### `PUT /api/answers/:answerId`

- **Auth**: required.
- **Request body**: `{ "answerText": string }`.
- **Success `200`**:
  ```json
  {
    "success": true,
    "message": "Answer updated successfully",
    "data": {
      "_id": "...",
      "answerText": "...",
      "author": { "_id": "...", "name": "..." },
      "editedAt": "2026-09-06T18:00:00.000Z",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```
- **Error responses**:
  - `400` — missing/blank `answerText` (**new** validation, replaces today's unguarded
    `500` from the Mongoose required-field validator).
  - `401` — no/invalid token.
  - `403` — authenticated but not the author and not an admin.
  - `404` — no answer with id `:answerId` exists.

### Existing `GET /api/questions/:id`

No shape change beyond the new `editedAt` field appearing on the question and on each
item in `answers` once edited (`null`/absent otherwise) — `getQuestionByIdService`
already returns the full documents, so this falls out of the schema change below with
no service-code change needed there.

## Data model changes

### `src/models/Question.js` and `src/models/Answer.js`

Add one field to each, following the existing plain-field convention (e.g. `views` on
`Question`):

```js
editedAt: {
  type: Date,
  default: null,
},
```

**Why not just compare the existing `updatedAt` (from `timestamps: true`) against
`createdAt`, avoiding a schema change?** Because `voteService.js#handleVote` calls
`document.save()` on the same `Question`/`Answer` document to record a vote, and
`getQuestionByIdService` calls `findByIdAndUpdate` to increment `views` — both bump
`updatedAt` on documents that were never content-edited. Using `updatedAt` for the
"edited" indicator would show it on any voted-on or merely-viewed question, which is
wrong per acceptance criterion 8. `editedAt` is set **only** by
`updateQuestionService`/`updateAnswerService`, so it unambiguously means "content was
edited."

### `src/services/questionService.js` — `updateQuestionService`

- Add a guard before the existing tag-processing: if `title.trim()` or
  `description.trim()` is empty, `throw createAppError("Title and description are required", 400)`.
- Change the `Question.findByIdAndUpdate(id, { title, description, tags: tagIds }, { new: true })`
  call to also set `editedAt: new Date()` in the update payload.

### `src/services/answerService.js` — `updateAnswerService`

- Add a guard before the existing `answer.answerText = answerText` assignment: if
  `answerText.trim()` is empty, `throw createAppError("Answer text is required", 400)`.
- Set `answer.editedAt = new Date()` alongside `answer.answerText = answerText` before
  `save()`.

No changes to `User.js` or `Tag.js`. No new collections.

## UI changes

### Components

- **`src/components/Shared/EditControls.jsx`** (new, small shared piece mirroring the
  `VoteButtons`/`BookmarkButton` "shared control" convention): a pencil icon `Button`
  that calls an `onEdit` prop when clicked; rendered only when the caller has already
  determined the current user is the author (the ownership check itself lives in each
  parent, matching how `VoteButtons` takes a precomputed `authorId` rather than
  re-deriving auth state itself... except here there's no "self" restriction to apply,
  just a plain author-match gate done by the parent before rendering this at all).
- **`src/components/Question/QuestionContent.jsx`** (edit): track local `isEditing`
  state. When the logged-in user is the author (`question.author?._id === userInfo?.userId`)
  render the pencil from `EditControls` next to the title. When `isEditing`, render an
  inline form (title input, description textarea, tags input — reusing the same
  `Form.Control` patterns as `PostQuestion.jsx`, no AI-improve assist in this pass — see
  Out of scope) pre-filled from `question`, with Save/Cancel buttons, in place of the
  title/description/tags display. Save dispatches the new `updateQuestion` thunk;
  Cancel resets `isEditing` to `false` with no dispatch. When the question has a
  truthy `editedAt`, render an "edited {formatDate(editedAt)}" span next to the existing
  "Asked {formatDate(createdAt)}" line, visible to all viewers.
- **`src/components/Answer/AnswerList.jsx`** (edit): per answer, same `isEditing`
  pattern (one `editingAnswerId` piece of state for the whole list, so only one answer
  is in edit mode at a time, and opening another closes the first — satisfies
  acceptance criterion 3's "only one form open" for answers). Author check is
  `answer.author?._id === userInfo?.userId`. The inline form is a single textarea
  (mirroring `AnswerForm.jsx`'s textarea) pre-filled with `answer.answerText`, with
  Save/Cancel. Save dispatches the new `updateAnswer` thunk. When an answer has a
  truthy `editedAt`, render "edited {formatDate(editedAt)}" next to its existing
  "Answered by ... • {formatDate(createdAt)}" row.
- **`src/components/Question/QuestionCard.jsx`**: **no change** — confirms acceptance
  criterion 1 (no edit affordance on the list view).

### Redux

- **`src/reducers/questionSlice.js`** (edit):
  - New thunk `updateQuestion({ questionId, title, description, tags })`, modeled on
    `postQuestion`: reads `getState().user.userInfo.token`, calls the new
    `questionService.updateQuestion(...)`, and on success replaces `state.currentQuestion`'s
    `title`/`description`/`tags`/`editedAt` with the response (tags: since the `PUT`
    response returns tag ids rather than populated tag docs — see API contract note —
    the fulfilled reducer re-derives displayable tags by re-fetching the question via
    `fetchQuestionById` rather than merging raw ids into a slot that renders `tag.name`
    elsewhere; simplest correct option, at the cost of one extra request per save).
    Same `try/catch` → `rejectWithValue(error.response?.data?.message || error.message || "Failed to update question")`
    pattern as every other thunk in this slice.
  - New thunk `updateAnswer({ answerId, answerText })`, modeled on `voteAnswer`'s
    "find the answer inside `currentQuestion.answers` and patch it in place" reducer
    pattern: on fulfilled, find the matching answer by `_id` in
    `state.currentQuestion.answers` and replace its `answerText`/`editedAt` from the
    response (the `PUT /api/answers/:answerId` response already includes populated
    `author`, so no re-fetch needed here, unlike the question case).
- No changes to `src/reducers/userSlice.js`.

### Services / config

- **`src/config/config.js`**: `QUESTION_API.UPDATE` and `ANSWER_API.UPDATE` already
  exist (added but unused) — no config change needed.
- **`src/services/questionService.js`**: add `updateQuestion(questionId, { title, description, tags }, token)`,
  following the existing `axiosInstance.put(URL, body, { headers: { Authorization: \`Bearer ${token}\` } })`
  → `res.data.data` pattern.
- **`src/services/answerService.js`**: add `updateAnswer(answerId, answerText, token)`,
  same pattern.

### Routes

No new frontend route — everything happens inline on the existing `/question/:id`
page.

## Edge cases & error handling

- **Concurrent edit by two tabs / stale form**: last write wins (whoever's `PUT` lands
  last overwrites the document) — no optimistic-concurrency check is added; this
  matches the "known, accepted limitation" precedent already set for `handleVote`'s
  race condition in the bookmarks spec.
- **Saving with unchanged content**: still issues the `PUT` and still sets `editedAt`
  (the service has no way to distinguish "you clicked Save but changed nothing" from a
  real edit, and doesn't need to — this is an acceptable, harmless no-op edit timestamp
  bump).
- **Tags field edited to empty string**: mirrors question creation's existing behavter
  (empty tags currently produces one empty-string "tag" after `.split(",")` — a
  pre-existing quirk, not introduced or fixed by this feature; noted here as a
  known gap rather than something this spec's acceptance criteria depend on).
- **Editing a question that gets deleted by its author in another tab first**: the
  `PUT` 404s (see Acceptance criterion 9); the frontend surfaces this as an alert and
  leaves the (now-stale) edit form open rather than crashing.
- **Non-author attempts a direct API call**: `403`, handled identically to the existing
  vote/bookmark ownership pattern — no special UI needed since the affordance was never
  rendered for them; this is purely a "server must still refuse it" defense-in-depth
  requirement (Acceptance criterion 7).
- **Malformed `:id`/`:answerId`**: falls through to the same existing
  Mongoose/`errorHandler` behavior as every other id-taking route — no new handling.
- **Admin editing someone else's post**: the backend's existing `isAdmin` bypass is
  left intact (this feature doesn't touch it), but the frontend affordance stays
  strictly author-gated — there is no existing admin-mode UI pattern anywhere else in
  this app to model an "admin can also see the pencil on others' posts" affordance on,
  so that capability remains API-only for now (out of scope, see below).

## Out of scope

- Delete for questions/answers — `DELETE /api/questions/:id` and
  `DELETE /api/answers/:answerId` already exist and are unused by the frontend, same as
  before this feature; wiring them up is a separate feature (different concerns:
  confirmation UX, cascade effects on answers/votes/bookmarks).
- "Improve with AI" assist inside the edit form (available today only on
  `PostQuestion.jsx` at creation time). Editing is plain-field in this pass.
- Edit history / diff / revision log — only the latest content and a single `editedAt`
  timestamp are kept; no record of what the content used to be.
- A time-boxed edit window (e.g. "can't edit after N minutes/once answered") — editing
  remains available indefinitely, matching the backend's current unrestricted
  ownership-only check.
- Admin-authored edit affordance in the UI for posts the admin doesn't own (see Edge
  cases) — the backend capability already exists and is untouched; only its frontend
  surface is deferred.
- Optimistic-concurrency / conflict detection on simultaneous edits (see Edge cases).
- Any change to how tags are parsed/deduped (the existing comma-split-and-trim
  behavior, quirks included, is reused as-is).

## Test plan

### Backend — unit (`tests/unit/services/`)

Additions to `questionService.test.js` and `answerService.test.js`, mocking
`Question`/`Answer`/`Tag` per the existing `vi.mock(...)` convention:

- `updateQuestionService` with a blank/whitespace-only `title` or `description` throws
  via `createAppError(..., 400)` without calling `Question.findByIdAndUpdate`.
- `updateQuestionService` on a valid edit sets `editedAt` in the
  `findByIdAndUpdate` payload (assert on the call args) and returns the updated
  document.
- `updateQuestionService` by a non-author, non-admin user throws `403` (already
  covered if an existing test does this — extend rather than duplicate if so).
- `updateAnswerService` with a blank/whitespace-only `answerText` throws via
  `createAppError(..., 400)` without calling `answer.save()`.
- `updateAnswerService` on a valid edit sets `answer.editedAt` before `save()` and
  returns the populated, updated document.
- `updateAnswerService` by a non-author, non-admin user throws `403` (extend existing
  coverage if present).

### Backend — integration (`tests/integration/questions.test.js`, `tests/integration/answers.test.js`)

Following the existing register+login-for-a-real-JWT, `supertest`-against-real-`app`
convention:

- `PUT /api/questions/:id` by the author with valid data → `200`, response `data`
  reflects the new title/description/tags and a non-null `editedAt`.
- `PUT /api/questions/:id` by the author with an empty `title` → `400`, question
  unchanged in the DB.
- `PUT /api/questions/:id` by a different logged-in (non-admin) user → `403`, question
  unchanged.
- `PUT /api/questions/:id` with no token → `401`.
- `PUT /api/questions/:id` for a nonexistent id → `404`.
- `GET /api/questions/:id` after an edit shows the new content and `editedAt` set; a
  freshly created, never-edited question's `GET` shows `editedAt` as `null`/absent.
- Same six shapes mirrored for `PUT /api/answers/:answerId` (author success incl.
  `editedAt`, blank `answerText` → `400`, non-author → `403`, no token → `401`,
  nonexistent id → `404`).
- **Vote does not set `editedAt`**: upvoting a question/answer, then `GET`-ing it,
  shows `editedAt` still `null` — proving the new field isn't accidentally bumped by
  the existing vote path (guards acceptance criterion 8's key requirement).

### Frontend — unit (`tests/unit/components/`, `tests/unit/reducers/`)

- `QuestionContent.test.jsx` additions: pencil renders when `question.author._id`
  matches the mocked logged-in user's id, and is absent for a different author id or a
  logged-out store; clicking it shows a pre-filled form; Cancel restores the read-only
  view with original content and dispatches nothing; Save with an emptied title
  disables/blocks submission; an `editedAt`-bearing question shows the "edited ..."
  text, a `null`-`editedAt` question does not.
- `AnswerList.test.jsx` additions: same pencil-gating/pre-fill/cancel/blank-guard/edited
  -indicator cases per answer, plus "opening a second answer's edit form closes the
  first."
- `QuestionCard.test.jsx`: assert no pencil/edit affordance renders even when the
  mocked question's author matches the logged-in user (locks in acceptance criterion 1).
- `questionSlice.test.js` additions: `updateQuestion.fulfilled` updates
  `currentQuestion`; `updateAnswer.fulfilled` patches the matching answer inside
  `currentQuestion.answers`; both `.rejected` branches set the slice's error state via
  the established `rejectWithValue` fallback-message chain.

### Frontend — integration (`tests/integration/`, new `editPosts.test.jsx`)

Following the MSW-backed convention in `tests/mocks/handlers.js` (add `PUT`
handlers for `/questions/:id` and `/answers/:answerId`) plus `tests/mocks/mockData.js`
fixtures:

- Rendering `QuestionDetail` as the question's author, editing the title/description
  and saving, shows the new content on the page with no navigation/reload.
- Rendering `QuestionDetail` as a different logged-in user shows no pencil on the
  question or on answers authored by someone else.
- Editing an answer the current user authored (rendered inside the same question page)
  saves and shows updated text in place.
- Submitting a question edit with an empty title shows a validation message and issues
  no request (assert via the MSW handler not being hit).
