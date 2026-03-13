import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Admin from '@/pages/Admin';
import { MemoryRouter } from 'react-router-dom';
// we will mock the authentication hook to supply a logged-in admin user

// stub ResizeObserver used by recharts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// provide a minimal mock of supabase methods used by Admin
vi.mock('@/integrations/supabase/client', () => {
  const noopChain = () => ({
    select: () => noopChain(),
    order: () => noopChain(),
    eq: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: [], error: null }),
    delete: () => ({ eq: () => Promise.resolve({}) }),
    update: () => ({ eq: () => Promise.resolve({}) }),
  });

  // channel object that supports chaining .on().on().subscribe()
  const fakeChannel = () => {
    const ch = {
      on: () => ch,
      subscribe: () => ch,
    };
    return ch;
  };

  return {
    supabase: {
      from: () => noopChain(),
      channel: fakeChannel,
      removeChannel: () => {},
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
      auth: { onAuthStateChange: () => ({ subscription: { unsubscribe: () => {} } }), getSession: async () => ({ data: { session: null } }) },
    },
  };
});

// we'll replace the notification hook with a stub we can inspect and drive via state
const markNewsletterMock = vi.fn();
// this factory returns a hook that holds its own counts state so we can observe updates
vi.mock('@/hooks/useAdminNotifications', () => {
  return {
    useAdminNotifications: () => {
      const [counts, setCounts] = React.useState({ orders: 0, messages: 0, users: 0, newsletter: 2 });
      const markOrdersAsRead = () => setCounts((c) => ({ ...c, orders: 0 }));
      const markMessagesAsRead = () => setCounts((c) => ({ ...c, messages: 0 }));
      const markUsersAsNotified = () => setCounts((c) => ({ ...c, users: 0 }));
      const markNewsletterAsRead = () => {
        setCounts((c) => ({ ...c, newsletter: 0 }));
        markNewsletterMock();
      };
      const fetchCounts = vi.fn();
      return {
        counts,
        markOrdersAsRead,
        markMessagesAsRead,
        markNewsletterAsRead,
        markUsersAsNotified,
        fetchCounts,
        isLoading: false,
      };
    },
  };
});

// mock the authentication context/hook so that Admin believes an admin user is logged in
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: null,
    loading: false,
    isAdmin: true,
    userRole: 'admin',
    profile: null,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => ({}),
  }),
}));

describe('Admin page notification behaviour', () => {
  beforeEach(() => {
    markNewsletterMock.mockClear();
  });

  it('renders the top nav summary including newsletter count', () => {
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    // after render the header should show "2 new notifications" (newsletter only)
    expect(screen.getByText(/2 new notifications/i)).toBeInTheDocument();
  });

  it('calls markNewsletterAsRead when newsletter tab is clicked and clears the badge', async () => {
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    // newsletter button should exist and display the badge (desktop + mobile versions appear)
    const newsletterButtons = screen.getAllByRole('button', { name: /newsletter/i });
    expect(newsletterButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

    // click the first occurrence to open the newsletter tab
    fireEvent.click(newsletterButtons[0]);

    await waitFor(() => {
      expect(markNewsletterMock).toHaveBeenCalled();
    });

    // after the hook updates its counts state the badge should vanish
    await waitFor(() => {
      expect(screen.queryByText('2')).not.toBeInTheDocument();
      // top nav summary should also update to zero notifications
      expect(screen.queryByText(/new notifications/i)).not.toBeInTheDocument();
    });
  });
});
