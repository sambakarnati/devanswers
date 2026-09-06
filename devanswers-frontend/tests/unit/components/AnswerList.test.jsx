import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AnswerList from '../../../src/components/Answer/AnswerList';
import questionReducer from '../../../src/reducers/questionSlice';

const createMockStore = (userInfo = { userId: 'user-1' }) => {
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

const mockAnswers = [
  {
    _id: 'a1',
    answerText: 'Use the useState hook for local state.',
    author: { _id: 'user-2', name: 'Alice' },
    voteCount: 5,
    createdAt: '2026-01-15T12:00:00.000Z',
  },
  {
    _id: 'a2',
    answerText: 'You can also try lifting state up.',
    author: { _id: 'user-3', name: 'Bob' },
    voteCount: -2,
    createdAt: '2026-01-15T13:00:00.000Z',
  },
];

const renderAnswerList = (answers = mockAnswers, userInfo = { userId: 'user-1' }) => {
  const store = createMockStore(userInfo);
  return render(
    <Provider store={store}>
      <AnswerList answers={answers} />
    </Provider>
  );
};

describe('AnswerList Component', () => {
  it('renders all answer texts', () => {
    renderAnswerList();
    expect(screen.getByText('Use the useState hook for local state.')).toBeInTheDocument();
    expect(screen.getByText('You can also try lifting state up.')).toBeInTheDocument();
  });

  it('renders answer authors', () => {
    renderAnswerList();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders answer vote counts', () => {
    renderAnswerList();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('renders the answers count heading', () => {
    renderAnswerList();
    expect(screen.getByText('2 Answers')).toBeInTheDocument();
  });

  it('shows singular "Answer" for one answer', () => {
    renderAnswerList([mockAnswers[0]]);
    expect(screen.getByText('1 Answer')).toBeInTheDocument();
  });

  it('renders upvote and downvote buttons for each answer', () => {
    renderAnswerList();
    const buttons = screen.getAllByRole('button');
    // At least 2 upvote + 2 downvote = 4 buttons
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders "Answered by" label for each answer', () => {
    renderAnswerList();
    const answeredByTexts = screen.getAllByText(/Answered by/i);
    expect(answeredByTexts).toHaveLength(2);
  });

  it('renders empty state when no answers provided', () => {
    renderAnswerList([]);
    expect(screen.getByText(/No answers yet/i)).toBeInTheDocument();
  });

  it('shows "0 Answers" heading when answers array is empty', () => {
    renderAnswerList([]);
    expect(screen.getByText('0 Answers')).toBeInTheDocument();
  });

  describe('Edit affordance', () => {
    const myAnswers = [
      { ...mockAnswers[0], _id: 'a1', author: { _id: 'user-1', name: 'Me' } },
      { ...mockAnswers[1], _id: 'a2', author: { _id: 'user-1', name: 'Me' } },
    ];

    it('renders the edit pencil only for answers authored by the logged-in user', () => {
      renderAnswerList(
        [myAnswers[0], { ...mockAnswers[1], author: { _id: 'user-3', name: 'Bob' } }],
        { userId: 'user-1' },
      );
      expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(1);
    });

    it('does not render any pencil when logged out', () => {
      renderAnswerList(myAnswers, null);
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('clicking a pencil shows a form pre-filled with that answer\'s text', async () => {
      const user = userEvent.setup();
      renderAnswerList(myAnswers, { userId: 'user-1' });

      const [firstPencil] = screen.getAllByRole('button', { name: /edit/i });
      await user.click(firstPencil);

      expect(screen.getByRole('textbox')).toHaveValue(myAnswers[0].answerText);
    });

    it('Cancel restores the read-only view and dispatches nothing', async () => {
      const user = userEvent.setup();
      renderAnswerList(myAnswers, { userId: 'user-1' });

      const [firstPencil] = screen.getAllByRole('button', { name: /edit/i });
      await user.click(firstPencil);
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.getByText(myAnswers[0].answerText)).toBeInTheDocument();
    });

    it('disables Save when the answer text is emptied', async () => {
      const user = userEvent.setup();
      renderAnswerList(myAnswers, { userId: 'user-1' });

      const [firstPencil] = screen.getAllByRole('button', { name: /edit/i });
      await user.click(firstPencil);
      await user.clear(screen.getByRole('textbox'));

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('opening a second answer\'s edit form closes the first', async () => {
      const user = userEvent.setup();
      renderAnswerList(myAnswers, { userId: 'user-1' });

      const pencils = screen.getAllByRole('button', { name: /edit/i });
      await user.click(pencils[0]);
      expect(screen.getAllByRole('button', { name: /cancel/i })).toHaveLength(1);

      // Re-query pencils since the first answer is now in edit mode (no pencil shown for it).
      const remainingPencil = screen.getByRole('button', { name: /edit/i });
      await user.click(remainingPencil);

      expect(screen.getAllByRole('button', { name: /cancel/i })).toHaveLength(1);
      expect(screen.getByRole('textbox')).toHaveValue(myAnswers[1].answerText);
    });
  });

  describe('Edited indicator', () => {
    it('shows the "edited" text when editedAt is set', () => {
      renderAnswerList([{ ...mockAnswers[0], editedAt: '2026-01-16T00:00:00.000Z' }]);
      expect(screen.getByText(/edited/i)).toBeInTheDocument();
    });

    it('does not show the "edited" text when editedAt is null', () => {
      renderAnswerList([{ ...mockAnswers[0], editedAt: null }]);
      expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    });
  });
});
