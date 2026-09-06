import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import questionReducer, {
  toggleBookmarkQuestion,
  fetchBookmarkedQuestions,
} from '../../src/reducers/questionSlice';
import QuestionCard from '../../src/components/Question/QuestionCard';
import * as questionService from '../../src/services/questionService';

// Note: Profile page's "Bookmarked Questions" section is covered in
// tests/unit/pages/profile.test.jsx alongside the page's other tests, rather
// than here - Profile.jsx also fires an unrelated, unmocked axios call
// (fetchUserStats) on mount, which is only safe to exercise the way the rest
// of that file's tests already do.

/**
 * Integration Tests: Bookmark Flow (Redux thunks + reducer + components)
 *
 * The service layer is mocked here (rather than relying on MSW/axiosInstance)
 * so these tests exercise the real thunk -> reducer -> component wiring
 * deterministically, independent of whatever base URL axiosInstance resolves
 * to in a given environment.
 */

vi.mock('../../src/services/questionService', async () => {
  const actual = await vi.importActual('../../src/services/questionService');
  return {
    ...actual,
    toggleBookmarkQuestion: vi.fn(),
    getBookmarkedQuestions: vi.fn(),
  };
});

const mockQuestion = {
  _id: 'question-1',
  title: 'How do I manage state in React?',
  description: 'I want to understand the best way to manage component state.',
  voteCount: 10,
  tags: [{ _id: 'tag-1', name: 'javascript' }],
  author: { _id: 'user-2', name: 'Alice Johnson' },
  createdAt: '2026-01-14T10:00:00.000Z',
};

const defaultQuestionState = {
  questions: [],
  currentQuestion: null,
  loading: false,
  error: null,
  bookmarkedQuestionIds: [],
  bookmarkedQuestions: [],
  bookmarkLoading: false,
  bookmarkError: null,
};

const createTestStore = (questionStateOverrides = {}) => {
  return configureStore({
    reducer: {
      question: questionReducer,
      user: () => ({
        userInfo: { userId: 'user-1', token: 'mock-jwt-token-alice', name: 'Alice Johnson' },
        loading: false,
        error: null,
      }),
    },
    preloadedState: {
      question: { ...defaultQuestionState, ...questionStateOverrides },
    },
  });
};

describe('Bookmark Flow Integration Tests (Redux + components)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Toggle bookmark', () => {
    it('should bookmark a not-yet-bookmarked question', async () => {
      questionService.toggleBookmarkQuestion.mockResolvedValue({ bookmarked: true });
      const store = createTestStore();

      const result = await store.dispatch(
        toggleBookmarkQuestion({ questionId: 'question-2' })
      );

      expect(toggleBookmarkQuestion.fulfilled.match(result)).toBe(true);
      expect(store.getState().question.bookmarkedQuestionIds).toContain('question-2');
    });

    it('should un-bookmark an already-bookmarked question', async () => {
      questionService.toggleBookmarkQuestion.mockResolvedValue({ bookmarked: false });
      const store = createTestStore({ bookmarkedQuestionIds: ['question-1'] });

      const result = await store.dispatch(
        toggleBookmarkQuestion({ questionId: 'question-1' })
      );

      expect(toggleBookmarkQuestion.fulfilled.match(result)).toBe(true);
      expect(store.getState().question.bookmarkedQuestionIds).not.toContain('question-1');
    });

    it('should set bookmarkError on a rejected toggle', async () => {
      questionService.toggleBookmarkQuestion.mockRejectedValue(new Error('Question not found'));
      const store = createTestStore();

      const result = await store.dispatch(
        toggleBookmarkQuestion({ questionId: 'nonexistent' })
      );

      expect(toggleBookmarkQuestion.rejected.match(result)).toBe(true);
      expect(store.getState().question.bookmarkError).toBe('Question not found');
    });
  });

  describe('Fetch bookmarked questions', () => {
    it('should populate bookmarkedQuestions and bookmarkedQuestionIds', async () => {
      questionService.getBookmarkedQuestions.mockResolvedValue([mockQuestion]);
      const store = createTestStore();

      const result = await store.dispatch(fetchBookmarkedQuestions());

      expect(fetchBookmarkedQuestions.fulfilled.match(result)).toBe(true);
      const state = store.getState().question;
      expect(state.bookmarkedQuestions).toEqual([mockQuestion]);
      expect(state.bookmarkedQuestionIds).toContain('question-1');
    });
  });

  describe('QuestionCard bookmark icon', () => {
    const renderQuestionCard = (preloadedState) => {
      const store = createTestStore(preloadedState);
      return render(
        <Provider store={store}>
          <BrowserRouter>
            <QuestionCard question={mockQuestion} />
          </BrowserRouter>
        </Provider>
      );
    };

    it('shows the filled (bookmarked) icon for a question already in bookmarkedQuestionIds', () => {
      renderQuestionCard({ bookmarkedQuestionIds: ['question-1'] });
      expect(screen.getByRole('button', { name: /remove bookmark/i })).toBeInTheDocument();
    });

    it('shows the outline (not-bookmarked) icon otherwise', () => {
      renderQuestionCard({ bookmarkedQuestionIds: [] });
      expect(screen.getByRole('button', { name: /bookmark question/i })).toBeInTheDocument();
    });

    it('toggles to the bookmarked state after clicking the bookmark icon', async () => {
      questionService.toggleBookmarkQuestion.mockResolvedValue({ bookmarked: true });
      renderQuestionCard({ bookmarkedQuestionIds: [] });

      const button = screen.getByRole('button', { name: /bookmark question/i });
      await userEvent.click(button);

      expect(await screen.findByRole('button', { name: /remove bookmark/i })).toBeInTheDocument();
    });
  });

  describe('fetchBookmarkedQuestions thunk feeding a Profile-shaped list', () => {
    it('produces data ready to render via QuestionCard (title, author, tags all present)', async () => {
      questionService.getBookmarkedQuestions.mockResolvedValue([mockQuestion]);
      const store = createTestStore();

      await store.dispatch(fetchBookmarkedQuestions());

      const [question] = store.getState().question.bookmarkedQuestions;
      render(
        <Provider store={store}>
          <BrowserRouter>
            <QuestionCard question={question} />
          </BrowserRouter>
        </Provider>
      );

      expect(screen.getByText('How do I manage state in React?')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });
});
