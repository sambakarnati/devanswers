import { createAppError } from "./createAppError.js";

/**
 * Throws a 400 createAppError if `value` is missing or whitespace-only.
 * Shared by createQuestionService/updateQuestionService (title,
 * description) and createAnswerService/updateAnswerService (answerText) so
 * the same "must not be blank" rule can't silently drift between the create
 * and update paths.
 */
export const assertNonBlank = (value, message) => {
  if (!value?.trim()) {
    throw createAppError(message, 400);
  }
};
