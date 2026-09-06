import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import Profile from '../../../src/pages/Profile/Profile';
import questionReducer from '../../../src/reducers/questionSlice';
import * as questionService from '../../../src/services/questionService';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mocked so the "Bookmarked Questions" section's fetch-on-mount is
// deterministic rather than depending on a real network round trip.
vi.mock('../../../src/services/questionService', async () => {
  const actual = await vi.importActual('../../../src/services/questionService');
  return {
    ...actual,
    getBookmarkedQuestions: vi.fn().mockResolvedValue([]),
  };
});

const createMockStore = ({
  userInfo = { userId: 'u1', name: 'TestUser', token: 'tok' },
} = {}) => {
  return configureStore({
    reducer: {
      question: questionReducer,
      user: () => ({ userInfo, loading: false, error: null }),
    },
  });
};

const renderProfile = (storeOptions = {}) => {
  const store = createMockStore(storeOptions);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <Profile />
      </BrowserRouter>
    </Provider>
  );
};

describe('Profile Page', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    questionService.getBookmarkedQuestions.mockReset().mockResolvedValue([]);
  });

  it('renders the profile heading when authenticated', () => {
    renderProfile();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('shows Edit Profile button when not in edit mode', () => {
    renderProfile();
    expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderProfile({ userInfo: null });
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows activity stats section when authenticated', () => {
    renderProfile();
    expect(screen.getByText('Activity Stats')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Answers')).toBeInTheDocument();
  });

  it('enters edit mode when Edit Profile button is clicked', async () => {
    renderProfile();
    await userEvent.click(screen.getByText(/edit profile/i));

    expect(screen.getByText(/save changes/i)).toBeInTheDocument();
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
  });

  it('exits edit mode when Cancel button is clicked', async () => {
    renderProfile();
    await userEvent.click(screen.getByText(/edit profile/i));
    await userEvent.click(screen.getByText(/cancel/i));

    expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
  });

  it('shows form inputs in edit mode', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByText(/edit profile/i));

    // Full Name and Email inputs should now be enabled
    expect(screen.getByPlaceholderText(/enter your name/i)).not.toBeDisabled();
    expect(screen.getByPlaceholderText(/enter your email/i)).not.toBeDisabled();
  });

  it('renders the Bookmarked Questions section heading', () => {
    renderProfile();
    expect(screen.getByText('Bookmarked Questions')).toBeInTheDocument();
  });

  it('shows an empty-state message when the user has no bookmarks', async () => {
    renderProfile();
    expect(
      await screen.findByText(/haven.t bookmarked any questions yet/i)
    ).toBeInTheDocument();
  });
});
