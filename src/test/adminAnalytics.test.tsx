import { render, screen } from '@testing-library/react';
import AdminAnalytics from '@/components/AdminAnalytics';

// ResizeObserver is used by recharts' ResponsiveContainer; jsdom doesn't provide it
// so we stub a minimal implementation here.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type Order = {
  id: string;
  status: string;
  total: number;
  shipping_name: string;
  shipping_email?: string;
  shipping_phone?: string;
  shipping_country: string;
  shipping_city?: string;
  shipping_address?: string;
  created_at: string;
  user_id: string;
  order_items?: { product_name: string; quantity: number; price: number }[];
};

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  created_at: string;
};

type Product = {
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
};

describe('AdminAnalytics component', () => {
  const now = new Date().toISOString();

  const sampleOrders = [
    {
      id: 'o1',
      status: 'delivered',
      total: 100,
      shipping_name: 'Alice',
      shipping_country: 'USA',
      created_at: now,
      user_id: 'u1',
      order_items: [
        { product_name: 'Widget', quantity: 2, price: 50 },
      ],
    },
  ];

  const sampleUsers = [
    {
      id: 'p1',
      user_id: 'u1',
      full_name: 'Alice',
      email: 'alice@example.com',
      phone: null,
      country: 'USA',
      created_at: now,
    },
  ];

  const sampleProducts = [
    {
      id: 'p1',
      name: 'Widget',
      name_ar: 'ويدجيت',
      description: 'A widget',
      description_ar: 'وصف',
      category: 'Gadgets',
      category_ar: 'أدوات',
      price: 50,
      images: [],
      in_stock: true,
      stock_quantity: 10,
      specifications: {},
      featured: false,
    },
  ];

  it('renders filter buttons and major sections', () => {
    render(
      <AdminAnalytics
        orders={sampleOrders}
        users={sampleUsers}
        products={sampleProducts}
      />,
    );

    expect(screen.getByText('Sales Analytics')).toBeInTheDocument();
    expect(screen.getByText('User Analytics')).toBeInTheDocument();
    expect(screen.getByText('Product Analytics')).toBeInTheDocument();
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    // there should be at least one numeric summary value (we inserted one order/user)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
