import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import questionReducer from '../../src/reducers/questionSlice';
import QuestionDetail from '../../src/pages/Question/QuestionDetail';
import * as questionService from '../../src/services/questionService';
import * as answerService from '../../src/services/answerService';

/**
 * Integration Tests: Edit Posts Flow (Redux thunks + reducer + rendered page)
 *
 * The service layer is mocked (rather than relying on MSW/axiosInstance),
 * matching the convention in tests/integration/bookmark.test.jsx - this
 * exercises the real thunk -> reducer -> component wiring deterministically.
 */

vi.mock('../../src/services/questionService', async () => {
  const actual = await vi.importActual('../../src/services/questionService');
  return {
    ...actual,
    getQuestionById: vi.fn(),
    updateQuestion: vi.fn(),
  };
});

vi.mock('../../src/services/answerService', async () => {
  const actual = await vi.importActual('../../src/services/answerService');
  return {
    ...actual,
    updateAnswer: vi.fn(),
  };
});

const baseQuestion = {
  _id: 'question-1',
  title: 'Original title',
  description: 'Original description',
  tags: [{ _id: 'tag-1', name: 'javascript' }],
  author: { _id: 'user-1', name: 'Alice Johnson' },
  createdAt: '2026-01-14T10:00:00.000Z',
  editedAt: null,
  voteCount: 0,
  answers: [
    {
      _id: 'answer-1',
      answerText: 'My answer',
      author: { _id: 'user-1', name: 'Alice Johnson' },
      voteCount: 0,
      createdAt: '2026-01-15T12:00:00.000Z',
      editedAt: null,
    },
    {
      _id: 'answer-2',
      answerText: 'Someone else\'s answer',
      author: { _id: 'user-2', name: 'Bob Smith' },
      voteCount: 0,
      createdAt: '2026-01-15T13:00:00.000Z',
      editedAt: null,
    },
  ],
};

const createTestStore = (userInfo = { userId: 'user-1', token: 'mock-jwt-token-alice', name: 'Alice Johnson' }) => {
  return configureStore({
    reducer: {
      question: questionReducer,
      user: () => ({
        userInfo,
        loading: false,
        error: null,
      }),
    },
  });
};

const renderQuestionDetail = (userInfo) => {
  const store = createTestStore(userInfo);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/question/question-1']}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetail />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return store;
};

describe('Edit Posts Integration Tests (Redux + rendered QuestionDetail)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    questionService.getQuestionById.mockResolvedValue(baseQuestion);
  });

  it('editing the title/description as the author shows the new content with no reload', async () => {
    const user = userEvent.setup();
    renderQuestionDetail();

    expect(await screen.findByText('Original title')).toBeInTheDocument();

    const updatedQuestion = {
      ...baseQuestion,
      title: 'Updated title',
      description: 'Updated description',
      editedAt: '2026-01-16T00:00:00.000Z',
    };
    questionService.updateQuestion.mockResolvedValue({ ...updatedQuestion, tags: ['tag-1'] });
    // The initial mount fetch already resolved with baseQuestion above; the
    // updateQuestion thunk's post-save re-fetch is the next call, so this
    // becomes the new default from here on.
    questionService.getQuestionById.mockResolvedValue(updatedQuestion);

    // Only the question has a pencil here besides answer-1's (both authored by
    // user-1); the question's pencil renders first in the DOM.
    const [questionPencil] = screen.getAllByRole('button', { name: /edit/i });
    await user.click(questionPencil);
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Updated title');
    await user.clear(screen.getByLabelText(/description/i));
    await user.type(screen.getByLabelText(/description/i), 'Updated description');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Updated title')).toBeInTheDocument();
    expect(screen.getByText('Updated description')).toBeInTheDocument();
    expect(screen.queryByText('Original title')).not.toBeInTheDocument();
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it('shows no pencil on the question or on answers authored by someone else, for a different logged-in user', async () => {
    renderQuestionDetail({ userId: 'user-3', token: 'mock-jwt-token-other', name: 'Someone Else' });

    expect(await screen.findByText('Original title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('editing an answer the current user authored saves and shows the updated text in place', async () => {
    const user = userEvent.setup();
    renderQuestionDetail();

    expect(await screen.findByText('My answer')).toBeInTheDocument();

    answerService.updateAnswer.mockResolvedValue({
      _id: 'answer-1',
      answerText: 'My updated answer',
      author: { _id: 'user-1', name: 'Alice Johnson' },
      voteCount: 0,
      createdAt: baseQuestion.answers[0].createdAt,
      editedAt: '2026-01-16T00:00:00.000Z',
    });

    // The question also has a pencil (also authored by user-1); answer-1's
    // pencil is the second one in the DOM.
    const pencils = screen.getAllByRole('button', { name: /edit/i });
    await user.click(pencils[1]);
    // Disambiguate from AnswerForm's "post a new answer" textarea, which is
    // also on the page.
    const textbox = screen.getByDisplayValue('My answer');
    await user.clear(textbox);
    await user.type(textbox, 'My updated answer');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('My updated answer')).toBeInTheDocument();
    expect(screen.queryByText('My answer')).not.toBeInTheDocument();
  });

  it('blocks submission and issues no request when the question title is emptied', async () => {
    const user = userEvent.setup();
    renderQuestionDetail();

    expect(await screen.findByText('Original title')).toBeInTheDocument();

    const [questionPencil] = screen.getAllByRole('button', { name: /edit/i });
    await user.click(questionPencil);
    await user.clear(screen.getByLabelText(/title/i));

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(questionService.updateQuestion).not.toHaveBeenCalled();
  });
});
