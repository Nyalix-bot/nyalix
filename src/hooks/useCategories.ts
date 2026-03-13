import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export interface Category {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  icon?: string;
  order_index: number;
}

export interface CategoryOption {
  en: string;
  ar: string;
  id?: string;
}

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;

      return (data as Category[]) || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook for getting categories in legacy format (for backward compatibility)
export const useCategoriesLegacy = () => {
  const { data: categories, isLoading, error } = useCategories();
  const [legacyCategories, setLegacyCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    if (categories) {
      setLegacyCategories(
        categories.map((cat) => ({
          en: cat.name,
          ar: cat.name_ar,
          id: cat.id,
        }))
      );
    }
  }, [categories]);

  return { data: legacyCategories, isLoading, error };
};

// Hook for real-time category subscriptions
export const useCategoriesRealtime = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchCategories = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('categories')
          .select('*')
          .order('order_index', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }
        
        setCategories((data as Category[]) || []);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch categories';
        setError(err instanceof Error ? err : new Error(errorMsg));
        setIsLoading(false);
      }
    };

    // Fetch initial data
    fetchCategories();

    // Subscribe to real-time changes
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupSubscription = () => {
      channel = supabase
        .channel('public:categories', {
          config: {
            presence: { key: 'categories_listener' },
          },
        })
        .on(
          'postgres_changes',
          { 
            event: 'INSERT',
            schema: 'public', 
            table: 'categories' 
          },
          (payload) => {
            const newCategory = payload.new as Category;
            setCategories((prev) => 
              [...prev, newCategory].sort((a, b) => a.order_index - b.order_index)
            );
          }
        )
        .on(
          'postgres_changes',
          { 
            event: 'UPDATE',
            schema: 'public', 
            table: 'categories' 
          },
          (payload) => {
            const updatedCategory = payload.new as Category;
            setCategories((prev) =>
              prev
                .map((cat) => (cat.id === updatedCategory.id ? updatedCategory : cat))
                .sort((a, b) => a.order_index - b.order_index)
            );
          }
        )
        .on(
          'postgres_changes',
          { 
            event: 'DELETE',
            schema: 'public', 
            table: 'categories' 
          },
          (payload) => {
            setCategories((prev) => prev.filter((cat) => cat.id !== payload.old.id));
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            // Attempt to reconnect
            if (channel) {
              supabase.removeChannel(channel);
            }
            setTimeout(setupSubscription, 2000);
          }
        });
    };

    setupSubscription();

    // Cleanup on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { categories, isLoading, error };
};
