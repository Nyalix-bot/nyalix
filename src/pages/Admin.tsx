import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { type LucideIcon, Plus, Pencil, Trash2, Package, ShoppingBag, Users, MessageSquare, Award, BarChart3, X, Upload, Bell, Settings, Eye, EyeOff, AlertTriangle, ImageIcon, Mail, Download, Menu } from 'lucide-react';
import AdminExhibitions from '@/components/AdminExhibitions';
import AdminAnalytics from '@/components/AdminAnalytics';
import AdminQuotesTab from '@/components/AdminQuotesTab';
import { AdminSidebar, type AdminTab } from '@/components/AdminSidebar';
import { useCategoriesRealtime, type Category } from '@/hooks/useCategories';
import { generateAndSendNotifications } from '@/lib/notifications';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

// Simple error boundary to surface runtime errors on admin page
class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AdminErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pt-20 min-h-screen bg-background flex items-center justify-center">
          <div className="bg-card rounded-xl border border-border p-8 shadow-luxury max-w-lg">
            <h1 className="text-xl font-bold text-foreground mb-4">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-4">The admin dashboard failed to render.</p>
            <pre className="text-xs text-red-500 bg-muted p-3 rounded-lg overflow-x-auto">{this.state.error.message}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Product {
  id: string;name: string;name_ar: string;description: string;description_ar: string;
  category: string;category_ar: string;price: number;images: string[];in_stock: boolean;
  stock_quantity: number;specifications: Record<string, string>;featured: boolean;
}

interface Order {
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
  read: boolean;
  order_items?: {product_name: string;quantity: number;price: number;product_image_url?: string;}[];
}

interface ContactMsg {id: string;name: string;email: string;message: string;read: boolean;created_at: string;}

interface Certificate { id: string; title: string; title_ar: string; type: string; file_url: string; created_at?: string; }

/* ── Confirm Modal ── */
const ConfirmModal = ({ open, title, message, onConfirm, onCancel

}: {open: boolean;title: string;message: string;onConfirm: () => void;onCancel: () => void;}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border p-6 shadow-luxury w-full max-w-sm">
        
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <h3 className="font-display font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">Delete</button>
        </div>
      </motion.div>
    </div>);

};

interface UserProfile {id: string;user_id: string;full_name: string;email: string;phone: string | null;country: string | null;created_at: string;admin_notified?: boolean;}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const { categories, isLoading: categoriesLoading, error: categoriesError } = useCategoriesRealtime();
  const { counts: notificationCounts, markOrdersAsRead, markMessagesAsRead, markNewsletterAsRead, markUsersAsNotified } = useAdminNotifications();

  useEffect(() => {
    if (categoriesError) {
      // Error handling - silent fail with fallback
    }
  }, [categoriesError]);

  // Sync local categories list with hook data
  useEffect(() => {
    if (categories.length > 0) {
      setCategoriesList(categories);
    }
  }, [categories]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Partial<Category> | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [confirmModal, setConfirmModal] = useState<{open: boolean;title: string;message: string;onConfirm: () => void;} | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && user && !isAdmin) {
      // Allow access for 10 seconds to let user make themselves admin
      const timer = setTimeout(() => {
        if (!isAdmin) {
          navigate('/');
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data as unknown as Product[] ?? []);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*, order_items(product_name, quantity, price, product_image_url)').order('created_at', { ascending: false });
    setOrders(data as unknown as Order[] ?? []);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
    setMessages(data as unknown as ContactMsg[] ?? []);
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data as unknown as UserProfile[] ?? []);
  }, []);

  useEffect(() => {
    if (user) { // Fetch data for any logged-in user
      fetchProducts();
      fetchOrders();
      fetchMessages();
      fetchUsers();
    }
  }, [user, fetchProducts, fetchOrders, fetchMessages, fetchUsers]);

  // Real-time subscriptions for toast notifications only
  useEffect(() => {
    if (!user) return;
    
    const ordersChannel = supabase.channel('admin-orders-toast').
    on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      setOrders((prev) => [payload.new as Order, ...prev]);
      toast.info('🛒 New order received!');
    }).subscribe();

    const messagesChannel = supabase.channel('admin-messages-toast').
    on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_messages' }, (payload) => {
      setMessages((prev) => [payload.new as ContactMsg, ...prev]);
      toast.info('💬 New message received!');
    }).subscribe();

    const usersChannel = supabase.channel('admin-users-toast').
    on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
      setUsers((prev) => [payload.new as UserProfile, ...prev]);
      toast.info('👤 New user registered!');
    }).subscribe();

    const newsletterChannel = supabase.channel('admin-newsletter-toast').
    on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'newsletter_subscribers' }, () => {
      toast.info('📧 New newsletter subscriber!');
    }).subscribe();

    const productsChannel = supabase.channel('admin-products').
    on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, (payload) => {
      setProducts((prev) => [payload.new as Product, ...prev]);
      toast.info('✨ New product added!');
    }).
    on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
      setProducts((prev) =>
        prev.map((p) => p.id === payload.new.id ? (payload.new as Product) : p)
      );
    }).subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(newsletterChannel);
      supabase.removeChannel(productsChannel);
    };
  }, [user, isAdmin]);

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    const payload = {
      name: editProduct.name || '',
      name_ar: editProduct.name_ar || '',
      description: editProduct.description || '',
      description_ar: editProduct.description_ar || '',
      category: editProduct.category || '',
      category_ar: editProduct.category_ar || '',
      price: editProduct.price || 0,
      images: editProduct.images || [],
      in_stock: editProduct.in_stock ?? true,
      stock_quantity: editProduct.stock_quantity ?? 0,
      specifications: editProduct.specifications || {},
      featured: editProduct.featured ?? false
    };

    if (editProduct.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
      if (error) {toast.error(error.message);return;}
      toast.success('Product updated');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) {toast.error(error.message);return;}
      toast.success('Product added');
    }
    setShowForm(false);
    setEditProduct(null);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success('Product deleted');
    fetchProducts();
  };

  // Category Management Functions
  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory?.name || !editCategory?.name_ar) {
      toast.error('Please fill in both language fields');
      return;
    }

    const payload = {
      name: editCategory.name,
      name_ar: editCategory.name_ar,
      description: editCategory.description || '',
      description_ar: editCategory.description_ar || '',
      icon: editCategory.icon || '',
      order_index: editCategory.order_index ?? categoriesList.length + 1,
    };

    if (editCategory.id) {
      // Edit existing category
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editCategory.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      
      // Immediately update local state for instant UI feedback
      setCategoriesList((prev) =>
        prev
          .map((cat) =>
            cat.id === editCategory.id
              ? { ...cat, ...payload }
              : cat
          )
          .sort((a, b) => a.order_index - b.order_index)
      );
      
      toast.success('Category updated');
    } else {
      // Add new category
      const { data, error } = await supabase
        .from('categories')
        .insert(payload)
        .select('*')
        .single();
      
      if (error) {
        toast.error(error.message);
        return;
      }

      // Immediately update local state for instant UI feedback
      if (data) {
        setCategoriesList((prev) =>
          [...prev, data as Category].sort((a, b) => a.order_index - b.order_index)
        );
      }
      
      toast.success('Category added');
    }

    setShowCategoryForm(false);
    setEditCategory(null);
    // The hook will automatically update via real-time subscription for other components
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Products using it will be unaffected.')) return;
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    
    // Immediately update local state for instant UI feedback
    setCategoriesList((prev) => prev.filter((cat) => cat.id !== id));
    
    toast.success('Category deleted');
    // The hook will automatically update via real-time subscription for other components
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    await supabase.from('orders').update({ status }).eq('id', id);
    toast.success('Order status updated');
    fetchOrders();

    // Send status update notifications
    await generateAndSendNotifications('order_status_update', order.user_id, id);
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Delete this order?')) return;
    await supabase.from('orders').delete().eq('id', id);
    toast.success('Order deleted');
    fetchOrders();
  };

  const makeCurrentUserAdmin = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('make-admin', {
        body: { userId: user.id }
      });

      if (error || !data?.success) {
        toast.error('Unable to grant admin access. Please try again or contact support.');
        return;
      }

      toast.success('User is now an admin!');
      // Refresh the page to update the admin status
      window.location.reload();
    } catch (error) {
      toast.error('Failed to make user admin');
    }
  };

  const deleteMessage = (msgId: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message? This action cannot be undone.',
      onConfirm: async () => {
        await supabase.from('contact_messages').delete().eq('id', msgId);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        toast.success('Message deleted');
        setConfirmModal(null);
      }
    });
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user profile?')) return;
    await supabase.from('profiles').delete().eq('user_id', userId);
    toast.success('User deleted');
    fetchUsers();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const urls: string[] = [...(editProduct?.images || [])];
    for (const file of Array.from(files)) {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file);
      if (error) {toast.error(error.message);continue;}
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    setEditProduct((prev) => prev ? { ...prev, images: urls } : prev);
  };

  if (loading) return (
    <div className="pt-20 min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading admin dashboard...</p>
      </div>
    </div>
  );

  if (!user) {
    // If not logged in, redirect to the auth page (prevents showing a blank page while the redirect occurs)
    return <Navigate to="/auth" replace />;
  }

  // Filter out admin user from users list
  const regularUsers = users.filter((u) => u.user_id !== user?.id);

  const handleTabChange = (t: AdminTab) => {
    setTab(t);
    
    // Mark as read when admin opens each section
    if (t === 'orders') {
      markOrdersAsRead();
    } else if (t === 'messages') {
      markMessagesAsRead();
    } else if (t === 'users') {
      markUsersAsNotified();
    } else if (t === 'newsletter') {
      markNewsletterAsRead();
    }
    
    setSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  return (
    <AdminErrorBoundary>
      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal?.open &&
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)} />

        }
      </AnimatePresence>

      {/* Sidebar */}
      <AdminSidebar
        activeTab={tab}
        onTabChange={handleTabChange}
        notifications={{
          orders: notificationCounts.orders,
          messages: notificationCounts.messages,
          users: notificationCounts.users,
          newsletter: notificationCounts.newsletter,
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="min-h-screen bg-background">
        {/* Top navbar */}
        <div className="bg-gradient-navy fixed top-0 left-0 right-0 z-40 py-4 border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-primary-foreground" />
              </button>
              <h1 className="text-2xl font-display font-bold text-primary-foreground">Admin Dashboard</h1>
            </div>
            {/* include newsletter in the global notification summary as well */}
            {notificationCounts.orders + notificationCounts.messages + notificationCounts.users + notificationCounts.newsletter > 0 &&
            <div className="flex items-center gap-2 bg-gold/20 border border-gold/30 rounded-full px-4 py-1.5">
                <Bell className="w-4 h-4 text-gold" />
                <span className="text-gold text-sm font-medium">{notificationCounts.orders + notificationCounts.messages + notificationCounts.users + notificationCounts.newsletter} new notifications</span>
              </div>
            }
          </div>
        </div>

        {/* Main content area */}
        <main className="pt-24 lg:ml-64 transition-all duration-300">
          <div className="container mx-auto px-4 py-6">

        {/* Dashboard */}
        {tab === 'dashboard' &&
        <div className="space-y-8">
            {/* Product Analytics Summary */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-foreground">Product Analytics Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[{
                  label: 'Total Products',
                  value: products.length,
                  icon: Package,
                }, {
                  label: 'New This Month',
                  value: products.filter(p => {
                    const created = new Date(p.created_at);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  }).length,
                  icon: Package,
                }, {
                  label: 'Low Stock (≤5)',
                  value: products.filter(p => p.stock_quantity <= 5).length,
                  icon: AlertTriangle,
                }, {
                  label: 'Featured',
                  value: products.filter(p => p.featured).length,
                  icon: Award,
                }].map((s, i) =>
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl border border-border p-5 shadow-luxury">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <s.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-xl font-bold text-foreground">{s.value}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* analytics section replaced by dedicated component */}
        <AdminAnalytics orders={orders} users={users} products={products} />

            {/* Admin Setup */}
            {!isAdmin && (
              <div className="bg-card rounded-xl border border-border p-6 shadow-luxury">
                <h3 className="font-display font-semibold text-foreground mb-4">Admin Setup</h3>
                <p className="text-muted-foreground mb-4">You need admin privileges to access all features. Click the button below to make yourself an admin.</p>
                <button
                  onClick={makeCurrentUserAdmin}
                  className="px-4 py-2 bg-gradient-gold text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Make Me Admin
                </button>
              </div>
            )}

            {/* Recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-5 shadow-luxury">
                <h3 className="font-display font-semibold text-foreground mb-4">Recent Orders</h3>
                <div className="space-y-3">
                  {orders.slice(0, 5).map((o) =>
                <div key={o.id} className="flex items-center gap-3 text-sm">
                      {o.order_items?.[0]?.product_image_url ?
                  <img src={o.order_items[0].product_image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" /> :

                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                  }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{o.shipping_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">${Number(o.total).toLocaleString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                  o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  o.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                  o.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-muted text-muted-foreground'}`
                  }>{o.status}</span>
                      <button onClick={() => deleteOrder(o.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                )}
                  {orders.length === 0 && <p className="text-muted-foreground text-sm">No orders yet.</p>}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5 shadow-luxury">
                <h3 className="font-display font-semibold text-foreground mb-4">Recent Messages</h3>
                <div className="space-y-3">
                  {messages.slice(0, 5).map((m) =>
                <div key={m.id} className="flex items-start gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-muted-foreground truncate">{m.message}</p>
                      </div>
                      {!m.read && <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />}
                      <button onClick={() => deleteMessage(m.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                )}
                  {messages.length === 0 && <p className="text-muted-foreground text-sm">No messages yet.</p>}
                </div>
              </div>
            </div>
          </div>
        }

        {/* Products */}
        {tab === 'products' &&
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-display font-semibold text-foreground">Manage Products</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2 pl-10 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button onClick={() => {setEditProduct({ stock_quantity: 0 });setShowForm(true);}}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>
            </div>

            {showForm &&
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-card rounded-xl border border-border p-6 shadow-luxury max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-display font-semibold text-foreground">{editProduct?.id ? 'Edit' : 'Add'} Product</h3>
                    <button onClick={() => {setShowForm(false);setEditProduct(null);}}><X className="w-5 h-5 text-muted-foreground" /></button>
                  </div>
                  <form onSubmit={saveProduct} className="space-y-4">
                    {[
                { key: 'name', label: 'Name (EN)', type: 'text' },
                { key: 'name_ar', label: 'Name (AR)', type: 'text' },
                { key: 'price', label: 'Price ($)', type: 'number' },
                { key: 'stock_quantity', label: 'Stock Quantity (units available)', type: 'number' }].
                map((f) =>
                <div key={f.key}>
                        <label className="block text-sm font-medium text-foreground mb-1">{f.label}</label>
                        <input type={f.type} required min={f.type === 'number' ? 0 : undefined}
                  value={editProduct?.[f.key as keyof Product] ?? ''}
                  onChange={(e) => setEditProduct((prev) => ({ ...prev, [f.key as keyof Product]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                )}

                    {/* Dynamic Category Selection */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Category (EN)</label>
                      <select
                        required
                        value={editProduct?.category ?? ''}
                        onChange={(e) => {
                          const selectedCategory = categories.find(c => c.name === e.target.value);
                          setEditProduct((prev) => ({
                            ...prev,
                            category: e.target.value,
                            category_ar: selectedCategory?.name_ar || ''
                          }));
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Arabic Category - Auto-populated from database */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Category (AR)</label>
                      <input
                        type="text"
                        disabled
                        value={editProduct?.category_ar ?? ''}
                        className="w-full px-4 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-sm opacity-75"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Automatically populated from database</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Description (EN)</label>
                      <textarea rows={3} value={editProduct?.description ?? ''} onChange={(e) => setEditProduct((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Description (AR)</label>
                      <textarea rows={3} value={editProduct?.description_ar ?? ''} onChange={(e) => setEditProduct((prev) => ({ ...prev, description_ar: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                    </div>

                    {/* Images */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Images</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(editProduct?.images || []).map((url, i) =>
                    <div key={i} className="relative w-20 h-20">
                            <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                            <button type="button" onClick={() => setEditProduct((prev) => prev ? { ...prev, images: prev.images?.filter((_, idx) => idx !== i) } : prev)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs">×</button>
                          </div>
                    )}
                      </div>
                      <label className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-sm cursor-pointer hover:bg-border transition-colors">
                        <Upload className="w-4 h-4" /> Upload Images
                        <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    </div>

                    {/* Specifications */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-foreground">Specifications</label>
                        <button type="button" onClick={() => {
                      const specs = { ...(editProduct?.specifications || {}) };
                      specs[''] = '';
                      setEditProduct((prev) => ({ ...prev, specifications: specs }));
                    }} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Add Row</button>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(editProduct?.specifications || {}).map(([key, val], idx) =>
                    <div key={idx} className="flex gap-2">
                            <input placeholder="Key (e.g. Weight)" value={key} onChange={(e) => {
                        const specs = { ...(editProduct?.specifications || {}) };
                        const entries = Object.entries(specs);
                        entries[idx] = [e.target.value, val as string];
                        setEditProduct((prev) => ({ ...prev, specifications: Object.fromEntries(entries) }));
                      }} className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm" />
                            <input placeholder="Value" value={val as string} onChange={(e) => {
                        const specs = { ...(editProduct?.specifications || {}) };
                        const entries = Object.entries(specs);
                        entries[idx] = [key, e.target.value];
                        setEditProduct((prev) => ({ ...prev, specifications: Object.fromEntries(entries) }));
                      }} className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm" />
                            <button type="button" onClick={() => {
                        const specs = { ...(editProduct?.specifications || {}) };
                        delete specs[key];
                        setEditProduct((prev) => ({ ...prev, specifications: specs }));
                      }} className="text-destructive hover:text-destructive/80"><X className="w-4 h-4" /></button>
                          </div>
                    )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editProduct?.in_stock ?? true} onChange={(e) => setEditProduct((prev) => ({ ...prev, in_stock: e.target.checked }))} />
                        In Stock
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editProduct?.featured ?? false} onChange={(e) => setEditProduct((prev) => ({ ...prev, featured: e.target.checked }))} />
                        Featured
                      </label>
                    </div>

                    <button type="submit" className="w-full px-6 py-3 bg-gradient-gold rounded-lg font-semibold text-white hover:opacity-90 transition-all shadow-gold">
                      {editProduct?.id ? 'Update' : 'Create'} Product
                    </button>
                  </form>
                </div>
              </motion.div>
          }

            {/* Filter products based on search */}
            {(() => {
              const filteredProducts = products.filter((p) => {
                if (!productSearch.trim()) return true;
                const searchTerm = productSearch.toLowerCase();
                return (
                  p.name.toLowerCase().includes(searchTerm) ||
                  p.name_ar.toLowerCase().includes(searchTerm) ||
                  p.description.toLowerCase().includes(searchTerm) ||
                  p.description_ar.toLowerCase().includes(searchTerm) ||
                  p.category.toLowerCase().includes(searchTerm) ||
                  p.category_ar.toLowerCase().includes(searchTerm)
                );
              });

              return (
                <div className="grid gap-4">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto opacity-50 mb-3" />
                      <p className="text-muted-foreground">
                        {productSearch.trim() ? 'No products match your search.' : 'No products yet. Create your first one!'}
                      </p>
                    </div>
                  ) : (
                    filteredProducts.map((p) =>
            <div key={p.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4 shadow-luxury">
                  <img src={p.images?.[0] || '/placeholder.svg'} alt={p.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.category} · ${p.price.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Stock</p>
                    <p className={`text-sm font-bold ${p.stock_quantity <= 5 ? 'text-red-500' : 'text-green-600'}`}>{p.stock_quantity ?? 0}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.in_stock ? 'In Stock' : 'Out of Stock'}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => {setEditProduct(p);setShowForm(true);}} className="p-2 text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteProduct(p.id)} className="p-2 text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
            )
                  )}
                </div>
              );
            })()}
          </div>
        }

        {/* Categories Management */}
        {tab === 'categories' &&
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-lg font-display font-semibold text-foreground">Manage Categories</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2 pl-10 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {categorySearch && (
                  <button
                    onClick={() => setCategorySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setEditCategory({});
                  setShowCategoryForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>
          </div>

          {/* Category Form Modal */}
          {showCategoryForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="bg-card rounded-xl border border-border p-6 shadow-luxury max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-semibold text-foreground">
                    {editCategory?.id ? 'Edit Category' : 'Add Category'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowCategoryForm(false);
                      setEditCategory(null);
                    }}
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <form onSubmit={saveCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Category Name (English) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editCategory?.name ?? ''}
                      onChange={(e) =>
                        setEditCategory((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., Diagnostic"
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Category Name (Arabic) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editCategory?.name_ar ?? ''}
                      onChange={(e) =>
                        setEditCategory((prev) => ({ ...prev, name_ar: e.target.value }))
                      }
                      placeholder="e.g., تشخيصي"
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      dir="rtl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Description (English)
                    </label>
                    <textarea
                      rows={2}
                      value={editCategory?.description ?? ''}
                      onChange={(e) =>
                        setEditCategory((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description"
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Description (Arabic)
                    </label>
                    <textarea
                      rows={2}
                      value={editCategory?.description_ar ?? ''}
                      onChange={(e) =>
                        setEditCategory((prev) => ({
                          ...prev,
                          description_ar: e.target.value,
                        }))
                      }
                      placeholder="وصف اختياري"
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      dir="rtl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editCategory?.order_index ?? 1}
                      onChange={(e) =>
                        setEditCategory((prev) => ({
                          ...prev,
                          order_index: Number(e.target.value),
                        }))
                      }
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-gradient-gold rounded-lg font-semibold text-white hover:opacity-90 transition-all shadow-gold"
                  >
                    {editCategory?.id ? 'Update' : 'Create'} Category
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Categories Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-luxury">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Name (EN)
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Name (AR)
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    const filteredCategories = categoriesList.filter((cat) => {
                      if (!categorySearch.trim()) return true;
                      const searchTerm = categorySearch.toLowerCase();
                      return (
                        cat.name.toLowerCase().includes(searchTerm) ||
                        cat.name_ar.toLowerCase().includes(searchTerm) ||
                        (cat.description && cat.description.toLowerCase().includes(searchTerm)) ||
                        (cat.description_ar && cat.description_ar.toLowerCase().includes(searchTerm))
                      );
                    });

                    return filteredCategories.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-muted-foreground text-sm"
                        >
                          {categorySearch.trim() ? 'No categories match your search.' : 'No categories yet. Create your first one!'}
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => (
                        <tr
                          key={cat.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-6 py-3 text-sm text-foreground font-medium">
                            {cat.name}
                          </td>
                          <td className="px-6 py-3 text-sm text-foreground">
                            {cat.name_ar}
                          </td>
                          <td className="px-6 py-3 text-sm text-muted-foreground truncate max-w-xs">
                            {cat.description || '-'}
                          </td>
                          <td className="px-6 py-3 text-sm text-foreground">
                            {cat.order_index}
                          </td>
                          <td className="px-6 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditCategory(cat);
                                  setShowCategoryForm(true);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors text-xs font-medium"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => deleteCategory(cat.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors text-xs font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        }

        {/* Orders */}
        {tab === 'orders' &&
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-display font-semibold text-foreground">Orders</h2>
              <div className="relative w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search orders by status, customer, or order ID..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full sm:w-80 px-4 py-2 pl-10 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {orderSearch && (
                  <button
                    onClick={() => setOrderSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* Filter orders based on search */}
            {(() => {
              const filteredOrders = orders.filter((o) => {
                if (!orderSearch.trim()) return true;
                const searchTerm = orderSearch.toLowerCase();
                return (
                  o.status.toLowerCase().includes(searchTerm) ||
                  o.shipping_name.toLowerCase().includes(searchTerm) ||
                  o.shipping_email?.toLowerCase().includes(searchTerm) ||
                  o.id.toLowerCase().includes(searchTerm) ||
                  o.shipping_country?.toLowerCase().includes(searchTerm) ||
                  o.shipping_city?.toLowerCase().includes(searchTerm)
                );
              });

              return (
                <>
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto opacity-50 mb-3" />
                      <p className="text-muted-foreground">
                        {orderSearch.trim() ? 'No orders match your search.' : 'No orders yet.'}
                      </p>
                    </div>
                  ) : (
                    filteredOrders.map((o) =>
          <div key={o.id} className="bg-card rounded-xl border border-border p-5 shadow-luxury">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="font-mono text-sm text-foreground">{o.id.slice(0, 8)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="text-sm text-foreground">{o.shipping_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-bold text-foreground">${Number(o.total).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="text-sm text-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground">
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button onClick={() => deleteOrder(o.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete order">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setExpandedOrders((prev) => {
                        const next = new Set(prev);
                        if (next.has(o.id)) next.delete(o.id);
                        else next.add(o.id);
                        return next;
                      });
                    }}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Toggle customer details"
                  >
                    {expandedOrders.has(o.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {expandedOrders.has(o.id) && (
                  <div className="border-t border-border pt-3 text-sm space-y-1">
                    <p><strong>Email:</strong> {o.shipping_email || '—'}</p>
                    <p><strong>Phone:</strong> {o.shipping_phone || '—'}</p>
                    <p><strong>Country:</strong> {o.shipping_country || '—'}</p>
                    <p><strong>City:</strong> {o.shipping_city || '—'}</p>
                    <p><strong>Address:</strong> {o.shipping_address || '—'}</p>
                  </div>
                )}
                {o.order_items && o.order_items.length > 0 &&
            <div className="border-t border-border pt-3 space-y-2">
                    {o.order_items.map((item, i) =>
              <div key={i} className="flex items-center gap-3">
                        {item.product_image_url ?
                <img src={item.product_image_url} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" /> :

                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                }
                        <p className="text-sm text-muted-foreground">{item.quantity}x {item.product_name} — ${Number(item.price).toLocaleString()}</p>
                      </div>
              )}
                  </div>
            }
              </div>
          )
                  )}
                </>
              );
            })()}
          </div>
        }

        {/* Certificates */}
        {tab === 'certificates' && <CertificatesTab />}

        {/* Exhibitions */}
        {tab === 'exhibitions' && <AdminExhibitions />}

        {/* Messages */}
        {tab === 'messages' && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">Contact Messages</h2>
            {messages.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`bg-card rounded-xl border border-border p-5 shadow-luxury ${!m.read ? 'border-l-4 border-l-accent' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!m.read && <span className="w-2 h-2 rounded-full bg-red-500" />}
                    <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
                    <button onClick={() => deleteMessage(m.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete message">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-foreground">{m.message}</p>
                {!m.read && (
                  <button
                    onClick={async () => {
                      await supabase.from('contact_messages').update({ read: true }).eq('id', m.id);
                      setMessages((prev) => prev.map((msg) => (msg.id === m.id ? { ...msg, read: true } : msg)));
                    }}
                    className="mt-2 text-xs text-accent hover:underline"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quotes */}
        {tab === 'quotes' && <AdminQuotesTab />}

        {/* Users */}
        {tab === 'users' &&
        <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-display font-semibold text-foreground">Registered Users ({regularUsers.length})</h2>
            </div>
            {regularUsers.length === 0 && <p className="text-muted-foreground">No users yet.</p>}
            <div className="grid gap-4">
              {regularUsers.map((u) =>
            <div key={u.id} className="flex flex-wrap items-center gap-4 bg-card rounded-xl border border-border p-5 shadow-luxury">
                  <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center font-bold text-lg shrink-0 text-gray-50">
                    {(u.full_name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{u.full_name || 'No name'}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {u.phone && <span>📞 {u.phone}</span>}
                      {u.country && <span>🌍 {u.country}</span>}
                      <span>Joined: {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteUser(u.user_id)} className="p-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
            )}
            </div>
          </div>
        }

        {/* Newsletter */}
        {tab === 'newsletter' && <NewsletterTab />}

        {/* Settings */}
        {tab === 'settings' && <AdminSettingsTab />}
          </div>
        </main>
      </div>
    </AdminErrorBoundary>
  );

};

/* ─── Newsletter Tab ─── */
const NewsletterTab = () => {
  const { markNewsletterAsRead } = useAdminNotifications();
  const [subscribers, setSubscribers] = useState<{id: string;email: string;created_at: string;}[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{open: boolean;id: string;email: string;} | null>(null);

  // mark anything unread as read whenever the newsletter tab mounts
  useEffect(() => {
    markNewsletterAsRead();
    fetchSubscribers();
  }, [markNewsletterAsRead]);

  const fetchSubscribers = async () => {
    setLoading(true);
    const { data } = await supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
    setSubscribers(data ?? []);
    setLoading(false);
  };

  const deleteSubscriber = async (id: string) => {
    await supabase.from('newsletter_subscribers').delete().eq('id', id);
    setSubscribers((prev) => prev.filter((s) => s.id !== id));
    toast.success('Subscriber removed');
    setConfirmModal(null);
  };

  const exportCSV = () => {
    const csv = ['Email,Subscribed At', ...subscribers.map((s) => `${s.email},${new Date(s.created_at).toLocaleDateString()}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-subscribers-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  return (
    <div>
      <AnimatePresence>
        {confirmModal?.open &&
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl border border-border p-6 shadow-luxury w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="font-display font-bold text-foreground">Remove Subscriber</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Remove <strong>{confirmModal.email}</strong> from the newsletter list?</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors">Cancel</button>
                <button onClick={() => deleteSubscriber(confirmModal.id)} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">Remove</button>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-display font-semibold text-foreground">Newsletter Subscribers ({subscribers.length})</h2>
        <button onClick={exportCSV} disabled={subscribers.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {!loading && subscribers.length === 0 && <p className="text-muted-foreground">No subscribers yet.</p>}

      <div className="grid gap-3">
        {subscribers.map((s) =>
        <div key={s.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4 shadow-luxury">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{s.email}</p>
              <p className="text-xs text-muted-foreground">Subscribed: {new Date(s.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setConfirmModal({ open: true, id: s.id, email: s.email })}
          className="p-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>);

};

/* ─── Admin Settings Tab ─── */
const AdminSettingsTab = () => {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    // Update profile table
    const { error: profileError } = await supabase.from('profiles').update({
      full_name: fullName,
      email,
      phone,
      country
    }).eq('user_id', user.id);

    if (profileError) {
      toast.error(profileError.message);
      setSaving(false);
      return;
    }

    // Update auth email if changed
    if (email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        toast.error('Email update: ' + emailError.message);
        setSaving(false);
        return;
      }
      toast.info('A confirmation email has been sent to verify your new email address.');
    }

    // Update password if provided
    if (newPassword.trim()) {
      if (newPassword.length < 6) {
        toast.error('Password must be at least 6 characters');
        setSaving(false);
        return;
      }
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) {
        toast.error('Password update: ' + pwError.message);
        setSaving(false);
        return;
      }
      setNewPassword('');
      toast.success('Password updated successfully');
    }

    toast.success('Profile updated successfully');
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-display font-semibold text-foreground mb-6">Admin Settings</h2>
      <form onSubmit={handleSaveProfile} className="bg-card rounded-xl border border-border p-6 shadow-luxury space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Country</label>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></label>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={saving}
        className="w-full px-6 py-3 bg-gradient-gold rounded-lg font-semibold text-white hover:opacity-90 transition-all shadow-gold disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>);

};

/* ─── Certificates Tab ─── */
const CertificatesTab = () => {
  const [certs, setCerts] = useState<{id: string;title: string;title_ar: string;type: string;file_url: string;}[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {fetchCerts();}, []);

  const fetchCerts = async () => {
    const { data } = await supabase.from<Certificate>('certificates').select('*').order('created_at', { ascending: false });
    setCerts(data ?? []);
  };

  const uploadCert = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    if (!file) return;
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('certificates').upload(path, file);
    if (uploadErr) {toast.error(uploadErr.message);setUploading(false);return;}
    const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(path);
    const { error } = await supabase.from('certificates').insert({
      title: formData.get('title') as string,
      title_ar: formData.get('title_ar') as string || '',
      type: formData.get('type') as string || 'ISO',
      file_url: urlData.publicUrl
    });
    setUploading(false);
    if (error) {toast.error(error.message);return;}
    toast.success('Certificate uploaded');
    e.currentTarget.reset();
    fetchCerts();
  };

  const deleteCert = async (id: string) => {
    await supabase.from('certificates').delete().eq('id', id);
    toast.success('Certificate deleted');
    fetchCerts();
  };

  return (
    <div>
      <h2 className="text-lg font-display font-semibold text-foreground mb-4">Certificates</h2>
      <form onSubmit={uploadCert} className="bg-card rounded-xl border border-border p-6 shadow-luxury mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input name="title" required placeholder="Title (EN)" className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
          <input name="title_ar" placeholder="Title (AR)" className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
          <select name="type" className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
            <option value="ISO">ISO</option><option value="CE">CE</option><option value="FDA">FDA</option>
          </select>
        </div>
        <div className="flex gap-4 items-center">
          <input name="file" type="file" required accept="image/*,.pdf" className="text-sm text-foreground" />
          <button type="submit" disabled={uploading} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
      <div className="grid gap-3">
        {certs.map((c) =>
        <div key={c.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4 shadow-luxury">
            <span className="px-2 py-1 rounded bg-accent/20 text-accent text-xs font-bold">{c.type}</span>
            <button onClick={() => deleteCert(c.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>);

};

export default Admin;