import Question from "../models/Question.js";
import User from "../models/User.js";
import Answer from "../models/Answer.js";
import { createAppError } from "../utils/createAppError.js";

export const toggleBookmarkService = async (questionId, userId) => {
  const questionExists = await Question.exists({ _id: questionId });
  if (!questionExists) {
    throw createAppError("Question not found", 404);
  }

  const user = await User.findById(userId);

  const isBookmarked = user.bookmarkedQuestions.includes(questionId);
  let bookmarked;

  if (isBookmarked) {
    user.bookmarkedQuestions.pull(questionId);
    bookmarked = false;
  } else {
    user.bookmarkedQuestions.push(questionId);
    bookmarked = true;
  }

  await user.save();

  return { bookmarked };
};

export const getBookmarkedQuestionsService = async (userId) => {
  const user = await User.findById(userId).populate({
    path: "bookmarkedQuestions",
    populate: [{ path: "author", select: "name" }, { path: "tags" }],
  });

  // Filter out orphaned references (deleted questions resolve to null on populate)
  const questions = user.bookmarkedQuestions.filter(Boolean);

  // Attach answerCount to each question, same as getAllQuestionsService, so the
  // frontend's QuestionCard shows the real answer count instead of falling back to 0.
  const questionsWithCount = await Promise.all(
    questions.map(async (q) => {
      const answerCount = await Answer.countDocuments({ questionId: q._id });
      return { ...(q.toObject?.() ?? q), answerCount };
    }),
  );

  // Most-recently-bookmarked first: insertion order in the array already reflects
  // push order, so reversing it is enough.
  return questionsWithCount.reverse();
};
