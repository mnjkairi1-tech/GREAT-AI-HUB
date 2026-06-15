import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, LogOut, DollarSign, Activity, AlertCircle, Home, BarChart2, Settings, Power, Edit2, CheckCircle2, Palette, History, Wrench, MessageSquare, Send, X, PlusCircle, Sparkles, Search, Megaphone, ArrowLeft, Check, HelpCircle } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear, format } from 'date-fns';
import { Restaurant } from '../types';
import SleekLoader from '../components/SleekLoader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type TabType = 'home' | 'charts' | 'clients' | 'tools' | 'settings';

interface PlatformPayment {
  id: string;
  restaurantId: string;
  amount: number;
  createdAt: any;
}

const THEMES = [
  { 
    id: 'dark', name: 'Midnight Dark', 
    colors: { bg: 'bg-[#0d1117]', card: 'bg-[#161b22]', text: 'text-white', textMuted: 'text-gray-400', border: 'border-gray-800', primary: 'text-orange-500', primaryBg: 'bg-orange-500', primaryLight: 'bg-orange-500/10', primaryBorder: 'border-orange-500/20', chartBar: '#f97316' }
  },
  { 
    id: 'cotton', name: 'Cotton Candy', 
    colors: { bg: 'bg-pink-50', card: 'bg-white', text: 'text-neutral-900', textMuted: 'text-neutral-500', border: 'border-pink-200', primary: 'text-pink-500', primaryBg: 'bg-pink-500', primaryLight: 'bg-pink-100', primaryBorder: 'border-pink-200', chartBar: '#ec4899' }
  },
  { 
    id: 'mint', name: 'Minty Fresh', 
    colors: { bg: 'bg-emerald-50', card: 'bg-white', text: 'text-neutral-900', textMuted: 'text-emerald-700', border: 'border-emerald-200', primary: 'text-emerald-600', primaryBg: 'bg-emerald-500', primaryLight: 'bg-emerald-100', primaryBorder: 'border-emerald-200', chartBar: '#10b981' }
  },
  { 
    id: 'lavender', name: 'Lavender Dream', 
    colors: { bg: 'bg-purple-50', card: 'bg-white', text: 'text-neutral-900', textMuted: 'text-purple-600', border: 'border-purple-200', primary: 'text-purple-600', primaryBg: 'bg-purple-500', primaryLight: 'bg-purple-100', primaryBorder: 'border-purple-200', chartBar: '#8b5cf6' }
  },
  { 
    id: 'ocean', name: 'Ocean Breeze', 
    colors: { bg: 'bg-blue-50', card: 'bg-white', text: 'text-neutral-900', textMuted: 'text-blue-600', border: 'border-blue-200', primary: 'text-blue-500', primaryBg: 'bg-blue-500', primaryLight: 'bg-blue-100', primaryBorder: 'border-blue-200', chartBar: '#3b82f6' }
  }
];

export default function CeoDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const navigate = useNavigate();

  // For editing fee
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [tempFee, setTempFee] = useState<string>('');
  const [clientTab, setClientTab] = useState<'basic' | 'standard' | 'pro'>('standard');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [clientStats, setClientStats] = useState<Record<string, { monthlyEarning: number, isLoading: boolean }>>({});

  // Tools Tab State
  const [selectedToolsClient, setSelectedToolsClient] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [activeAddTab, setActiveAddTab] = useState<'ai' | 'manual'>('ai');
  
  // Message State
  const [adminMessageBody, setAdminMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // AI Add Items State
  const [aiItemName, setAiItemName] = useState('');
  const [aiItemPrice, setAiItemPrice] = useState('');
  const [aiItemPrompt, setAiItemPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const loadClientStats = async (restId: string) => {
    if (clientStats[restId]) return;
    setClientStats(prev => ({ ...prev, [restId]: { monthlyEarning: 0, isLoading: true } }));
    try {
      const q = query(
        collection(db, 'orders'),
        where('restaurantId', '==', restId),
        where('status', '==', 'COMPLETED')
      );
      const snap = await getDocs(q);
      const orders = snap.docs.map(doc => doc.data() as any);
      
      const now = new Date();
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      
      const monthlyEarning = orders.reduce((sum, order) => {
        if (!order.createdAt) return sum;
        const dbDate = order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
        if (isWithinInterval(dbDate, { start: mStart, end: mEnd })) {
          return sum + (order.total || 0);
        }
        return sum;
      }, 0);
      
      setClientStats(prev => ({ ...prev, [restId]: { monthlyEarning, isLoading: false } }));
    } catch (err) {
      console.error("Failed to fetch client stats", err);
      setClientStats(prev => ({ ...prev, [restId]: { monthlyEarning: 0, isLoading: false } }));
    }
  };

  const handleSendAdminMessage = async () => {
    if (!selectedToolsClient || !adminMessageBody.trim()) return;
    setSendingMessage(true);
    try {
      await updateDoc(doc(db, 'restaurants', selectedToolsClient), {
        adminMessage: adminMessageBody.trim()
      });
      alert('Message sent to client!');
      setAdminMessageBody('');
    } catch (e) {
      console.error(e);
      alert('Failed to send message');
    }
    setSendingMessage(false);
  };

  const handleManualAddItem = async () => {
    if (!selectedToolsClient || !aiItemName.trim()) return;
    try {
      const rest = restaurants.find(r => r.id === selectedToolsClient);
      if (!rest) return;
      
      await addDoc(collection(db, 'menuItems'), {
        restaurantId: rest.id,
        businessType: rest.businessType || 'General Store',
        name: aiItemName.trim(),
        price: isNaN(parseFloat(aiItemPrice)) ? 0 : parseFloat(aiItemPrice),
        category: 'Admin Added',
        createdAt: serverTimestamp()
      });
      
      alert('Item added successfully to client catalog!');
      setAiItemName('');
      setAiItemPrice('');
    } catch (err) {
      console.error(err);
      alert('Failed to add item');
    }
  };

  const handleAIAddItem = async () => {
    if (!selectedToolsClient || !aiItemPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');
    try {
      const rest = restaurants.find(r => r.id === selectedToolsClient);
      if (!rest) throw new Error("Client not found");

      const response = await fetch('/api/gemini/generate-menu-items-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiItemPrompt,
          businessType: rest.businessType || 'Store'
        })
      });

      const textRes = await response.text();
      let dataList;
      try {
        dataList = JSON.parse(textRes);
      } catch (err) {
        throw new Error("AI generated an invalid response.");
      }

      if (!response.ok) {
        throw new Error(dataList?.error || 'AI bulk add failed');
      }

      await Promise.all(dataList.map((item: any) => 
        addDoc(collection(db, 'menuItems'), {
           restaurantId: rest.id,
           businessType: rest.businessType || 'Store',
           name: item.name || 'Unknown Item',
           price: parseFloat(item.price) || 0,
           category: item.category || 'AI Generated',
           createdAt: serverTimestamp()
        })
      ));

      alert('AI items added to client catalog!');
      setAiItemPrompt('');
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || 'Failed to generate items');
    }
    setAiGenerating(false);
  };

  const getLatestPaymentDate = (restId: string) => {
    const restPayments = payments.filter(p => p.restaurantId === restId);
    if (restPayments.length === 0) return 0;
    return Math.max(...restPayments.map(p => {
      if (!p.createdAt) return 0;
      return p.createdAt.seconds ? p.createdAt.seconds * 1000 : new Date(p.createdAt).getTime();
    }));
  };

  // Theme support
  const [themeId, setThemeId] = useState<string>(() => localStorage.getItem('ceoTheme') || 'dark');
  const t = useMemo(() => THEMES.find(th => th.id === themeId)?.colors || THEMES[0].colors, [themeId]);

  const changeTheme = (id: string) => {
    setThemeId(id);
    localStorage.setItem('ceoTheme', id);
  };


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/');
      } else if (user.email !== 'mnjkairi1@gmail.com') {
        navigate('/dashboard');
      } else {
        fetchPlatformData();
      }
    });
    return unsub;
  }, [navigate]);

  const fetchPlatformData = async () => {
    setLoading(true);
    try {
      const restSnap = await getDocs(collection(db, 'restaurants'));
      const restData = restSnap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant));
      setRestaurants(restData);

      const paySnap = await getDocs(collection(db, 'platformPayments'));
      const payData = paySnap.docs.map(d => ({ id: d.id, ...d.data() } as PlatformPayment));
      setPayments(payData);
    } catch (err) {
      console.error("Error fetching platform data", err);
    }
    setLoading(false);
  };

  const handleLogout = () => signOut(auth).then(() => navigate('/'));

  const toggleRestaurantBlock = async (id: string, currentlyBlocked: boolean) => {
    const confirmMsg = currentlyBlocked ? "Unblock this business?" : "Block this business? They and their staff won't be able to use the app.";
    if (!window.confirm(confirmMsg)) return;

    try {
       await updateDoc(doc(db, 'restaurants', id), { isBlocked: !currentlyBlocked });
       setRestaurants(prev => prev.map(r => r.id === id ? { ...r, isBlocked: !currentlyBlocked } : r));
    } catch (err) {
       console.error("Failed to update status", err);
       alert("Failed to update status");
    }
  };

  const saveFee = async (id: string) => {
    const num = Number(tempFee);
    if (isNaN(num) || num < 0) {
      alert("Invalid fee amount");
      return;
    }
    try {
      await updateDoc(doc(db, 'restaurants', id), { subscriptionFee: num });
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, subscriptionFee: num } : r));
      setEditingFeeId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save fee");
    }
  };

  const markPaid = async (rest: Restaurant) => {
    const fee = rest.subscriptionFee || 1000;
    if (!window.confirm(`Mark ₹${fee} as paid for this month for ${rest.name}?`)) return;

    try {
      const newPay = {
        restaurantId: rest.id,
        amount: fee,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'platformPayments'), newPay);
      setPayments(prev => [...prev, { id: docRef.id, ...newPay, createdAt: { toDate: () => new Date() } }]);
      alert("Payment recorded!");
    } catch (err) {
      console.error("Payment recording failed", err);
      alert("Failed to record payment");
    }
  };

  const { totalEarnings, monthlyEarnings, yearlyEarnings, chartData } = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);
    
    let total = 0;
    let monthly = 0;
    let yearly = 0;

    const monthlyAgg: Record<string, number> = {};

    payments.forEach(p => {
      const payDate = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
      const amount = Number(p.amount) || 0;
      
      total += amount;

      if (isWithinInterval(payDate, { start: monthStart, end: monthEnd })) {
         monthly += amount;
      }
      if (isWithinInterval(payDate, { start: yearStart, end: yearEnd })) {
         yearly += amount;
         const monthKey = format(payDate, 'MMM');
         monthlyAgg[monthKey] = (monthlyAgg[monthKey] || 0) + amount;
      }
    });

    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const finalChartData = monthsOrder.map(m => ({
      name: m,
      Earnings: monthlyAgg[m] || 0
    }));

    return { 
      totalEarnings: total, 
      monthlyEarnings: monthly, 
      yearlyEarnings: yearly,
      chartData: finalChartData
    };
  }, [payments]);

  // Check if a restaurant has paid this month
  const hasPaidThisMonth = (restId: string) => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    return payments.some(p => {
      if (p.restaurantId !== restId) return false;
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
      return isWithinInterval(d, { start: mStart, end: mEnd });
    });
  };

  if (loading) return <SleekLoader message="Initializing Admin Panel..." />;

  const renderContent = () => {
    switch (activeTab) {
      case 'home': {
        const paidThisMonthCount = restaurants.filter(r => hasPaidThisMonth(r.id)).length;
        
        return (
          <div className="space-y-4 p-4 pb-24">
            <h2 className={`text-xl font-black mb-6 ${t.text}`}>Overview</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm`}>
                <p className={`text-[10px] font-bold tracking-wider uppercase mb-2 ${t.textMuted}`}>Platform Revenue</p>
                <h3 className={`text-2xl font-black ${t.text}`}>₹{totalEarnings.toLocaleString()}</h3>
                <p className={`text-[10px] font-medium mt-1 ${t.textMuted}`}>All-time collected</p>
              </div>

              <div className={`${t.primaryLight} rounded-3xl p-5 border ${t.primaryBorder} shadow-sm`}>
                <p className={`text-[10px] font-bold tracking-wider uppercase mb-2 ${t.primary}`}>Monthly Revenue</p>
                <h3 className={`text-2xl font-black ${t.primary}`}>₹{monthlyEarnings.toLocaleString()}</h3>
                <p className={`text-[10px] font-medium mt-1 ${t.primary} opacity-80`}>This month</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm`}>
                <Users className={`h-6 w-6 mb-3 ${t.primary}`} />
                <h4 className={`text-2xl font-black ${t.text}`}>{restaurants.length}</h4>
                <p className={`text-xs font-semibold uppercase tracking-widest mt-1 ${t.textMuted}`}>Active Users</p>
              </div>
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm`}>
                <CheckCircle2 className={`h-6 w-6 mb-3 ${t.primary}`} />
                <h4 className={`text-2xl font-black ${t.text}`}>{paidThisMonthCount} <span className={`text-sm ${t.textMuted}`}>/ {restaurants.length}</span></h4>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mt-1 ${t.textMuted}`}>Paid This Month</p>
              </div>
            </div>
          </div>
        );
      }
      
      case 'charts':
        return (
          <div className="space-y-4 p-4 pb-24 h-full flex flex-col">
            <h2 className={`text-xl font-black mb-2 ${t.text}`}>Financials</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <div className={`${t.card} rounded-2xl p-4 border ${t.border} shadow-sm`}>
                 <p className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${t.textMuted}`}>This Month</p>
                 <h4 className={`text-xl font-black ${t.text}`}>₹{monthlyEarnings.toLocaleString()}</h4>
               </div>
               <div className={`${t.card} rounded-2xl p-4 border ${t.border} shadow-sm`}>
                 <p className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${t.textMuted}`}>This Year</p>
                 <h4 className={`text-xl font-black ${t.text}`}>₹{yearlyEarnings.toLocaleString()}</h4>
               </div>
            </div>
            
            <div className={`${t.card} rounded-3xl p-4 border ${t.border} shadow-sm flex-1`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-6 ml-2 ${t.textMuted}`}>Monthly Revenue</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={themeId === 'dark' ? '#2d3748' : '#e5e5e5'} vertical={false} />
                    <XAxis dataKey="name" stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} width={40} />
                    <Tooltip 
                      cursor={{fill: themeId === 'dark' ? '#2d3748' : '#f5f5f5', opacity: 0.4}}
                      contentStyle={{ backgroundColor: themeId === 'dark' ? '#1a202c' : '#fff', borderColor: themeId === 'dark' ? '#2d3748' : '#e5e5e5', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: themeId === 'dark' ? '#fff' : '#000', fontWeight: 'bold' }}
                      labelStyle={{ color: themeId === 'dark' ? '#a0aec0' : '#737373', marginBottom: '4px' }}
                    />
                    <Bar dataKey="Earnings" fill={t.chartBar} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'clients': {
        const basicRests = restaurants.filter(r => (r.subscriptionFee || 1000) <= 500);
        const standardRests = restaurants.filter(r => {
          const fee = (r.subscriptionFee || 1000);
          return fee > 500 && fee <= 1000;
        });
        const proRests = restaurants.filter(r => (r.subscriptionFee || 1000) > 1000);

        let activeRests: Restaurant[] = [];
        if (clientTab === 'basic') activeRests = basicRests;
        else if (clientTab === 'standard') activeRests = standardRests;
        else if (clientTab === 'pro') activeRests = proRests;

        // Sort by older payments first
        activeRests.sort((a, b) => getLatestPaymentDate(a.id) - getLatestPaymentDate(b.id));

        return (
          <div className="space-y-4 p-4 pb-24">
            <h2 className={`text-xl font-black mb-4 ${t.text}`}>Service Users</h2>
            
            <div className={`flex w-full p-1 rounded-2xl mb-6 ${t.card} border ${t.border}`}>
              {(['basic', 'standard', 'pro'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setClientTab(tab)}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
                    clientTab === tab 
                      ? `${t.primaryBg} text-white shadow-sm` 
                      : `${t.textMuted} hover:${t.primary}`
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {restaurants.length === 0 ? (
              <p className={`text-center font-medium py-10 ${t.textMuted}`}>No active businesses yet.</p>
            ) : activeRests.length === 0 ? (
              <p className={`text-center font-medium py-10 ${t.textMuted}`}>No users in this category.</p>
            ) : (
              <div className="space-y-4">
                {activeRests.map(rest => {
                  const isPaid = hasPaidThisMonth(rest.id);
                  const fee = rest.subscriptionFee || 1000;
                  const isEditing = editingFeeId === rest.id;

                  return (
                    <div key={rest.id} className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm transition-all`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className={`font-bold text-base flex items-center gap-2 ${t.text}`}>
                            {rest.name}
                            {rest.businessType && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase tracking-widest font-black ${t.primaryLight} ${t.primary}`}>
                                {rest.businessType}
                              </span>
                            )}
                          </h4>
                          <p className={`text-xs font-medium mt-1 ${t.textMuted}`}>{rest.ownerEmail}</p>
                        </div>
                        <button
                          onClick={() => toggleRestaurantBlock(rest.id, !!rest.isBlocked)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                            rest.isBlocked 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20'
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {rest.isBlocked ? 'Blocked' : 'Active'}
                        </button>
                      </div>

                      <div className={`flex items-center justify-between pt-3 border-t ${t.border}`}>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${t.textMuted}`}>₹</span>
                            <input 
                              type="number" 
                              value={tempFee}
                              onChange={e => setTempFee(e.target.value)}
                              className={`w-20 px-2 py-1 text-sm font-bold border ${t.border} ${t.bg} ${t.text} rounded-lg outline-none`}
                              autoFocus
                            />
                            <button onClick={() => saveFee(rest.id)} className={`p-1.5 ${t.primaryBg} text-white rounded-lg`}><CheckCircle2 className="h-4 w-4"/></button>
                            <button onClick={() => setEditingFeeId(null)} className={`p-1.5 ${t.bg} ${t.textMuted} rounded-lg text-xs font-bold px-3`}>X</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold ${t.text}`}>Fee: ₹{fee}</p>
                            <button onClick={() => { setEditingFeeId(rest.id); setTempFee(fee.toString()); }} className={`${t.textMuted} hover:${t.primary}`}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (expandedHistoryId !== rest.id) {
                                setExpandedHistoryId(rest.id);
                                loadClientStats(rest.id);
                              } else {
                                setExpandedHistoryId(null);
                              }
                            }}
                            className={`p-1.5 rounded-full hover:${t.primaryLight} ${t.textMuted} transition-colors`}
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {!isPaid ? (
                            <button 
                              onClick={() => markPaid(rest)}
                              className={`${t.primaryBg} text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-colors opacity-90 hover:opacity-100 flex items-center gap-1`}
                            >
                              Mark Paid
                            </button>
                          ) : (
                            <span className={`flex items-center gap-1 ${t.primary} ${t.primaryLight} px-3 py-1.5 rounded-xl text-xs font-bold border ${t.primaryBorder} cursor-default`}>
                              <CheckCircle2 className="h-4 w-4" /> Paid Monthly
                            </span>
                          )}
                        </div>
                      </div>

                      {expandedHistoryId === rest.id && (
                        <div className={`mt-4 p-3 rounded-2xl ${t.bg} border ${t.border} space-y-4`}>
                          
                          {/* Monthly Earning Stats */}
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Monthly Earning</span>
                            {clientStats[rest.id]?.isLoading ? (
                               <span className={`text-xs font-bold ${t.textMuted}`}>Loading...</span>
                            ) : (
                               <span className={`text-sm font-black ${t.text}`}>₹{(clientStats[rest.id]?.monthlyEarning || 0).toLocaleString()}</span>
                            )}
                          </div>

                          <div className="h-px w-full bg-black/5 dark:bg-white/5" />

                          <div>
                            <h5 className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Payment History</h5>
                            {payments.filter(p => p.restaurantId === rest.id).length === 0 ? (
                              <p className={`text-xs font-medium ${t.textMuted}`}>No payments recorded yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {payments
                                  .filter(p => p.restaurantId === rest.id)
                                  .sort((a, b) => {
                                    const aT = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
                                    const bT = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
                                    return bT - aT;
                                  })
                                  .map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-xs">
                                      <span className={`font-medium ${t.text}`}>
                                        {p.createdAt ? format(p.createdAt.seconds ? p.createdAt.seconds * 1000 : new Date(p.createdAt), 'MMM d, yyyy • h:mm a') : 'Unknown Date'}
                                      </span>
                                      <span className={`font-bold ${t.primary}`}>₹{p.amount}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'tools': {
        const filteredClients = restaurants.filter(r => {
          const q = clientSearchQuery.toLowerCase();
          return (r.name || '').toLowerCase().includes(q) || (r.ownerEmail || '').toLowerCase().includes(q);
        });

        const currentClient = restaurants.find(r => r.id === selectedToolsClient);

        return (
          <div className="space-y-6 p-4 pb-24">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className={`h-6 w-6 ${t.text}`} />
              <h2 className={`text-xl font-black ${t.text}`}>Admin Tools</h2>
            </div>
            
            {!selectedToolsClient ? (
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-wider mb-1 ${t.text}`}>Select Client Account</h3>
                  <p className={`text-[11px] ${t.textMuted}`}>Select a partner from below to broadcast announcement messages or customize their digital item catlogs remotely.</p>
                </div>
                
                {/* Search / Filter bar for clients */}
                <div className="relative">
                  <Search className={`absolute left-4 top-3.5 h-4 w-4 ${t.textMuted}`} />
                  <input 
                    type="text" 
                    placeholder="Search by owner email or business name..." 
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className={`w-full rounded-2xl border ${t.border} ${t.bg} pl-11 pr-10 py-3 outline-none ${t.text} text-sm font-medium transition-all focus:ring-1 focus:ring-orange-500`}
                  />
                  {clientSearchQuery && (
                    <button 
                      onClick={() => setClientSearchQuery('')}
                      className="absolute right-3 top-3 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <X className={`w-4 h-4 ${t.textMuted}`} />
                    </button>
                  )}
                </div>

                {/* Styled client lists */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredClients.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed rounded-2xl border-neutral-200/50">
                      <HelpCircle className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                      <p className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest">No matching accounts</p>
                    </div>
                  ) : (
                    filteredClients.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedToolsClient(r.id);
                          setAdminMessageBody(r.adminMessage || '');
                          setAiItemPrompt('');
                          setAiItemName('');
                          setAiItemPrice('');
                        }}
                        className={`w-full text-left p-4 rounded-2xl border ${t.border} ${t.bg} hover:border-orange-500/40 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 flex items-center justify-between group active:scale-98`}
                      >
                        <div className="min-w-0 pr-4">
                          <h4 className={`text-sm font-bold ${t.text} truncate group-hover:text-orange-500 transition-colors`}>{r.name}</h4>
                          <p className={`text-[10px] ${t.textMuted} font-mono truncate mt-0.5`}>{r.ownerEmail}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${t.primaryLight} ${t.primary}`}>
                            {r.businessType || 'General Store'}
                          </span>
                          {r.adminMessage && (
                            <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" title="Active announcement message posted" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Back / Dismiss Bar */}
                <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-2 rounded-2xl border border-transparent hover:border-orange-500/10 transition-all">
                  <button
                    type="button"
                    onClick={() => setSelectedToolsClient('')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#161b22] border ${t.border} text-xs font-extrabold uppercase tracking-wide ${t.text} hover:text-orange-500 hover:border-orange-500/20 shadow-sm transition-all active:scale-95`}
                  >
                    <ArrowLeft className="w-4 h-4 text-orange-500" /> Back to Partners
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedToolsClient('')}
                    className={`p-2 rounded-xl bg-white dark:bg-[#161b22] border ${t.border} text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95`}
                    title="Close selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Active Client Selection Card */}
                <div className={`${t.primaryLight} rounded-3xl p-5 border ${t.primaryBorder} shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${t.primaryBg} text-white`}>
                        {currentClient?.businessType || 'General Store'}
                      </span>
                      {currentClient?.isBlocked && (
                        <span className="text-[9px] font-black uppercase bg-red-500 text-white px-2 py-0.5 rounded-md">
                          Blocked User
                        </span>
                      )}
                    </div>
                    <h3 className={`text-lg font-black mt-1 truncate ${t.text}`}>{currentClient?.name}</h3>
                    <p className={`text-xs font-mono truncate opacity-80 ${t.text}`}>{currentClient?.ownerEmail}</p>
                  </div>
                  <button
                    onClick={() => setSelectedToolsClient('')}
                    className={`px-4 py-2 text-xs font-black uppercase rounded-xl bg-white dark:bg-[#161b22] shadow-sm border ${t.border} ${t.text} hover:opacity-90 transition-all shrink-0 active:scale-95`}
                  >
                    Change Client
                  </button>
                </div>

                {/* Card 1: Broadcast Bulletin Message */}
                <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Megaphone className={`h-5 w-5 ${t.primary}`} />
                      <h3 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>Admin Bulletin</h3>
                    </div>
                    {currentClient?.adminMessage && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> Broadcast Active
                      </span>
                    )}
                  </div>

                  <p className={`text-[11px] ${t.textMuted} leading-relaxed`}>
                    Alerts owners instantly. This message appears right at the top of their home dashboard and can be dismissed.
                  </p>

                  <textarea 
                    value={adminMessageBody}
                    onChange={(e) => setAdminMessageBody(e.target.value)}
                    placeholder="Enter support alert, system upgrade news or custom notice..."
                    className={`w-full rounded-2xl border ${t.border} ${t.bg} px-4 py-3 outline-none ${t.text} text-sm font-medium focus:ring-1 focus:ring-orange-500 min-h-[100px] resize-none`}
                  />

                  {/* Immediate quick templates */}
                  <div className="space-y-1">
                    <span className={`text-[9.5px] font-bold uppercase tracking-wider ${t.textMuted}`}>Quick Templates:</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        'Hi, please review your monthly subscription payment status.',
                        'System maintenance scheduled tonight at 11:30 PM (15 mins downtime).',
                        'Exciting news! We activated the new smart AI catalog models in your dashboard.',
                        'Your catalog configuration was completed! Let us know if you need help.'
                      ].map((tpl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAdminMessageBody(tpl)}
                          className="text-[9.5px] font-bold px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent hover:border-orange-500/25 text-gray-500 hover:text-orange-500 transition-all text-left truncate max-w-[280px]"
                          title={tpl}
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {currentClient?.adminMessage && (
                      <button 
                        onClick={async () => {
                          if (!selectedToolsClient) return;
                          try {
                            await updateDoc(doc(db, 'restaurants', selectedToolsClient), { adminMessage: '' });
                            setRestaurants(prev => prev.map(r => r.id === selectedToolsClient ? { ...r, adminMessage: '' } : r));
                            setAdminMessageBody('');
                            alert('Announcement cleared successfully!');
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className={`px-4 py-3 rounded-xl border border-red-500/20 text-red-500 font-bold text-xs hover:bg-red-500/10 transition-all uppercase tracking-widest`}
                      >
                        Clear Active Alert
                      </button>
                    )}
                    <button 
                      onClick={handleSendAdminMessage}
                      disabled={sendingMessage || !adminMessageBody.trim()}
                      className={`flex-1 ${t.primaryBg} hover:opacity-95 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest`}
                    >
                      {sendingMessage ? 'Sending...' : 'Publish broadcast'} <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card 2: Remote Catalog Setup */}
                <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-5 w-5 ${t.primary}`} />
                    <h3 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>Remote Catalog Setup</h3>
                  </div>

                  <p className={`text-[11px] ${t.textMuted} leading-relaxed`}>
                     Draft and insert products remotely. Either write a quick AI descriptive prompt or input direct name and pricing to publish manually.
                  </p>

                  {/* High Quality Segment Toggle Controls */}
                  <div className="flex bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-1 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setActiveAddTab('ai')}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeAddTab === 'ai' ? 'bg-orange-500 text-white shadow-sm' : `${t.textMuted} hover:${t.primary}`}`}
                    >
                      AI Generator
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveAddTab('manual')}
                      className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeAddTab === 'manual' ? 'bg-orange-500 text-white shadow-sm' : `${t.textMuted} hover:${t.primary}`}`}
                    >
                      Manual entry
                    </button>
                  </div>

                  {activeAddTab === 'ai' ? (
                    <div className="space-y-4">
                      <div>
                        <textarea 
                          value={aiItemPrompt}
                          onChange={(e) => setAiItemPrompt(e.target.value)}
                          placeholder="E.g. Add 3 styles of hot coffee and customized bakery cookies..."
                          className={`w-full rounded-2xl border ${t.border} ${t.bg} px-4 py-3 outline-none ${t.text} text-sm font-medium focus:ring-1 focus:ring-orange-500 min-h-[90px] resize-none`}
                        />
                        {aiError && <p className="text-red-500 text-xs font-bold mt-1">{aiError}</p>}
                      </div>

                      {/* AI suggestions templates */}
                      <div className="space-y-1">
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider ${t.textMuted}`}>Examples:</span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            'Crispy burgers (Aloo Tikki 99rs, Cheese Blast 179rs, Paneer supreme 199rs)',
                            'Special iced juices (Tropical mango 120rs, Kiwi cooler 150rs, Berries 180rs)',
                            'Classic haircut menu (Standard cut 199rs, Hair style 299rs, Shave beard 99rs)'
                          ].map((suggest, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setAiItemPrompt(`Add items: ${suggest}`)}
                              className="text-[9.5px] font-semibold px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent hover:border-orange-500/25 text-gray-500 hover:text-orange-500 transition-all text-left truncate max-w-[280px]"
                            >
                              💡 {suggest}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={handleAIAddItem}
                        type="button"
                        disabled={aiGenerating || !aiItemPrompt.trim()}
                        className={`w-full ${t.primaryBg} text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest`}
                      >
                        {aiGenerating ? 'Generating and publishing...' : 'Run Catalog AI Engine'} <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Item Title (e.g. Garlic Bread Sticks)"
                          value={aiItemName}
                          onChange={(e) => setAiItemName(e.target.value)}
                          className={`w-full rounded-2xl border ${t.border} ${t.bg} px-4 py-3 outline-none ${t.text} text-sm font-medium focus:ring-1 focus:ring-orange-500`}
                        />
                        <input 
                          type="number"
                          placeholder="Pricing (₹ e.g. 199)"
                          value={aiItemPrice}
                          onChange={(e) => setAiItemPrice(e.target.value)}
                          className={`w-full rounded-2xl border ${t.border} ${t.bg} px-4 py-3 outline-none ${t.text} text-sm font-medium focus:ring-1 focus:ring-orange-500`}
                        />
                      </div>

                      <button 
                        onClick={handleManualAddItem}
                        type="button"
                        disabled={!aiItemName.trim()}
                        className={`w-full ${t.primaryBg} text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest`}
                      >
                        <PlusCircle className="w-4 h-4" /> Write to catalog
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'settings':
        return (
          <div className="space-y-4 p-4 pb-24 flex flex-col h-full justify-center text-center max-w-sm mx-auto">
            <div className={`w-24 h-24 ${t.primaryLight} rounded-full flex items-center justify-center mx-auto mb-6 border ${t.primaryBorder}`}>
              <Shield className={`h-10 w-10 ${t.primary}`} />
            </div>
            <h2 className={`text-2xl font-black mb-2 ${t.text}`}>CEO Terminal</h2>
            <p className={`text-sm font-medium mb-8 ${t.textMuted}`}>mnjkairi1@gmail.com</p>

            <div className={`mb-8 p-6 rounded-3xl border ${t.border} ${t.card} text-left`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${t.text}`}>
                <Palette className={`h-4 w-4 ${t.primary}`} /> Theme
              </h3>
              <div className="flex flex-wrap gap-3">
                {THEMES.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => changeTheme(theme.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      themeId === theme.id 
                        ? `${t.primaryBorder} ${t.primaryLight} ${t.primary}` 
                        : `${t.border} ${t.bg} ${t.textMuted}`
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>
            
            <button
               onClick={handleLogout}
               className="flex items-center justify-center gap-2 w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all font-bold text-sm border border-red-500/20"
             >
              <LogOut className="h-5 w-5" />
              Terminate Session
            </button>
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-sans flex flex-col transition-colors duration-300`}>
      {/* Top Header */}
      <header className={`${t.bg}/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40 border-b ${t.border}`}>
        <div className={`flex items-center justify-center gap-2 ${t.text}`}>
          <Shield className={`h-6 w-6 ${t.primary}`} />
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 overflow-y-auto max-w-lg mx-auto w-full relative">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 ${t.card} border-t ${t.border} pb-safe z-50`}>
        <div className="flex items-center justify-around p-3 md:max-w-md mx-auto">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'charts', icon: BarChart2, label: 'Charts' },
            { id: 'clients', icon: Users, label: 'Clients' },
            { id: 'tools', icon: Wrench, label: 'Tools' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex flex-col items-center justify-center w-16 gap-1 transition-all ${
                  isActive ? `${t.primary} scale-110` : `${t.textMuted} hover:opacity-80`
                }`}
              >
                <div className={`p-2 rounded-xl ${isActive ? t.primaryLight : 'bg-transparent'}`}>
                  <Icon className={`h-6 w-6 stroke-[2.5px]`} />
                </div>
                {isActive && <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


