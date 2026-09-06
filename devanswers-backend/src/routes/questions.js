import express from "express";

import {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  upvoteQuestion,
  downvoteQuestion,
  improveQuestion,
} from "../controllers/questionController.js";
import {
  toggleBookmark,
  getBookmarkedQuestions,
} from "../controllers/bookmarkController.js";
import {
  getAnswersByQuestionId,
  createAnswer,
} from "../controllers/answerController.js";
import authenticate from "../middleware/authHandler.js";

const router = express.Router();

// Public routes - no authentication required
router.get("/", getAllQuestions);
// Protected, but must be registered before "/:id" below - otherwise Express matches
// "bookmarked" as an :id value and this route becomes unreachable.
router.get("/bookmarked", authenticate, getBookmarkedQuestions);
router.get("/:id", getQuestionById);
router.get("/:questionId/answers", getAnswersByQuestionId);

// Protected routes - authentication required
router.post("/improve", authenticate, improveQuestion);
router.post("/", authenticate, createQuestion);
router.put("/:id", authenticate, updateQuestion);
router.delete("/:id", authenticate, deleteQuestion);
router.post("/:id/upvote", authenticate, upvoteQuestion);
router.post("/:id/downvote", authenticate, downvoteQuestion);
router.post("/:id/bookmark", authenticate, toggleBookmark);
router.post("/:questionId/answers", authenticate, createAnswer);

export default router;
