import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Category {
  id: string;
  name: string;
  name_ar: string;
  created_at: string;
}

export const AdminDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<{
    categoriesTableExists: boolean;
    categoriesCount: number;
    categoriesData: Category[];
    currentUser: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const checkDebugInfo = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        // Try to fetch categories
        const { data: categories, error } = await supabase
          .from('categories')
          .select('*');

        if (error) {
          console.error('[Debug] Categories fetch error:', error);
          setDebugInfo({
            categoriesTableExists: false,
            categoriesCount: 0,
            categoriesData: [],
            currentUser: user?.email || null,
            error: error.message,
          });
        } else {
          console.log('[Debug] Categories fetched:', categories);
          setDebugInfo({
            categoriesTableExists: true,
            categoriesCount: categories?.length || 0,
            categoriesData: categories || [],
            currentUser: user?.email || null,
            error: null,
          });
        }
      } catch (err) {
        console.error('[Debug] Unexpected error:', err);
        setDebugInfo({
          categoriesTableExists: false,
          categoriesCount: 0,
          categoriesData: [],
          currentUser: null,
          error: String(err),
        });
      }
    };

    checkDebugInfo();
  }, []);

  if (!debugInfo) {
    return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">Loading debug info...</div>;
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-black text-white rounded-lg text-xs max-w-64 z-[9999]">
      <div className="font-bold mb-2">Debug Info</div>
      <div className="space-y-1 font-mono text-[10px]">
        <div>User: {debugInfo.currentUser || 'Not logged in'}</div>
        <div>Categories Table: {debugInfo.categoriesTableExists ? '✅ Exists' : '❌ Missing'}</div>
        <div>Categories Count: {debugInfo.categoriesCount}</div>
        {debugInfo.error && <div className="text-red-300">Error: {debugInfo.error}</div>}
        {debugInfo.categoriesData.length > 0 && (
          <div className="mt-2">
            <div className="font-bold">Categories:</div>
            {debugInfo.categoriesData.map((cat: Category) => (
              <div key={cat.id}>{cat.name} ({cat.name_ar})</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
