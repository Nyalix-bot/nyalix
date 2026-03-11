import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminSidebar } from '@/components/AdminSidebar';

describe('notification badges', () => {
  it('renders newsletter badge when there are unread subscribers', () => {
    render(
      <AdminSidebar
        activeTab="dashboard"
        onTabChange={() => {}}
        notifications={{ orders: 0, messages: 0, users: 0, newsletter: 5 }}
      />
    );

    // badge text for the count should be present (might appear twice mobile/desktop)
    const badges = screen.getAllByText('5');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render a badge if the newsletter count is zero', () => {
    render(
      <AdminSidebar
        activeTab="dashboard"
        onTabChange={() => {}}
        notifications={{ orders: 0, messages: 0, users: 0, newsletter: 0 }}
      />
    );

    // numeric badge should not show when count is zero
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('updates badge visibility when the notification prop changes', () => {
    const { rerender } = render(
      <AdminSidebar
        activeTab="dashboard"
        onTabChange={() => {}}
        notifications={{ orders: 0, messages: 0, users: 0, newsletter: 3 }}
      />
    );

    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);

    // rerender with zero count
    rerender(
      <AdminSidebar
        activeTab="dashboard"
        onTabChange={() => {}}
        notifications={{ orders: 0, messages: 0, users: 0, newsletter: 0 }}
      />
    );

    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});
