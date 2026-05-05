import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
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
  BellRing
} from 'lucide-react';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';
import { MenuItem, Restaurant, OrderItem, Order } from '../types';

export default function CustomerMenu() {
  const { restaurantId, tableNo } = useParams<{ restaurantId: string, tableNo: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
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
        const rDoc = await getDoc(doc(db, 'restaurants', restaurantId));
        if (rDoc.exists()) {
          setRestaurant({ id: rDoc.id, ...rDoc.data() } as Restaurant);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `restaurants/${restaurantId}`);
      }
      
      if (tableNo && tableNo !== 'PREVIEW') {
        try {
          const qrQ = query(collection(db, 'qrTables'), where('restaurantId', '==', restaurantId), where('tableNo', '==', tableNo));
          const qrSnap = await getDocs(qrQ);
          if (!qrSnap.empty) {
            setQrTableInfo({ id: qrSnap.docs[0].id, ...qrSnap.docs[0].data() });
          }
        } catch (error) {
          console.error("Error fetching QR table info", error);
        }
      }
      
      try {
        const qPath = 'orders';
        const ordersQ = query(collection(db, qPath), where('restaurantId', '==', restaurantId));
        const ordersSnap = await getDocs(ordersQ);
        setPastOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }

      setLoading(false);
    };
    
    fetchData();

    const qPath = 'menuItems';
    const q = query(collection(db, qPath), where('restaurantId', '==', restaurantId), where('isAvailable', '==', true));
    const unsub = onSnapshot(q, (mSnapshot) => {
      const items = mSnapshot.docs.map(iDoc => ({ id: iDoc.id, ...iDoc.data() } as MenuItem));
      // Filter out items that are out of stock
      // Set to state
      setMenuItems(items.filter(i => i.stockCount > 0));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
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
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsub;
  }, [orderSent?.id]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(i => i.category)));
    return ['All', ...cats];
  }, [menuItems]);

  const filteredItems = menuItems.filter(i => 
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
    return menuItems
      .filter(item => counts[item.id])
      .sort((a, b) => counts[b.id] - counts[a.id])
      .slice(0, 3);
  }, [pastOrders, menuItems]);

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
    
    return menuItems
      .filter(item => suggestions[item.id])
      .sort((a,b) => suggestions[b.id] - suggestions[a.id])
      .slice(0, 3);
  }, [pastOrders, menuItems, cart]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const updateCart = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
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
      
      // Update stock for all items in the cart
      await Promise.all(cart.map(item => 
        updateDoc(doc(db, 'menuItems', item.id), {
          stockCount: increment(-item.quantity)
        }).catch(err => {
          // Log error but don't fail the order if stock update fails just in case
          console.error("Failed to update stock for item", item.id, err);
        })
      ));
      
      const key = `activeOrder_${restaurantId}`;
      localStorage.setItem(key, JSON.stringify({
        orderId: docRef.id,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
      }));

      setOrderSent({ id: docRef.id, ...orderData } as any);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, qPath);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !restaurant) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );

  if (!restaurant) return <div>Restaurant not found</div>;

  if (orderSent) {
    return <OrderStatusView order={orderSent} restaurantName={restaurant.name} googleMapReviewLink={qrTableInfo?.googleMapReviewLink} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 p-6 backdrop-blur-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{restaurant.name}</h1>
            <p className="text-xs font-semibold text-orange-600">TABLE {tableNo}</p>
          </div>
          <div className="rounded-full bg-neutral-100 p-2">
            <Utensils className="h-5 w-5 text-neutral-400" />
          </div>
        </div>
        
        {/* Categories */}
        <div className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition-all",
                activeCategory === cat 
                  ? "bg-neutral-900 text-white shadow-lg" 
                  : "bg-white text-neutral-500 border border-neutral-100"
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
             className="w-full rounded-full border border-neutral-100 bg-white px-5 py-3 text-sm outline-none focus:border-orange-500"
          />
        </div>
      </header>

      {/* Menu List */}
      <main className="p-6">
        {popularItems.length > 0 && activeCategory === 'All' && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-black text-neutral-900 flex items-center gap-2">🔥 Popular / Trending</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {popularItems.map(item => (
                <MenuItemCard key={item.id} item={item} cart={cart} updateCart={updateCart} />
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
           {activeCategory === 'All' && filteredItems.length > 0 && popularItems.length > 0 && (
              <h2 className="text-xl font-black text-neutral-900 mb-4">All Items</h2>
           )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredItems.map(item => (
              <MenuItemCard key={item.id} item={item} cart={cart} updateCart={updateCart} />
            ))}
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
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold">
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
              className="fixed bottom-0 z-[70] flex w-full flex-col rounded-t-[40px] bg-white p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-2xl font-black text-neutral-900">Your Basket</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="rounded-full bg-neutral-100 p-2"><X className="h-6 w-6" /></button>
              </div>

              <div className="space-y-4 mb-8">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900">{item.name}</span>
                      <span className="ml-2 text-xs font-bold text-orange-600">x{item.quantity}</span>
                    </div>
                    <span className="font-bold text-neutral-900">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {suggestedItems.length > 0 && (
                <div className="mb-8 border-t border-neutral-200 pt-6">
                  <h4 className="mb-4 text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Utensils className="h-4 w-4" /> Frequently Bought Together
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {suggestedItems.map(item => (
                       <MenuItemCard key={item.id} item={item} cart={cart} updateCart={updateCart} />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 rounded-3xl bg-neutral-50 p-6">
                <div>
                  <label className="mb-1 block text-xs font-bold text-neutral-400 uppercase">Your Name</label>
                  <input
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-transparent text-lg font-bold outline-none"
                  />
                </div>
                {tableNo === 'PREVIEW' ? (
                  <div className="border-t border-neutral-200 pt-4">
                    <label className="mb-1 block text-xs font-bold text-neutral-400 uppercase">Table Number</label>
                    <input
                      required
                      value={checkoutTableNo}
                      onChange={e => setCheckoutTableNo(e.target.value)}
                      placeholder="Enter table number"
                      className="w-full bg-transparent text-lg font-bold outline-none"
                    />
                  </div>
                ) : (
                  <div className="border-t border-neutral-200 pt-4 flex justify-between items-center">
                    <span className="text-sm font-bold text-neutral-500">Table Number</span>
                    <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-600 uppercase tracking-widest">{tableNo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                  <span className="text-sm font-bold text-neutral-500">Total Payable</span>
                  <span className="text-2xl font-black text-neutral-900">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <button
                disabled={!customerName || !checkoutTableNo || loading}
                onClick={placeOrder}
                className="mt-8 flex h-16 w-full items-center justify-center gap-3 rounded-[24px] bg-orange-600 text-lg font-bold text-white shadow-xl shadow-orange-100 hover:bg-orange-700 active:scale-95 disabled:opacity-50"
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

function MenuItemCard({ item, cart, updateCart }: { key?: string | number, item: MenuItem, cart: OrderItem[], updateCart: (i: MenuItem, d: number) => void }) {
  const inCart = cart.find(i => i.id === item.id);
  return (
    <motion.div 
      layout
      className="flex items-center gap-4 rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm"
    >
      {item.imageUrl && (
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-bold text-neutral-900">{item.name}</h4>
        <p className="text-xs text-neutral-500 line-clamp-1">{item.description}</p>
        <p className="mt-1 font-bold text-neutral-900">{formatCurrency(item.price)}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        {inCart ? (
          <div className="flex items-center gap-3 rounded-full bg-neutral-100 p-1">
            <button onClick={() => updateCart(item, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm"><Minus className="h-4 w-4" /></button>
            <span className="text-sm font-bold">{inCart.quantity}</span>
            <button 
              disabled={inCart.quantity >= item.stockCount}
              onClick={() => updateCart(item, 1)} 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm disabled:opacity-50"
             >
               <Plus className="h-4 w-4" />
             </button>
          </div>
        ) : (
          <button 
            disabled={item.stockCount <= 0}
            onClick={() => updateCart(item, 1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-100 transition-transform active:scale-90 disabled:opacity-50 disabled:bg-neutral-300"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function OrderStatusView({ order, restaurantName, googleMapReviewLink }: { order: Order, restaurantName: string, googleMapReviewLink?: string }) {
  const steps = [
    { label: 'Pending', status: 'PENDING', icon: Clock },
    { label: 'Accepted', status: 'ACCEPTED', icon: CheckCircle2 },
    { label: 'Preparing', status: 'PREPARING', icon: ChefHat },
    { label: 'Completed', status: 'COMPLETED', icon: Utensils }
  ];

  const currentIdx = steps.findIndex(s => s.status === order.status);

  const [showCompletionAlert, setShowCompletionAlert] = useState(false);
  const [hasAlerted, setHasAlerted] = useState(false);

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className={cn("h-24 w-24 rounded-full border-4 p-4",
              order.status === 'COMPLETED' ? "border-emerald-100 bg-emerald-50 text-emerald-500" :
              order.status === 'CANCELLED' ? "border-red-100 bg-red-50 text-red-500" :
              "border-orange-100 bg-orange-50 text-orange-600"
            )}>
              {order.status === 'COMPLETED' ? (
                <CheckCircle2 className="h-full w-full" />
              ) : order.status === 'CANCELLED' ? (
                <X className="h-full w-full" />
              ) : (
                <ChefHat className="h-full w-full animate-bounce" />
              )}
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-black text-neutral-900">
          {order.status === 'CANCELLED' ? 'Order Cancelled' : `Order ${order.status.toLowerCase()}!`}
        </h2>
        <p className="mt-2 text-neutral-500">
          From <span className="font-bold text-neutral-900">{restaurantName}</span>
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
                    isCompleted ? "bg-orange-500" : "bg-neutral-100"
                  )} />
                )}
                <div className={cn(
                  "z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted ? "bg-orange-500 border-orange-500 text-white" : 
                  isActive ? "bg-white border-orange-500 text-orange-500" : "bg-white border-neutral-100 text-neutral-300"
                )}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>
                <div>
                  <h4 className={cn("text-sm font-bold", isCompleted || isActive ? "text-neutral-900" : "text-neutral-300")}>
                    {step.label}
                  </h4>
                  {isActive && <span className="text-[10px] font-black uppercase text-orange-600">Currently</span>}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {order.status !== 'CANCELLED' && (
          <div className="mt-12 rounded-3xl bg-neutral-50 p-6">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-neutral-400">Subtotal</span>
              <span className="text-neutral-900">{formatCurrency(order.totalAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span className="text-neutral-400">Estimated Time</span>
              <span className="text-neutral-900">15-20 mins</span>
            </div>
          </div>
        )}

        {order.status === 'COMPLETED' && googleMapReviewLink && (
          <div className="mt-6">
            <a 
              href={googleMapReviewLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-neutral-100 p-4 text-sm font-bold text-neutral-900 shadow-sm hover:bg-neutral-50 active:scale-95 transition-all"
            >
              ⭐ Write a review on Google Maps
            </a>
          </div>
        )}

        <p className="mt-8 text-xs text-neutral-400">
          {order.status === 'CANCELLED' ? 'You may close this page.' : 'Keep this page open to track your meal.'}
        </p>
      </motion.div>
    </div>
    </>
  );
}
