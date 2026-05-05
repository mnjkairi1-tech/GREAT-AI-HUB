import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  getDocs, 
  addDoc, 
  setDoc,
  serverTimestamp,

  deleteDoc,
  orderBy,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isThisMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import { 
  LayoutDashboard, 
  Menu as MenuIcon, 
  QrCode, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Check, 
  X,
  Trash2,
  LogOut,
  ChevronRight,
  Pizza,
  Coffee,
  CheckCircle,
  Truck,
  Link,
  Settings,
  ScanLine,
  LayoutList,
  BarChart3,
  Home,
  DollarSign,
  Package,
  Bell,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';
import { MenuItem, Order, Restaurant, OrderStatus, QrTable } from '../types';
import { BUSINESS_TYPES } from '../constants';

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'menu' | 'qr' | 'settings' | 'analytics' | 'staff'>('home');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      
      if (user) {
        setLoading(true);
        try {
          // 1. Try finding as owner
          let q = query(collection(db, 'restaurants'), where('ownerId', '==', user.uid));
          let snapshot = await getDocs(q);
          
          let restaurantDoc = null;
          let isStaffFound = false;

          if (!snapshot.empty) {
            restaurantDoc = snapshot.docs[0];
            setIsStaff(false);
          } else {
            // 2. Try finding as staff
            q = query(collection(db, 'restaurants'), where('staffEmails', 'array-contains', user.email));
            snapshot = await getDocs(q);
            if (!snapshot.empty) {
                restaurantDoc = snapshot.docs[0];
                setIsStaff(true);
                isStaffFound = true;
            }
          }
          
          if (!restaurantDoc) {
            navigate('/setup');
          } else {
            const docData = restaurantDoc;
            const data = docData.data();
            
            // Still ensure ownerEmail exists for the restaurant document
            if (!data.ownerEmail && user.email && !isStaffFound) {
                await updateDoc(doc(db, 'restaurants', docData.id), { ownerEmail: user.email });
            }
            
            setRestaurant({ 
              id: docData.id, 
              ...data,
              ownerEmail: data.ownerEmail || (isStaffFound ? '' : user.email),
              businessType: data.businessType || 'Restaurant' 
            } as Restaurant);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'restaurants');
        }
        setLoading(false);
      } else {
        navigate('/');
        return;
      }
      setLoading(false);
    });

    return unsubAuth;
  }, [navigate]);

  const handleLogout = () => signOut(auth).then(() => navigate('/'));

  if (loading || !restaurant) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50 lg:flex-row">
      {/* Sidebar */}
      <aside className="fixed bottom-0 z-50 flex w-full border-t border-neutral-200 bg-white p-2 lg:relative lg:bottom-auto lg:z-0 lg:w-64 lg:flex-col lg:border-r lg:border-t-0 lg:p-6">
        <div className="hidden lg:mb-10 lg:block">
          <h1 className="text-xl font-bold text-orange-600">{restaurant.name}</h1>
          <p className="text-xs text-neutral-400">Merchant Dashboard</p>
        </div>

          <nav className="flex w-full justify-around gap-2 lg:flex-col lg:justify-start">
            <NavBtn 
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')}
              icon={<Home className="h-5 w-5" />}
              label="Home"
            />
            {restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic' ? (
              <>
                <NavBtn 
                  active={activeTab === 'orders'} 
                  onClick={() => setActiveTab('orders')}
                  icon={restaurant.businessType === 'Clinic' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  label={restaurant.businessType === 'Clinic' ? 'Appointments' : 'Appointments'}
                />
                <NavBtn 
                  active={activeTab === 'menu'} 
                  onClick={() => setActiveTab('menu')}
                  icon={restaurant.businessType === 'Clinic' ? <LayoutList className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                  label={restaurant.businessType === 'Clinic' ? 'Services' : 'Services'}
                />
              </>
            ) : (
              <>
                <NavBtn 
                  active={activeTab === 'orders'} 
                  onClick={() => setActiveTab('orders')}
                  icon={<LayoutDashboard className="h-5 w-5" />}
                  label="Orders"
                />
                <NavBtn 
                  active={activeTab === 'menu'} 
                  onClick={() => setActiveTab('menu')}
                  icon={<Pizza className="h-5 w-5" />}
                  label="Menu"
                />
              </>
            )}
            {!isStaff && (
              <>
                {(restaurant.businessType !== 'Salon' && restaurant.businessType !== 'Clinic') && (
                  <NavBtn 
                    active={activeTab === 'qr'} 
                    onClick={() => setActiveTab('qr')}
                    icon={<Link className="h-5 w-5" />}
                    label="QR"
                  />
                )}
                <NavBtn 
                  active={activeTab === 'analytics'} 
                  onClick={() => setActiveTab('analytics')}
                  icon={<BarChart3 className="h-5 w-5" />}
                  label="Analytics"
                />
              </>
            )}

            <NavBtn 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="h-5 w-5" />}
              label="Settings"
              isLast
            />
          </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-10 lg:pb-10">
        <header className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900 capitalize">
            {activeTab === 'home' && 'Home'}
            {activeTab === 'orders' && ((restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? 'Appointments' : 'Live Orders')}
            {activeTab === 'menu' && ((restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? 'Services' : 'Menu')}
            {activeTab === 'staff' && 'Staff'}
            {activeTab === 'qr' && 'QR'}
            {activeTab === 'analytics' && 'Analytics'}
            {activeTab === 'settings' && 'Settings'}
          </h2>
        </header>

        <div className="mx-auto max-w-5xl">
          {activeTab === 'home' && <HomeTab restaurantId={restaurant.id} businessType={restaurant.businessType} setActiveTab={setActiveTab} isStaff={isStaff} />}
          {activeTab === 'orders' && <OrdersTab restaurantId={restaurant.id} businessType={restaurant.businessType} />}
          {activeTab === 'menu' && <MenuTab restaurantId={restaurant.id} businessType={restaurant.businessType} />}
          {!isStaff && (
            <>
              {activeTab === 'staff' && <StaffManagementTab restaurant={restaurant} setRestaurant={setRestaurant} />}
              {activeTab === 'qr' && <QRTab restaurantId={restaurant.id} name={restaurant.name} />}
              {activeTab === 'analytics' && <AnalyticsTab restaurantId={restaurant.id} businessType={restaurant.businessType} />}
            </>
          )}
          {activeTab === 'settings' && <SettingsTab onLogout={handleLogout} restaurant={restaurant} setActiveTab={setActiveTab} isStaff={isStaff} />}
        </div>
      </main>
    </div>
  );
}

function HomeTab({ restaurantId, businessType, setActiveTab, isStaff }: { restaurantId: string, businessType: string, setActiveTab: (tab: 'home' | 'orders' | 'menu' | 'qr' | 'settings' | 'analytics' | 'staff') => void, isStaff: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qPathOrders = 'orders';
    const qOrders = query(
      collection(db, qPathOrders),
      where('restaurantId', '==', restaurantId)
    );

    const qPathMenu = 'menuItems';
    const qMenu = query(
      collection(db, qPathMenu),
      where('restaurantId', '==', restaurantId)
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
    });

    const unsubMenu = onSnapshot(qMenu, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(data);
      setLoading(false);
    });

    return () => { unsubOrders(); unsubMenu(); };
  }, [restaurantId]);

  if (loading) {
    return <div className="text-center p-10 font-bold text-neutral-400">Loading metrics...</div>;
  }

  const today = new Date();
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt);
    return orderDate.getDate() === today.getDate() &&
           orderDate.getMonth() === today.getMonth() &&
           orderDate.getFullYear() === today.getFullYear();
  });

  const todaysSales = todayOrders.filter(o => o.status === 'COMPLETED').reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingOrdersCount = todayOrders.filter(o => o.status === 'PENDING' || o.status === 'ACCEPTED' || o.status === 'PREPARING').length;
  const completedOrdersCount = todayOrders.filter(o => o.status === 'COMPLETED').length;
  const totalOrdersCount = todayOrders.length;
  
  const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const miniOrders = activeOrders.slice(0, 3); // Take top 3

  // Calculate top selling items
  const itemCounts: Record<string, number> = {};
  orders.forEach(order => {
    order.items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Take top 5

  // Alerts
  const inventoryNotifications = menuItems
    .filter(item => !item.isAvailable || (item.stockCount !== undefined && item.stockCount < 5))
    .map(item => ({
      id: `inv-${item.id}`,
      type: 'INVENTORY' as const,
      message: `${item.name} ${!item.isAvailable ? 'is out of stock!' : `is low on stock (${item.stockCount} remaining)!`}`
    }));

  const now = new Date();
  const orderNotifications = orders
    .filter(order => order.status === 'PENDING' && (now.getTime() - new Date(order.createdAt?.toDate?.() || order.createdAt).getTime() < 60000))
    .map(order => ({
      id: `ord-${order.id}`,
      type: 'ORDER' as const,
      message: `New order received from Table ${order.tableNo}!`
    }));

  const allNotifications = [...inventoryNotifications, ...orderNotifications];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-2 rounded-full bg-orange-100 p-3 text-orange-600">
            {isStaff ? <Package className="h-6 w-6" /> : <DollarSign className="h-6 w-6" />}
          </div>
          <h4 className="text-sm font-medium text-neutral-500">{isStaff ? 'Sales Count' : 'Today Sales'}</h4>
          <p className="mt-1 text-2xl font-black text-neutral-900">{isStaff ? completedOrdersCount : formatCurrency(todaysSales)}</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-2 rounded-full bg-blue-100 p-3 text-blue-600">
            <Package className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-medium text-neutral-500">Total Orders</h4>
          <p className="mt-1 text-2xl font-black text-neutral-900">{totalOrdersCount}</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-2 rounded-full bg-yellow-100 p-3 text-yellow-600">
            <Clock className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-medium text-neutral-500">Pending</h4>
          <p className="mt-1 text-2xl font-black text-neutral-900">{pendingOrdersCount}</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-2 rounded-full bg-green-100 p-3 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-medium text-neutral-500">Completed</h4>
          <p className="mt-1 text-2xl font-black text-neutral-900">{completedOrdersCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2 text-neutral-900">
              <Bell className="h-4 w-4" /> Live Orders
            </h3>
            <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-orange-600 uppercase tracking-widest hover:underline">View All</button>
          </div>
          
          {activeOrders.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">No active orders</p>
          ) : (
            <ul className="space-y-3">
               {miniOrders.map(order => (
                 <li key={order.id} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-neutral-50">
                    <span className="font-bold">Table {order.tableNo} → {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                    <span className={cn("text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full",
                       order.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                       order.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
                       'bg-blue-100 text-blue-700'
                    )}>
                      {order.status === 'PENDING' && '⏳ Pending'}
                      {order.status === 'PREPARING' && '⏳ Preparing'}
                      {order.status === 'ACCEPTED' && '✅ Accepted'}
                    </span>
                 </li>
               ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-neutral-900 mb-4">
            <TrendingUp className="h-4 w-4" /> {(businessType === 'Salon' || businessType === 'Clinic') ? 'Top Services' : 'Top Selling Items'}
          </h3>
          {topItems.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">No sales yet</p>
          ) : (
            <ul className="space-y-3">
              {topItems.map(([name, count]) => (
                <li key={name} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-neutral-50">
                  <span className="font-bold text-neutral-900">{name}</span>
                  <span className="text-orange-600 font-black">{count} {(businessType === 'Salon' || businessType === 'Clinic') ? 'bookings' : 'orders'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* Alerts Section */}
      {allNotifications.length > 0 && (
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-neutral-900 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Notifications
          </h3>
          <ul className="space-y-3">
            {allNotifications.map(notification => (
              <li key={notification.id} className={cn("flex items-center gap-3 text-sm p-3 rounded-2xl", notification.type === 'INVENTORY' ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900')}>
                <span className={notification.type === 'INVENTORY' ? 'text-amber-500' : 'text-blue-500'}>
                  {notification.type === 'INVENTORY' ? '⚠️' : '🔔'}
                </span>
                <span className="font-medium">{notification.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, isLast }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isLast?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium transition-all lg:flex-row lg:gap-3",
        active 
          ? "bg-orange-600 text-white shadow-lg shadow-orange-100" 
          : "text-neutral-500 hover:bg-neutral-100",
        isLast && "lg:mt-auto"
      )}
    >
      {icon}
      <span className="text-[10px] lg:text-sm">{label}</span>
    </button>
  );
}

// --- TAB: Orders ---
function OrdersTab({ restaurantId, businessType }: { restaurantId: string, businessType: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const qPath = 'orders';
    const q = query(
      collection(db, qPath), 
      where('restaurantId', '==', restaurantId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
    });
  }, [restaurantId]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const statusMap: Record<OrderStatus, { color: string, icon: any }> = {
    PENDING: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    ACCEPTED: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Check },
    PREPARING: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Pizza },
    COMPLETED: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    CANCELLED: { color: 'bg-neutral-100 text-neutral-500 border-neutral-200', icon: X }
  };

  const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {activeOrders.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <p className="text-neutral-400">Waiting for live orders...</p>
        </div>
      )}
      <AnimatePresence>
        {activeOrders.map((order) => (
          <OrderCard key={order.id} order={order} updateStatus={updateStatus} statusMap={statusMap} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function OrderCard({ order, updateStatus, statusMap }: { key?: React.Key, order: Order, updateStatus: (id: string, s: OrderStatus) => Promise<void>, statusMap: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md flex flex-col"
    >
      <div 
        className="flex cursor-pointer items-center justify-between border-b border-neutral-100 bg-neutral-50/50 p-4 active:bg-neutral-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Table {order.tableNo}</span>
          <h3 className="font-bold text-neutral-900 truncate max-w-[120px]">{order.customerName}</h3>
        </div>
        <div className="text-right flex flex-col items-end">
           <div className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest", statusMap[order.status].color)}>
            {order.status}
          </div>
          <span className="text-xs font-bold text-neutral-900 mt-1">{formatCurrency(order.totalAmount)}</span>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4"
          >
            <ul className="space-y-1.5 mb-4">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span className="text-neutral-600 font-medium">
                    <span className="inline-block min-w-[20px] font-bold text-orange-600">{item.quantity}x</span> {item.name}
                  </span>
                  <span className="font-bold text-neutral-900">{formatCurrency(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
             <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{new Date(order.createdAt?.toDate()).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto grid grid-cols-2 divide-x divide-neutral-100 border-t border-neutral-100">
        {order.status === 'PENDING' && (
          <button 
            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'ACCEPTED'); }}
            className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 col-span-2"
          >
            <Check className="h-4 w-4" /> Accept
          </button>
        )}
        {order.status === 'ACCEPTED' && (
          <button 
            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'PREPARING'); }}
            className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50 col-span-2"
          >
            <Pizza className="h-4 w-4" /> PREP
          </button>
        )}
        {['ACCEPTED', 'PREPARING'].includes(order.status) && (
          <button 
            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'COMPLETED'); }}
            className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 col-span-2"
          >
            <CheckCircle2 className="h-4 w-4" /> COMPLETE
          </button>
        )}
        {['PENDING', 'ACCEPTED'].includes(order.status) && (
           <button 
             onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'CANCELLED'); }}
             className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-neutral-400 hover:bg-red-50 hover:text-red-500 col-span-2 border-t border-neutral-100"
           >
             <X className="h-4 w-4" /> CANCEL
           </button>
        )}
      </div>
    </motion.div>
  );
}

// --- TAB: Menu ---
function MenuTab({ restaurantId, businessType }: { restaurantId: string, businessType: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', price: '', category: 'Main Course', description: '', imageUrl: '', stockCount: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const qPath = 'menuItems';
    const q = query(collection(db, qPath), where('restaurantId', '==', restaurantId));
    return onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
    });
  }, [restaurantId]);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setForm({ name: '', price: '', category: 'Main Course', description: '', imageUrl: '', stockCount: '' });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qPath = 'menuItems';
    try {
      const stockVal = form.stockCount ? parseInt(form.stockCount) : 0;
      if (editingId) {
        await updateDoc(doc(db, qPath, editingId), {
          ...form,
          price: parseFloat(form.price),
          stockCount: stockVal,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, qPath), {
          ...form,
          price: parseFloat(form.price),
          stockCount: stockVal,
          restaurantId,
          isAvailable: true,
          updatedAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, qPath);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setForm({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      stockCount: item.stockCount?.toString() || '0'
    });
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const deleteItem = async (id: string) => {
    if (confirm('Delete this item?')) {
      const path = `menuItems/${id}`;
      try {
        await deleteDoc(doc(db, 'menuItems', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    const path = `menuItems/${id}`;
    try {
      await updateDoc(doc(db, 'menuItems', id), { isAvailable: !current });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        <button 
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="flex items-center gap-2 whitespace-nowrap rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-neutral-800 active:scale-95 shadow-sm"
        >
          <Plus className="-ml-1 h-4 w-4" />
          Add Item
        </button>

        <button 
          onClick={() => navigate(`/menu/${restaurantId}/PREVIEW`)}
          className="flex items-center gap-2 whitespace-nowrap rounded-full bg-orange-100 px-5 py-2.5 text-sm font-bold text-orange-700 transition-all hover:bg-orange-200 active:scale-95"
        >
          <ScanLine className="-ml-1 h-4 w-4" />
          Public Preview
        </button>

         <button 
           onClick={async () => {
             if (confirm('Are you sure you want to delete ALL items? This cannot be undone.')) {
               try {
                 for (const item of items) {
                   await deleteDoc(doc(db, 'menuItems', item.id));
                 }
               } catch (error) {
                 handleFirestoreError(error, OperationType.DELETE, 'menuItems');
               }
             }
           }}
           className="flex items-center gap-2 whitespace-nowrap rounded-full bg-red-100 px-5 py-2.5 text-sm font-bold text-red-700 transition-all hover:bg-red-200 active:scale-95"
          >
            <Trash2 className="-ml-1 h-4 w-4" />
            Clear All Items
          </button>
        

        <button 
          onClick={() => alert("Organize categories functionality coming soon!")}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition-all hover:bg-neutral-50 active:scale-95 shadow-sm"
        >
          <LayoutList className="-ml-1 h-4 w-4" />
          Categories
        </button>

        <input 
           type="text"
           placeholder="Search items..."
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-orange-500 w-full md:w-64"
        />
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 md:grid-cols-4"
          >
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-neutral-400">NAME</label>
              <input 
                required 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Delicious Burger" 
                className="w-full bg-transparent text-lg font-medium outline-none" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400">PRICE (₹)</label>
              <input 
                required 
                type="number" 
                value={form.price} 
                onChange={e => setForm({...form, price: e.target.value})}
                placeholder="199" 
                className="w-full bg-transparent text-lg font-medium outline-none" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400">CATEGORY</label>
              <select 
                value={form.category} 
                onChange={e => setForm({...form, category: e.target.value})}
                className="w-full bg-transparent text-lg font-medium outline-none"
              >
                <option>Main Course</option>
                <option>Snacks</option>
                <option>Drinks</option>
                <option>Desserts</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-neutral-400">DESCRIPTION</label>
              <input 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Brief description..." 
                className="w-full bg-transparent text-sm outline-none" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400">STOCK QUANTITY</label>
              <input 
                type="number"
                value={form.stockCount} 
                onChange={e => setForm({...form, stockCount: e.target.value})}
                placeholder="0" 
                className="w-full bg-transparent text-sm outline-none" 
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-bold text-neutral-400">IMAGE URL</label>
              <input 
                value={form.imageUrl} 
                onChange={e => setForm({...form, imageUrl: e.target.value})}
                placeholder="https://..." 
                className="w-full bg-transparent text-sm outline-none" 
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-1">
              <button type="button" onClick={resetForm} className="h-10 w-full rounded-lg bg-neutral-100 font-bold text-neutral-500 hover:bg-neutral-200">Cancel</button>
              <button type="submit" className="h-10 w-full rounded-lg bg-orange-600 font-bold text-white hover:bg-orange-700">{editingId ? 'Update' : 'Save'}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map(item => (
          <div key={item.id} className="group relative rounded-2xl border border-neutral-200 bg-white p-4 transition-all hover:border-orange-200 flex flex-col justify-between">
            <div>
              {item.imageUrl && (
                <div className="h-32 w-full mb-3 overflow-hidden rounded-xl bg-neutral-100">
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-orange-500">{item.category}</span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest", item.stockCount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      {item.stockCount > 0 ? `${item.stockCount} In Stock` : 'Out of Stock'}
                    </span>
                  </div>
                  <h4 className="font-bold text-neutral-900 mt-1">{item.name}</h4>
                  <p className="text-xs text-neutral-500">{item.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-600">{formatCurrency(item.price)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 border-t border-neutral-100 pt-3">
              <button 
                onClick={() => handleEdit(item)}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 uppercase tracking-widest flex items-center gap-1"
              >
                Edit
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleAvailability(item.id, item.isAvailable)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors border",
                    item.isAvailable ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-neutral-50 border-neutral-200 text-neutral-400"
                  )}
                  title={item.isAvailable ? "Available" : "Unavailable (Sold Out)"}
                >
                  <CheckCircle className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => deleteItem(item.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}// --- TAB: QR Generation ---
function QRTab({ restaurantId, name: restaurantName }: { restaurantId: string, name: string }) {
  const [qrTables, setQrTables] = useState<QrTable[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    name: '', 
    tableNo: '', 
    dynamicLink: '', 
    imageUrl: '',
    googleMapReviewLink: ''
  });

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  useEffect(() => {
    const qPath = 'qrTables';
    const q = query(collection(db, qPath), where('restaurantId', '==', restaurantId));
    return onSnapshot(q, (snapshot) => {
      setQrTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QrTable)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
    });
  }, [restaurantId]);

  const resetForm = () => {
    setForm({ name: '', tableNo: '', dynamicLink: '', imageUrl: '', googleMapReviewLink: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (qr: QrTable) => {
    setForm({ 
      name: qr.name, 
      tableNo: qr.tableNo, 
      dynamicLink: qr.dynamicLink || '', 
      imageUrl: qr.imageUrl || '',
      googleMapReviewLink: qr.googleMapReviewLink || ''
    });
    setEditingId(qr.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const qPath = 'qrTables';
    try {
      if (editingId) {
        await updateDoc(doc(db, qPath, editingId), {
          ...form,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, qPath), {
          ...form,
          restaurantId,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, qPath);
    } finally {
      setLoading(false);
    }
  };

  const deleteQR = async (id: string) => {
    if (confirm('Delete this QR? Printed QR codes for this table will stop working.')) {
      const path = `qrTables/${id}`;
      try {
        await deleteDoc(doc(db, 'qrTables', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">QR</h3>
          <p className="text-sm text-neutral-500">Generate public links for your tables.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border-2 border-orange-100 bg-white p-8 md:grid-cols-2"
          >
            <div className="md:col-span-2 flex items-center justify-between border-b border-neutral-100 pb-4">
              <h4 className="font-bold text-neutral-900">{editingId ? 'Edit Table Info' : 'New Table Link'}</h4>
              <button type="button" onClick={resetForm} className="text-neutral-400 hover:text-neutral-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Table Name (e.g. Table 1)</label>

              <input 
                required 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Table 1" 
                className="w-full border-b border-neutral-100 py-2 text-lg font-bold outline-none focus:border-orange-500 bg-transparent" 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Table Number</label>
              <input 
                required 
                type="number"
                value={form.tableNo} 
                onChange={e => setForm({...form, tableNo: e.target.value})}
                placeholder="1" 
                className="w-full border-b border-neutral-100 py-2 text-lg font-bold outline-none focus:border-orange-500 bg-transparent" 
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Google Map Review Link (Optional)</label>
              <input 
                value={form.googleMapReviewLink} 
                onChange={e => setForm({...form, googleMapReviewLink: e.target.value})}
                placeholder="https://g.page/r/..." 
                className="w-full border-b border-neutral-100 py-2 text-lg font-bold outline-none focus:border-orange-500 bg-transparent" 
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button 
                disabled={loading}
                className="w-full rounded-2xl bg-orange-600 py-4 font-bold text-white shadow-lg shadow-orange-100 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Create & Publish Table'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {qrTables.length === 0 && !isAdding && (
           <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-neutral-100">
             <Link className="h-12 w-12 text-neutral-200 mb-4" />
             <p className="text-neutral-400">No public table links created yet.</p>
           </div>
        )}
        {qrTables.sort((a,b) => parseInt(a.tableNo) - parseInt(b.tableNo)).map(qr => (
          <QRCard 
            key={qr.id} 
            num={parseInt(qr.tableNo)} 
            restaurantName={restaurantName}
            label={qr.name}
            url={`${appUrl}/q/${qr.id}`}
            onDelete={() => deleteQR(qr.id)}
            onEdit={() => handleEdit(qr)}
            targetLink={qr.dynamicLink}
          />
        ))}
      </div>
    </div>
  );
}

function QRCard({ num, url, restaurantName, label, onDelete, onEdit, targetLink }: { 
  key?: string | number,
  num: number, 
  url: string, 
  restaurantName: string, 
  label: string, 
  onDelete: () => void | Promise<void>,
  onEdit: () => void,
  targetLink?: string
}) {
  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    alert('Public Link copied!');
  };

  return (
    <motion.div 
      layout
      className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-orange-200"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
             <Link className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-neutral-900 truncate max-w-[150px]">{label}</h4>
            <div className="mt-1">
              <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-600 uppercase tracking-widest">Table {num}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
           <button 
             onClick={onEdit} 
             className="rounded-lg p-1.5 text-neutral-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
             title="Edit"
           >
             <LayoutDashboard className="h-4 w-4" />
           </button>
           <button 
             onClick={onDelete}
             className="rounded-lg p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
             title="Delete"
           >
             <Trash2 className="h-4 w-4" />
           </button>
        </div>
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <button 
          onClick={copyUrl}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-50 py-2.5 text-xs font-black text-orange-600 transition-colors hover:bg-orange-100 active:scale-95 uppercase tracking-widest"
          title="Copy Link"
        >
          <Link className="h-3.5 w-3.5" /> Copy Link
        </button>
      </div>
    </motion.div>
  );
}

// --- TAB: Staff Management ---
function StaffManagementTab({ restaurant, setRestaurant }: { restaurant: Restaurant, setRestaurant: React.Dispatch<React.SetStateAction<Restaurant | null>> }) {
  const [newEmail, setNewEmail] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleAddStaff = async () => {
    if (!newEmail) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        staffEmails: arrayUnion(newEmail)
      });
      setRestaurant({ ...restaurant, staffEmails: [...(restaurant.staffEmails || []), newEmail] });
      setNewEmail('');
      alert('Staff email added!');
    } catch(e) { 
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  };
  
  const handleRemoveStaff = async (email: string) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        staffEmails: arrayRemove(email)
      });
      setRestaurant({ ...restaurant, staffEmails: (restaurant.staffEmails || []).filter(e => e !== email) });
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  }
  
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join/${restaurant.id}`;
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link copied to clipboard!');
  };

  const handleAcceptAccessRequest = async (email: string) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        staffEmails: arrayUnion(email),
        requestAccessEmails: arrayRemove(email)
      });
      setRestaurant({ ...restaurant, staffEmails: [...(restaurant.staffEmails || []), email], requestAccessEmails: (restaurant.requestAccessEmails || []).filter(e => e !== email) });
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  };
    
  return (
    <div className="space-y-6">
    <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="mb-4 text-lg font-bold text-neutral-900">Invite Stuff</h3>
      <button 
        onClick={handleCopyLink}
        className="w-full rounded-xl border border-neutral-200 px-4 py-3 font-semibold text-neutral-700 transition-all hover:bg-neutral-50"
      >
        Copy Invite Link
      </button>

      {restaurant.requestAccessEmails && restaurant.requestAccessEmails.length > 0 && (
         <div className="mt-6">
           <h4 className="font-bold mb-2 text-neutral-800">Access Requests</h4>
            <div className="space-y-2">
              {restaurant.requestAccessEmails.map(email => (
                <div key={email} className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100">
                    <span>{email}</span>
                    <button 
                      onClick={() => handleAcceptAccessRequest(email)}
                      className="text-orange-600 font-bold"
                    >
                      Accept
                    </button>
                </div>
              ))}
            </div>
         </div>
      )}
    </div>

    <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="mb-4 text-lg font-bold text-neutral-900">Staff Management</h3>
      <div className="mb-6 flex gap-2">
        <input 
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-orange-500"
            placeholder="Staff Email"
        />
        <button 
            disabled={updating}
            onClick={handleAddStaff}
            className="rounded-xl bg-orange-600 px-4 py-3 font-bold text-white transition-all hover:bg-orange-700 disabled:opacity-50"
        >
            Add
        </button>
      </div>
      <div className="space-y-2">
        {(restaurant.staffEmails || []).map((email, i) => (
            <div key={i} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl">
                <span>{email}</span>
                <button 
                    disabled={updating}
                    onClick={() => handleRemoveStaff(email)}
                    className="text-red-500 font-bold"
                >
                    Remove
                </button>
            </div>
        ))}
      </div>
    </div>
    </div>
  );
}

// --- TAB: Settings ---
function SettingsTab({ onLogout, restaurant, setActiveTab, isStaff }: { onLogout: () => void, restaurant: Restaurant, setActiveTab: (tab: 'home' | 'orders' | 'menu' | 'qr' | 'settings' | 'analytics' | 'staff') => void, isStaff: boolean }) {
  const [businessType, setBusinessType] = useState(restaurant.businessType);
  const [staffCode, setStaffCode] = useState(restaurant.staffCode || '');
  const [updating, setUpdating] = useState(false);
  const [updatingCode, setUpdatingCode] = useState(false);

  const handleUpdateType = async (newType: string) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), { businessType: newType });
      setBusinessType(newType);
      window.location.reload();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStaffCode = async () => {
    setUpdatingCode(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), { staffCode });
      await setDoc(doc(db, 'staffCodes', staffCode), { restaurantId: restaurant.id });
      alert('Staff code updated successfully!');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    } finally {
      setUpdatingCode(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {!isStaff && (
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-4 text-lg font-bold text-neutral-900">Account Settings</h3>
          
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-neutral-700">Business Type</label>
            <select
              disabled={updating}
              value={businessType}
              onChange={(e) => handleUpdateType(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none transition-all focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-200"
            >
              {BUSINESS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-neutral-700">Staff Login Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
                className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-orange-500"
                placeholder="Enter secret code"
              />
              <button
                disabled={updatingCode}
                onClick={handleUpdateStaffCode}
                className="rounded-xl bg-orange-600 px-4 py-3 font-bold text-white transition-all hover:bg-orange-700 disabled:opacity-50"
              >
                {updatingCode ? '...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

        <button 
          onClick={onLogout}
          className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-red-50 px-6 py-3 font-bold text-red-600 transition-all hover:bg-red-100 active:scale-95"
        >
          <LogOut className="h-5 w-5" />
          Logout from Dashboard
        </button>

        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-4 text-lg font-bold text-neutral-900">Shop Management</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setActiveTab('staff')}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-bold text-neutral-700 transition-all hover:bg-neutral-100 active:scale-95"
            >
              <Package className="h-6 w-6 text-orange-600" />
              Staff Management
            </button>
            <button 
              onClick={() => setActiveTab('qr')}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-bold text-neutral-700 transition-all hover:bg-neutral-100 active:scale-95"
            >
              <Link className="h-6 w-6 text-orange-600" />
              QR Management
            </button>
          </div>
        </div>
    </div>
  );
}

// --- TAB: Analytics ---
function AnalyticsTab({ restaurantId, businessType }: { restaurantId: string, businessType: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qPath = 'orders';
    const q = query(
      collection(db, qPath),
      where('restaurantId', '==', restaurantId),
      where('status', '==', 'COMPLETED')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
      setLoading(false);
    });
  }, [restaurantId]);

  if (loading) {
    return <div className="text-center p-10 font-bold text-neutral-400">Loading analytics...</div>;
  }

  // Calculate stats
  let todaysEarnings = 0;
  let todaysOrders = 0;
  let monthlyEarnings = 0;
  let monthlyOrders = 0;

  const chartDataMap: Record<string, number> = {};

  orders.forEach(order => {
    // If createdAt is a Firestore timestamp, convert it
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    
    if (date) {
      if (isToday(date)) {
        todaysEarnings += order.totalAmount;
        todaysOrders++;
      }
      if (isThisMonth(date)) {
        monthlyEarnings += order.totalAmount;
        monthlyOrders++;
      }

      // Prepare chart data (daily earnings for the current month)
      if (isThisMonth(date)) {
        const dayStr = format(date, 'MMM dd');
        chartDataMap[dayStr] = (chartDataMap[dayStr] || 0) + order.totalAmount;
      }
    }
  });

  const chartData = Object.keys(chartDataMap).map(key => ({
    name: key,
    earnings: chartDataMap[key]
  })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Today's Earnings</span>
          <p className="mt-2 text-3xl font-black text-neutral-900">{formatCurrency(todaysEarnings)}</p>
        </div>
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Today's Sales (Orders)</span>
          <p className="mt-2 text-3xl font-black text-neutral-900">{todaysOrders}</p>
        </div>
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Monthly Earnings</span>
          <p className="mt-2 text-3xl font-black text-neutral-900">{formatCurrency(monthlyEarnings)}</p>
        </div>
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Monthly Customers</span>
          <p className="mt-2 text-3xl font-black text-neutral-900">{monthlyOrders}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm mt-8">
        <h3 className="mb-6 text-lg font-bold text-neutral-900">Earnings Overview (This Month)</h3>
        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A3A3A3' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A3A3A3' }} tickFormatter={(val) => `₹${val}`} dx={-10} />
                <RechartsTooltip cursor={{ fill: '#F5F5F5' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="earnings" fill="#EA580C" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-2xl bg-neutral-50 border border-dashed border-neutral-200">
            <p className="text-sm font-bold text-neutral-400">No data available for this month yet.</p>
          </div>
        )}
      </div>
      
      <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm mt-8 xl:col-span-2 overflow-hidden flex flex-col">
          <h3 className="mb-6 text-lg font-bold text-neutral-900">Recent Completed Orders</h3>
          <div className="overflow-x-auto w-full scrollbar-hide">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-100 text-neutral-400">
                <tr>
                  <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Date</th>
                  <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Customer</th>
                  <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-xs whitespace-nowrap">{businessType === 'Salon' ? 'Service/Table' : 'Table/Name'}</th>
                  <th className="pb-3 text-right font-bold uppercase tracking-wider text-xs whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 text-neutral-600">
                {orders.sort((a,b) => {
                   const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                   const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                   return dB.getTime() - dA.getTime();
                }).slice(0, 15).map(order => {
                  const dateInfo = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                  return (
                    <tr key={order.id}>
                      <td className="py-4 pr-4 whitespace-nowrap">{dateInfo ? format(dateInfo, 'MMM dd, h:mm a') : '-'}</td>
                      <td className="py-4 pr-4 font-medium text-neutral-900 whitespace-nowrap">{order.customerName}</td>
                      <td className="py-4 pr-4 whitespace-nowrap">{businessType === 'Salon' ? `Table ${order.tableNo}` : `Table ${order.tableNo}`}</td>
                      <td className="py-4 text-right font-black text-neutral-900 whitespace-nowrap">{formatCurrency(order.totalAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {orders.length === 0 && (
              <div className="p-10 text-center text-sm font-bold text-neutral-400">No completed orders yet.</div>
            )}
          </div>
      </div>
    </div>
  );
}

