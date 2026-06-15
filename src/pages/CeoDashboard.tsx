import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, updateDoc, doc, orderBy, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, LogOut, DollarSign, Activity, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Restaurant, Order } from '../types';
import SleekLoader from '../components/SleekLoader';

export default function CeoDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      // Fetch all restaurants
      const restSnap = await getDocs(collection(db, 'restaurants'));
      const restData = restSnap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant));
      setRestaurants(restData);

      // Fetch all orders (in a real production app, you might want to aggregate server-side)
      // We will fetch orders to calculate total earnings
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setOrders(ordersData);
    } catch (err) {
      console.error("Error fetching platform data", err);
    }
    setLoading(false);
  };

  const handleLogout = () => signOut(auth).then(() => navigate('/'));

  const toggleRestaurantBlock = async (id: string, currentlyBlocked: boolean) => {
    const confirmMsg = currentlyBlocked ? "Unblock this business?" : "Block this business? They and their staff will be unable to use the app.";
    if (!window.confirm(confirmMsg)) return;

    try {
       await updateDoc(doc(db, 'restaurants', id), { isBlocked: !currentlyBlocked });
       setRestaurants(prev => prev.map(r => r.id === id ? { ...r, isBlocked: !currentlyBlocked } : r));
    } catch (err) {
       console.error("Failed to update status", err);
       alert("Failed to update status");
    }
  };

  if (loading) return <SleekLoader message="Initializing Super Admin Panel..." />;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let totalEarnings = 0;
  let weeklyEarnings = 0;
  let monthlyEarnings = 0;

  orders.filter(o => o.status === 'COMPLETED').forEach(o => {
    const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
    const amount = Number(o.totalAmount) || 0;
    
    totalEarnings += amount;

    if (isWithinInterval(orderDate, { start: weekStart, end: weekEnd })) {
       weeklyEarnings += amount;
    }
    if (isWithinInterval(orderDate, { start: monthStart, end: monthEnd })) {
       monthlyEarnings += amount;
    }
  });

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 font-sans selection:bg-brand-primary/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#161b22] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500 border border-orange-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">CEO Terminal</h1>
            <p className="text-xs font-medium text-gray-400">System Administrator • <span className="text-orange-400">mnjkairi1@gmail.com</span></p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-red-500/10 hover:text-red-400 text-gray-400 rounded-xl transition-all font-medium text-sm border border-gray-700 hover:border-red-500/30"
        >
          <LogOut className="h-4 w-4" />
          Terminate Session
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#161b22] rounded-2xl p-6 border border-gray-800 flex items-start justify-between relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <DollarSign className="h-24 w-24" />
             </div>
             <div className="z-10">
               <p className="text-sm font-semibold tracking-wider text-gray-400 uppercase mb-2">Total Platform Volume</p>
               <h3 className="text-4xl font-black text-white">₹{totalEarnings.toLocaleString()}</h3>
             </div>
             <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl z-10 border border-emerald-500/20">
               <Activity className="h-6 w-6" />
             </div>
          </div>

          <div className="bg-[#161b22] rounded-2xl p-6 border border-gray-800 flex items-start justify-between relative overflow-hidden group">
             <div className="z-10">
               <p className="text-sm font-semibold tracking-wider text-gray-400 uppercase mb-2">Monthly Processing</p>
               <h3 className="text-4xl font-black text-white">₹{monthlyEarnings.toLocaleString()}</h3>
               <p className="text-xs text-gray-500 mt-2 font-medium flex items-center gap-1"><Calendar className="h-3 w-3"/> This Month</p>
             </div>
             <div className="bg-blue-500/10 text-blue-400 p-3 rounded-xl z-10 border border-blue-500/20">
               <TrendingUp className="h-6 w-6" />
             </div>
          </div>

          <div className="bg-[#161b22] rounded-2xl p-6 border border-gray-800 flex items-start justify-between relative overflow-hidden group">
             <div className="z-10">
               <p className="text-sm font-semibold tracking-wider text-gray-400 uppercase mb-2">Weekly Processing</p>
               <h3 className="text-4xl font-black text-white">₹{weeklyEarnings.toLocaleString()}</h3>
               <p className="text-xs text-gray-500 mt-2 font-medium flex items-center gap-1"><Calendar className="h-3 w-3"/> This Week</p>
             </div>
             <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-xl z-10 border border-indigo-500/20">
               <Activity className="h-6 w-6" />
             </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-[#161b22] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-[#13171d]">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-800 rounded-xl">
                  <Users className="h-5 w-5 text-gray-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Registered Businesses</h3>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">Manage platform operators & access controls</p>
                </div>
             </div>
             <div className="text-xs font-black text-orange-500 tracking-widest uppercase bg-orange-500/10 px-4 py-2 rounded-lg border border-orange-500/20 shadow-inner">
               {restaurants.length} Active Nodes
             </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-[#0d1117] text-gray-400 text-xs tracking-wider uppercase font-bold border-b border-gray-800">
                      <th className="px-6 py-4">Business Info</th>
                      <th className="px-6 py-4">Owner / Contact</th>
                      <th className="px-6 py-4">Total Staff</th>
                      <th className="px-6 py-4">Total Earnings</th>
                      <th className="px-6 py-4">Recent Returns (Wk/Mo)</th>
                      <th className="px-6 py-4">System Status</th>
                      <th className="px-6 py-4 text-right">Access Control</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                   {restaurants.map(rest => {
                      const restOrders = orders.filter(o => o.restaurantId === rest.id && o.status === 'COMPLETED');
                      let restTotalEarnings = 0;
                      let restWeeklyEarnings = 0;
                      let restMonthlyEarnings = 0;

                      restOrders.forEach(o => {
                         const amount = Number(o.totalAmount) || 0;
                         const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
                         restTotalEarnings += amount;
                         if (isWithinInterval(orderDate, { start: weekStart, end: weekEnd })) {
                            restWeeklyEarnings += amount;
                         }
                         if (isWithinInterval(orderDate, { start: monthStart, end: monthEnd })) {
                            restMonthlyEarnings += amount;
                         }
                      });
                      
                      return (
                         <tr key={rest.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4">
                               <p className="text-sm font-bold text-white">{rest.name}</p>
                               <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md mt-1 inline-block border border-indigo-500/20">{rest.businessType || 'General'}</span>
                            </td>
                            <td className="px-6 py-4">
                               <p className="text-sm text-gray-300 font-medium">{rest.ownerEmail || 'Unknown Email'}</p>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-1.5 text-gray-400 bg-gray-800/50 w-fit px-3 py-1 rounded-lg border border-gray-700/50">
                                 <Users className="h-3.5 w-3.5" />
                                 <span className="text-sm font-bold text-gray-200">{rest.staffEmails?.length || 0}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <p className="text-sm font-bold text-gray-300 flex items-center"><span className="text-xs text-gray-500 mr-1">₹</span>{restTotalEarnings.toLocaleString()}</p>
                               <p className="text-xs text-gray-500 font-medium mt-0.5">{restOrders.length} processed operations</p>
                            </td>
                            <td className="px-6 py-4">
                               <p className="text-xs text-green-400 font-bold mb-1">Mo: ₹{restMonthlyEarnings.toLocaleString()}</p>
                               <p className="text-[11px] text-gray-400 font-medium">Wk: ₹{restWeeklyEarnings.toLocaleString()}</p>
                            </td>
                            <td className="px-6 py-4">
                               {rest.isBlocked ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
                                    <AlertCircle className="h-3 w-3" /> Suspended
                                  </span>
                               ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Activity className="h-3 w-3" /> Active
                                  </span>
                               )}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <button 
                                 onClick={() => toggleRestaurantBlock(rest.id, !!rest.isBlocked)}
                                 className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative overflow-hidden group ${rest.isBlocked ? 'bg-emerald-500 hover:bg-emerald-400 text-[#0d1117]' : 'bg-gray-800 hover:bg-red-500 hover:text-white text-gray-300 border border-gray-700 hover:border-red-500'}`}
                               >
                                 <span className="relative z-10">{rest.isBlocked ? 'Restore Access' : 'Suspend Node'}</span>
                               </button>
                            </td>
                         </tr>
                      );
                   })}
                   {restaurants.length === 0 && (
                      <tr>
                         <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                            No active businesses detected in the network.
                         </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>

      </main>
    </div>
  );
}
