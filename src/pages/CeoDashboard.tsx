import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, LogOut, DollarSign, Activity, AlertCircle, Home, BarChart2, Settings, Power, Edit2, CheckCircle2, Palette } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear, format } from 'date-fns';
import { Restaurant } from '../types';
import SleekLoader from '../components/SleekLoader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type TabType = 'home' | 'charts' | 'clients' | 'settings';

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
      case 'home':
        return (
          <div className="space-y-4 p-4 pb-24">
            <h2 className={`text-xl font-black mb-6 ${t.text}`}>Overview</h2>
            <div className={`${t.card} rounded-3xl p-6 border ${t.border} shadow-sm`}>
               <p className={`text-sm font-bold tracking-wider uppercase mb-2 ${t.textMuted}`}>Platform Revenue</p>
               <h3 className={`text-4xl font-black ${t.text}`}>₹{totalEarnings.toLocaleString()}</h3>
               <p className={`text-xs font-medium mt-2 ${t.textMuted}`}>All-time collected subscription fees</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm`}>
                <Users className={`h-6 w-6 mb-3 ${t.primary}`} />
                <h4 className={`text-3xl font-black ${t.text}`}>{restaurants.length}</h4>
                <p className={`text-xs font-semibold uppercase tracking-widest mt-1 ${t.textMuted}`}>Active Users</p>
              </div>
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm`}>
                <Activity className={`h-6 w-6 mb-3 ${t.primary}`} />
                <h4 className={`text-3xl font-black ${t.text}`}>{payments.length}</h4>
                <p className={`text-xs font-semibold uppercase tracking-widest mt-1 ${t.textMuted}`}>Total Payments</p>
              </div>
            </div>
          </div>
        );
      
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

      case 'clients':
        return (
          <div className="space-y-4 p-4 pb-24">
            <h2 className={`text-xl font-black mb-6 ${t.text}`}>Service Users</h2>
            {restaurants.length === 0 ? (
              <p className={`text-center font-medium py-10 ${t.textMuted}`}>No active businesses yet.</p>
            ) : (
              <div className="space-y-4">
                {restaurants.map(rest => {
                  const isPaid = hasPaidThisMonth(rest.id);
                  const fee = rest.subscriptionFee || 1000;
                  const isEditing = editingFeeId === rest.id;

                  return (
                    <div key={rest.id} className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className={`font-bold text-base ${t.text}`}>{rest.name}</h4>
                          <p className={`text-xs font-medium mt-1 ${t.textMuted}`}>{rest.ownerEmail}</p>
                        </div>
                        <button
                          onClick={() => toggleRestaurantBlock(rest.id, !!rest.isBlocked)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                            rest.isBlocked 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20' 
                              : `bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20`
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
                              onChange={(e) => setTempFee(e.target.value)}
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

                        {!isPaid ? (
                          <button 
                            onClick={() => markPaid(rest)}
                            className={`${t.primaryBg} text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-colors opacity-90 hover:opacity-100`}
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
                  );
                })}
              </div>
            )}
          </div>
        );

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
        <h1 className={`text-lg font-black tracking-widest uppercase flex items-center justify-center gap-2 ${t.text}`}>
          <Shield className={`h-5 w-5 ${t.primary}`} /> CEO Dashboard
        </h1>
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


