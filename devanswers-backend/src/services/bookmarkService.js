import Question from "../models/Question.js";
import User from "../models/User.js";
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

  // Most-recently-bookmarked first: insertion order in the array already reflects
  // push order, so reversing it is enough.
  return questions.reverse();
};
