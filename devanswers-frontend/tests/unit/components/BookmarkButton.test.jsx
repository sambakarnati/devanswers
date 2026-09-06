import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BookmarkButton from '../../../src/components/Shared/BookmarkButton';

const createMockStore = ({ userInfo = { userId: 'user-1' } } = {}) => {
  return configureStore({
    reducer: {
      user: () => ({
        userInfo,
        loading: false,
        error: null,
      }),
    },
  });
};

const renderBookmarkButton = (props = {}, storeOptions = {}) => {
  const defaultProps = {
    questionId: 'question-1',
    isBookmarked: false,
    onToggle: vi.fn(),
    ...props,
  };
  const store = createMockStore(storeOptions);
  return render(
    <Provider store={store}>
      <BookmarkButton {...defaultProps} />
    </Provider>
  );
};

describe('BookmarkButton Component', () => {
  it('renders the outline (not-bookmarked) icon when isBookmarked is false', () => {
    renderBookmarkButton({ isBookmarked: false });
    expect(screen.getByRole('button')).toHaveAccessibleName(/bookmark question/i);
  });

  it('renders the filled (bookmarked) icon when isBookmarked is true', () => {
    renderBookmarkButton({ isBookmarked: true });
    expect(screen.getByRole('button')).toHaveAccessibleName(/remove bookmark/i);
  });

  it('calls onToggle with the question id when clicked while authenticated', async () => {
    const mockOnToggle = vi.fn();
    renderBookmarkButton({ onToggle: mockOnToggle, questionId: 'question-42' });

    await userEvent.click(screen.getByRole('button'));

    expect(mockOnToggle).toHaveBeenCalledWith('question-42');
  });

  it('shows a login-required alert and does not call onToggle when logged out', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const mockOnToggle = vi.fn();
    renderBookmarkButton({ onToggle: mockOnToggle }, { userInfo: null });

    await userEvent.click(screen.getByRole('button'));

    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/logged in/i));
    expect(mockOnToggle).not.toHaveBeenCalled();
  });
});
