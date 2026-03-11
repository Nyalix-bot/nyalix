import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DBProduct {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  category_ar: string;
  price: number;
  images: string[];
  in_stock: boolean;
  stock_quantity: number;
  specifications: Record<string, string>;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DBProduct[];
    },
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as unknown as DBProduct | null;
    },
    enabled: !!id,
  });
};

// -----------------------------------------------------------------------------
// live search helper – used by the navbar search suggestions. Queries the
// database for products whose name contains the provided query string. We
// enable the query only when there's actually text to search for, keeping the
// cache keyed by the query string itself.
// -----------------------------------------------------------------------------
export const useProductSearch = (query?: string, language: 'en' | 'ar' = 'en') => {
  return useQuery({
    queryKey: ['productSearch', query, language],
    queryFn: async () => {
      if (!query) return [] as DBProduct[];

      // choose fields based on language
      const nameField = language === 'ar' ? 'name_ar' : 'name';
      const descField = language === 'ar' ? 'description_ar' : 'description';

      // search either name or description in the selected language
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`${nameField}.ilike.%${query}%,${descField}.ilike.%${query}%`);
      if (error) throw error;
      return (data ?? []) as unknown as DBProduct[];
    },
    enabled: !!query && query.length > 0,
    staleTime: 1000 * 60 * 5, // five minutes
  });
};
