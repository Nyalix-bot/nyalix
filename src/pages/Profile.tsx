import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon, User, Package, Clock, CheckCircle, Truck, XCircle, ChevronDown, ChevronUp, Pencil, Save, X, Star } from 'lucide-react';
import { toast } from 'sonner';
import StarRating from '@/components/StarRating';

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  product_id: string | null;
  product_image_url?: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  shipping_name: string;
  shipping_email?: string;
  shipping_phone?: string;
  shipping_city: string;
  shipping_country: string;
  shipping_address?: string;
  order_items?: OrderItem[];
}

interface Review {
  id: string;
  product_id: string;
  order_id: string;
  rating: number;
  review_text: string;
}

const statusConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  processing: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-100' },
  shipped: { icon: Truck, color: 'text-purple-600', bg: 'bg-purple-100' },
  delivered: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  cancelled: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
};

/* ── Review Modal ── */
const ReviewModal = ({
  open,
  orderId,
  productId,
  productName,
  userId,
  existingReview,
  onClose,
  onSaved









}: {open: boolean;orderId: string;productId: string;productName: string;userId: string;existingReview?: Review;onClose: () => void;onSaved: () => void;}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [text, setText] = useState(existingReview?.review_text || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(existingReview?.rating || 0);
      setText(existingReview?.review_text || '');
    }
  }, [open, existingReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {toast.error('Please select a rating');return;}
    setSaving(true);

    if (existingReview) {
      const { error } = await supabase.from('product_reviews').update({ rating, review_text: text }).eq('id', existingReview.id);
      if (error) {toast.error(error.message);setSaving(false);return;}
    } else {
      const { error } = await supabase.from('product_reviews').insert({
        product_id: productId,
        user_id: userId,
        order_id: orderId,
        rating,
        review_text: text
      });
      if (error) {toast.error(error.message);setSaving(false);return;}
    }

    toast.success('Review submitted! Thank you.');
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border p-6 shadow-luxury w-full max-w-md">
        
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-foreground text-lg">
            {existingReview ? 'Edit Your Review' : 'Write a Review'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4 truncate">{productName}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Your Rating</label>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Your Review <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share your experience with this product..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            
          </div>
          <button
            type="submit"
            disabled={saving || rating === 0}
            className="w-full px-6 py-3 bg-gradient-gold rounded-lg font-semibold text-primary hover:opacity-90 transition-all shadow-gold disabled:opacity-50">
            
            {saving ? 'Submitting...' : existingReview ? 'Update Review' : 'Submit Review'}
          </button>
        </form>
      </motion.div>
    </div>);

};

/* ── Main Profile Component ── */
const Profile = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;orderId: string;productId: string;productName: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.
    from('orders').
    select('*, order_items(product_name, quantity, price, product_id, product_image_url)').
    order('created_at', { ascending: false });
    setOrders(data as unknown as Order[] ?? []);
  }, []);

  const fetchReviews = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('product_reviews').select('*').eq('user_id', user.id);
    setReviews(data as unknown as Review[] ?? []);
  }, [user]);

  useEffect(() => {
    if (user) {fetchOrders();fetchReviews();}
  }, [user, fetchOrders, fetchReviews]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditPhone(profile.phone || '');
      setEditCountry(profile.country || '');
    }
  }, [profile]);

  const getExistingReview = (orderId: string, productId: string) =>
  reviews.find((r) => r.order_id === orderId && r.product_id === productId);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editName,
      phone: editPhone,
      country: editCountry
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) {toast.error(error.message);return;}
    toast.success('Profile updated successfully');
    setEditing(false);
    window.location.reload();
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (error) {toast.error(error.message);return;}
    toast.success('Order cancelled successfully');
    fetchOrders();
  };

  if (loading || !user) return null;

  return (
    <div className="pt-20 min-h-screen bg-background">
      {/* Review Modal */}
      <AnimatePresence>
        {reviewModal?.open &&
        <ReviewModal
          open={reviewModal.open}
          orderId={reviewModal.orderId}
          productId={reviewModal.productId}
          productName={reviewModal.productName}
          userId={user.id}
          existingReview={getExistingReview(reviewModal.orderId, reviewModal.productId)}
          onClose={() => setReviewModal(null)}
          onSaved={fetchReviews} />

        }
      </AnimatePresence>

      <div className="bg-gradient-navy py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-primary-foreground">My Account</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-6 shadow-luxury">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-gold flex items-center justify-center">
                <User className="w-8 h-8 text-gray-50" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">{profile?.full_name || 'User'}</h2>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
            {!editing ?
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Pencil className="w-4 h-4" /> Edit Profile
              </button> :

            <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            }
          </div>

          {editing ?
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Country</label>
                <input type="text" value={editCountry} onChange={(e) => setEditCountry(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div> :

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {[
            { label: 'Phone', value: profile?.phone || '—' },
            { label: 'Country', value: profile?.country || '—' },
            { label: 'Total Orders', value: orders.length }].
            map((item, i) =>
            <div key={i} className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-semibold text-foreground">{item.value}</p>
                </div>
            )}
            </div>
          }
        </motion.div>

        {/* Orders */}
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">My Orders</h2>
          {orders.length === 0 ?
          <div className="bg-card rounded-xl border border-border p-8 text-center shadow-luxury">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            </div> :

          <div className="space-y-4">
              {orders.map((order, i) => {
              const config = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const isExpanded = expandedOrder === order.id;
              const canCancel = order.status === 'pending' || order.status === 'processing';
              const isDelivered = order.status === 'delivered';

              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border shadow-luxury overflow-hidden">
                    <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Product image thumbnail */}
                        {order.order_items?.[0]?.product_image_url ?
                      <img
                        src={order.order_items[0].product_image_url}
                        alt={order.order_items[0].product_name}
                        className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" /> :


                      <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                            <StatusIcon className={`w-5 h-5 ${config.color}`} />
                          </div>
                      }
                        <div>
                          <p className="font-mono text-sm text-foreground">#{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${config.bg} ${config.color}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-foreground">${Number(order.total).toLocaleString()}</p>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded &&
                  <div className="border-t border-border p-5 bg-muted/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Shipping To</p>
                            <p className="text-sm text-foreground">{order.shipping_name}</p>
                            {order.shipping_email && <p className="text-sm text-muted-foreground">{order.shipping_email}</p>}
                            <p className="text-sm text-muted-foreground">{order.shipping_city}, {order.shipping_country}</p>
                            {order.shipping_phone && <p className="text-sm text-muted-foreground">Phone: {order.shipping_phone}</p>}
                            {order.shipping_address && <p className="text-sm text-muted-foreground">{order.shipping_address}</p>}
                          </div>
                          {/* Status Timeline */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Order Progress</p>
                            <div className="flex items-center gap-1">
                              {['pending', 'processing', 'shipped', 'delivered'].map((step, si) => {
                            const steps = ['pending', 'processing', 'shipped', 'delivered'];
                            const currentIdx = steps.indexOf(order.status);
                            const isActive = si <= currentIdx && order.status !== 'cancelled';
                            return (
                              <div key={step} className="flex items-center gap-1 flex-1">
                                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-primary' : 'bg-border'}`} />
                                    {si < 3 && <div className={`h-0.5 flex-1 ${isActive && si < currentIdx ? 'bg-primary' : 'bg-border'}`} />}
                                  </div>);

                          })}
                            </div>
                            <div className="flex justify-between mt-1">
                              {['Pending', 'Processing', 'Shipped', 'Delivered'].map((s) =>
                          <span key={s} className="text-[10px] text-muted-foreground">{s}</span>
                          )}
                            </div>
                          </div>
                        </div>

                        {/* Order items with images */}
                        {order.order_items && order.order_items.length > 0 &&
                    <div className="mb-4">
                            <p className="text-xs text-muted-foreground mb-3">Items</p>
                            <div className="space-y-3">
                              {order.order_items.map((item, idx) => {
                          const existing = item.product_id ? getExistingReview(order.id, item.product_id) : undefined;
                          return (
                            <div key={idx} className="flex items-center gap-3">
                                    {item.product_image_url ?
                              <img
                                src={item.product_image_url}
                                alt={item.product_name}
                                className="w-14 h-14 rounded-lg object-cover border border-border shrink-0" /> :


                              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Package className="w-6 h-6 text-muted-foreground" />
                                      </div>
                              }
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} · ${Number(item.price).toLocaleString()}</p>
                                      {existing &&
                                <div className="flex items-center gap-1 mt-0.5">
                                          <StarRating value={existing.rating} readonly size="sm" />
                                          <span className="text-xs text-muted-foreground">Your review</span>
                                        </div>
                                }
                                    </div>
                                    {isDelivered && item.product_id &&
                              <button
                                onClick={() => setReviewModal({ open: true, orderId: order.id, productId: item.product_id!, productName: item.product_name })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                                existing ?
                                'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100' :
                                'bg-primary text-primary-foreground hover:bg-primary/90'}`
                                }>
                                
                                        <Star className="w-3.5 h-3.5" />
                                        {existing ? 'Edit Review' : 'Write Review'}
                                      </button>
                              }
                                  </div>);

                        })}
                            </div>
                          </div>
                    }

                        {/* Cancel Order Button */}
                        {canCancel &&
                    <button onClick={() => handleCancelOrder(order.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                            <XCircle className="w-4 h-4" /> Cancel Order
                          </button>
                    }
                        {order.status === 'cancelled' &&
                    <p className="text-sm text-red-500 font-medium">This order has been cancelled.</p>
                    }
                      </div>
                  }
                  </motion.div>);

            })}
            </div>
          }
        </div>
      </div>
    </div>);

};

export default Profile;