import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  toggleBookmarkService,
  getBookmarkedQuestionsService,
} from "../../../src/services/bookmarkService.js";
import Question from "../../../src/models/Question.js";
import User from "../../../src/models/User.js";

vi.mock("../../../src/models/Question.js");
vi.mock("../../../src/models/User.js");

describe("bookmarkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toggleBookmarkService", () => {
    // Success case - toggle on
    it("should add the question id and return { bookmarked: true } when not yet bookmarked", async () => {
      // Arrange
      Question.exists = vi.fn().mockResolvedValue({ _id: "question123" });

      const mockUser = {
        bookmarkedQuestions: {
          includes: vi.fn().mockReturnValue(false),
          push: vi.fn(),
          pull: vi.fn(),
        },
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById = vi.fn().mockResolvedValue(mockUser);

      // Act
      const result = await toggleBookmarkService("question123", "user123");

      // Assert
      expect(Question.exists).toHaveBeenCalledWith({ _id: "question123" });
      expect(mockUser.bookmarkedQuestions.push).toHaveBeenCalledWith(
        "question123",
      );
      expect(mockUser.bookmarkedQuestions.pull).not.toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({ bookmarked: true });
    });

    // Success case - toggle off
    it("should remove the question id and return { bookmarked: false } when already bookmarked", async () => {
      // Arrange
      Question.exists = vi.fn().mockResolvedValue({ _id: "question123" });

      const mockUser = {
        bookmarkedQuestions: {
          includes: vi.fn().mockReturnValue(true),
          push: vi.fn(),
          pull: vi.fn(),
        },
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById = vi.fn().mockResolvedValue(mockUser);

      // Act
      const result = await toggleBookmarkService("question123", "user123");

      // Assert
      expect(mockUser.bookmarkedQuestions.pull).toHaveBeenCalledWith(
        "question123",
      );
      expect(mockUser.bookmarkedQuestions.push).not.toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({ bookmarked: false });
    });

    // Edge case - toggling twice does not duplicate
    it("should not duplicate the entry when toggled twice in a row", async () => {
      // Arrange
      Question.exists = vi.fn().mockResolvedValue({ _id: "question123" });

      const bookmarks = [];
      const mockUser = {
        bookmarkedQuestions: {
          includes: (id) => bookmarks.includes(id),
          push: (id) => bookmarks.push(id),
          pull: (id) => {
            const idx = bookmarks.indexOf(id);
            if (idx !== -1) bookmarks.splice(idx, 1);
          },
        },
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById = vi.fn().mockResolvedValue(mockUser);

      // Act
      const first = await toggleBookmarkService("question123", "user123");
      const second = await toggleBookmarkService("question123", "user123");

      // Assert
      expect(first).toEqual({ bookmarked: true });
      expect(second).toEqual({ bookmarked: false });
      expect(bookmarks).toHaveLength(0);
    });

    // Error case - nonexistent question
    it("should throw a 404 error for a nonexistent question id", async () => {
      // Arrange
      Question.exists = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        toggleBookmarkService("nonexistent", "user123"),
      ).rejects.toThrow("Question not found");
      await expect(
        toggleBookmarkService("nonexistent", "user123"),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  describe("getBookmarkedQuestionsService", () => {
    // Success case
    it("should return the populated bookmarked questions, most-recent first", async () => {
      // Arrange
      const questions = [
        { _id: "q1", title: "First bookmarked" },
        { _id: "q2", title: "Second bookmarked" },
      ];
      User.findById = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue({ bookmarkedQuestions: questions }),
      });

      // Act
      const result = await getBookmarkedQuestionsService("user123");

      // Assert
      expect(result).toEqual([questions[1], questions[0]]);
    });

    // Edge case - orphaned reference filtered out
    it("should filter out orphaned (deleted) question references", async () => {
      // Arrange
      const questions = [{ _id: "q1", title: "Still exists" }, null];
      User.findById = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue({ bookmarkedQuestions: questions }),
      });

      // Act
      const result = await getBookmarkedQuestionsService("user123");

      // Assert
      expect(result).toEqual([{ _id: "q1", title: "Still exists" }]);
    });
  });
});
