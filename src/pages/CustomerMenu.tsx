import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  serverTimestamp,
  onSnapshot,
  updateDoc,
  increment
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Utensils, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  ChefHat,
  X,
  ArrowRight,
  BellRing,
  Check,
  Receipt
} from 'lucide-react';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';
import { MenuItem, Restaurant, OrderItem, Order } from '../types';
import { applyTheme } from '../themes';
import InvoiceModal from '../components/InvoiceModal';
import SleekLoader from '../components/SleekLoader';

export default function CustomerMenu() {
  const { restaurantId, tableNo } = useParams<{ restaurantId: string, tableNo: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    if (restaurant?.theme) {
      applyTheme(restaurant.theme);
    } else {
      applyTheme('classic-orange');
    }
  }, [restaurant?.theme]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [checkoutTableNo, setCheckoutTableNo] = useState(tableNo === 'PREVIEW' ? '' : (tableNo || ''));
  const [orderSent, setOrderSent] = useState<Order | null>(null);
  const [qrTableInfo, setQrTableInfo] = useState<any>(null);

  const [pastOrders, setPastOrders] = useState<Order[]>([]);

  // Check for active order in local storage
  useEffect(() => {
    if (!restaurantId) return;
    const key = `activeOrder_${restaurantId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt > Date.now()) {
          // Still valid, set as orderSent to trigger status listener
          setOrderSent({ id: parsed.orderId } as Order);
        } else {
          localStorage.removeItem(key);
        }
      } catch (e) {
         localStorage.removeItem(key);
      }
    }
  }, [restaurantId, tableNo]);

  // Fetch Restaurant and Menu
  useEffect(() => {
    if (!restaurantId) return;

    const fetchData = async () => {
      try {
        const [rDoc, qrSnap] = await Promise.all([
          getDoc(doc(db, 'restaurants', restaurantId)),
          (tableNo && tableNo !== 'PREVIEW') 
            ? getDocs(query(collection(db, 'qrTables'), where('restaurantId', '==', restaurantId), where('tableNo', '==', tableNo)))
            : Promise.resolve({ empty: true, docs: [] })
        ]);
        
        if (rDoc.exists()) {
          setRestaurant({ id: rDoc.id, ...rDoc.data() } as Restaurant);
        }
        
        if (!qrSnap.empty) {
          setQrTableInfo({ id: qrSnap.docs[0].id, ...qrSnap.docs[0].data() });
        }
      } catch (error) {
        console.error("Error fetching restaurant or QR info", error);
      }
      
      // Don't block the UI rendering for past orders
      setLoading(false);
      
      try {
        // Fetch past orders in the background only if there's an authenticated session (staff/owner)
        if (auth.currentUser) {
          const qPath = 'orders';
          const ordersQ = query(collection(db, qPath), where('restaurantId', '==', restaurantId));
          getDocs(ordersQ).then(ordersSnap => {
            setPastOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
          }).catch(err => console.error("Error fetching past orders", err));
        }
      } catch (error) {
        console.error("Error setting up orders fetch", error);
      }
    };
    
    fetchData();

    const qPath = 'menuItems';
    const q = query(collection(db, qPath), where('restaurantId', '==', restaurantId), where('isAvailable', '==', true));
    const unsub = onSnapshot(q, (mSnapshot) => {
      const items = mSnapshot.docs.map(iDoc => ({ id: iDoc.id, ...iDoc.data() } as MenuItem));
      setMenuItems(items);
    }, (error) => {
      console.error("Error listening to menuItems:", error);
    });

    return unsub;
  }, [restaurantId]);

  // Listen to placed order status
  useEffect(() => {
    if (!orderSent?.id) return;
    const path = `orders/${orderSent.id}`;
    const unsub = onSnapshot(doc(db, 'orders', orderSent.id), (snap) => {
      if (snap.exists()) {
        setOrderSent({ id: snap.id, ...snap.data() } as Order);
      }
    }, (error) => {
      console.error("Error listening to order status:", error);
    });
    return unsub;
  }, [orderSent?.id]);

  const availableMenuItems = useMemo(() => {
    return menuItems.filter(i => {
      if (i.category === 'Inventory Product') return false;
      
      const isMismatch = i.businessType && restaurant?.businessType && i.businessType !== restaurant.businessType;
      
      let isOldMismatch = false;
      if (!i.businessType && restaurant?.businessType) {
        const cat = i.category as string;
        if (restaurant.businessType === 'Salon') {
          isOldMismatch = !['Hair', 'Face', 'Spa & Massage', 'Other Services'].includes(cat);
        } else if (restaurant.businessType === 'Clinic') {
          isOldMismatch = !['Consultation', 'Diagnostics', 'Treatment', 'Other Services'].includes(cat);
        } else {
          isOldMismatch = !['Main Course', 'Snacks', 'Drinks', 'Desserts'].includes(cat);
        }
      }

      if (isMismatch || isOldMismatch) return false;

      const isServiceOrFood = ['clinic', 'salon', 'gym', 'restaurant', 'cafe', 'fast food', 'hotel', 'fastfood'].includes(restaurant?.businessType?.toLowerCase() || '');
      if (isServiceOrFood) {
        return true;
      }
      return i.stockCount > 0;
    });
  }, [menuItems, restaurant?.businessType]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(availableMenuItems.map(i => i.category)));
    return ['All', ...cats];
  }, [availableMenuItems]);

  const filteredItems = availableMenuItems.filter(i => 
    (activeCategory === 'All' || i.category === activeCategory) &&
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.description && i.description.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const popularItems = useMemo(() => {
    const counts: Record<string, number> = {};
    pastOrders.forEach(order => {
      if (order.status !== 'CANCELLED') {
        order.items?.forEach(item => {
          counts[item.id] = (counts[item.id] || 0) + item.quantity;
        });
      }
    });
    return availableMenuItems
      .filter(item => counts[item.id])
      .sort((a, b) => counts[b.id] - counts[a.id])
      .slice(0, 3);
  }, [pastOrders, availableMenuItems]);

  const suggestedItems = useMemo(() => {
    if (cart.length === 0) return [];
    const cartItemIds = cart.map(i => i.id);
    const suggestions: Record<string, number> = {};
    
    pastOrders.forEach(order => {
      if (order.status !== 'CANCELLED' && order.items) {
        const orderItemIds = order.items.map(i => i.id);
        if (orderItemIds.some(id => cartItemIds.includes(id))) {
          orderItemIds.forEach(id => {
            if (!cartItemIds.includes(id)) {
              suggestions[id] = (suggestions[id] || 0) + 1;
            }
          });
        }
      }
    });
    
    return availableMenuItems
      .filter(item => suggestions[item.id])
      .sort((a,b) => suggestions[b.id] - suggestions[a.id])
      .slice(0, 3);
  }, [pastOrders, availableMenuItems, cart]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const updateCart = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        let newQty = existing.quantity + delta;
        if (restaurant?.businessType === 'Salon' || restaurant?.businessType === 'Clinic') {
          if (newQty > 1) newQty = 1;
        }
        if (newQty <= 0) return prev.filter(i => i.id !== item.id);
        return prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i);
      }
      if (delta > 0) return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
      return prev;
    });
  };

  const placeOrder = async () => {
    if (!customerName || !checkoutTableNo || cart.length === 0 || !restaurantId) return;
    setLoading(true);
    const qPath = 'orders';
    try {
      const orderData = {
        restaurantId,
        tableNo: checkoutTableNo,
        customerName,
        items: cart,
        totalAmount,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, qPath), orderData);
      
      const isServiceOrFood = ['clinic', 'salon', 'gym', 'restaurant', 'cafe', 'fast food', 'hotel', 'fastfood'].includes(restaurant?.businessType?.toLowerCase() || '');
      if (!isServiceOrFood) {
        // Update stock for all items in the cart (if stock is being tracked)
        await Promise.all(cart.map(async item => {
          const menuItemDoc = await getDoc(doc(db, 'menuItems', item.id));
          if (menuItemDoc.exists()) {
            const currentStock = menuItemDoc.data().stockCount;
            // If we are tracking stock (not null/undefined/0 for salons), decrement it
            if (currentStock !== null && currentStock !== undefined) {
               await updateDoc(doc(db, 'menuItems', item.id), {
                 stockCount: increment(-item.quantity)
               }).catch(err => {
                 console.error("Failed to update stock", err);
               });
            }
          }
        }));
      }
      
      const key = `activeOrder_${restaurantId}`;
      localStorage.setItem(key, JSON.stringify({
        orderId: docRef.id,
        expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
      }));

      setOrderSent({ id: docRef.id, ...orderData } as any);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (e) {
      console.error("Failed to place order: ", e);
      alert("Order placement failed! Please check your internet connection and try again. (" + (e instanceof Error ? e.message : "Database Error") + ")");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !restaurant) return (
    <SleekLoader message="Loading Menu..." />
  );

  if (!restaurant) return <div>Restaurant not found</div>;

  if (orderSent) {
    return <OrderStatusView order={orderSent} restaurantName={restaurant.name} googleMapReviewLink={qrTableInfo?.googleMapReviewLink} businessType={restaurant.businessType} />;
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text pb-32 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-brand-card/80 p-6 backdrop-blur-lg border-b border-brand-border">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{restaurant.name}</h1>
              <p className="text-xs font-semibold text-brand-primary">{(restaurant?.businessType === 'Salon' || restaurant?.businessType === 'Clinic') ? 'STAFF CODE' : 'TABLE'} {tableNo}</p>
            </div>
            <div className="rounded-full bg-brand-bg p-2 border border-brand-border">
              <Utensils className="h-5 w-5 opacity-40" />
            </div>
          </div>
          
          {/* Categories */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "whitespace-nowrap rounded-full px-5 py-2 text-sm font-black transition-all",
                  activeCategory === cat 
                    ? "bg-brand-primary text-white shadow-lg" 
                    : "bg-brand-card text-brand-text/50 border border-brand-border"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="mt-4">
             <input 
               type="text"
               placeholder="Search items..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full rounded-2xl border border-brand-border bg-brand-card px-5 py-3 text-sm outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      </header>

      {/* Menu List */}
      <main className="p-6">
        <div className="max-w-3xl mx-auto w-full">
          {popularItems.length > 0 && activeCategory === 'All' && (
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-black text-brand-text flex items-center gap-2">🔥 Popular / Trending</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {popularItems.map(item => (
                  <MenuItemCard key={item.id} item={item} cart={cart} updateCart={updateCart} businessType={restaurant?.businessType} />
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
             {activeCategory === 'All' && filteredItems.length > 0 && popularItems.length > 0 && (
                <h2 className="text-xl font-black text-brand-text mb-4">All Items</h2>
             )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredItems.map(item => (
                <MenuItemCard key={item.id} item={item} cart={cart} updateCart={updateCart} businessType={restaurant?.businessType} />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Cart Bar */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-0 z-50 flex w-full justify-center px-6"
          >
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="flex w-full max-w-md items-center justify-between rounded-3xl bg-neutral-900 p-5 text-white shadow-2xl shadow-neutral-300"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ShoppingBag className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold">
                    {totalItems}
                  </span>
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">View Basket</span>
                  <span className="font-bold">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Sidebar/Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 z-[70] flex w-full flex-col rounded-t-[40px] bg-brand-card p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-2xl font-black text-brand-text">Your Basket</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="rounded-full bg-brand-bg p-2 border border-brand-border"><X className="h-6 w-6" /></button>
              </div>

              <div className="space-y-4 mb-8">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-brand-text">{item.name}</span>
                      {(!restaurant || (restaurant.businessType !== 'Salon' && restaurant.businessType !== 'Clinic')) && (
                        <span className="ml-2 text-xs font-bold text-brand-primary">x{item.quantity}</span>
                      )}
                    </div>
                    <span className="font-bold text-brand-text">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {suggestedItems.length > 0 && (
                <div className="mb-8 border-t border-brand-border pt-6">
                  <h4 className="mb-4 text-[10px] font-black text-brand-text/40 uppercase tracking-widest flex items-center gap-2">
                    <Utensils className="h-4 w-4" /> Frequently Bought Together
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {suggestedItems.map(item => (
                       <MenuItemCard key={item.id} item={item} cart={cart} updateCart={updateCart} businessType={restaurant?.businessType} />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 rounded-3xl bg-brand-bg border border-brand-border p-6">
                <div>
                  <label className="mb-1 block text-[10px] font-black text-brand-text/40 uppercase tracking-widest">Your Name</label>
                  <input
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-brand-text/20"
                  />
                </div>
                {tableNo === 'PREVIEW' ? (
                  <div className="border-t border-brand-border pt-4">
                    <label className="mb-1 block text-[10px] font-black text-brand-text/40 uppercase tracking-widest">
                      {(restaurant?.businessType === 'Salon' || restaurant?.businessType === 'Clinic') ? 'Staff Code' : 'Table Number'}
                    </label>
                    <input
                      required
                      value={checkoutTableNo}
                      onChange={e => setCheckoutTableNo(e.target.value)}
                      placeholder={(restaurant?.businessType === 'Salon' || restaurant?.businessType === 'Clinic') ? 'Enter staff code (e.g. 101)' : 'Enter table number'}
                      className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-brand-text/20"
                    />
                  </div>
                ) : (
                  <div className="border-t border-brand-border pt-4 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-brand-text/40">
                      {(restaurant?.businessType === 'Salon' || restaurant?.businessType === 'Clinic') ? 'Staff Code' : 'Table Number'}
                    </span>
                    <span className="rounded-md bg-brand-secondary border border-brand-primary/10 px-2 py-0.5 text-xs font-black text-brand-primary uppercase tracking-widest">{tableNo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-brand-border pt-4">
                  <span className="text-sm font-bold opacity-40">Total Payable</span>
                  <span className="text-2xl font-black">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <button
                disabled={!customerName || !checkoutTableNo || loading}
                onClick={placeOrder}
                className="mt-8 flex h-16 w-full items-center justify-center gap-3 rounded-[24px] bg-brand-primary text-lg font-bold text-white shadow-xl shadow-brand-primary/20 hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Place Order'} <ArrowRight className="h-6 w-6" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItemCard({ item, cart, updateCart, businessType }: { key?: string | number, item: MenuItem, cart: OrderItem[], updateCart: (i: MenuItem, d: number) => void, businessType?: string }) {
  const inCart = cart.find(i => i.id === item.id);
  const isServiceOrFood = ['clinic', 'salon', 'gym', 'restaurant', 'cafe', 'fast food', 'hotel', 'fastfood'].includes(businessType?.toLowerCase() || '');
  const isAppointmentType = businessType === 'Salon' || businessType === 'Clinic';

  return (
    <motion.div 
      layout
      className="flex items-center gap-4 rounded-3xl border border-brand-border bg-brand-card p-4 shadow-sm"
    >
      {item.imageUrl && (
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-brand-bg border border-brand-border">
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-bold">{item.name}</h4>
        {businessType !== 'Salon' && businessType !== 'Clinic' && (
          <p className="text-xs opacity-50 line-clamp-1">{item.description}</p>
        )}
        {item.volume && (
          <div className="mt-1">
            <span className="inline-block rounded-md bg-brand-secondary border border-brand-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary">
              {item.volume}
            </span>
          </div>
        )}
        <p className="mt-1 font-bold text-brand-primary">{formatCurrency(item.price)}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        {inCart ? (
            <div className="flex items-center gap-3 rounded-full bg-brand-bg p-1 border border-brand-border">
              <button onClick={() => updateCart(item, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-card text-brand-primary shadow-sm border border-brand-border"><Minus className="h-4 w-4" /></button>
              <span className="text-sm font-bold">{inCart.quantity}</span>
              <button 
                disabled={isAppointmentType ? true : isServiceOrFood ? false : (item.stockCount !== null && item.stockCount !== undefined) ? inCart.quantity >= item.stockCount : false}
                onClick={() => updateCart(item, 1)} 
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-card text-brand-primary shadow-sm border border-brand-border disabled:opacity-50"
               >
                 <Plus className="h-4 w-4" />
               </button>
            </div>
        ) : (
          <button 
            disabled={isServiceOrFood ? false : (item.stockCount !== null && item.stockCount !== undefined) ? item.stockCount <= 0 : false}
            onClick={() => updateCart(item, 1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-lg shadow-brand-primary/20 transition-all active:scale-90 disabled:opacity-50 disabled:bg-neutral-300"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function OrderStatusView({ order, restaurantName, googleMapReviewLink, businessType }: { order: Order, restaurantName: string, googleMapReviewLink?: string, businessType?: string }) {
  const steps = [
    { label: 'Pending', status: 'PENDING', icon: Clock },
    { label: 'Accepted', status: 'ACCEPTED', icon: CheckCircle2 },
    { label: 'Preparing', status: 'PREPARING', icon: ChefHat },
    { label: 'Completed', status: 'COMPLETED', icon: Utensils }
  ];

  const currentIdx = steps.findIndex(s => s.status === order.status);

  const [showCompletionAlert, setShowCompletionAlert] = useState(false);
  const [hasAlerted, setHasAlerted] = useState(false);
  const [isEditingStaffCode, setIsEditingStaffCode] = useState(false);
  const [newStaffCode, setNewStaffCode] = useState(order.tableNo);
  const [hasEditedStaffCode, setHasEditedStaffCode] = useState(() => localStorage.getItem("edited_code_" + order.id) === "true");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const submitNewStaffCode = async () => {
    if (!newStaffCode.trim()) return;
    setIsUpdating(true);
    try {
       await updateDoc(doc(db, 'orders', order.id), {
          tableNo: newStaffCode.trim()
       });
       localStorage.setItem("edited_code_" + order.id, "true");
       setHasEditedStaffCode(true);
       setIsEditingStaffCode(false);
    } catch (e) {
       console.error("Failed to update staff code", e);
    } finally {
       setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (order.status === 'COMPLETED' && !hasAlerted) {
      setShowCompletionAlert(true);
      setHasAlerted(true);
      
      try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          const now = ctx.currentTime;
          
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now); 
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2);
          osc.start(now);
          osc.stop(now + 2);
          
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1318.51, now); 
          gain2.gain.setValueAtTime(0, now);
          gain2.gain.linearRampToValueAtTime(0.3, now + 0.05);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 2);
          osc2.start(now);
          osc2.stop(now + 2);
      } catch(e) {
          console.error("Audio not supported", e);
      }
    }
  }, [order.status, hasAlerted]);

  return (
    <>
      <AnimatePresence>
         {showCompletionAlert && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, backgroundColor: ['#ef4444', '#f97316', '#ef4444'] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-white"
            >
               <BellRing className="h-32 w-32 animate-bounce" />
               <h1 className="mt-8 text-5xl font-black text-center text-white drop-shadow-lg">ORDER READY!</h1>
               <p className="mt-4 text-xl font-bold text-center">Your order is complete and coming to your table!</p>
               <button 
                  onClick={() => setShowCompletionAlert(false)}
                  className="mt-12 rounded-full bg-white/20 px-8 py-3 text-xl font-bold hover:bg-white/30 transition-colors"
                >
                  Dismiss
               </button>
            </motion.div>
         )}
      </AnimatePresence>
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className={cn("h-24 w-24 rounded-full border-4 p-4",
              order.status === 'COMPLETED' || ((businessType === 'Salon' || businessType === 'Clinic') && order.status !== 'CANCELLED') ? "border-emerald-100 bg-emerald-50 text-emerald-500" :
              order.status === 'CANCELLED' ? "border-red-100 bg-red-50 text-red-500" :
              "border-brand-primary/20 bg-brand-secondary text-brand-primary"
            )}>
              {order.status === 'COMPLETED' || ((businessType === 'Salon' || businessType === 'Clinic') && order.status !== 'CANCELLED') ? (
                <CheckCircle2 className="h-full w-full" />
              ) : order.status === 'CANCELLED' ? (
                <X className="h-full w-full" />
              ) : (
                <ChefHat className="h-full w-full animate-bounce" />
              )}
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-black">
          {order.status === 'CANCELLED' ? 'Order Cancelled' : ((businessType === 'Salon' || businessType === 'Clinic') ? 'Thank You!' : `Order ${order.status.toLowerCase()}!`)}
        </h2>
        <p className="mt-2 opacity-60">
          From <span className="font-bold">{restaurantName}</span>
        </p>

        {order.status === 'CANCELLED' ? (
          <div className="mt-12 text-center">
            <p className="text-neutral-500 mb-8">We're sorry, your order could not be processed at this time.</p>
            <button 
              onClick={() => {
                localStorage.removeItem(`activeOrder_${order.restaurantId}`);
                window.location.reload();
              }}
              className="w-full flex items-center justify-center h-14 rounded-2xl bg-neutral-900 text-white font-bold"
            >
              Start New Order
            </button>
          </div>
        ) : (
          (businessType === 'Salon' || businessType === 'Clinic') ? (
            <div className="mt-12 text-center space-y-4">
              <h3 className="text-xl font-bold text-neutral-900">Submitted successfully!</h3>
              <p className="text-sm text-neutral-500">Your selections have been sent.</p>
              
              <div className="mt-6 rounded-2xl bg-brand-bg p-4 border border-brand-border mx-auto max-w-xs">
                <p className="text-[10px] font-black text-brand-text/40 uppercase tracking-widest mb-2">Staff Code</p>
                {isEditingStaffCode ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={newStaffCode} 
                      onChange={e => setNewStaffCode(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-card px-3 py-2 text-center font-bold text-brand-text outline-none focus:border-brand-primary"
                    />
                    <button 
                      disabled={isUpdating || !newStaffCode.trim()} 
                      onClick={submitNewStaffCode}
                      className="rounded-xl bg-brand-primary px-4 py-2 font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {isUpdating ? '...' : <Check className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="text-2xl font-black text-brand-text">{order.tableNo}</span>
                    {!hasEditedStaffCode && (
                      <button 
                        onClick={() => setIsEditingStaffCode(true)}
                        className="ml-3 text-sm font-bold text-brand-primary hover:opacity-80 underline underline-offset-2"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
                {hasEditedStaffCode && !isEditingStaffCode && (
                  <p className="mt-2 text-[9px] text-brand-text/40 font-black uppercase">Code can only be edited once.</p>
                )}
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => {
                    localStorage.removeItem(`activeOrder_${order.restaurantId}`);
                    window.location.reload();
                  }}
                  className="px-6 py-3 rounded-2xl bg-brand-secondary text-brand-primary font-bold hover:opacity-80 transition-all active:scale-95 border border-brand-primary/10"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-12 space-y-8 text-left">
            {steps.map((step, i) => {
              const isCompleted = i < currentIdx || order.status === 'COMPLETED';
              const isActive = i === currentIdx;
              const isLast = i === steps.length - 1;

              return (
                <div key={step.label} className="relative flex items-center gap-4">
                  {!isLast && (
                    <div className={cn(
                      "absolute left-[13px] top-8 w-0.5 h-10 transition-colors",
                      isCompleted ? "bg-brand-primary" : "bg-brand-border"
                    )} />
                  )}
                  <div className={cn(
                    "z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all",
                    isCompleted ? "bg-brand-primary border-brand-primary text-white" : 
                    isActive ? "bg-brand-card border-brand-primary text-brand-primary" : "bg-brand-card border-brand-border text-brand-text/10"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-black", isCompleted || isActive ? "text-brand-text" : "opacity-20")}>
                      {step.label}
                    </h4>
                    {isActive && <span className="text-[10px] font-black uppercase text-brand-primary">Currently</span>}
                  </div>
                </div>
              );
            })}
          </div>
          )
        )}

        {order.status !== 'CANCELLED' && (
          <div className="mt-12 rounded-3xl bg-brand-bg p-6 border border-brand-border">
            <div className="flex justify-between text-sm font-black uppercase tracking-widest">
              <span className="opacity-40">Subtotal</span>
              <span className="text-brand-text">{formatCurrency(order.totalAmount)}</span>
            </div>
            {(businessType !== 'Salon' && businessType !== 'Clinic') && (
              <div className="mt-2 flex justify-between text-sm font-black uppercase tracking-widest">
                <span className="opacity-40">Estimated Time</span>
                <span className="text-brand-text">15-20 mins</span>
              </div>
            )}
          </div>
        )}

        {order.status === 'COMPLETED' && (
          <div className="mt-4">
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-white font-bold h-14 hover:bg-neutral-800 transition-all select-none shadow-sm drop-shadow-sm active:scale-95"
            >
              <Receipt className="h-4 w-4" /> View Bill / Invoice
            </button>
          </div>
        )}

        {order.status === 'COMPLETED' && googleMapReviewLink && (
          <div className="mt-6">
            <a 
              href={googleMapReviewLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-brand-card border border-brand-border p-4 text-sm font-black text-brand-text shadow-sm hover:opacity-80 active:scale-95 transition-all uppercase tracking-widest"
            >
              ⭐ Write a review on Google Maps
            </a>
          </div>
        )}

        <p className="mt-8 text-[10px] font-black uppercase tracking-widest opacity-30">
          {order.status === 'CANCELLED' ? 'You may close this page.' : (
            (businessType === 'Salon' || businessType === 'Clinic') ? 'You may close this page.' : 'Keep this page open to track your meal.'
          )}
        </p>
      </motion.div>
    </div>

    <InvoiceModal
      isOpen={showInvoiceModal}
      onClose={() => setShowInvoiceModal(false)}
      order={order}
      restaurantName={restaurantName}
      businessType={businessType}
    />
    </>
  );
}
