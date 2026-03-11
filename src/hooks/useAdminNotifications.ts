import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationCounts {
  orders: number;
  messages: number;
  users: number;
  newsletter: number;
}

export const useAdminNotifications = () => {
  const [counts, setCounts] = useState<NotificationCounts>({
    orders: 0,
    messages: 0,
    users: 0,
    newsletter: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Quick test to see if columns exist
  useEffect(() => {
    const testColumns = async () => {
      console.log('🔍 Testing if notification columns exist...');
      try {
        // Test orders.read
        const { error: ordersReadErr } = await supabase
          .from('orders')
          .select('read')
          .limit(1);
        
        if (ordersReadErr?.code === 'PGRST116') {
          console.warn('⚠️  orders.read column does NOT exist yet - migration may not be applied');
        } else if (ordersReadErr) {
          console.error('❌ Error testing orders.read:', ordersReadErr.code, ordersReadErr.message);
        } else {
          console.log('✅ orders.read column EXISTS');
        }

        // Test newsletter_subscribers.read
        const { error: newslErr } = await supabase
          .from('newsletter_subscribers')
          .select('read')
          .limit(1);
        
        if (newslErr?.code === 'PGRST116') {
          console.warn('⚠️  newsletter_subscribers.read column does NOT exist');
        } else if (newslErr) {
          console.error('❌ Error testing newsletter_subscribers.read:', newslErr.code);
        } else {
          console.log('✅ newsletter_subscribers.read column EXISTS');
        }

        // Test profiles.admin_notified
        const { error: profileErr } = await supabase
          .from('profiles')
          .select('admin_notified')
          .limit(1);
        
        if (profileErr?.code === 'PGRST116') {
          console.warn('⚠️  profiles.admin_notified column does NOT exist');
        } else if (profileErr) {
          console.error('❌ Error testing profiles.admin_notified:', profileErr.code);
        } else {
          console.log('✅ profiles.admin_notified column EXISTS');
        }
      } catch (e) {
        console.error('Exception testing columns:', e);
      }
    };
    testColumns();
  }, []);

  // Fetch unread counts from database
  const fetchCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('fetchCounts: Starting to fetch notification counts...');

      // Now use the read filters which should work after migration
      const { count: unreadOrdersCount, error: ordersErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      const { count: unreadMsgCount, error: messErr } = await supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      const { count: unreadNewslCount, error: newslErr } = await supabase
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      const { count: unnNotifiedUserCount, error: userErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('admin_notified', false);

      console.log('fetchCounts: Unread counts -', {
        orders: unreadOrdersCount,
        messages: unreadMsgCount,
        newsletter: unreadNewslCount,
        users: unnNotifiedUserCount,
      });

      const finalCounts = {
        orders: unreadOrdersCount || 0,
        messages: unreadMsgCount || 0,
        users: unnNotifiedUserCount || 0,
        newsletter: unreadNewslCount || 0,
      };

      console.log('fetchCounts: Final counts:', finalCounts);
      setCounts(finalCounts);

      if (ordersErr) console.error('Error fetching orders:', ordersErr);
      if (messErr) console.error('Error fetching messages:', messErr);
      if (newslErr) console.error('Error fetching newsletter:', newslErr);
      if (userErr) console.error('Error fetching users:', userErr);
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark orders as read
  const markOrdersAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;

      // Refetch to ensure state is synced with database
      await new Promise(resolve => setTimeout(resolve, 100));
      const { count: unreadCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      setCounts((prev) => ({ ...prev, orders: unreadCount || 0 }));
    } catch (error) {
      console.error('Error marking orders as read:', error);
    }
  }, []);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;

      // Refetch to ensure state is synced with database
      await new Promise(resolve => setTimeout(resolve, 100));
      const { count: unreadCount } = await supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      setCounts((prev) => ({ ...prev, messages: unreadCount || 0 }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, []);

  // Mark newsletter subscribers as read (admin notified)
  const markNewsletterAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;

      // Refetch to ensure state is synced with database
      await new Promise(resolve => setTimeout(resolve, 100));
      const { count: unreadCount } = await supabase
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      setCounts((prev) => ({ ...prev, newsletter: unreadCount || 0 }));
    } catch (error) {
      console.error('Error marking newsletter as read:', error);
    }
  }, []);

  // Mark new users as notified
  const markUsersAsNotified = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ admin_notified: true })
        .eq('admin_notified', false);

      if (error) throw error;

      // Refetch to ensure state is synced with database
      await new Promise(resolve => setTimeout(resolve, 100));
      const { count: unreadCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('admin_notified', false);

      setCounts((prev) => ({ ...prev, users: unreadCount || 0 }));
    } catch (error) {
      console.error('Error marking users as notified:', error);
    }
  }, []);

  // Set up real-time subscriptions for notification updates
  useEffect(() => {
    console.log('useAdminNotifications: Setting up subscriptions');
    // Fetch counts initially
    fetchCounts();

    // Refetch counts periodically to catch any sync issues
    const interval = setInterval(() => {
      console.log('useAdminNotifications: Periodic refetch of counts');
      fetchCounts();
    }, 30000); // Refetch every 30 seconds as safety net

    // Subscribe to new orders
    const ordersChannel = supabase
      .channel('admin-orders-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        () => {
          console.log('New order inserted');
          // Increment orders count
          setCounts((prev) => ({
            ...prev,
            orders: prev.orders + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'read=eq.true',
        },
        () => {
          console.log('Orders marked as read');
          // Decrement when marked as read externally
          setCounts((prev) => ({
            ...prev,
            orders: Math.max(0, prev.orders - 1),
          }));
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('admin-messages-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contact_messages',
        },
        () => {
          // Increment messages count
          setCounts((prev) => ({
            ...prev,
            messages: prev.messages + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contact_messages',
          filter: 'read=eq.true',
        },
        () => {
          // Decrement when marked as read externally
          setCounts((prev) => ({
            ...prev,
            messages: Math.max(0, prev.messages - 1),
          }));
        }
      )
      .subscribe();

    // Subscribe to new newsletter subscribers
    const newsletterChannel = supabase
      .channel('admin-newsletter-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'newsletter_subscribers',
        },
        () => {
          // Increment newsletter count
          setCounts((prev) => ({
            ...prev,
            newsletter: prev.newsletter + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'newsletter_subscribers',
          filter: 'read=eq.true',
        },
        () => {
          // Decrement when marked as read externally
          setCounts((prev) => ({
            ...prev,
            newsletter: Math.max(0, prev.newsletter - 1),
          }));
        }
      )
      .subscribe();

    // Subscribe to new profiles (users)
    const usersChannel = supabase
      .channel('admin-users-unread')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          // Increment users count
          setCounts((prev) => ({
            ...prev,
            users: prev.users + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'admin_notified=eq.true',
        },
        () => {
          // Decrement when marked as notified externally
          setCounts((prev) => ({
            ...prev,
            users: Math.max(0, prev.users - 1),
          }));
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(newsletterChannel);
      supabase.removeChannel(usersChannel);
    };
  }, [fetchCounts]);

  return {
    counts,
    isLoading,
    fetchCounts,
    markOrdersAsRead,
    markMessagesAsRead,
    markNewsletterAsRead,
    markUsersAsNotified,
  };
};
