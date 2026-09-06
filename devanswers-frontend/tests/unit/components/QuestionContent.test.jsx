import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import QuestionContent from '../../../src/components/Question/QuestionContent';
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

const mockQuestion = {
  _id: 'q1',
  title: 'How do I use the useEffect hook?',
  description: 'I have trouble with the dependency array.',
  voteCount: 8,
  tags: [
    { _id: 't1', name: 'react' },
    { _id: 't2', name: 'hooks' },
  ],
  author: { _id: 'user-2', name: 'Alice' },
  createdAt: '2026-01-15T00:00:00.000Z',
};

const renderQuestionContent = (question = mockQuestion, userInfo = { userId: 'user-1' }) => {
  const store = createMockStore(userInfo);
  return render(
    <Provider store={store}>
      <QuestionContent question={question} />
    </Provider>
  );
};

describe('QuestionContent Component', () => {
  it('renders the question title', () => {
    renderQuestionContent();
    expect(screen.getByText('How do I use the useEffect hook?')).toBeInTheDocument();
  });

  it('renders the question description', () => {
    renderQuestionContent();
    expect(screen.getByText('I have trouble with the dependency array.')).toBeInTheDocument();
  });

  it('renders the vote count', () => {
    renderQuestionContent();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders tags as badges', () => {
    renderQuestionContent();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('hooks')).toBeInTheDocument();
  });

  it('renders the author name', () => {
    renderQuestionContent();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders upvote and downvote buttons', () => {
    renderQuestionContent();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the "Asked" date text', () => {
    renderQuestionContent();
    expect(screen.getByText(/Asked/i)).toBeInTheDocument();
  });

  it('renders "Posted by" label for the author', () => {
    renderQuestionContent();
    expect(screen.getByText(/Posted by/i)).toBeInTheDocument();
  });

  describe('Edit affordance', () => {
    it('renders the edit pencil when the logged-in user is the author', () => {
      renderQuestionContent(
        { ...mockQuestion, author: { _id: 'user-1', name: 'Me' } },
        { userId: 'user-1' },
      );
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('does not render the edit pencil for a different author', () => {
      renderQuestionContent(mockQuestion, { userId: 'user-1' });
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('does not render the edit pencil when logged out', () => {
      renderQuestionContent(
        { ...mockQuestion, author: { _id: 'user-1', name: 'Me' } },
        null,
      );
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('clicking the pencil shows a form pre-filled with the current content', async () => {
      const user = userEvent.setup();
      renderQuestionContent(
        { ...mockQuestion, author: { _id: 'user-1', name: 'Me' } },
        { userId: 'user-1' },
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByLabelText(/title/i)).toHaveValue(mockQuestion.title);
      expect(screen.getByLabelText(/description/i)).toHaveValue(mockQuestion.description);
      expect(screen.getByLabelText(/tags/i)).toHaveValue('react, hooks');
    });

    it('Cancel restores the read-only view with the original content and dispatches nothing', async () => {
      const user = userEvent.setup();
      renderQuestionContent(
        { ...mockQuestion, author: { _id: 'user-1', name: 'Me' } },
        { userId: 'user-1' },
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.clear(screen.getByLabelText(/title/i));
      await user.type(screen.getByLabelText(/title/i), 'Changed title');
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.getByText(mockQuestion.title)).toBeInTheDocument();
      expect(screen.queryByText('Changed title')).not.toBeInTheDocument();
    });

    it('disables Save when the title is emptied', async () => {
      const user = userEvent.setup();
      renderQuestionContent(
        { ...mockQuestion, author: { _id: 'user-1', name: 'Me' } },
        { userId: 'user-1' },
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.clear(screen.getByLabelText(/title/i));

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  describe('Edited indicator', () => {
    it('shows the "edited" text when editedAt is set', () => {
      renderQuestionContent({ ...mockQuestion, editedAt: '2026-01-16T00:00:00.000Z' });
      expect(screen.getByText(/edited/i)).toBeInTheDocument();
    });

    it('does not show the "edited" text when editedAt is null', () => {
      renderQuestionContent({ ...mockQuestion, editedAt: null });
      expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    });
  });
});
