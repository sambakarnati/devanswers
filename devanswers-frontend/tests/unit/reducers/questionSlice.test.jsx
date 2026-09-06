// Unit tests for questionSlice.js using Vitest. The tests should verify:
// - The initial state is correctly defined.
// - Reducer state transitions for fetchQuestions (pending, fulfilled, rejected).
// - Creating a new question adds it to the state (postQuestion fulfilled, rejected).
//
// Uses the direct reducer + action creator pattern (same as MLS reducer tests):
// questionReducer(state, thunkAction.fulfilled(payload)) — no service mocking needed.

import { describe, it, expect } from 'vitest';
import questionReducer, {
  fetchQuestions,
  postQuestion,
  toggleBookmarkQuestion,
  fetchBookmarkedQuestions,
} from '../../../src/reducers/questionSlice.js';

describe('questionSlice', () => {
  const initialState = {
    questions: [],
    currentQuestion: null,
    loading: false,
    error: null,
    bookmarkedQuestionIds: [],
    bookmarkedQuestions: [],
    bookmarkLoading: false,
    bookmarkError: null,
  };

  describe('initial state', () => {
    it('should return initial state', () => {
      const state = questionReducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });
  });

  describe('fetchQuestions async thunk', () => {
    it('should handle pending state', () => {
      const state = questionReducer(initialState, fetchQuestions.pending());

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state and populate questions', () => {
      const mockQuestions = [
        { _id: 'q1', title: 'First Question' },
        { _id: 'q2', title: 'Second Question' },
      ];

      const state = questionReducer(
        initialState,
        fetchQuestions.fulfilled(mockQuestions, '')
      );

      expect(state.loading).toBe(false);
      expect(state.questions).toEqual(mockQuestions);
      expect(state.questions).toHaveLength(2);
      expect(state.error).toBeNull();
    });

    it('should handle rejected state', () => {
      const errorMessage = 'Failed to fetch questions';
      const state = questionReducer(
        initialState,
        fetchQuestions.rejected(null, '', null, errorMessage)
      );

      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('postQuestion async thunk', () => {
    it('should add new question to list on fulfilled', () => {
      const existingState = {
        ...initialState,
        questions: [{ _id: 'q1', title: 'Existing Question' }],
      };

      const newQuestion = {
        _id: 'q3',
        title: 'New Question',
        description: 'Description',
        tags: ['redux'],
      };

      const state = questionReducer(
        existingState,
        postQuestion.fulfilled(newQuestion, '', {})
      );

      expect(state.questions).toHaveLength(2);
      expect(state.questions).toContainEqual(newQuestion);
      expect(state.currentQuestion).toEqual(newQuestion);
      expect(state.loading).toBe(false);
    });

    it('should set error on rejected', () => {
      const errorMessage = 'Failed to post question';
      const state = questionReducer(
        initialState,
        postQuestion.rejected(null, '', {}, errorMessage)
      );

      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('toggleBookmarkQuestion async thunk', () => {
    it('should add the question id to bookmarkedQuestionIds when bookmarked is true', () => {
      const state = questionReducer(
        initialState,
        toggleBookmarkQuestion.fulfilled(
          { questionId: 'q1', bookmarked: true },
          '',
          { questionId: 'q1' }
        )
      );

      expect(state.bookmarkedQuestionIds).toContain('q1');
    });

    it('should remove the question id from bookmarkedQuestionIds when bookmarked is false', () => {
      const existingState = {
        ...initialState,
        bookmarkedQuestionIds: ['q1', 'q2'],
      };

      const state = questionReducer(
        existingState,
        toggleBookmarkQuestion.fulfilled(
          { questionId: 'q1', bookmarked: false },
          '',
          { questionId: 'q1' }
        )
      );

      expect(state.bookmarkedQuestionIds).toEqual(['q2']);
    });

    it('should not duplicate an id already present when bookmarked is true', () => {
      const existingState = {
        ...initialState,
        bookmarkedQuestionIds: ['q1'],
      };

      const state = questionReducer(
        existingState,
        toggleBookmarkQuestion.fulfilled(
          { questionId: 'q1', bookmarked: true },
          '',
          { questionId: 'q1' }
        )
      );

      expect(state.bookmarkedQuestionIds).toEqual(['q1']);
    });

    it('should set bookmarkError on rejected', () => {
      const errorMessage = 'Bookmark failed';
      const state = questionReducer(
        initialState,
        toggleBookmarkQuestion.rejected(null, '', {}, errorMessage)
      );

      expect(state.bookmarkError).toBe(errorMessage);
    });
  });

  describe('fetchBookmarkedQuestions async thunk', () => {
    it('should populate bookmarkedQuestions on fulfilled', () => {
      const mockQuestions = [
        { _id: 'q1', title: 'Bookmarked Question 1' },
        { _id: 'q2', title: 'Bookmarked Question 2' },
      ];

      const state = questionReducer(
        initialState,
        fetchBookmarkedQuestions.fulfilled(mockQuestions, '')
      );

      expect(state.bookmarkLoading).toBe(false);
      expect(state.bookmarkedQuestions).toEqual(mockQuestions);
      expect(state.bookmarkedQuestionIds).toEqual(['q1', 'q2']);
    });

    it('should set bookmarkError on rejected', () => {
      const errorMessage = 'Failed to fetch bookmarked questions';
      const state = questionReducer(
        initialState,
        fetchBookmarkedQuestions.rejected(null, '', undefined, errorMessage)
      );

      expect(state.bookmarkLoading).toBe(false);
      expect(state.bookmarkError).toBe(errorMessage);
    });
  });
});
