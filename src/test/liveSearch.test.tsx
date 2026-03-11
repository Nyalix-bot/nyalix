import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LiveSearch from '@/components/LiveSearch';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// language context is mutable so we can flip it in tests
const languageMock = { language: 'en', setLanguage: () => {}, isRTL: false };

// stub translations to return either english or arabic text based on languageMock
vi.mock('react-i18next', () => {
  return {
    useTranslation: () => ({
      t: (key: string, def?: string) => {
        // handle only relevant keys
        if (key === 'products.noResults') {
          return languageMock.language === 'ar' ? 'لا توجد منتجات' : 'No products found';
        }
        if (key === 'products.search') {
          return languageMock.language === 'ar' ? 'ابحث عن المنتجات...' : 'Search products...';
        }
        return def || key;
      },
    }),
  };
});

// mock the hook so we can control what results are returned without hitting
// supabase. the component uses a debounced query so we also disable the
// debounce delay in tests by setting it to a small value.

type Product = {
  id: string;
  name: string;
  name_ar?: string;
  images: string[];
  price: number;
};

// the hook now takes a language argument; the mock returns english or arabic
// product names based on that value.
vi.mock('@/hooks/useProducts', () => {
  return {
    useProductSearch: (query?: string, language: 'en' | 'ar' = 'en') => {
      const results: Product[] = [];
      if (query && query.toLowerCase().includes('a')) {
        if (language === 'ar') {
          results.push({
            id: '1',
            name: 'Apple',
            name_ar: 'تفاحة',
            images: ['foo.jpg'],
            price: 10,
          });
        } else {
          results.push({ id: '1', name: 'Apple', images: ['foo.jpg'], price: 10 });
        }
      }
      return { data: results, isFetching: false };
    },
  };
});

// the debounce hook uses setTimeout; we can speed it up by passing a
// delay of 0 when calling it in tests. an alternative is to mock it, but the
// simplest approach is to override the implementation here.
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: <T>(value: T) => value,
}));

// language context is mutable so we can flip it in tests
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => languageMock,
}));

describe('LiveSearch component', () => {
  const renderComponent = () => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LiveSearch />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('displays suggestions as the user types (english)', async () => {
    languageMock.language = 'en';
    renderComponent();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });

    expect(await screen.findByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });

  it('shows "no products found" when there are no matching items (english)', async () => {
    languageMock.language = 'en';
    renderComponent();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'z' } });

    expect(await screen.findByText(/no products found/i)).toBeInTheDocument();
  });

  it('renders arabic results when language is set to ar', async () => {
    languageMock.language = 'ar';
    renderComponent();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });

    // arabic name should appear
    expect(await screen.findByText('تفاحة')).toBeInTheDocument();
  });

  it('shows arabic no-results message when nothing matches and lang ar', async () => {
    languageMock.language = 'ar';
    renderComponent();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'z' } });

    expect(await screen.findByText(/لا توجد منتجات/i)).toBeInTheDocument();
  });
});
