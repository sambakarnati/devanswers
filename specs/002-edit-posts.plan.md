# Implementation Plan: Edit Your Posts

Source spec: `specs/002-edit-posts.md`. Sequenced bottom-up (model → service →
controller → route → backend tests → Redux slice → frontend service → component →
wire-up → frontend tests) so each task only depends on ones above it. No code in this
plan — file/function targets only.

---

## 1. Data model

**Edit `devanswers-backend/src/models/Question.js`**

- Add field to `questionSchema`, after `author` (following the file's existing
  plain-field style, e.g. `views`):
  ```
  editedAt: {
    type: Date,
    default: null,
  }
  ```

**Edit `devanswers-backend/src/models/Answer.js`**

- Add the identical field to `answerSchema`, after `voteCount`:
  ```
  editedAt: {
    type: Date,
    default: null,
  }
  ```

No changes to `User.js` or `Tag.js`.

---

## 2. Service layer

**Edit `devanswers-backend/src/services/questionService.js` — `updateQuestionService`**

- Immediately after the existing "not found" / ownership checks and before the
  tag-processing block, add:
  ```
  if (!title?.trim() || !description?.trim()) {
    throw createAppError("Title and description are required", 400);
  }
  ```
- Change the existing `Question.findByIdAndUpdate(id, { title, description, tags: tagIds }, { new: true })`
  call's update payload to also set `editedAt: new Date()`.

**Edit `devanswers-backend/src/services/answerService.js` — `updateAnswerService`**

- Immediately after the existing "not found" / ownership checks, before
  `answer.answerText = answerText`, add:
  ```
  if (!answerText?.trim()) {
    throw createAppError("Answer text is required", 400);
  }
  ```
- Set `answer.editedAt = new Date();` alongside the existing
  `answer.answerText = answerText;` line, before `await answer.save()`.

No changes to `voteService.js` (confirms it never touches `editedAt` — this is load-
bearing for acceptance criterion 8 and is explicitly tested in step 5).

---

## 3. Controller layer

**No changes.** `updateQuestion` (`src/controllers/questionController.js`) and
`updateAnswer` (`src/controllers/answerController.js`) already destructure the request
body and pass it straight to the services edited in step 2; the new `400` from the
service's validation guard is forwarded to `errorHandler` automatically (Express 5
async-rejection forwarding, no try/catch needed — matches the existing convention).

---

## 4. Routes

**No changes.** `PUT /:id` (`devanswers-backend/src/routes/questions.js`) and
`PUT /:answerId` (`devanswers-backend/src/routes/answers.js`) are already registered
with `authenticate`, and already point at the controllers from step 3.

---

## 5. Backend tests

**Edit `devanswers-backend/tests/unit/services/questionService.test.js`**

Add to (or create, if not already present) the `updateQuestionService` describe block,
mocking `Question`/`Tag` per the file's existing `vi.mock(...)` convention:

- blank (`""`) or whitespace-only `title` throws via `createAppError(..., 400)` without
  calling `Question.findByIdAndUpdate`.
- blank/whitespace-only `description` throws the same way.
- a valid edit calls `Question.findByIdAndUpdate` with `editedAt` present (an `expect.any(Date)`
  or similar) in the update payload, and returns the updated document.
- a non-author, non-admin `loggedInUser` throws `403` (extend the existing test if one
  already covers this ownership check, rather than duplicating).

**Edit `devanswers-backend/tests/unit/services/answerService.test.js`**

Same shape for `updateAnswerService`:

- blank/whitespace-only `answerText` throws via `createAppError(..., 400)` without
  calling `answer.save()`.
- a valid edit sets `answer.editedAt` (assert on the mocked answer instance) before
  `save()` is called, and returns the populated document.
- non-author, non-admin throws `403` (extend existing coverage if present).

**Edit `devanswers-backend/tests/integration/questions.test.js`**

Add, following the file's existing register+login-for-a-real-JWT / `supertest`-against-
real-`app` convention:

- `PUT /api/questions/:id` by the author, valid data → `200`; response `data` has the
  new title/description/tags and a non-null `editedAt`.
- `PUT /api/questions/:id` by the author, empty `title` → `400`; a follow-up `GET`
  shows the question unchanged.
- `PUT /api/questions/:id` by a different logged-in (non-admin) user → `403`; question
  unchanged.
- `PUT /api/questions/:id` with no token → `401`.
- `PUT /api/questions/:id` for a nonexistent id → `404`.
- `GET /api/questions/:id` on a freshly created, never-edited question shows `editedAt`
  as `null`.
- **`POST /api/questions/:id/upvote` does not set `editedAt`**: upvote, then `GET` the
  question, assert `editedAt` is still `null` (guards acceptance criterion 8 against
  the `voteService.js#handleVote` `.save()` call).

**Edit `devanswers-backend/tests/integration/answers.test.js`**

Mirror the same six/seven cases for `PUT /api/answers/:answerId` (author success incl.
non-null `editedAt`, blank `answerText` → `400`, non-author → `403`, no token → `401`,
nonexistent id → `404`, never-edited answer's `GET` via the question's answers list
shows `editedAt: null`, and upvoting an answer does not set its `editedAt`).

Run in isolation before moving to frontend work:
```
cd devanswers-backend && npx vitest run tests/unit/services/questionService.test.js tests/unit/services/answerService.test.js tests/integration/questions.test.js tests/integration/answers.test.js
```

---

## 6. Redux slice

**Edit `devanswers-frontend/src/reducers/questionSlice.js`**

- New thunk `updateQuestion({ questionId, title, description, tags })`:
  - reads `const { token } = getState().user.userInfo || {};`
  - calls `questionService.updateQuestion(questionId, { title, description, tags }, token)`
  - on success, calls `questionService.getQuestionById(questionId)` to re-fetch the
    fully populated question (the `PUT` response's `tags` are raw ObjectIds, not
    populated `Tag` docs — re-fetching is the simplest way to keep
    `currentQuestion.tags[i].name` renderable, at the cost of one extra request per
    save) and returns that as the payload.
  - `try/catch` → `rejectWithValue(error.response?.data?.message || error.message || "Failed to update question")`,
    matching every other thunk in this slice.
- New thunk `updateAnswer({ answerId, answerText })`:
  - reads token the same way, calls `answerService.updateAnswer(answerId, answerText, token)`,
    returns the response directly (already populated with `author`, includes
    `editedAt`) — no re-fetch needed here.
  - same `try/catch` → `rejectWithValue(...)` pattern, fallback message
    `"Failed to update answer"`.
- Extra reducers:
  - `updateQuestion.pending` → clear `state.error` (matches `fetchQuestionById.pending`).
  - `updateQuestion.fulfilled` → `state.currentQuestion = action.payload` (same
    assignment `fetchQuestionById.fulfilled` already does).
  - `updateQuestion.rejected` → `state.error = action.payload || action.error.message`.
  - `updateAnswer.pending` → clear `state.error`.
  - `updateAnswer.fulfilled` → find the answer in `state.currentQuestion.answers` by
    `_id === action.payload._id` and replace it with `action.payload` (mirrors
    `voteAnswer.fulfilled`'s existing find-by-id-and-patch shape).
  - `updateAnswer.rejected` → `state.error = action.payload || action.error.message`.

No changes to `src/reducers/userSlice.js`.

---

## 7. Frontend service / config

**Edit `devanswers-frontend/src/services/questionService.js`**

- Add `getQuestionById` re-use (already exported — no change needed there) plus:
  ```
  export const updateQuestion = async (questionId, { title, description, tags }, token) => {
    const res = await axiosInstance.put(
      QUESTION_API.UPDATE(questionId),
      { title, description, tags },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data.data;
  };
  ```

**Edit `devanswers-frontend/src/services/answerService.js`**

- Add:
  ```
  export const updateAnswer = async (answerId, answerText, token) => {
    const res = await axiosInstance.put(
      ANSWER_API.UPDATE(answerId),
      { answerText },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data.data;
  };
  ```
  (Import `ANSWER_API` from `../config/config.js` at the top of the file alongside the
  existing import, if not already imported there.)

**`devanswers-frontend/src/config/config.js`**: no changes — `QUESTION_API.UPDATE` and
`ANSWER_API.UPDATE` already exist, added but unused.

---

## 8. Components

**New `devanswers-frontend/src/components/Shared/EditControls.jsx`**

- Props: `onEdit` (click handler), optional `className`.
- Renders a single pencil-icon `Button` (`react-bootstrap` `Button` + `FaPencilAlt`/
  `FaEdit` from `react-icons/fa`, matching the icon-button style already used by
  `VoteButtons`/`BookmarkButton`) that calls `onEdit` on click, with
  `e.preventDefault()`/`e.stopPropagation()` for consistency with the other shared
  controls (even though neither `QuestionContent` nor `AnswerList` wraps these in an
  outer `<Link>`, unlike `QuestionCard`, so this is defensive rather than strictly
  required).
- No auth-guard or ownership logic inside this component — the caller only renders it
  once it has already determined the current user is the author (matches the spec's
  stated pattern of `VoteButtons` taking a precomputed `authorId` rather than
  re-deriving auth state itself).

---

## 9. Wire-up

**Edit `devanswers-frontend/src/components/Question/QuestionContent.jsx`**

- Add `useState` for `isEditing` (`false` initially) and local form state
  (`editTitle`, `editDescription`, `editTags` — initialized from `question` when
  entering edit mode).
- Add `useSelector((state) => state.user.userInfo)` (already imports `useSelector`
  for `bookmarkedQuestionIds`) and compute `isAuthor = question.author?._id === userInfo?.userId`.
  - Import `useDispatch`'s existing `dispatch` (already present) plus the new
    `updateQuestion` thunk from `../../reducers/questionSlice`.
- When `isAuthor`, render `EditControls` (imported from `../Shared/EditControls`) next
  to the title; its `onEdit` sets `isEditing = true` and seeds the local form state
  from the current `question`.
- When `isEditing`, replace the title/description/tags `Card.Body` region with a form:
  `Form.Control` for title, `as="textarea"` for description, `Form.Control` for a
  comma-joined tags string (pre-filled via `question.tags.map((t) => t.name).join(", ")`),
  and Save/Cancel buttons.
  - Save: `e.preventDefault()`, dispatch `updateQuestion({ questionId: question._id, title: editTitle, description: editDescription, tags: editTags })`;
    on success (`.unwrap()`) set `isEditing = false`; on failure, `alert(...)` matching
    the existing `PostQuestion.jsx` error-handling idiom.
  - Save is disabled when `!editTitle.trim() || !editDescription.trim()` (client-side
    guard, acceptance criterion 6).
  - Cancel: sets `isEditing = false` without dispatching anything.
- Add an "edited" indicator: when `question.editedAt` is truthy, render
  `edited {formatDate(question.editedAt)}` next to the existing
  "Asked {formatDate(question.createdAt)}" line (`formatDate` is already imported).

**Edit `devanswers-frontend/src/components/Answer/AnswerList.jsx`**

- Add `useState` for `editingAnswerId` (`null` initially, shared across the whole list
  so only one answer's form is open at a time) and `editAnswerText` (the in-progress
  text for whichever answer is being edited).
- Import `updateAnswer` from `../../reducers/questionSlice.js` alongside the existing
  `voteAnswer` import; `userInfo` is already read via `useSelector`.
- Per answer, compute `isAuthor = answer.author?._id === userInfo?.userId`; when true,
  render `EditControls` (imported from `../Shared/EditControls`) next to the vote
  controls. Its `onEdit` sets `editingAnswerId = answer._id` and seeds
  `editAnswerText = answer.answerText` (replacing whatever was previously open, since
  it's a single shared piece of state — satisfies "only one form open" for answers).
- When `editingAnswerId === answer._id`, replace that answer's content
  (`alist-content` div) with a `Form.Control as="textarea"` bound to `editAnswerText`
  plus Save/Cancel buttons.
  - Save: dispatch `updateAnswer({ answerId: answer._id, answerText: editAnswerText })`;
    on success set `editingAnswerId = null`; on failure, `alert(...)`.
  - Save disabled when `!editAnswerText.trim()`.
  - Cancel: sets `editingAnswerId = null` without dispatching.
- Add the "edited" indicator: when `answer.editedAt` is truthy, render
  `edited {formatDate(answer.editedAt)}` in the existing meta row (next to
  "Answered by ... • {formatDate(answer.createdAt)}").

**`devanswers-frontend/src/components/Question/QuestionCard.jsx`**: no changes —
confirms acceptance criterion 1 (no edit affordance on the list view); locked in by the
test added in step 10.

**Optional CSS touch-ups**: minor new classnames for the inline edit forms
(`qcontent-edit-form` in `QuestionContent.css`, `alist-edit-form` in `AnswerList.css`)
if the existing `Form.Control`/`Button` defaults need spacing adjustments to sit
correctly in place of the static content — add only if visually necessary while
implementing, not a hard requirement of this plan.

---

## 10. Frontend tests

**Edit `devanswers-frontend/tests/unit/components/QuestionContent.test.jsx`**

- pencil renders when `question.author._id` matches the mocked logged-in user's
  `userInfo.userId`; absent for a different author id; absent when logged out.
- clicking the pencil shows a form pre-filled with the question's current
  title/description/tags.
- Cancel restores the read-only view with the original content and dispatches nothing.
- Save with an emptied title leaves Save disabled / blocks submission (no dispatched
  action / no store update).
- a question with `editedAt` set shows the "edited ..." text; one with `editedAt: null`
  does not.

**Edit `devanswers-frontend/tests/unit/components/AnswerList.test.jsx`**

- Same pencil-gating / pre-fill / cancel / blank-guard / edited-indicator cases, scoped
  per answer.
- opening a second answer's edit form closes the first (only one `editingAnswerId` at a
  time).

**Edit `devanswers-frontend/tests/unit/components/QuestionCard.test.jsx`**

- assert no pencil/edit affordance renders even when the mocked question's author
  matches the logged-in user (locks in acceptance criterion 1).

**Edit `devanswers-frontend/tests/unit/reducers/questionSlice.test.jsx`**

- `updateQuestion.fulfilled` sets `state.currentQuestion` to the payload.
- `updateQuestion.rejected` sets `state.error` via the fallback-message chain.
- `updateAnswer.fulfilled` replaces the matching answer inside
  `state.currentQuestion.answers` by `_id`.
- `updateAnswer.rejected` sets `state.error` via the fallback-message chain.

**Edit `devanswers-frontend/tests/mocks/handlers.js`**

- Add MSW handlers for `PUT /questions/:id` and `PUT /answers/:answerId`, matching the
  `{ success, message, data }` response shape the rest of the handlers use, including a
  branch to return `400` when the mocked request body has a blank title/description/
  answerText (so the "no request succeeds with blank content" integration test has
  something real to assert against).

**New `devanswers-frontend/tests/integration/editPosts.test.jsx`**

- Rendering `QuestionDetail` as the question's author, editing the title/description
  and saving, shows the new content on the page with no navigation/reload.
- Rendering `QuestionDetail` as a different logged-in user shows no pencil on the
  question or on answers authored by someone else.
- Editing an answer the current user authored (rendered inside the same question page)
  saves and shows the updated text in place.
- Submitting a question edit with an empty title shows a validation message/blocked
  Save and issues no request.

Run before considering the feature done:
```
cd devanswers-frontend && npx vitest run tests/unit/components/QuestionContent.test.jsx tests/unit/components/AnswerList.test.jsx tests/unit/components/QuestionCard.test.jsx tests/unit/reducers/questionSlice.test.jsx tests/integration/editPosts.test.jsx
```

---

## Task checklist

- [ ] 1a. `Question.js` — add `editedAt` field
- [ ] 1b. `Answer.js` — add `editedAt` field
- [ ] 2a. `questionService.js` — `updateQuestionService`: blank title/description
      guard (`400`), set `editedAt` in the update payload
- [ ] 2b. `answerService.js` — `updateAnswerService`: blank `answerText` guard
      (`400`), set `answer.editedAt` before save
- [ ] 3. Controllers — verified no changes needed (`updateQuestion`, `updateAnswer`)
- [ ] 4. Routes — verified no changes needed (`PUT /:id`, `PUT /:answerId` already
      registered)
- [ ] 5a. `tests/unit/services/questionService.test.js` — validation + `editedAt`
      + ownership cases
- [ ] 5b. `tests/unit/services/answerService.test.js` — validation + `editedAt`
      + ownership cases
- [ ] 5c. `tests/integration/questions.test.js` — `PUT /:id` cases + vote-doesn't-
      set-`editedAt` case
- [ ] 5d. `tests/integration/answers.test.js` — `PUT /:answerId` cases + vote-
      doesn't-set-`editedAt` case
- [ ] 6. `questionSlice.js` — `updateQuestion`, `updateAnswer` thunks + reducers
- [ ] 7a. `questionService.js` (frontend) — `updateQuestion`
- [ ] 7b. `answerService.js` (frontend) — `updateAnswer`
- [ ] 8. `EditControls.jsx` — new shared pencil-icon component
- [ ] 9a. `QuestionContent.jsx` — edit state, pre-filled form, Save/Cancel,
      "edited" indicator
- [ ] 9b. `AnswerList.jsx` — per-answer edit state, pre-filled form, Save/Cancel,
      "edited" indicator
- [ ] 9c. `QuestionCard.jsx` — verified no changes (no affordance on list view)
- [ ] 10a. `tests/unit/components/QuestionContent.test.jsx` additions
- [ ] 10b. `tests/unit/components/AnswerList.test.jsx` additions
- [ ] 10c. `tests/unit/components/QuestionCard.test.jsx` — no-affordance case
- [ ] 10d. `tests/unit/reducers/questionSlice.test.jsx` additions
- [ ] 10e. `tests/mocks/handlers.js` — `PUT` handlers for questions/answers
- [ ] 10f. `tests/integration/editPosts.test.jsx` — new file
