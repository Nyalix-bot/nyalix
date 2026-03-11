import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useProductSearch, DBProduct } from '@/hooks/useProducts';
import { useDebounce } from '@/hooks/useDebounce';
import { useLanguage } from '@/contexts/LanguageContext';

const LiveSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);
  const { data: results = [], isFetching } = useProductSearch(debouncedQuery, language);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // open/close dropdown based on debounced query
  useEffect(() => {
    if (debouncedQuery.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [debouncedQuery]);

  // close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelect = (product: DBProduct) => {
    setQuery('');
    setOpen(false);
    navigate(`/products/${product.id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={query}
        placeholder={t('products.search')}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (debouncedQuery.length > 0) setOpen(true);
        }}
        className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute z-50 w-full bg-white border border-border rounded mt-1 max-h-60 overflow-auto shadow-lg"
          >
            {isFetching ? (
              <li className="px-4 py-2 text-sm text-muted-foreground">Loading...</li>
            ) : results.length > 0 ? (
              results.map((p) => {
                const displayName = language === 'ar' ? p.name_ar || p.name : p.name;
                return (
                  <li
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
                  >
                    <img
                      src={p.images?.[0] ?? ''}
                      alt={displayName}
                      className="w-8 h-8 object-cover rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        ${p.price.toFixed(2)}
                      </span>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-2 text-sm text-muted-foreground">
                {t('products.noResults')}
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveSearch;
