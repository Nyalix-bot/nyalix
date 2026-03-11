import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateAndSendNotifications } from '@/lib/notifications';

const Cart = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [orderId, setOrderId] = useState('');
  const [placing, setPlacing] = useState(false);

  const handleCheckout = () => {
    if (!user) {
      toast.info('Please login to place an order');
      navigate('/auth');
      return;
    }
    setStep('checkout');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPlacing(true);
    const formData = new FormData(e.target as HTMLFormElement);

    const basePayload: Record<string, any> = {
      user_id: user.id,
      total: totalPrice,
      shipping_name: formData.get('fullName') as string,
      shipping_address: formData.get('address') as string,
      shipping_city: formData.get('city') as string,
      shipping_country: formData.get('country') as string,
      shipping_phone: formData.get('phone') as string,
      shipping_email: formData.get('email') as string
    };

    // attempt to insert; if column is missing in schema we retry without it
    let order;
    let error;
    ({ data: order, error } = await supabase.from('orders').insert(basePayload).select('id').single());

    if (error && /shipping_email/.test(error.message)) {
      // probably schema doesn't include that column yet
      const payload = { ...basePayload };
      delete payload.shipping_email;
      const res = await supabase.from('orders').insert(payload).select('id').single();
      order = res.data;
      error = res.error;
      if (!error) {
        toast.warning('Shipping email not saved because database schema is outdated. Please run migrations.');
      }
    }

    if (error || !order) {
      toast.error(error?.message || 'Failed to place order');
      setPlacing(false);
      return;
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: language === 'ar' ? item.product.name_ar : item.product.name,
      quantity: item.quantity,
      price: item.product.price * item.quantity,
      product_image_url: item.product.images?.[0] || ''
    }));

    await supabase.from('order_items').insert(orderItems);

    setOrderId(order.id.slice(0, 8).toUpperCase());
    setStep('success');
    clearCart();
    setPlacing(false);

    // Send order notifications
    await generateAndSendNotifications('order_placed', user.id, order.id);
  };

  if (step === 'success') {
    return (
      <div className="pt-20 min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">{t('cart.orderSuccess')}</h1>
          <p className="text-muted-foreground mb-4">{t('cart.orderThankYou')}</p>
          <div className="bg-muted rounded-lg p-4 mb-8">
            <span className="text-sm text-muted-foreground">{t('cart.orderIdLabel')}</span>
            <p className="text-lg font-bold text-gold">NYX-{orderId}</p>
          </div>
          <Link to="/products" className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-navy-light transition-colors">
            {t('cart.continueShopping')}
          </Link>
        </motion.div>
      </div>);

  }

  if (items.length === 0 && step === 'cart') {
    return (
      <div className="pt-20 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">{t('cart.empty')}</h2>
          <Link to="/products" className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-navy-light transition-colors">
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>);

  }

  return (
    <div className="pt-20 min-h-screen bg-background">
      <div className="bg-gradient-navy py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-display font-bold text-primary-foreground">
            {step === 'cart' ? t('cart.title') : t('cart.shippingDetails')}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {step === 'cart' ?
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => {
              const name = language === 'ar' ? item.product.name_ar : item.product.name;
              return (
                <div key={item.product.id} className="flex gap-4 bg-card rounded-xl border border-border p-4 shadow-luxury">
                    <img src={item.product.images?.[0] || '/placeholder.svg'} alt={name} className="w-24 h-24 rounded-lg object-cover opacity-100" />
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-foreground">{name}</h3>
                      <p className="text-gold font-bold mt-1">${item.product.price.toLocaleString()}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1 rounded bg-muted hover:bg-border transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <button onClick={() => {
                        const stock = item.product.stock_quantity ?? 0;
                        if (stock > 0 && item.quantity >= stock) {
                          toast.warning(`⚠️ Only ${stock} units available in stock.`);
                          return;
                        }
                        updateQuantity(item.product.id, item.quantity + 1);
                      }} className="p-1 rounded bg-muted hover:bg-border transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} className="self-start p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>);

            })}
            </div>
            <div className="bg-card rounded-xl border border-border p-6 shadow-luxury h-fit">
              <h3 className="font-display font-semibold text-foreground text-lg mb-4">{t('cart.orderSummary')}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.subtotal')}</span><span className="font-medium text-foreground">${totalPrice.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('cart.shipping')}</span><span className="font-medium text-gold">{t('cart.free')}</span></div>
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-semibold text-foreground">{t('cart.total')}</span>
                  <span className="text-xl font-bold text-foreground">${totalPrice.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={handleCheckout} className="w-full mt-6 px-6 py-3.5 bg-gradient-gold rounded-lg font-semibold transition-all shadow-gold text-primary-foreground opacity-100">
                {t('cart.checkout')}
              </button>
            </div>
          </div> :

        <div className="max-w-2xl mx-auto">
            <form onSubmit={handlePlaceOrder} className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-luxury space-y-4">
                {[
              { name: 'fullName', label: t('cart.fullName'), type: 'text' },
              { name: 'email', label: t('cart.email'), type: 'email' },
              { name: 'phone', label: t('cart.phone'), type: 'tel' },
              { name: 'country', label: t('cart.country'), type: 'text' },
              { name: 'city', label: t('cart.city'), type: 'text' },
              { name: 'address', label: t('cart.address'), type: 'text' }].
              map((field) =>
              <div key={field.name}>
                    <label className="block text-sm font-medium text-foreground mb-1">{field.label}</label>
                    <input name={field.name} type={field.type} required className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
                  </div>
              )}
              </div>
              <div className="bg-card rounded-xl border border-border p-6 shadow-luxury">
                <h3 className="font-display font-semibold text-foreground mb-3">{t('cart.orderSummary')}</h3>
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-semibold text-foreground">{t('cart.total')}</span>
                  <span className="text-xl font-bold text-foreground">${totalPrice.toLocaleString()}</span>
                </div>
              </div>
              <button type="submit" disabled={placing} className="w-full px-8 py-3.5 bg-gradient-gold rounded-lg font-semibold transition-all shadow-gold text-primary-foreground opacity-100">
                {placing ? 'Placing order...' : t('cart.placeOrder')}
              </button>
            </form>
          </div>
        }
      </div>
    </div>);

};

export default Cart;