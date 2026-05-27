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
  limit,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isThisMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  ChevronDown,
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
  AlertTriangle,
  UserX,
  UserPlus,
  BookOpen,
  Search,
  Calculator,
  Users,
  Shield,
  History,
  RefreshCcw,
  Palette,
  Sparkles,
  Zap,
  Star,
  Moon,
  Layers
} from 'lucide-react';
import { THEMES, getTheme, applyTheme } from '../themes';
import { cn, formatCurrency, handleFirestoreError, OperationType } from '../lib/utils';
import { MenuItem, Order, Restaurant, OrderStatus, QrTable, StaffMember, StoreCustomer, StaffPermission } from '../types';
import { BUSINESS_TYPES } from '../constants';

const filterByBusinessType = <T extends { businessType?: string, category?: string }>(items: T[], currentType: string): T[] => {
  return items.filter(item => {
    if (item.businessType) return item.businessType === currentType;
    if ('category' in item) {
       const cat = item.category as string;
       if (currentType === 'Salon') return ['Hair', 'Face', 'Spa & Massage', 'Other Services', 'Inventory Product'].includes(cat);
       if (currentType === 'Clinic') return ['Consultation', 'Diagnostics', 'Treatment', 'Other Services', 'Inventory Product'].includes(cat);
       return ['Main Course', 'Snacks', 'Drinks', 'Desserts', 'Inventory Product'].includes(cat);
    }
    return true; 
  });
};

function GeneralStorePos({ restaurant, isStaff }: { restaurant: Restaurant, isStaff?: boolean }) {
  const [view, setView] = useState<'HOME' | 'CREDIT' | 'ADD_CUST'>('HOME');
  const [loading, setLoading] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [activeInput, setActiveInput] = useState<'amount' | 'custCode' | null>(null);

  const [amount, setAmount] = useState('');
  const [staffCode, setStaffCode] = useState(localStorage.getItem('gsStaffCode') || '');
  const [custCode, setCustCode] = useState('');
  const [custName, setCustName] = useState('');
  const [foundCust, setFoundCust] = useState<StoreCustomer | null>(null);

  const isStaffSelectionMissing = restaurant.enableStaffCode && (restaurant.staffMembers && restaurant.staffMembers.length > 0) && !staffCode;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getAmountFontSize = (val: string) => {
    const len = val.length;
    if (len <= 6) return 'text-5xl';
    if (len <= 8) return 'text-4xl';
    if (len <= 11) return 'text-3xl';
    if (len <= 15) return 'text-2xl';
    return 'text-xl';
  };

  const handleNumpadPress = (btn: string) => {
    if (activeInput === 'amount') {
      if (btn === '⌫') setAmount(prev => prev.slice(0, -1));
      else setAmount(prev => prev + btn);
    } else if (activeInput === 'custCode') {
      if (btn === '⌫') setCustCode(prev => prev.slice(0, -1));
      else if (btn !== '.') setCustCode(prev => prev + btn);
    }
  };

  const getParsedAmount = (val: string): number => {
    try {
      if (!val) return 0;
      const sanitized = val.replace(/[^0-9+\-*/.]/g, '');
      if (!sanitized) return 0;
      const evaluated = Function(`"use strict";return (${sanitized})`)();
      return Number(evaluated) || 0;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    localStorage.setItem('gsStaffCode', staffCode);
  }, [staffCode]);

  useEffect(() => {
    if (view !== 'HOME') {
      window.history.pushState({ modal: view }, '');
      const handlePop = () => {
         // when user swipes back, reset the local view instead of exiting
         setView('HOME');
         setCustCode(''); setCustName(''); setFoundCust(null);
      };
      window.addEventListener('popstate', handlePop);
      return () => window.removeEventListener('popstate', handlePop);
    }
  }, [view]);

  const reset = () => {
    setCustCode(''); setCustName('');
    setAmount('');
    setStaffCode('');
    setFoundCust(null);
    if (view !== 'HOME') {
      window.history.back(); // let the popstate handler do the rest
    } else {
      setView('HOME');
    }
  };

  const handleCashSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalAmount = getParsedAmount(amount);
    if (finalAmount <= 0) {
      alert("Please enter a valid amount first!");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        restaurantId: restaurant.id,
        businessType: restaurant.businessType,
        tableNo: restaurant.enableStaffCode ? (staffCode || 'Unknown') : 'Owner',
        staffCode: restaurant.enableStaffCode ? (staffCode || 'Unknown') : 'Owner',
        customerName: 'Cash Customer',
        items: [{ id: 'pos', name: 'Store Sale', price: finalAmount, quantity: 1 }],
        totalAmount: finalAmount,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setAmount('');
      reset();
    } catch (err) {
      console.error(err);
      alert('Failed to record sale');
    }
    setLoading(false);
  };

  const handleAddCust = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!custName || !custCode) return;
    setLoading(true);
    try {
      const qCheck = query(collection(db, 'storeCustomers'), where('restaurantId', '==', restaurant.id), where('code', '==', custCode));
      const snap = await getDocs(qCheck);
      if (!snap.empty) {
         alert('Customer code already exists!');
         setLoading(false);
         return;
      }
      const docRef = await addDoc(collection(db, 'storeCustomers'), {
        restaurantId: restaurant.id,
        name: custName,
        code: custCode,
        creditBalance: 0,
        createdAt: serverTimestamp()
      });
      if (amount && Number(amount) > 0) {
        setFoundCust({ id: docRef.id, restaurantId: restaurant.id, name: custName, code: custCode, creditBalance: 0, createdAt: new Date() });
        setView('CREDIT');
      } else {
        reset();
      }
    } catch(err) {
      console.error(err);
      alert('Failed to add customer');
    }
    setLoading(false);
  };

  const handleVerifyCust = async () => {
    if(!custCode) return;
    setLoading(true);
    try {
      const qCheck = query(collection(db, 'storeCustomers'), where('restaurantId', '==', restaurant.id), where('code', '==', custCode));
      const snap = await getDocs(qCheck);
      if (snap.empty) {
        alert('Customer not found!');
        setFoundCust(null);
      } else {
        setFoundCust({ id: snap.docs[0].id, ...snap.docs[0].data() } as StoreCustomer);
      }
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreditSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!foundCust) return;
    const finalAmount = getParsedAmount(amount);
    if (finalAmount <= 0) {
      alert("Please enter a valid amount at the top first!");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        restaurantId: restaurant.id,
        businessType: restaurant.businessType,
        tableNo: restaurant.enableStaffCode ? (staffCode || 'Unknown') : 'Owner',
        staffCode: restaurant.enableStaffCode ? (staffCode || 'Unknown') : 'Owner',
        customerName: foundCust.name,
        storeCustomerCode: foundCust.code,
        items: [{ id: 'credit', name: 'Credit Sale', price: finalAmount, quantity: 1 }],
        totalAmount: finalAmount,
        status: 'COMPLETED',
        paymentMethod: 'CREDIT',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'storeCustomers', foundCust.id), {
        creditBalance: increment(finalAmount)
      });

      setAmount('');
      reset();
    } catch (err) {
      console.error(err);
      alert('Failed to record udhaari');
    }
    setLoading(false);
  };

  return (
    <div className={`max-w-md mx-auto space-y-6 pt-6 animate-in fade-in zoom-in-95 duration-200 ${activeInput ? 'pb-[400px]' : 'pb-20'}`}>
      
      {/* ALWAYS VISIBLE TOP SECTION - amount & staff */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
         <div>
           <div className="flex items-center justify-between pl-2 pr-1 mb-2">
             <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Enter Amount (₹)</label>
             <button onClick={() => { setShowCalc(!showCalc); setActiveInput(null); }} className={`p-1.5 rounded-xl transition-all ${showCalc ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400 hover:text-neutral-600'}`}>
               <Calculator className="h-4 w-4" />
             </button>
           </div>
           <input 
             type={isMobile && !showCalc ? "button" : "text"}
             value={amount || (isMobile && !showCalc ? '0' : '')}
             readOnly={isMobile && !showCalc}
             onClick={(e) => { 
                if (isMobile && !showCalc) {
                   setActiveInput('amount');
                   const target = e.currentTarget;
                   setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
                }
             }}
             onChange={(e) => { 
                if (!isMobile || showCalc) {
                   const val = e.target.value;
                   if (/^[0-9+\-*/.]*$/.test(val)) setAmount(val);
                }
             }}
             className={`w-full ${getAmountFontSize(amount)} font-black border-none rounded-2xl p-4 text-center outline-none focus:ring-4 focus:ring-orange-100 placeholder:text-neutral-200 ${isMobile && !showCalc ? 'cursor-pointer text-neutral-900 bg-neutral-50 active:bg-neutral-100 tracking-tight' : 'bg-neutral-50 text-neutral-900 tracking-tight'} transition-all duration-150`}
             placeholder="0"
           />
           {showCalc && (
             <div className="mt-3 grid grid-cols-4 gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                {['7','8','9','/','4','5','6','*','1','2','3','-','C','0','.','+'].map(btn => (
                  <button 
                    key={btn} 
                    onClick={() => {
                        if (btn === 'C') setAmount('');
                        else setAmount(prev => prev + btn);
                    }} 
                    className={`py-3 rounded-xl font-bold text-lg transition-colors active:scale-95 ${['/','*','-','+'].includes(btn) ? 'bg-orange-50 text-orange-600' : btn === 'C' ? 'bg-red-50 text-red-600' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'}`}
                  >
                    {btn}
                  </button>
                ))}
                <button 
                  onClick={() => {
                    const res = getParsedAmount(amount);
                    if (res > 0) setAmount(String(res));
                  }} 
                  className="col-span-4 py-3 rounded-xl bg-orange-600 shadow-sm text-white font-black text-xl hover:bg-orange-700 active:scale-95 transition-all"
                >
                  =
                </button>
             </div>
           )}
         </div>
         {restaurant.enableStaffCode && (
           <div className="space-y-2">
             <div className="flex items-center justify-between pl-2">
               <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Staff Identification</label>
               {staffCode && (
                 <button onClick={() => setStaffCode('')} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline">Clear</button>
               )}
             </div>

             {/* QUICK STAFF SELECTION */}
             {restaurant.staffMembers && restaurant.staffMembers.length > 0 && (
               <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                 {restaurant.staffMembers.map(staff => (
                   <button
                     key={staff.id}
                     type="button"
                     onClick={() => setStaffCode(staff.code)}
                     className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${staffCode === staff.code ? 'bg-orange-600 text-white border-orange-600 shadow-sm scale-105' : 'bg-neutral-50 text-neutral-600 border-neutral-100 hover:border-orange-200 active:scale-95'}`}
                   >
                     {staff.name}
                   </button>
                 ))}
               </div>
             )}
           </div>
         )}
      </div>

      {isStaffSelectionMissing && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center mb-3">
          Please select a staff member to proceed.
        </div>
      )}

      {/* ACTION PANES */}
      {view === 'HOME' && (
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => handleCashSale()} disabled={loading || (isStaffSelectionMissing as boolean)} className="flex flex-col items-center justify-center gap-2 py-6 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-3xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
            <DollarSign className="h-8 w-8 mb-1" />
            <span className="text-xs font-black uppercase tracking-widest text-center">Cash <br/>Sale</span>
          </button>
          <button onClick={() => setView('CREDIT')} className="flex flex-col items-center justify-center gap-2 py-6 px-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-3xl transition-colors">
            <BookOpen className="h-8 w-8 mb-1" />
            <span className="text-xs font-black uppercase tracking-widest text-center">Udhaari</span>
          </button>
          <button onClick={() => setView('ADD_CUST')} className="flex flex-col items-center justify-center gap-2 py-6 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-3xl transition-colors">
            <UserPlus className="h-8 w-8 mb-1" />
            <span className="text-xs font-black uppercase tracking-widest text-center">Add<br/>Cust</span>
          </button>
        </div>
      )}

      {/* CREDIT (UDHAARI) PANE */}
      {view === 'CREDIT' && (
        <div className="bg-orange-50 p-6 rounded-3xl animate-in fade-in slide-in-from-top-2">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-orange-900">Udhaari (Credit)</h3>
              <button onClick={reset}><X className="text-orange-900 h-6 w-6 hover:scale-110 transition-transform" /></button>
           </div>
           
           {!foundCust ? (
             <div className="space-y-3">
               <input 
                 type={isMobile ? "button" : "text"}
                 value={custCode || (isMobile ? 'Customer Code' : '')}
                 readOnly={isMobile}
                 onChange={(e) => { if (!isMobile) setCustCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '')); }}
                 onClick={(e) => {
                    if (isMobile) {
                       setActiveInput('custCode');
                       const target = e.currentTarget;
                       setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
                    }
                 }}
                 className={`w-full text-xl font-bold bg-white rounded-xl p-4 text-center outline-none uppercase font-mono border border-orange-200 focus:border-orange-500 cursor-pointer ${!custCode ? 'text-neutral-400' : 'text-neutral-900'} h-[62px]`}
               />
               <button disabled={loading || !custCode} onClick={handleVerifyCust} className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
                 {loading ? 'Searching...' : <><Search className="h-5 w-5" /> Verify Customer</>}
               </button>
             </div>
           ) : (
             <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 text-center border border-orange-200">
                   <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Customer verified</p>
                   <p className="text-xl font-black text-neutral-900">{foundCust.name}</p>
                   <p className="text-sm font-medium text-neutral-500 mt-1">Due: ₹{foundCust.creditBalance}</p>
                </div>
                <button disabled={loading || (isStaffSelectionMissing as boolean)} onClick={() => handleCreditSale()} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wide py-4 rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none">
                  {loading ? 'Processing...' : `Confirm ₹${amount || 0} Udhaari`}
                </button>
             </div>
           )}
        </div>
      )}

      {/* ADD CUSTOMER PANE */}
      {view === 'ADD_CUST' && (
        <div className="bg-blue-50 p-6 rounded-3xl animate-in fade-in slide-in-from-top-2">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-blue-900">New Customer</h3>
              <button onClick={reset}><X className="text-blue-900 h-6 w-6 hover:scale-110 transition-transform" /></button>
           </div>
           
           <div className="space-y-3">
             <input 
               autoFocus
               type="text" 
               value={custName}
               onChange={e => setCustName(e.target.value)}
               placeholder="Customer Name"
               className="w-full text-lg font-bold bg-white rounded-xl p-4 outline-none border border-blue-200 focus:border-blue-500"
             />
             <input 
               type={isMobile ? "button" : "text"}
               value={custCode || (isMobile ? 'Unique Code (e.g. 98765..)' : '')}
               readOnly={isMobile}
               onChange={(e) => { if (!isMobile) setCustCode(e.target.value); }}
               onClick={(e) => {
                  if (isMobile) {
                     setActiveInput('custCode');
                     const target = e.currentTarget;
                     setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
                  }
               }}
               className={`w-full text-lg font-bold bg-white rounded-xl p-4 text-left outline-none uppercase font-mono border border-blue-200 focus:border-blue-500 cursor-pointer ${!custCode ? 'text-neutral-400' : 'text-neutral-900'} h-[62px]`}
             />
             <button disabled={loading || !custName || !custCode} onClick={() => handleAddCust()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-colors">
               {loading ? 'Saving...' : 'Add Customer'}
             </button>
           </div>
        </div>
      )}
      {/* Floating Numpad Overlay for custom numeric entry */}
      {activeInput && (
        <div className="fixed inset-x-0 bottom-0 z-[100] animate-in slide-in-from-bottom flex justify-center pb-8 border-t border-neutral-200 bg-white md:bg-transparent md:border-none shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="w-full max-w-md bg-white rounded-t-3xl pt-4 px-4 pb-2">
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-xs font-black text-neutral-400 tracking-wider">
                 {activeInput === 'amount' ? 'ENTER AMOUNT' : 'CUSTOMER CODE'}
              </span>
              <button onClick={() => setActiveInput(null)} className="text-orange-600 font-bold active:scale-95 text-sm p-2 bg-orange-50 rounded-xl">DONE</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
               {['1','2','3','4','5','6','7','8','9','0','⌫'].map((btn, idx) => (
                 <button 
                   key={btn} 
                   onClick={() => handleNumpadPress(btn)} 
                   className={`py-4 rounded-2xl font-bold text-2xl transition-colors active:scale-95 ${btn === '⌫' ? 'bg-red-50 text-red-600' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'} ${btn === '0' ? 'col-span-2' : ''}`}
                 >
                   {btn}
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreCustomersTab({ restaurant }: { restaurant: Restaurant }) {
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);
  const [selectedCust, setSelectedCust] = useState<StoreCustomer | null>(null);
  const [custOrders, setCustOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (selectedCust) {
      window.history.pushState({ modal: 'custDetails' }, '');
      const handlePop = () => setSelectedCust(null);
      window.addEventListener('popstate', handlePop);
      return () => window.removeEventListener('popstate', handlePop);
    }
  }, [selectedCust]);

  useEffect(() => {
    const q = query(collection(db, 'storeCustomers'), where('restaurantId', '==', restaurant.id));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreCustomer));
      setCustomers(data.sort((a,b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dbTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dbTime - da;
      }));
      setLoading(false);
    });
    return unsub;
  }, [restaurant.id]);

  useEffect(() => {
    if (!selectedCust) return;
    setLoading(true);
    // Query ALL orders for this restaurant, then filter locally to avoid composite index requirement
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurant.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Order))
        .filter(d => d.storeCustomerCode === selectedCust.code);
        
      setCustOrders(data.sort((a,b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dbTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dbTime - da;
      }));
      setLoading(false);
    });
    return unsub;
  }, [selectedCust, restaurant.id]);

  if (selectedCust) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
           <div className="flex items-center gap-3">
             <button onClick={() => window.history.back()} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-500">
               <ChevronRight className="h-6 w-6 rotate-180" />
             </button>
             <div>
               <h2 className="text-xl font-bold text-neutral-900">{selectedCust.name} <span className="text-sm font-mono text-neutral-400 font-normal">({selectedCust.code})</span></h2>
               <p className="text-sm text-neutral-500 font-medium">Total Balance: ₹{selectedCust.creditBalance}</p>
             </div>
           </div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm">
           <h3 className="font-bold text-neutral-900 mb-4">Credit History</h3>
           {loading ? (
             <p className="text-sm text-neutral-500">Loading...</p>
           ) : custOrders.length === 0 ? (
             <p className="text-sm text-neutral-500">No credit history found.</p>
           ) : (
             <div className="space-y-3">
               {custOrders.map(order => (
                 <div key={order.id} className="flex justify-between items-center p-4 bg-white border border-neutral-100 shadow-sm rounded-2xl">
                   <div>
                     <div className="flex items-center gap-2 mb-1">
                       <span className="bg-orange-100 text-orange-700 text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-sm">
                         Udhaari
                       </span>
                       <p className="font-black text-xl text-neutral-900 flex items-center">
                         <span className="text-sm font-bold text-neutral-400 mr-1">₹</span>{order.totalAmount}
                       </p>
                     </div>
                     <p className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
                       <Clock className="h-3.5 w-3.5" />
                       {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'eee, MMM dd • h:mm a') : 'Just now'}
                     </p>
                   </div>
                   {order.tableNo && order.tableNo !== 'Unknown' && (
                     <div className="bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-lg flex flex-col items-end">
                       <span className="text-[9px] uppercase font-black tracking-widest text-neutral-400">Processed By</span>
                       <span className="text-sm font-bold text-neutral-700">{restaurant.staffMembers?.find(s => s.code === order.tableNo)?.name || order.tableNo}</span>
                     </div>
                   )}
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              <BookOpen className="text-blue-500" /> Udhaari Book
            </h2>
            <p className="text-sm text-neutral-500 mt-1">View and manage customer credit</p>
          </div>
        </div>
        <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
          <Search className="h-5 w-5 text-neutral-400 mr-2" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-neutral-900 placeholder:text-neutral-400 font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-100 p-2 shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Loading customers...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No customers found.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredCustomers.map(cust => (
              <button 
                key={cust.id} 
                onClick={() => setSelectedCust(cust)}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div className="text-left">
                  <p className="font-bold text-neutral-900">{cust.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mt-1">{cust.code}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">Due</p>
                    <p className="font-bold text-orange-600">₹{cust.creditBalance}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const initialTab = (window.location.hash.replace('#', '') || 'home') as any;
  const [activeTab, setActiveTabRaw] = useState<'home' | 'orders' | 'menu' | 'settings' | 'analytics' | 'staff' | 'customers' | 'staff_analytics' | 'qr'>(initialTab);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveTabRaw(hash as any);
      else setActiveTabRaw('home');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setActiveTab = (tab: any) => {
    window.location.hash = tab;
  };
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurant?.theme) {
      applyTheme(restaurant.theme);
    } else {
      applyTheme('classic-orange');
    }
  }, [restaurant?.theme]);
  const [isStaff, setIsStaff] = useState(false);
  const navigate = useNavigate();

  const canAccess = (tab: string) => {
    if (!isStaff || !restaurant) return true;
    const permissions = restaurant.staffPermissions?.find(p => p.email === auth.currentUser?.email);
    // If no permission object exists for this staff email, allow default core tabs
    if (!permissions) {
      const defaults = ['home', 'orders', 'menu'];
      if (restaurant.businessType === 'General Store') defaults.push('customers');
      return defaults.includes(tab);
    }
    return permissions.tabs.includes(tab);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      
      if (user) {
        setLoading(true);
        try {
          // Fetch owner and staff restaurants concurrently to reduce latency
          let qOwner = query(collection(db, 'restaurants'), where('ownerId', '==', user.uid));
          let qStaff = query(collection(db, 'restaurants'), where('staffEmails', 'array-contains', user.email));
          
          let [snapOwner, snapStaff] = await Promise.all([
            getDocs(qOwner),
            getDocs(qStaff)
          ]);
          
          let loadedRestaurants: Restaurant[] = [];
          let isUserStaffForCurrent = false;

          snapOwner.docs.forEach(doc => {
            const data = doc.data();
            loadedRestaurants.push({ id: doc.id, ...data, businessType: data.businessType || 'Restaurant' } as Restaurant);
          });

          snapStaff.docs.forEach(doc => {
            // avoid duplicates if somehow they are both (shouldn't happen usually)
            if (!loadedRestaurants.find(r => r.id === doc.id)) {
              const data = doc.data();
              loadedRestaurants.push({ id: doc.id, ...data, businessType: data.businessType || 'Restaurant' } as Restaurant);
            }
          });
          
          if (loadedRestaurants.length === 0) {
            navigate('/setup');
          } else {
            setAllRestaurants(loadedRestaurants);
            // Default to first restaurant
            const first = loadedRestaurants[0];
            setRestaurant(first);
            // Check if user is staff for the first restaurant
            const isActuallyStaff = !snapOwner.docs.find(d => d.id === first.id);
            setIsStaff(isActuallyStaff);

            // Ensure ownerEmail is set if they are the owner
            if (!isActuallyStaff && !first.ownerEmail && user.email) {
               await updateDoc(doc(db, 'restaurants', first.id), { ownerEmail: user.email });
            }
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

  const handleSwitchRestaurant = (resId: string) => {
    const selected = allRestaurants.find(r => r.id === resId);
    if (selected) {
      setRestaurant(selected);
      // If user is owner, they are not staff for this one unless they only exist in snapStaff.
      // (A simplified check: if their uid matches the ownerId, they are not staff)
      setIsStaff(selected.ownerId !== auth.currentUser?.uid);
      setActiveTab('home');
    }
  };

  if (loading || !restaurant) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
    </div>
  );

  const isFoodBiz = ['hotel', 'restaurant', 'fastfood', 'fast food', 'cafe'].includes(restaurant.businessType?.toLowerCase() || '');

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 md:flex-row">
      {/* Sidebar */}
      <aside className="fixed bottom-0 z-50 flex w-full border-t border-brand-border bg-white p-2 md:relative md:bottom-auto md:z-0 md:w-64 md:flex-col md:border-r md:border-t-0 md:p-6 shadow-xl md:shadow-none">
        <div className="hidden md:mb-8 md:block">
          <div className="relative group">
            <select 
              value={restaurant.id}
              onChange={(e) => handleSwitchRestaurant(e.target.value)}
              className="w-full appearance-none pr-8 text-xl font-black text-neutral-900 bg-transparent border-none outline-none cursor-pointer truncate hover:text-brand-primary transition-colors"
            >
              {allRestaurants.map(r => (
                <option key={r.id} value={r.id} className="text-base bg-white text-neutral-900 font-semibold">{r.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-neutral-500 group-hover:text-brand-primary transition-colors">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Merchant Dashboard
          </p>
        </div>

        <nav className="flex w-full justify-around gap-2 md:flex-col md:justify-start">
          {canAccess('home') && (
            <NavBtn 
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')}
              icon={<Home className="h-5 w-5" />}
              label="Home"
            />
          )}
          {(restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? (
            <>
              {canAccess('orders') && (
                <NavBtn 
                  active={activeTab === 'orders'} 
                  onClick={() => setActiveTab('orders')}
                  icon={restaurant.businessType === 'Clinic' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  label={restaurant.businessType === 'Clinic' ? 'Appointments' : 'Appointments'}
                />
              )}
              {canAccess('menu') && (
                <NavBtn 
                  active={activeTab === 'menu'} 
                  onClick={() => setActiveTab('menu')}
                  icon={restaurant.businessType === 'Clinic' ? <LayoutList className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                  label={restaurant.businessType === 'Clinic' ? 'Services' : 'Services'}
                />
              )}
            </>
          ) : restaurant.businessType === 'General Store' ? (
            canAccess('customers') && (
              <NavBtn 
                active={activeTab === 'customers'} 
                onClick={() => setActiveTab('customers')}
                icon={<BookOpen className="h-5 w-5" />}
                label="Udhaari Book"
              />
            )
          ) : (
            <>
              {canAccess('orders') && (
                <NavBtn 
                  active={activeTab === 'orders'} 
                  onClick={() => setActiveTab('orders')}
                  icon={<LayoutDashboard className="h-5 w-5" />}
                  label="Orders"
                />
              )}
              {canAccess('menu') && (
                <NavBtn 
                  active={activeTab === 'menu'} 
                  onClick={() => setActiveTab('menu')}
                  icon={<Pizza className="h-5 w-5" />}
                  label="Menu"
                />
              )}
            </>
          )}
          
          {canAccess('analytics') && !isStaff && (
            <NavBtn 
              active={activeTab === 'analytics'} 
              onClick={() => setActiveTab('analytics')}
              icon={<BarChart3 className="h-5 w-5" />}
              label="Analytics"
              className=""
            />
          )}
          
          {(isFoodBiz || restaurant.businessType === 'General Store') && (
            <NavBtn 
              active={activeTab === 'recent_sales'} 
              onClick={() => setActiveTab('recent_sales')}
              icon={<History className="h-5 w-5" />}
              label="Completed Orders"
            />
          )}

          {isStaff && canAccess('staff_analytics') && (
            <NavBtn 
              active={activeTab === 'staff_analytics'} 
              onClick={() => setActiveTab('staff_analytics')}
              icon={<BarChart3 className="h-5 w-5" />}
              label="My Performance"
            />
          )}

          <NavBtn 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="h-5 w-5" />}
            label="Settings"
            isLast
            className=""
          />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-10 md:pb-10">
        <div className="w-full">
          <div className="mb-6 md:hidden">
            <select 
              value={restaurant.id}
              onChange={(e) => handleSwitchRestaurant(e.target.value)}
              className="w-full text-xl font-bold text-brand-primary bg-transparent border-none outline-none cursor-pointer truncate hover:opacity-80"
            >
              {allRestaurants.map(r => (
                <option key={r.id} value={r.id} className="text-base text-neutral-900">{r.name}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-400 mt-1">Merchant Dashboard</p>
          </div>
          <header className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-neutral-900 capitalize">
              {activeTab === 'home' && 'Home'}
              {activeTab === 'orders' && ((restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? 'Appointments' : 'Live Orders')}
              {activeTab === 'menu' && ((restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? 'Services' : 'Menu')}
              {activeTab === 'staff' && 'Staff'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'settings' && 'Settings'}
              {activeTab === 'customers' && 'Udhaari Book'}
              {activeTab === 'staff_analytics' && 'Staff Analytics'}
              {activeTab === 'recent_sales' && 'Completed Orders'}
              {activeTab === 'qr' && 'QR Management'}
            </h2>
            {isFoodBiz && (
              <div className="flex items-center gap-2 md:hidden">
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`p-2 rounded-xl transition-colors ${activeTab === 'settings' || activeTab === 'analytics' ? 'bg-brand-primary text-white' : 'bg-white text-neutral-500 hover:bg-neutral-50 shadow-sm border border-neutral-100'}`}
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            )}
          </header>

          <div>
            {activeTab === 'home' && restaurant.businessType === 'General Store' ? <GeneralStorePos restaurant={restaurant} isStaff={isStaff} /> : activeTab === 'home' && <HomeTab restaurant={restaurant} setActiveTab={setActiveTab} isStaff={isStaff} />}
            {activeTab !== 'home' && restaurant.businessType === 'General Store' && (activeTab === 'orders' || activeTab === 'menu') ? null : (
              <>
                {activeTab === 'orders' && canAccess('orders') && <OrdersTab restaurantId={restaurant.id} businessType={restaurant.businessType} />}
                {activeTab === 'menu' && canAccess('menu') && <MenuTab restaurantId={restaurant.id} businessType={restaurant.businessType} />}
              </>
            )}
            {activeTab === 'customers' && canAccess('customers') && <StoreCustomersTab restaurant={restaurant} />}
            {activeTab === 'staff' && !isStaff && <StaffManagementTab restaurant={restaurant} setRestaurant={setRestaurant} />}
            {activeTab === 'recent_sales' && (isFoodBiz || restaurant.businessType === 'General Store') && <RecentSalesTab restaurantId={restaurant.id} businessType={restaurant.businessType} staffMembers={restaurant.staffMembers || []} />}
            {activeTab === 'analytics' && !isStaff && canAccess('analytics') && <AnalyticsTab restaurantId={restaurant.id} businessType={restaurant.businessType} staffMembers={restaurant.staffMembers || []} />}
            {activeTab === 'staff_analytics' && canAccess('staff_analytics') && <StaffPerformanceAnalytics restaurantId={restaurant.id} staffMembers={restaurant.staffMembers || []} forceStaffView={isStaff} />}
            {activeTab === 'settings' && <SettingsTab onLogout={handleLogout} restaurant={restaurant} setRestaurant={setRestaurant} setActiveTab={setActiveTab} isStaff={isStaff} />}
            {activeTab === 'qr' && <QRTab restaurantId={restaurant.id} name={restaurant.name} businessType={restaurant.businessType} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function HomeTab({ restaurant, setActiveTab, isStaff }: { restaurant: Restaurant, setActiveTab: (tab: 'home' | 'orders' | 'menu' | 'settings' | 'analytics' | 'staff' | 'staff_analytics') => void, isStaff: boolean }) {
  const restaurantId = restaurant.id;
  const businessType = restaurant.businessType;
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [topItemsFilter, setTopItemsFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('yearly');

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
      setOrders(filterByBusinessType(data, businessType));
    });

    const unsubMenu = onSnapshot(qMenu, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(filterByBusinessType(data, businessType));
    });

    return () => { unsubOrders(); unsubMenu(); };
  }, [restaurantId]);

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
    const orderDate = new Date(order.createdAt?.toDate?.() || order.createdAt);
    const timeDiff = today.getTime() - orderDate.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    
    let isIncluded = false;
    if (topItemsFilter === 'daily') isIncluded = daysDiff <= 1;
    else if (topItemsFilter === 'weekly') isIncluded = daysDiff <= 7;
    else if (topItemsFilter === 'monthly') isIncluded = daysDiff <= 30;
    else if (topItemsFilter === 'yearly') isIncluded = daysDiff <= 365;
    
    if (isIncluded) {
      order.items.forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    }
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Take top 5

  // Calculate shop-wise revenue
  const shopEarnings: Record<string, number> = {};
  if (restaurant.shops && restaurant.shops.length > 0) {
    const staffCodeToShop: Record<string, string> = {};
    (restaurant.staffMembers || []).forEach(staff => {
      staffCodeToShop[staff.code] = staff.shop || restaurant.shops![0];
    });

    const completedOrders = orders.filter(o => o.status === 'COMPLETED');
    completedOrders.forEach(order => {
      const code = order.staffCode || order.tableNo; // fallback to tableNo if staffCode isn't set, depending on how they check out
      const shop = staffCodeToShop[code] || 'Unknown';
      shopEarnings[shop] = (shopEarnings[shop] || 0) + order.totalAmount;
    });
  }

  // Alerts
  const inventoryNotifications = (businessType === 'Salon' || businessType === 'Clinic') ? [] : menuItems
    .filter(item => !item.isAvailable || (item.stockCount !== undefined && item.stockCount !== null && item.stockCount < 5))
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
      message: `New order received from ${(businessType === 'Salon' || businessType === 'Clinic') ? 'Staff Code' : 'Table'} ${order.tableNo}!`
    }));

  const allNotifications = [...inventoryNotifications, ...orderNotifications];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Today Sales Stat Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">{isStaff ? 'Sales Count' : 'Today Sales'}</span>
            <div className="rounded-2xl bg-orange-50 p-2 text-orange-600">
              {isStaff ? <Package className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{isStaff ? completedOrdersCount : formatCurrency(todaysSales)}</h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Live calculation
            </p>
          </div>
        </div>

        {/* Total Orders Stat Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Total Orders</span>
            <div className="rounded-2xl bg-blue-50 p-2 text-blue-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{totalOrdersCount}</h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-semibold">Today's standard volume</p>
          </div>
        </div>

        {/* Pending Orders Stat Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Pending</span>
            <div className="rounded-2xl bg-amber-50 p-2 text-amber-600">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{pendingOrdersCount}</h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-semibold flex items-center gap-1">
              {pendingOrdersCount > 0 ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span> Requires prep
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-300"></span> No queue
                </>
              )}
            </p>
          </div>
        </div>

        {/* Completed Orders Stat Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">Completed</span>
            <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{completedOrdersCount}</h3>
            <p className="text-[10px] text-neutral-400 mt-1 font-semibold">Ready & dispatched</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {restaurant.businessType === 'Salon' && restaurant.shops && restaurant.shops.length > 0 && !isStaff && (
          <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm lg:col-span-3 md:col-span-2">
            <h3 className="font-bold flex items-center gap-2 text-neutral-900 mb-4">
              <DollarSign className="h-4 w-4" /> Shop-wise Revenue (All Time)
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Object.entries(shopEarnings).map(([shop, earning]) => (
                <div key={shop} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-400">{shop}</span>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">₹{earning.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Live Orders Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2 text-neutral-900">
                <Bell className="h-4 w-4 text-brand-primary" /> Live Orders
              </h3>
              <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-brand-primary uppercase tracking-widest hover:underline">View All</button>
            </div>
            
            {activeOrders.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-6">No active orders</p>
            ) : (
              <ul className="space-y-3">
                 {miniOrders.map(order => (
                   <li key={order.id} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-neutral-50">
                      <span className="font-bold">{(businessType === 'Salon' || businessType === 'Clinic') ? 'Staff Code' : 'Table'} {order.tableNo} → {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                      {!(businessType === 'Salon' || businessType === 'Clinic') && (
                        <span className={cn("text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full",
                           order.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                           order.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
                           'bg-blue-100 text-blue-700'
                        )}>
                          {order.status === 'PENDING' && '⏳ Pending'}
                          {order.status === 'PREPARING' && '⏳ Preparing'}
                          {order.status === 'ACCEPTED' && '✅ Accepted'}
                        </span>
                      )}
                   </li>
                 ))}
              </ul>
            )}
          </div>
        </div>

        {/* Top Selling Items Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2 text-neutral-900">
                <TrendingUp className="h-4 w-4 text-brand-primary" /> {(businessType === 'Salon' || businessType === 'Clinic') ? 'Top Services' : 'Top Selling Items'}
              </h3>
              <select
                value={topItemsFilter}
                onChange={(e) => setTopItemsFilter(e.target.value as any)}
                className="bg-neutral-50 border border-neutral-200 text-xs font-bold rounded-lg px-2 py-1 outline-none focus:border-brand-primary text-neutral-600"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            {topItems.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-6">No sales yet</p>
            ) : (
              <ul className="space-y-3">
                {topItems.map(([name, count]) => (
                  <li key={name} className="flex justify-between items-center text-sm p-3 rounded-2xl bg-neutral-50">
                    <span className="font-bold text-neutral-900">{name}</span>
                    <span className="text-brand-primary font-black">{count} {(businessType === 'Salon' || businessType === 'Clinic') ? 'bookings' : 'orders'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Notifications and System Status Card */}
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold flex items-center gap-2 text-neutral-900 mb-4">
              <AlertTriangle className="h-4 w-4 text-brand-primary" /> Notifications
            </h3>
            {allNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-neutral-400">
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-neutral-800">All Systems Standard</p>
                <p className="text-xs text-neutral-500">No active stock alerts or warnings.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {allNotifications.map(notification => (
                  <li key={notification.id} className={cn("flex items-center gap-3 text-xs p-3 rounded-2xl", notification.type === 'INVENTORY' ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900')}>
                    <span className={notification.type === 'INVENTORY' ? 'text-amber-500' : 'text-blue-500'}>
                      {notification.type === 'INVENTORY' ? '⚠️' : '🔔'}
                    </span>
                    <span className="font-medium">{notification.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, isLast, className }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isLast?: boolean, className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium transition-all md:flex-row md:gap-3 md:justify-start md:w-full",
        active 
          ? "bg-brand-primary text-white shadow-lg shadow-brand-secondary" 
          : "text-neutral-500 hover:bg-neutral-100",
        isLast && "md:mt-auto",
        className
      )}
    >
      {icon}
      <span className="text-[10px] md:text-sm font-semibold">{label}</span>
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
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(filterByBusinessType(fetchedOrders, businessType));
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
    PREPARING: { color: 'bg-brand-secondary text-brand-primary border-brand-secondary', icon: Pizza },
    COMPLETED: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    CANCELLED: { color: 'bg-neutral-100 text-neutral-500 border-neutral-200', icon: X }
  };

  const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in duration-300">
      {activeOrders.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <p className="text-neutral-400">Waiting for live orders...</p>
        </div>
      )}
      <AnimatePresence>
        {activeOrders.map((order) => (
          <OrderCard key={order.id} order={order} updateStatus={updateStatus} statusMap={statusMap} businessType={businessType} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function OrderCard({ order, updateStatus, statusMap, businessType }: { key?: React.Key, order: Order, updateStatus: (id: string, s: OrderStatus) => Promise<void>, statusMap: any, businessType: string }) {
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
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{(businessType === 'Salon' || businessType === 'Clinic') ? 'Staff Code' : 'Table'} {order.tableNo}</span>
          <h3 className="font-bold text-neutral-900 truncate max-w-[120px]">{order.customerName}</h3>
        </div>
        <div className="text-right flex flex-col items-end">
           {(businessType !== 'Salon' && businessType !== 'Clinic') && (
             <div className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest", statusMap[order.status].color)}>
              {order.status}
            </div>
           )}
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
                    <span className="inline-block min-w-[20px] font-bold text-brand-primary">{item.quantity}x</span> {item.name}
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
        {(businessType === 'Salon' || businessType === 'Clinic') ? (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'COMPLETED'); }}
              className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 col-span-2"
            >
              <CheckCircle2 className="h-4 w-4" /> COMPLETE APPOINTMENT
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'CANCELLED'); }}
              className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-neutral-400 hover:bg-red-50 hover:text-red-500 col-span-2 border-t border-neutral-100"
            >
              <X className="h-4 w-4" /> CANCEL
            </button>
          </>
        ) : (
          <>
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
                className="flex items-center justify-center gap-1.5 p-3 text-[11px] font-black uppercase tracking-widest text-brand-primary hover:bg-brand-secondary col-span-2"
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
          </>
        )}
      </div>
    </motion.div>
  );
}

// --- TAB: Menu ---
function MenuTab({ restaurantId, businessType }: { restaurantId: string, businessType: string }) {
  const defaultCat = businessType === 'Salon' ? 'Hair' : businessType === 'Clinic' ? 'Consultation' : 'Main Course';
  const isServiceOrFoodBusiness = ['clinic', 'salon', 'gym', 'restaurant', 'cafe', 'fast food', 'hotel', 'fastfood'].includes(businessType?.toLowerCase() || '');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', price: '', category: defaultCat, description: '', imageUrl: '', stockCount: '', volume: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const qPath = 'menuItems';
    const q = query(collection(db, qPath), where('restaurantId', '==', restaurantId));
    return onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setItems(filterByBusinessType(fetchedItems, businessType));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
    });
  }, [restaurantId]);

  const filteredItems = items.filter(item =>
    item.category !== 'Inventory Product' &&
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const resetForm = () => {
    setForm({ name: '', price: '', category: defaultCat, description: '', imageUrl: '', stockCount: '', volume: '' });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qPath = 'menuItems';
    try {
      const stockVal = form.stockCount !== '' ? parseInt(form.stockCount) : null;
      if (editingId) {
        const item = items.find(i => i.id === editingId);
        if (!item) throw new Error("Item not found");

        await updateDoc(doc(db, qPath, editingId), {
          ...form,
          restaurantId,
          businessType,
          isAvailable: item.isAvailable,
          price: isNaN(parseFloat(form.price)) ? 0 : parseFloat(form.price),
          stockCount: stockVal,
          volume: form.volume || '',
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, qPath), {
          ...form,
          restaurantId,
          businessType,
          price: isNaN(parseFloat(form.price)) ? 0 : parseFloat(form.price),
          stockCount: stockVal,
          volume: form.volume || '',
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
      stockCount: item.stockCount?.toString() || '0',
      volume: item.volume || ''
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
      const item = items.find(i => i.id === id);
      if (!item) throw new Error("Item not found");
      const { id: _, ...itemWithoutId } = item;
      await updateDoc(doc(db, 'menuItems', id), { ...itemWithoutId, isAvailable: !current, updatedAt: serverTimestamp() });
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
          className="flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-secondary px-5 py-2.5 text-sm font-bold text-brand-primary transition-all hover:opacity-80 active:scale-95"
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
           className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-brand-primary w-full md:w-64"
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
                placeholder={businessType === 'Salon' ? "Hair Spa" : businessType === 'Clinic' ? "Full Checkup" : "Delicious Burger"} 
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
                {businessType === 'Salon' ? (
                  <>
                    <option>Hair</option>
                    <option>Face</option>
                    <option>Spa & Massage</option>
                    <option>Other Services</option>
                  </>
                ) : businessType === 'Clinic' ? (
                  <>
                    <option>Consultation</option>
                    <option>Diagnostics</option>
                    <option>Treatment</option>
                    <option>Other Services</option>
                  </>
                ) : (
                  <>
                    <option>Main Course</option>
                    <option>Snacks</option>
                    <option>Drinks</option>
                    <option>Desserts</option>
                  </>
                )}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-neutral-400">DESCRIPTION {businessType === 'Salon' ? '(OPTIONAL)' : ''}</label>
              <input 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Brief description..." 
                className="w-full bg-transparent text-sm outline-none" 
              />
            </div>
            {!isServiceOrFoodBusiness && (
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
            )}
            {form.category.toLowerCase() === 'drinks' && (
              <div>
                <label className="text-xs font-bold text-neutral-400">VOLUME (E.G. 250ML, 1 LITER)</label>
                <input 
                  type="text"
                  value={form.volume} 
                  onChange={e => setForm({...form, volume: e.target.value})}
                  placeholder="e.g. 500 ml" 
                  className="w-full bg-transparent text-sm outline-none" 
                />
              </div>
            )}
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
              <button type="submit" className="h-10 w-full rounded-lg bg-brand-primary font-bold text-white hover:opacity-90">{editingId ? 'Update' : 'Save'}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map(item => (
          <div key={item.id} className="group relative rounded-2xl border border-neutral-200 bg-white p-4 transition-all hover:border-brand-primary flex flex-col justify-between">
            <div>
              {item.imageUrl && (
                <div className="h-32 w-full mb-3 overflow-hidden rounded-xl bg-neutral-100">
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase text-brand-primary">{item.category}</span>
                    {item.volume && (
                      <span className="rounded-md bg-brand-secondary px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-primary">
                        {item.volume}
                      </span>
                    )}
                    {!isServiceOrFoodBusiness && (
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest", item.stockCount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                        {item.stockCount > 0 ? `${item.stockCount} In Stock` : 'Out of Stock'}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-neutral-900 mt-1">{item.name}</h4>
                  {businessType !== 'Salon' && businessType !== 'Clinic' && (
                    <p className="text-xs text-neutral-500">{item.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-primary">{formatCurrency(item.price)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 border-t border-neutral-100 pt-3">
              <button 
                onClick={() => handleEdit(item)}
                className="text-xs font-bold text-brand-primary hover:opacity-80 uppercase tracking-widest flex items-center gap-1"
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
function QRTab({ restaurantId, name: restaurantName, businessType }: { restaurantId: string, name: string, businessType: string }) {
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
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{businessType === 'Salon' ? 'Staff Code Description (e.g. Code 101)' : 'Table Name (e.g. Table 1)'}</label>

              <input 
                required 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder={businessType === 'Salon' ? 'Staff 101' : 'Table 1'} 
                className="w-full border-b border-neutral-100 py-2 text-lg font-bold outline-none focus:border-orange-500 bg-transparent" 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{businessType === 'Salon' ? 'Staff Code (e.g. 101)' : 'Table Number'}</label>
              <input 
                required 
                type="text"
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
            businessType={businessType}
          />
        ))}
      </div>
    </div>
  );
}

function QRCard({ num, url, restaurantName, label, onDelete, onEdit, targetLink, businessType }: { 
  key?: string | number,
  num: number, 
  url: string, 
  restaurantName: string, 
  label: string, 
  onDelete: () => void | Promise<void>,
  onEdit: () => void,
  targetLink?: string,
  businessType: string
}) {
  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    alert('Public Link copied!');
  };

  return (
    <motion.div 
      layout
      className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-brand-primary"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-brand-primary">
             <Link className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-neutral-900 truncate max-w-[120px]">{label}</h4>
            <div className="mt-1">
              <span className="rounded-md bg-brand-secondary border border-brand-primary/10 px-2 py-0.5 text-[10px] font-black text-brand-primary uppercase tracking-widest">{(businessType === 'Salon' || businessType === 'Clinic') ? 'Code ' : 'Table '}{num}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
           <button 
             onClick={onEdit} 
             className="rounded-lg p-1.5 text-neutral-400 hover:bg-brand-secondary hover:text-brand-primary transition-colors"
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
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-secondary py-2.5 text-xs font-black text-brand-primary transition-colors hover:opacity-80 active:scale-95 uppercase tracking-widest"
          title="Copy Link"
        >
          <Link className="h-3.5 w-3.5" /> Copy Link
        </button>
      </div>
    </motion.div>
  );
}

// --- TAB: Staff Management ---
function StaffPerformanceAnalytics({ restaurantId, staffMembers, forceStaffView }: { restaurantId: string, staffMembers: StaffMember[], forceStaffView?: boolean }) {
  const [activeCode, setActiveCode] = useState('');
  const [activeName, setActiveName] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (forceStaffView && staffMembers.length === 1) {
      fetchStaffAnalytics(staffMembers[0].code, staffMembers[0].name);
    }
  }, [forceStaffView, staffMembers]);

  const fetchStaffAnalytics = async (code: string, name: string) => {
    setLoading(true);
    setActiveCode(code);
    setActiveName(name);
    try {
      const q = query(
        collection(db, 'orders'),
        where('restaurantId', '==', restaurantId),
        where('status', '==', 'COMPLETED'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(fetched.filter(o => o.staffCode === code || o.tableNo === code));
    } catch (e) {
      console.warn("Analytics fetch failed, using fallback:", e);
      try {
        const qSimple = query(
          collection(db, 'orders'),
          where('restaurantId', '==', restaurantId),
          where('status', '==', 'COMPLETED')
        );
        const snapshot = await getDocs(qSimple);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        const filtered = fetched
          .filter(o => o.staffCode === code || o.tableNo === code)
          .sort((a, b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return tB - tA;
          });
        setOrders(filtered);
      } catch (err2) {
        console.error(err2);
        alert('Error loading reports');
      }
    }
    setLoading(false);
  };

  const now = new Date();
  const isSameDay = (d: Date, ref: Date) => d.getDate() === ref.getDate() && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
  const isYesterday = (d: Date, ref: Date) => {
    const yesterday = new Date(ref);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(d, yesterday);
  };
  const getWeekNumber = (d: Date) => {
    const first = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - first.getTime()) / 86400000) + first.getDay() + 1) / 7);
  };
  const isSameWeek = (d: Date, ref: Date) => getWeekNumber(d) === getWeekNumber(ref) && d.getFullYear() === ref.getFullYear();
  const isSameMonth = (d: Date, ref: Date) => d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

  let todayTotal = 0, weekTotal = 0, monthTotal = 0;
  let todayCount = 0, weekCount = 0, monthCount = 0;

  const monthlyMap: Record<string, { total: number, count: number, date: Date }> = {};
  const dailyGroups: Record<string, Order[]> = {};

  orders.forEach(order => {
    let date: Date;
    if (order.createdAt?.toDate) date = order.createdAt.toDate();
    else if (order.createdAt?.seconds) date = new Date(order.createdAt.seconds * 1000);
    else date = new Date(order.createdAt);
    
    const amount = Number(order.totalAmount) || 0;

    if (isSameDay(date, now)) { todayTotal += amount; todayCount++; }
    if (isSameWeek(date, now)) { weekTotal += amount; weekCount++; }
    if (isSameMonth(date, now)) { monthTotal += amount; monthCount++; }
    
    const monthKey = format(date, 'yyyy-MM');
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { total: 0, count: 0, date: new Date(date.getFullYear(), date.getMonth(), 1) };
    }
    monthlyMap[monthKey].total += amount;
    monthlyMap[monthKey].count++;

    const logKey = format(date, 'yyyy-MM-dd');
    if (!dailyGroups[logKey]) dailyGroups[logKey] = [];
    dailyGroups[logKey].push(order);
  });

  const monthlyHistory = Object.values(monthlyMap).sort((a, b) => b.date.getTime() - a.date.getTime());
  const dailyHistoryKeys = Object.keys(dailyGroups).sort((a, b) => b.localeCompare(a));

  if (!staffMembers || staffMembers.length === 0) {
    return (
      <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8 mt-6">
        <h3 className="mb-4 text-lg font-black text-neutral-900">Performance Tracking</h3>
        <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Please add staff members to see reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-neutral-900">{forceStaffView ? 'My Stats' : 'Employee Stats'}</h3>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Live Performance Data</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-2">
          {staffMembers.map(staff => (
            <button
              key={staff.id}
              onClick={() => fetchStaffAnalytics(staff.code, staff.name)}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${activeCode === staff.code ? 'bg-neutral-900 text-white shadow-xl translate-y-[-2px]' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'} disabled:opacity-50`}
            >
              {staff.name}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-3xl bg-white border border-neutral-100 p-20 flex flex-col items-center justify-center shadow-sm">
            <RefreshCcw className="h-10 w-10 animate-spin text-orange-200 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-300">Syncing History...</p>
        </div>
      )}

      {!loading && activeCode && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="md:col-span-3 rounded-[2.5rem] bg-neutral-900 p-8 text-white relative overflow-hidden">
                <div className="absolute right-[-10%] top-[-20%] opacity-5">
                   <Users className="h-64 w-64" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
                   <div>
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] mb-2">Profile Overview</p>
                      <h4 className="text-3xl font-black tracking-tight">{activeName}</h4>
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Employee Code: #{activeCode}</p>
                   </div>
                   <div className="text-left sm:text-right">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-1">Total Career Revenue</p>
                      <p className="text-4xl font-black text-white tracking-tighter">₹{orders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0).toLocaleString()}</p>
                   </div>
                </div>
             </div>

             <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Today's Goal</span>
                <p className="text-2xl font-black text-neutral-900">₹{todayTotal.toLocaleString()}</p>
                <div className="mt-2 h-1 w-full bg-neutral-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
                </div>
                <p className="text-[9px] font-bold text-emerald-600 uppercase mt-2 tracking-tighter">{todayCount} Actions Today</p>
             </div>

             <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Weekly Balance</span>
                <p className="text-2xl font-black text-neutral-900">₹{weekTotal.toLocaleString()}</p>
                <div className="mt-2 h-1 w-full bg-neutral-100 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500" style={{ width: '100%' }} />
                </div>
                <p className="text-[9px] font-bold text-blue-500 uppercase mt-2 tracking-tighter">{weekCount} Sales this week</p>
             </div>

             <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-4">Monthly Target</span>
                <p className="text-2xl font-black text-neutral-900">₹{monthTotal.toLocaleString()}</p>
                <div className="mt-2 h-1 w-full bg-neutral-100 rounded-full overflow-hidden">
                   <div className="h-full bg-brand-primary" style={{ width: '100%' }} />
                </div>
                <p className="text-[9px] font-bold text-brand-primary uppercase mt-2 tracking-tighter">{monthCount} Total Actions</p>
             </div>
          </div>

          <div className="rounded-[2.5rem] border border-neutral-100 bg-white shadow-sm overflow-hidden">
             <div className="px-8 py-6 border-b border-neutral-50 bg-neutral-50/30 flex items-center justify-between">
                <div>
                   <h5 className="text-sm font-black text-neutral-900 uppercase tracking-tight">Earning Timeline</h5>
                   <p className="text-[9px] font-bold text-neutral-400 uppercase">Itemized transaction records</p>
                </div>
                <History className="h-5 w-5 text-neutral-300" />
             </div>

             <div className="p-2 space-y-6">
                {dailyHistoryKeys.length === 0 ? (
                  <div className="py-20 text-center">
                     <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest">No activity found</p>
                  </div>
                ) : (
                  dailyHistoryKeys.map(dateKey => {
                    const dailyOrders = dailyGroups[dateKey];
                    const dayDate = new Date(dateKey);
                    const daySum = dailyOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

                    return (
                      <div key={dateKey} className="px-4">
                         <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-2">
                               <div className="h-5 w-5 rounded-lg bg-neutral-900 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                               </div>
                               <span className="text-xs font-black text-neutral-900 uppercase">
                                 {isSameDay(dayDate, now) ? 'Today' : isYesterday(dayDate, now) ? 'Yesterday' : format(dayDate, 'EEE, dd MMM yyyy')}
                               </span>
                            </div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Day Total: ₹{daySum.toLocaleString()}</span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {dailyOrders.map(order => {
                               const t = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0);
                               return (
                                 <div key={order.id} className="group flex items-center justify-between bg-neutral-50/50 border border-neutral-100 rounded-2xl px-5 py-4 transition-all hover:bg-white hover:shadow-md hover:border-transparent">
                                    <div className="space-y-0.5">
                                       <p className="text-[11px] font-black text-neutral-800 leading-none truncate max-w-[100px]">{order.customerName || 'Walk-in'}</p>
                                       <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">{format(t, 'h:mm a')}</p>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-sm font-black text-neutral-900">₹{order.totalAmount}</p>
                                       <p className="text-[7px] font-black uppercase text-emerald-500 tracking-[0.2em] opacity-60">Success</p>
                                    </div>
                                 </div>
                               );
                            })}
                         </div>
                      </div>
                    );
                  })
                )}
             </div>
          </div>

          <div className="rounded-[2.5rem] border border-neutral-100 bg-neutral-50/30 p-8">
             <h5 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] mb-8 text-center text-center">Monthly Performance Summary</h5>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {monthlyHistory.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white px-6 py-5 rounded-[2rem] border border-neutral-100 shadow-sm transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-4">
                       <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white font-black text-xs uppercase shadow-lg">
                         {format(item.date, 'MMM')}
                       </div>
                       <div>
                          <p className="text-sm font-black text-neutral-900 tracking-tight">{format(item.date, 'MMMM yyyy')}</p>
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{item.count} Transactions</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-lg font-black text-orange-600 tracking-tighter">₹{item.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffManagementTab({ restaurant, setRestaurant }: { restaurant: Restaurant, setRestaurant: React.Dispatch<React.SetStateAction<Restaurant | null>> }) {
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editingPermissionsEmail, setEditingPermissionsEmail] = useState<string | null>(null);

  const shops = restaurant.shops && restaurant.shops.length > 0 ? restaurant.shops : ['Main Shop'];
  const [activeShop, setActiveShop] = useState(shops[0]);

  const availableTabs = [
    { id: 'home', label: restaurant.businessType === 'General Store' ? 'POS Terminal' : 'Home' },
    { id: 'orders', label: (restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? 'Appointments' : 'Live Orders' },
    { id: 'menu', label: (restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') ? 'Services' : 'Menu' },
    { id: 'analytics', label: 'Business Analytics', ownerOnly: true },
    { id: 'customers', label: 'Udhaari Book' },
    { id: 'staff_analytics', label: 'Performance Analytics' },
    { id: 'settings', label: 'Settings' }
  ].filter(t => {
    if (restaurant.businessType === 'General Store') return t.id !== 'analytics';
    if (restaurant.businessType === 'Salon' || restaurant.businessType === 'Clinic') return t.id !== 'customers';
    return t.id !== 'customers';
  });

  const togglePermission = async (email: string, tabId: string) => {
    const permissions = [...(restaurant.staffPermissions || [])];
    const existing = permissions.find(p => p.email === email);
    
    if (existing) {
      if (existing.tabs.includes(tabId)) {
        existing.tabs = existing.tabs.filter(t => t !== tabId);
      } else {
        existing.tabs.push(tabId);
      }
    } else {
      permissions.push({ email, tabs: ['home', tabId] }); // Home is usually default
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        staffPermissions: permissions
      });
      setRestaurant({ ...restaurant, staffPermissions: permissions });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  };

  const getPermissions = (email: string) => {
    const p = restaurant.staffPermissions?.find(sp => sp.email === email);
    return p ? p.tabs : ['home', 'orders', 'menu']; // Default fallback
  };

  const handleAddShop = async () => {
    if (!newShopName.trim() || shops.includes(newShopName.trim())) return;
    setUpdating(true);
    const updatedShops = [...(restaurant.shops || []), newShopName.trim()];
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        shops: updatedShops
      });
      setRestaurant({ ...restaurant, shops: updatedShops });
      setNewShopName('');
      setActiveShop(newShopName.trim());
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  };

  const handleAddStaffMember = async () => {
    if (!newName || !newCode) return;
    setUpdating(true);
    const newStaff = { id: Math.random().toString(36).substr(2, 9), name: newName, code: newCode, shop: activeShop };
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        staffMembers: arrayUnion(newStaff)
      });
      setRestaurant({ ...restaurant, staffMembers: [...(restaurant.staffMembers || []), newStaff] });
      setNewName('');
      setNewCode('');
      alert('Staff member added!');
    } catch(e) { 
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  };
  
  const handleRemoveStaffMember = async (id: string, staff: StaffMember) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        staffMembers: arrayRemove(staff)
      });
      setRestaurant({ ...restaurant, staffMembers: (restaurant.staffMembers || []).filter(s => s.id !== id) });
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
    }
    setUpdating(false);
  }
  
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

    {/* Shops Navigation */}
    {restaurant.businessType === 'Salon' && (
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {shops.map(shop => (
          <button
            key={shop}
            onClick={() => setActiveShop(shop)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeShop === shop ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'}`}
          >
            {shop}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <input 
            type="text"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            placeholder="New shop..."
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none w-32 focus:border-orange-500"
          />
          <button
            disabled={updating || !newShopName}
            onClick={handleAddShop}
            className="rounded-xl bg-orange-100 text-orange-600 px-3 py-2 text-sm font-bold transition-all hover:bg-orange-200 disabled:opacity-50"
          >
            Add Shop
          </button>
        </div>
      </div>
    )}

    <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="mb-4 text-lg font-bold text-neutral-900">Invite Staff Admin {restaurant.businessType === 'Salon' ? `(${activeShop})` : ''}</h3>
      <button 
        onClick={handleCopyLink}
        className="w-full mb-6 rounded-xl border border-neutral-200 px-4 py-3 font-semibold text-neutral-700 transition-all hover:bg-neutral-50"
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
      <h3 className="mb-4 text-lg font-bold text-neutral-900">{restaurant.businessType === 'Salon' ? `${activeShop} - ` : ''}Staff Members</h3>
      
      <div className="space-y-4 mb-6">
        <h4 className="font-bold text-sm text-neutral-600">Register Staff Member (For tracking earnings)</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto sm:flex-1">
            <input 
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-orange-500"
                placeholder="Staff Name"
            />
            <input 
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-24 shrink-0 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-orange-500"
                placeholder="Code"
            />
          </div>
          <button 
              disabled={updating}
              onClick={handleAddStaffMember}
              className="w-full sm:w-auto rounded-xl bg-orange-600 px-6 py-3 font-bold text-white transition-all hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
          >
              Add
          </button>
        </div>
        <div className="space-y-2">
          {((restaurant.staffMembers || []).filter(s => restaurant.businessType !== 'Salon' || (s.shop || 'Main Shop') === activeShop)).map((staff, i) => (
              <div key={i} className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl">
                  <span>{staff.name} (Code: {staff.code})</span>
                  <button 
                      disabled={updating}
                      onClick={() => handleRemoveStaffMember(staff.id, staff)}
                      className="text-red-500 font-bold"
                  >
                      Remove
                  </button>
              </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-neutral-600">Staff Dashboard Access</h4>
          <span className="text-[10px] uppercase font-black tracking-widest text-orange-500 bg-orange-50 px-2 py-1 rounded">Control Permissions</span>
        </div>
        <div className="flex gap-2">
          <input 
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-orange-500"
              placeholder="Enter Staff Gmail ID"
          />
          <button 
              disabled={updating}
              onClick={handleAddStaff}
              className="rounded-xl bg-neutral-900 px-4 py-3 font-bold text-white transition-all hover:bg-black active:scale-95 disabled:opacity-50"
          >
              Invite
          </button>
        </div>
        <div className="space-y-3">
          {(restaurant.staffEmails || []).map((email, i) => {
            const userPermissions = getPermissions(email);
            const isEditing = editingPermissionsEmail === email;
            
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 transition-all">
                <div className="flex items-center justify-between p-4 bg-white border-b border-neutral-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold text-xs">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-neutral-800 text-sm truncate max-w-[150px] sm:max-w-none">{email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setEditingPermissionsEmail(isEditing ? null : email)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${isEditing ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      {isEditing ? 'Close' : 'Permissions'}
                    </button>
                    <button 
                        disabled={updating}
                        onClick={() => handleRemoveStaff(email)}
                        className="text-red-400 hover:text-red-500 font-bold active:scale-95 p-1"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="p-4 bg-neutral-50"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">Accessible Features</p>
                    <div className="grid grid-cols-2 gap-2">
                       {availableTabs.map(tab => (
                         <button
                           key={tab.id}
                           onClick={() => togglePermission(email, tab.id)}
                           className={`flex items-center justify-between rounded-xl border p-3 transition-all ${userPermissions.includes(tab.id) ? 'bg-white border-orange-200 shadow-sm' : 'bg-transparent border-neutral-200 opacity-60'}`}
                         >
                           <span className={`text-[11px] font-bold ${userPermissions.includes(tab.id) ? 'text-orange-900' : 'text-neutral-500'}`}>{tab.label}</span>
                           <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${userPermissions.includes(tab.id) ? 'bg-orange-600 border-orange-600 text-white' : 'border-neutral-300'}`}>
                             {userPermissions.includes(tab.id) && <Check className="h-3 w-3" />}
                           </div>
                         </button>
                       ))}
                    </div>
                    <div className="mt-4 rounded-xl bg-orange-100/50 p-3 border border-orange-100">
                      <p className="text-[10px] leading-relaxed text-orange-800">
                        <strong>Security Note:</strong> Staff with access to 'Settings' can manage catalog and basic store info, but sensitive owner-only actions like 'Delete Store' will always be hidden.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}

function SalonProductInventory({ restaurant }: { restaurant: Restaurant }) {
  const restaurantId = restaurant.id;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newStock, setNewStock] = useState('');

  useEffect(() => {
    const qPath = 'menuItems';
    const q = query(collection(db, qPath), where('restaurantId', '==', restaurantId), where('category', '==', 'Inventory Product'));
    return onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setProducts(filterByBusinessType(fetchedProducts, restaurant.businessType));
      setLoading(false);
    });
  }, [restaurantId, restaurant.businessType]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newStock) return;
    try {
      await addDoc(collection(db, 'menuItems'), {
        restaurantId,
        businessType: restaurant.businessType,
        name: newName,
        price: 0,
        category: 'Inventory Product',
        isAvailable: true,
        stockCount: parseInt(newStock),
        updatedAt: serverTimestamp()
      });
      setNewName('');
      setNewStock('');
    } catch (error) {
      console.error(error);
      alert('Error adding product');
    }
  };

  const handleUpdateStock = async (id: string, delta: number, currentStock: number) => {
    const newCount = currentStock + delta;
    if (newCount < 0) return;
    try {
      await updateDoc(doc(db, 'menuItems', id), {
        stockCount: newCount,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this product?')) return;
    try {
      await deleteDoc(doc(db, 'menuItems', id));
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8 mt-8">
      <h3 className="mb-4 text-lg font-bold text-neutral-900">Products Inventory</h3>
      <p className="mb-6 text-sm text-neutral-500">Manage internal stock for physical products (e.g. Creams, Colors, Gels). These will NOT appear on your public menu.</p>
      
      <form onSubmit={handleAddProduct} className="mb-6 flex gap-2">
        <input 
          type="text" 
          value={newName} 
          onChange={e => setNewName(e.target.value)} 
          placeholder="Product Name" 
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-2 text-sm outline-none focus:border-orange-500" 
        />
        <input 
          type="number" 
          value={newStock} 
          onChange={e => setNewStock(e.target.value)} 
          placeholder="Qty" 
          className="w-24 rounded-xl border border-neutral-200 px-4 py-2 text-sm outline-none focus:border-orange-500" 
        />
        <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">Add</button>
      </form>

      <div className="space-y-3">
        {products.length === 0 && <p className="text-sm font-medium text-neutral-400">No products added yet.</p>}
        {products.map(product => (
          <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl bg-neutral-50 p-4 gap-4">
            <span className="font-bold text-neutral-900">{product.name}</span>
            <div className="flex items-center gap-4 justify-between sm:justify-end">
              <span className={cn("text-xs font-black uppercase tracking-widest min-w-[80px]", product.stockCount <= 5 ? "text-red-500" : "text-emerald-500")}>
                {product.stockCount} in stock
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleUpdateStock(product.id, -1, product.stockCount)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-600 shadow-sm hover:scale-105 active:scale-95 border border-neutral-200">-</button>
                <button onClick={() => handleUpdateStock(product.id, 1, product.stockCount)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-600 shadow-sm hover:scale-105 active:scale-95 border border-neutral-200">+</button>
              </div>
              <button onClick={() => handleDelete(product.id)} className="text-neutral-400 hover:text-red-500 ml-2">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- TAB: Settings ---
// --- Component: StaffRecentOrders ---
function StaffRecentOrders({ restaurantId, businessType, staffMembers }: { restaurantId: string, businessType: string, staffMembers: StaffMember[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: () => void = () => {};
    
    const startListening = () => {
      const q = query(
        collection(db, 'orders'),
        where('restaurantId', '==', restaurantId),
        where('status', '==', 'COMPLETED')
      );

      unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
          .sort((a, b) => {
            const getTime = (val: any) => {
              if (val?.toDate) return val.toDate().getTime();
              if (val) {
                const d = new Date(val);
                return isNaN(d.getTime()) ? 0 : d.getTime();
              }
              return 0;
            };
            return getTime(b.createdAt) - getTime(a.createdAt);
          });
        setOrders(data);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Orders listener failed:", err);
        setError("Failed to load history");
        setLoading(false);
      });
    };

    startListening();
    return () => unsub();
  }, [restaurantId]);

  if (loading) return (
    <div className="rounded-3xl border border-neutral-100 bg-white p-6 text-center shadow-sm">
      <RefreshCcw className="mx-auto h-6 w-6 animate-spin text-orange-400" />
      <p className="mt-2 text-[10px] uppercase font-black tracking-widest text-neutral-400">Loading History...</p>
    </div>
  );

  if (error) return (
    <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-center">
       <p className="text-xs font-bold text-red-600">{error}</p>
    </div>
  );

  return (
    <div className="rounded-3xl border border-neutral-100 bg-white shadow-sm overflow-hidden mb-6">
      <div className="flex items-center justify-between bg-neutral-50/50 px-5 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
           <History className="h-4 w-4 text-neutral-400" />
           <span className="text-xs font-black text-neutral-900 uppercase tracking-tight">Recent Completed Orders</span>
        </div>
      </div>

      <div className="overflow-x-auto w-full scrollbar-hide">
        {orders.length === 0 ? (
          <div className="py-10 text-center">
             <p className="text-xs font-medium text-neutral-400">No transactions recorded.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-neutral-100 text-neutral-400 bg-neutral-50/50">
              <tr>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px]">Date</th>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px]">Customer</th>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px]">{businessType === 'Salon' ? 'Service/Table' : businessType === 'General Store' ? 'Processed By' : 'Table/Name'}</th>
                <th className="px-5 py-3 text-right font-bold uppercase tracking-wider text-[10px]">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 text-neutral-600">
              {orders.map((order) => {
                let date: Date;
                try {
                  if (order.createdAt?.toDate) date = order.createdAt.toDate();
                  else if (order.createdAt) date = new Date(order.createdAt);
                  else date = new Date();
                  if (isNaN(date.getTime())) date = new Date();
                } catch (e) {
                  date = new Date();
                }

                return (
                  <tr key={order.id} className="transition-colors hover:bg-neutral-50/30">
                    <td className="px-5 py-4">{format(date, 'MMM dd, h:mm a')}</td>
                    <td className="px-5 py-4 font-medium text-neutral-900">{order.customerName || 'Walk-in'}</td>
                    <td className="px-5 py-4">{(businessType === 'Salon' || businessType === 'General Store') ? (!order.tableNo || order.tableNo === 'Unknown' ? 'Owner' : staffMembers?.find(s => s.code === order.tableNo)?.name || `Code: ${order.tableNo}`) : `Table ${order.tableNo}`}</td>
                    <td className="px-5 py-4 text-right font-black text-neutral-900">{formatCurrency(order.totalAmount || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RecentSalesTab({ restaurantId, businessType, staffMembers }: { restaurantId: string, businessType: string, staffMembers: StaffMember[] }) {
  return (
    <div className="mx-auto max-w-4xl">
      <StaffRecentOrders restaurantId={restaurantId} businessType={businessType} staffMembers={staffMembers} />
    </div>
  );
}

function SettingsTab({ onLogout, restaurant, setRestaurant, setActiveTab, isStaff }: { onLogout: () => void, restaurant: Restaurant, setRestaurant: React.Dispatch<React.SetStateAction<Restaurant | null>>, setActiveTab: (tab: 'home' | 'orders' | 'menu' | 'settings' | 'analytics' | 'staff' | 'staff_analytics' | 'qr') => void, isStaff: boolean }) {
  const [businessType, setBusinessType] = useState(restaurant.businessType);
  const [updating, setUpdating] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const navigate = useNavigate();

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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      setUpdating(true);
      // 1. Delete restaurant-related data
      const collectionsToDelete = ['orders', 'menuItems', 'qrTables'];
      for (const col of collectionsToDelete) {
        const q = query(collection(db, col), where('restaurantId', '==', restaurant.id));
        const snapshot = await getDocs(q);
        for (const docSnapshot of snapshot.docs) {
          await deleteDoc(doc(db, col, docSnapshot.id));
        }
      }

      // Also delete staff code if exists
      if (restaurant.staffCode) {
        await deleteDoc(doc(db, 'staffCodes', restaurant.staffCode)).catch(()=> {});
      }

      // 2. Delete restaurant
      await deleteDoc(doc(db, 'restaurants', restaurant.id));

      // 3. Delete user
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        navigate('/');
      } else {
        throw new Error('No user logged in.');
      }
    } catch (e: any) {
      console.error('Delete account error:', e);
      if (e.code === 'auth/requires-recent-login') {
        const msg = 'To delete your account, please log out and log in again, then try to delete your account.';
        console.error(msg);
        alert(msg); // fallback, though iframe issue might happen, it's better than nothing
      } else {
        console.error('Failed to delete account: ' + (e.message || 'Unknown error'));
      }
    } finally {
      setUpdating(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {!isStaff && (
        <div className="md:hidden">
          <button 
            onClick={() => setActiveTab('analytics')} 
            className="flex items-center gap-4 rounded-3xl bg-neutral-900 p-6 w-full shadow-lg hover:bg-neutral-800 transition-colors"
          >
             <div className="flex bg-neutral-800 rounded-2xl h-14 w-14 items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
             </div>
             <div className="text-left flex flex-col justify-center">
               <span className="font-bold text-lg text-white">Business Analytics</span>
               <span className="text-xs text-neutral-400 mt-1">View your stats and reports</span>
             </div>
          </button>
        </div>
      )}

      {!isStaff && (
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
          <button 
            onClick={() => setShowAccountSettings(!showAccountSettings)}
            className="flex w-full items-center justify-between outline-none"
          >
            <h3 className="text-lg font-bold text-neutral-900">Account Settings</h3>
            <ChevronDown className={`h-5 w-5 text-neutral-500 transition-transform ${showAccountSettings ? 'rotate-180' : ''}`} />
          </button>
          
          {showAccountSettings && (
            <div className="mt-6 space-y-6 pt-6 border-t border-neutral-100">
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-neutral-700">Account Email</label>
                <input
                  type="text"
                  value={auth.currentUser?.email || ''}
                  readOnly
                  className="w-full rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-neutral-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-neutral-700">Business Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={restaurant.name}
                    onChange={(e) => setRestaurant({...restaurant, name: e.target.value})}
                    className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-orange-500"
                  />
                  <button
                    disabled={updating}
                    onClick={async () => {
                      setUpdating(true);
                      try {
                        await updateDoc(doc(db, 'restaurants', restaurant.id), { name: restaurant.name });
                      } catch (e) {
                        handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
                      }
                      setUpdating(false);
                    }}
                    className="rounded-xl bg-orange-600 px-4 py-3 font-bold text-white transition-all hover:bg-orange-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>

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

              <div className="border-t border-neutral-100 pt-6">
                {showDeleteConfirm ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <h4 className="mb-2 font-bold text-red-700">Are you absolutely sure?</h4>
                    <p className="mb-4 text-sm text-red-600">
                      This will permanently delete your account, business data, menu items, orders, and all other associated data. This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        disabled={updating}
                        onClick={handleDeleteAccount}
                        className="flex-1 rounded-lg bg-red-600 py-2.5 font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
                      >
                        {updating ? 'Deleting...' : 'Yes, Delete Everything'}
                      </button>
                      <button
                        disabled={updating}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 rounded-lg bg-white px-4 py-2.5 font-bold text-neutral-700 border border-neutral-200 transition-all hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                     disabled={updating}
                     onClick={() => setShowDeleteConfirm(true)}
                     className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 font-bold text-red-600 transition-all hover:bg-red-100 active:scale-95 disabled:opacity-50"
                 >
                     <UserX className="h-5 w-5" />
                     Delete Account & All Data
                 </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isStaff && (
        <div className="rounded-3xl border border-brand-border bg-brand-card p-6 shadow-sm sm:p-8">
          <button 
            onClick={() => setShowThemes(!showThemes)}
            className="flex w-full items-center justify-between outline-none"
          >
            <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
              <Palette className="h-5 w-5 text-brand-primary" />
              Visual Themes
            </h3>
            <ChevronDown className={`h-5 w-5 text-neutral-500 transition-transform ${showThemes ? 'rotate-180' : ''}`} />
          </button>
          
          {showThemes && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-brand-border/30">
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.id}
                  disabled={updating}
                  onClick={async () => {
                    setUpdating(true);
                    try {
                      await updateDoc(doc(db, 'restaurants', restaurant.id), { theme: t.id });
                      setRestaurant({ ...restaurant, theme: t.id as any });
                    } catch (e) {
                      handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
                    }
                    setUpdating(false);
                  }}
                  className={`relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${restaurant.theme === t.id || (!restaurant.theme && t.id === 'classic-orange') ? 'border-brand-primary' : 'border-brand-border'}`}
                  style={{ 
                    backgroundColor: t.bgHex,
                    backdropFilter: t.id === 'glass-morphic' ? 'blur(10px)' : 'none'
                  }}
                >
                  {t.id === 'noir-dark' && <Moon className="absolute -right-1 -top-1 h-8 w-8 text-white opacity-20" />}
                  {t.id === 'glass-morphic' && <Layers className="absolute -right-1 -top-1 h-8 w-8 text-pink-400 opacity-30 animate-pulse" />}
                  {t.id === 'classic-orange' && <Sparkles className="absolute -right-1 -top-1 h-8 w-8 text-orange-400 opacity-30" />}
                  {t.id === 'cute-marshmallow' && <Star className="absolute -right-1 -top-1 h-8 w-8 text-pink-400 opacity-30 animate-pulse" />}
                  {t.id === 'matcha-cafe' && <Zap className="absolute -right-1 -top-1 h-8 w-8 text-emerald-400 opacity-30" />}
                  
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: t.primaryHex, border: t.id === 'glass-morphic' ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                      <div className="h-4 w-4 rounded-full bg-white opacity-40"></div>
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-tight" style={{ color: t.textHex }}>{t.name}</h4>
                      <p className="text-[10px] opacity-60" style={{ color: t.textHex }}>{t.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1.5 opacity-80">
                     <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: t.primaryHex }}></div>
                     <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: t.secondaryHex }}></div>
                     <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: t.primaryHex, opacity: 0.3 }}></div>
                  </div>

                  {(restaurant.theme === t.id || (!restaurant.theme && t.id === 'classic-orange')) && (
                    <div className="absolute right-3 bottom-3 h-5 w-5 rounded-full bg-brand-primary flex items-center justify-center text-white shadow-lg">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
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
          
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-neutral-100 bg-brand-secondary/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary text-brand-primary border border-brand-primary/10">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-neutral-900 text-sm">Enable Staff Tracking</h4>
                <p className="text-[11px] text-neutral-500">Turn this ON to track analytics by staff codes.</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const newValue = !restaurant.enableStaffCode;
                setUpdating(true);
                try {
                  await updateDoc(doc(db, 'restaurants', restaurant.id), { enableStaffCode: newValue });
                  setRestaurant({ ...restaurant, enableStaffCode: newValue });
                } catch (e) {
                  handleFirestoreError(e, OperationType.UPDATE, 'restaurants');
                } finally {
                  setUpdating(false);
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${restaurant.enableStaffCode ? 'bg-brand-primary' : 'bg-neutral-300'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${restaurant.enableStaffCode ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setActiveTab('staff')}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-bold text-neutral-700 transition-all hover:bg-neutral-100 active:scale-95"
            >
              <Package className="h-6 w-6 text-brand-primary" />
              Staff Management
            </button>
            <button 
              onClick={() => setActiveTab('qr')}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-bold text-neutral-700 transition-all hover:bg-neutral-100 active:scale-95"
            >
              <Link className="h-6 w-6 text-brand-primary" />
              QR Management
            </button>
            <button 
              onClick={() => setActiveTab('staff_analytics')}
              className={`flex items-center gap-3 rounded-xl border border-neutral-200 p-4 font-bold transition-all active:scale-95 sm:col-span-2 ${restaurant.enableStaffCode ? 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100' : 'bg-neutral-100 text-neutral-400 opacity-60'}`}
            >
              <BarChart3 className={`h-6 w-6 ${restaurant.enableStaffCode ? 'text-brand-primary' : 'text-neutral-400'}`} />
              Staff Analytics {!restaurant.enableStaffCode && <span className="ml-auto text-[10px] uppercase font-black tracking-tighter opacity-50">(Feature Disabled)</span>}
            </button>
          </div>
        </div>

        {restaurant.businessType === 'Salon' && (
           <SalonProductInventory restaurant={restaurant} />
        )}
    </div>
  );
}

// --- TAB: Analytics ---
function AnalyticsTab({ restaurantId, businessType, staffMembers }: { restaurantId: string, businessType: string, staffMembers: StaffMember[] }) {
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
      setOrders(filterByBusinessType(data, businessType));
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
      
      {!['hotel', 'restaurant', 'fastfood', 'fast food', 'cafe', 'general store'].includes(businessType.toLowerCase()) && (
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm mt-8 xl:col-span-2 overflow-hidden flex flex-col">
            <h3 className="mb-6 text-lg font-bold text-neutral-900">Recent Completed Orders</h3>
            <div className="overflow-x-auto w-full scrollbar-hide">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-100 text-neutral-400">
                  <tr>
                    <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Date</th>
                    <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Customer</th>
                    <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-xs whitespace-nowrap">{businessType === 'Salon' ? 'Service/Table' : businessType === 'General Store' ? 'Processed By' : 'Table/Name'}</th>
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
                        <td className="py-4 pr-4 whitespace-nowrap">{(businessType === 'Salon' || businessType === 'General Store') ? (!order.tableNo || order.tableNo === 'Unknown' ? 'Owner' : staffMembers?.find(s => s.code === order.tableNo)?.name || `Code: ${order.tableNo}`) : `Table ${order.tableNo}`}</td>
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
      )}
    </div>
  );
}

