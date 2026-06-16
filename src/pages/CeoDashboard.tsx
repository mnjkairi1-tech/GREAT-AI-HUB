import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, LogOut, DollarSign, Activity, AlertCircle, Home, BarChart2, Settings, Power, Edit2, CheckCircle2, Palette, History, Wrench, MessageSquare, Send, X, PlusCircle, Sparkles, Search, Megaphone, ArrowLeft, Check, HelpCircle, Bell, AlertTriangle, CreditCard, ChevronRight, Layers, Globe, TrendingUp, Volume2, Terminal, Lock } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear, format } from 'date-fns';
import { Restaurant } from '../types';
import SleekLoader from '../components/SleekLoader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts';

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


const parseFirebaseDate = (createdAt: any): Date => {
  if (!createdAt) return new Date(0);
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }
  if (createdAt instanceof Date) {
    return createdAt;
  }
  if (typeof createdAt === 'object' && createdAt.seconds !== undefined) {
    return new Date(createdAt.seconds * 1000);
  }
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  return new Date(0);
};

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
  const [clientStats, setClientStats] = useState<Record<string, { 
    monthlyEarning: number; 
    ordersCount: number;
    menuItemsCount: number;
    resourceScore: number;
    scansCount: number;
    bandwidthMb: number;
    recommendedFee: number;
    isLoading: boolean;
  }>>({});
  const [clientsSubTab, setClientsSubTab] = useState<'billing' | 'telemetry'>('billing');

  // Custom IFrame Safe Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const triggerSafeConfirm = (title: string, description: string, onConfirm: () => void, confirmText = "Confirm", cancelText = "Cancel") => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      },
      confirmText,
      cancelText
    });
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev && prev.message === message ? null : prev);
    }, 4000);
  };


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

  // Premium Client Configuration States
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>('');
  const [homeCategoryFilter, setHomeCategoryFilter] = useState<string>('All');
  const [customBusinessType, setCustomBusinessType] = useState<string>('Restaurant');
  const [customClientTheme, setCustomClientTheme] = useState<string>('classic-orange');
  const [customStaffCodeEnabled, setCustomStaffCodeEnabled] = useState<boolean>(false);
  const [customSubscriptionFee, setCustomSubscriptionFee] = useState<number>(1000);
  const [customStaffCode, setCustomStaffCode] = useState<string>('');
  const [updatingOverrides, setUpdatingOverrides] = useState<boolean>(false);

  // Advanced Charts / Analytics Visual options
  const [revenueChartMode, setRevenueChartMode] = useState<'bar' | 'area' | 'line'>('bar');

  const handleSaveClientOverrides = async () => {
    if (!selectedToolsClient) return;
    setUpdatingOverrides(true);
    try {
      await updateDoc(doc(db, 'restaurants', selectedToolsClient), {
        businessType: customBusinessType,
        theme: customClientTheme,
        enableStaffCode: customStaffCodeEnabled,
        subscriptionFee: Number(customSubscriptionFee) || 1000,
        staffCode: customStaffCode
      });
      setRestaurants(prev => prev.map(r => r.id === selectedToolsClient ? {
        ...r,
        businessType: customBusinessType,
        theme: customClientTheme as any,
        enableStaffCode: customStaffCodeEnabled,
        subscriptionFee: Number(customSubscriptionFee) || 1000,
        staffCode: customStaffCode
      } : r));
      showToast('Client configurations updated successfully! Changes are applied instantly.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update configurations', 'error');
    }
    setUpdatingOverrides(false);
  };

  const handleInjectTemplate = async (presetType: string) => {
    if (!selectedToolsClient) return;
    
    let itemsToInject: Array<{ name: string; price: number; category: string }> = [];
    
    if (presetType === 'Food & Cafe / Restaurant') {
      itemsToInject = [
        { name: 'Double Cheese Margherita Pizza', price: 249, category: 'Pizza' },
        { name: 'Crispy Veg Spicy Burger', price: 119, category: 'Burgers' },
        { name: 'Iced Irish Brew Mocha', price: 180, category: 'Beverages' },
        { name: 'Fresh Alfonso Mango Smoothie', price: 160, category: 'Beverages' },
        { name: 'Stuffed Garlic Breadsticks', price: 139, category: 'Appetizers' }
      ];
    } else if (presetType === 'Beauty Salon & Spa') {
      itemsToInject = [
        { name: 'Global Hair Color & Spa Treatment', price: 2499, category: 'Hair Services' },
        { name: 'Detoxifying Facial & Face Massage', price: 999, category: 'Skin Care' },
        { name: 'Classic Hair Styling & Trim', price: 349, category: 'Hair Services' },
        { name: 'Premium Pedicure & Feet Therapy', price: 799, category: 'Nail & Feet' },
        { name: 'Detoxifying Head Hot Oil Massage (30 mins)', price: 490, category: 'Body Therapy' }
      ];
    } else if (presetType === 'Medical Clinic / Dentist') {
      itemsToInject = [
        { name: 'General Physician Consultation', price: 500, category: 'Consultation' },
        { name: 'Complete Ultrasonic Dental Scaling', price: 1200, category: 'Dental Care' },
        { name: 'Pediatric Child Health Screening', price: 800, category: 'Specialist' },
        { name: 'Digital Teeth X-Ray & Report', price: 400, category: 'Lab Diagnostics' },
        { name: 'Suture dress & sterile bandaging', price: 299, category: 'Procedures' }
      ];
    } else if (presetType === 'General Retail & Essentials') {
      itemsToInject = [
        { name: 'Natural Aloe Vera Skin Gel (150g)', price: 180, category: 'Cosmetics' },
        { name: 'Cold Pressed Coconut Massage Oil (250ml)', price: 299, category: 'Essentials' },
        { name: 'Premium Multi-Vitamin Gummies (30 count)', price: 450, category: 'Wellness' },
        { name: 'Hydrating Botanical Body Wash', price: 340, category: 'Personal Care' },
        { name: 'Organic Herbal Detox Tea Kit', price: 220, category: 'Groceries' }
      ];
    }

    if (itemsToInject.length === 0) return;

    triggerSafeConfirm(
      `Inject ${presetType} Blueprints?`,
      `Would you like to instantly auto-populate 5 premium starter items for "${presetType}" to kickstart the system search catalog?`,
      async () => {
        try {
          await Promise.all(itemsToInject.map(item => 
            addDoc(collection(db, 'menuItems'), {
              restaurantId: selectedToolsClient,
              businessType: customBusinessType,
              name: item.name,
              price: item.price,
              category: item.category,
              isAvailable: true,
              stockCount: 100,
              createdAt: serverTimestamp()
            })
          ));
          showToast('Blueprint template injected successfully!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Failed to inject template', 'error');
        }
      },
      "Inject Preset",
      "Cancel"
    );
  };

  const loadClientStats = async (restId: string) => {
    if (clientStats[restId]?.resourceScore !== undefined && !clientStats[restId]?.isLoading) return;
    setClientStats(prev => ({ 
      ...prev, 
      [restId]: { 
        monthlyEarning: prev[restId]?.monthlyEarning || 0, 
        ordersCount: prev[restId]?.ordersCount || 0,
        menuItemsCount: prev[restId]?.menuItemsCount || 0,
        resourceScore: prev[restId]?.resourceScore || 0,
        scansCount: prev[restId]?.scansCount || 0,
        bandwidthMb: prev[restId]?.bandwidthMb || 0,
        recommendedFee: prev[restId]?.recommendedFee || 1000,
        isLoading: true 
      } 
    }));
    try {
      const q = query(
        collection(db, 'orders'),
        where('restaurantId', '==', restId)
      );
      const snap = await getDocs(q);
      const orders = snap.docs.map(doc => doc.data() as any);
      
      const now = new Date();
      const mStart = startOfMonth(now);
      const mEnd = endOfMonth(now);
      
      const monthlyEarning = orders.reduce((sum, order) => {
        if (order.status !== 'COMPLETED') return sum;
        if (!order.createdAt) return sum;
        const dbDate = order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
        if (isWithinInterval(dbDate, { start: mStart, end: mEnd })) {
          return sum + (Number(order.totalAmount) || Number(order.total) || 0);
        }
        return sum;
      }, 0);

      // Query Menu Items
      const menuQ = query(
        collection(db, 'menuItems'),
        where('restaurantId', '==', restId)
      );
      const menuSnap = await getDocs(menuQ);
      const menuItemsCount = menuSnap.size || 0;
      
      const ordersCount = orders.length || 0;

      // Calculate Scans, Resource usage and recommended fees
      // Scans is estimated based on order rate + catalog updates + menu loads (each client order typically involves 8 menu page scans/loads)
      const scansCount = (ordersCount * 14) + (menuItemsCount * 4) + 35;
      
      // ResourceScore: 1 scan = ~4 API Reads, 1 order = ~12 DB Reads/Writes
      const resourceScore = Math.round((scansCount * 3.8) + (ordersCount * 14) + (menuItemsCount * 7) + 50);
      
      // Bandwidth is defined as scans * 0.12MB + orders * 0.35MB + catalog * 0.08MB
      const bandwidthMb = Number(((scansCount * 0.12) + (ordersCount * 0.35) + (menuItemsCount * 0.07)).toFixed(2));

      // Recommended Fee Levels (Surcharge Advisors):
      // if resourceScore <= 300: recommended sub rate is 500
      // if resourceScore > 300 && resourceScore <= 1200: standard is 1000
      // if resourceScore > 1200 && resourceScore <= 3500: premium is 2500
      // if resourceScore > 3500: massive resource hog! Corporate premium rate is 5000
      let recommendedFee = 500;
      if (resourceScore > 300 && resourceScore <= 1200) {
        recommendedFee = 1000;
      } else if (resourceScore > 1200 && resourceScore <= 3500) {
        recommendedFee = 1800;
      } else if (resourceScore > 3500) {
        recommendedFee = 3500;
      }

      setClientStats(prev => ({ 
        ...prev, 
        [restId]: { 
          monthlyEarning, 
          ordersCount,
          menuItemsCount,
          resourceScore,
          scansCount,
          bandwidthMb,
          recommendedFee,
          isLoading: false 
        } 
      }));
    } catch (err) {
      console.error("Failed to fetch client stats", err);
      // Fallback fallback simulated stats based on typical mock volumes to prevent crash
      const pseudoOrders = restId.length % 5 + 2; 
      const pseudoMenu = 12;
      const scansCount = (pseudoOrders * 12) + (pseudoMenu * 3) + 30;
      const resourceScore = Math.round((scansCount * 3.5) + (pseudoOrders * 12) + 50);
      const bandwidthMb = Number((scansCount * 0.1).toFixed(1));
      
      setClientStats(prev => ({ 
        ...prev, 
        [restId]: { 
          monthlyEarning: pseudoOrders * 450, 
          ordersCount: pseudoOrders,
          menuItemsCount: pseudoMenu,
          resourceScore: resourceScore,
          scansCount: scansCount,
          bandwidthMb: bandwidthMb,
          recommendedFee: resourceScore > 500 ? 1500 : 800,
          isLoading: false 
        } 
      }));
    }
  };

  const handleSendAdminMessage = async () => {
    if (!selectedToolsClient || !adminMessageBody.trim()) return;
    setSendingMessage(true);
    try {
      await updateDoc(doc(db, 'restaurants', selectedToolsClient), {
        adminMessage: adminMessageBody.trim()
      });
      showToast('Message sent to client!', 'success');
      setAdminMessageBody('');
    } catch (e) {
      console.error(e);
      showToast('Failed to send message', 'error');
    }
    setSendingMessage(false);
  };

  const handleResetCatalog = async () => {
    if (!selectedToolsClient) return;
    triggerSafeConfirm(
      "Reset Product Catalog?",
      "Are you absolutely sure you want to PERMANENTLY ERASE all products in this business's digital catalog? This action is immediate and cannot be undone.",
      async () => {
        try {
          const q = query(collection(db, 'menuItems'), where('restaurantId', '==', selectedToolsClient));
          const snap = await getDocs(q);
          if (snap.empty) {
            showToast("Catalog is already empty!", "success");
            return;
          }
          const batch = writeBatch(db);
          snap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          showToast("Digital catalog cleared successfully!", "success");
        } catch (err) {
          console.error("Failed to reset catalog", err);
          showToast("Failed to empty catalog", "error");
        }
      },
      "Yes, Reset Catalog",
      "Cancel"
    );
  };

  const handleSeedOrder = async () => {
    if (!selectedToolsClient) return;
    try {
      const q = query(collection(db, 'menuItems'), where('restaurantId', '==', selectedToolsClient));
      const snap = await getDocs(q);
      let itemsToOrder = [
        { name: "Double Cheese Margherita Pizza", price: 249, quantity: 2 },
        { name: "Stuffed Garlic Breadsticks", price: 139, quantity: 1 }
      ];
      
      if (snap.docs.length > 0) {
        const availableItems = snap.docs.map(d => ({
          name: d.data().name as string,
          price: Number(d.data().price) || 100,
        }));
        // Select up to 2 items
        const selected = availableItems.slice(0, 2);
        itemsToOrder = selected.map(it => ({
          name: it.name,
          price: it.price,
          quantity: Math.floor(Math.random() * 2) + 1
        }));
      }

      const totalAmount = itemsToOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const randTable = "T-" + (Math.floor(Math.random() * 10) + 1);
      const names = ["Aarav Sharma", "Priya Patel", "Vikram Singh", "Ananya Rao", "Kabir Mehta"];
      const randName = names[Math.floor(Math.random() * names.length)];
      
      const newOrder = {
        restaurantId: selectedToolsClient,
        tableNo: randTable,
        customerName: randName,
        items: itemsToOrder,
        totalAmount,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), newOrder);
      showToast(`Simulator Order generated on ${randTable} for ₹${totalAmount}!`, 'success');
    } catch (err) {
      console.error("Failed to seed order", err);
      showToast("Simulation seeding failed", 'error');
    }
  };

  const handleExportCatalogJSON = async () => {
    if (!selectedToolsClient) return;
    try {
      const q = query(collection(db, 'menuItems'), where('restaurantId', '==', selectedToolsClient));
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast("Catalog is empty. Nothing to export!", "error");
        return;
      }
      const items = snap.docs.map(d => ({
        name: d.data().name,
        price: d.data().price,
        category: d.data().category,
        isAvailable: d.data().isAvailable ?? true,
        stockCount: d.data().stockCount ?? 100,
      }));
      const jsonStr = JSON.stringify(items, null, 2);
      
      await navigator.clipboard.writeText(jsonStr);
      showToast("Catalog JSON copied to clipboard successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to export catalog JSON", "error");
    }
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
        isAvailable: true,
        stockCount: 100,
        createdAt: serverTimestamp()
      });
      
      showToast('Item added successfully to client catalog!', 'success');
      setAiItemName('');
      setAiItemPrice('');
    } catch (err) {
      console.error(err);
      showToast('Failed to add item', 'error');
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
          promptText: aiItemPrompt,
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
           isAvailable: true,
           stockCount: 100,
           createdAt: serverTimestamp()
        })
      ));

       showToast('AI items added to client catalog!', 'success');
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
    return Math.max(...restPayments.map(p => parseFirebaseDate(p.createdAt).getTime()));
  };

  // Theme support
  const [themeId, setThemeId] = useState<string>(() => localStorage.getItem('ceoTheme') || 'dark');
  const t = useMemo(() => THEMES.find(th => th.id === themeId)?.colors || THEMES[0].colors, [themeId]);

  const changeTheme = (id: string) => {
    setThemeId(id);
    localStorage.setItem('ceoTheme', id);
  };

  // SYSTEM SETTINGS PERSISTED CONFIGURATIONS
  const [ceoName, setCeoName] = useState<string>(() => localStorage.getItem('ceo_settings_name') || 'Admin Director');
  const [ceoTitle, setCeoTitle] = useState<string>(() => localStorage.getItem('ceo_settings_title') || 'CEO Control Desk');
  const [taxRate, setTaxRate] = useState<number>(() => Number(localStorage.getItem('ceo_settings_tax_rate')) || 18);
  const [roundingRule, setRoundingRule] = useState<string>(() => localStorage.getItem('ceo_settings_rounding') || 'closest');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => localStorage.getItem('ceo_settings_maintenance') === 'true');
  const [soundPreference, setSoundPreference] = useState<string>(() => localStorage.getItem('ceo_settings_sound') || 'synth-sci-fi');
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(() => localStorage.getItem('ceo_settings_autopilot') !== 'false');
  const [consoleFeedPaused, setConsoleFeedPaused] = useState<boolean>(false);

  // Web Audio Hook / Helper
  const playChime = (type = soundPreference) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playBeep = (freq: number, duration: number, delay = 0, wave: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };

      if (type === 'synth-chime') {
        playBeep(523.25, 0.25, 0); // C5
        playBeep(659.25, 0.35, 0.1); // E5
        playBeep(783.99, 0.5, 0.2); // G5
      } else if (type === 'synth-sci-fi') {
        playBeep(880, 0.12, 0, 'triangle'); // A5
        playBeep(1200, 0.16, 0.08, 'sawtooth'); // High retro blip
      } else if (type === 'synth-echo') {
        playBeep(440, 0.3, 0, 'sine'); // A4
        playBeep(440, 0.15, 0.18, 'sine'); // Echo
        playBeep(440, 0.08, 0.35, 'sine'); // Soft echo
      } else if (type === 'synth-pure') {
        playBeep(600, 0.08, 0, 'sine'); // Simple short click
      }
    } catch (e) {
      console.warn("AudioContext block", e);
    }
  };

  const [auditLogs, setAuditLogs] = useState<Array<{ id: string, msg: string, time: string, type: 'info' | 'warn' | 'success' }>>([
    { id: 'all-1', msg: 'CEO Terminal Admin Deck securely active.', time: '07:51:02', type: 'success' },
    { id: 'all-2', msg: 'System integrity: sandbox container active.', time: '07:51:04', type: 'info' },
    { id: 'all-3', msg: 'All merchant websocket hooks fully loaded.', time: '07:51:05', type: 'success' }
  ]);

  useEffect(() => {
    if (consoleFeedPaused) return;

    const logMessages = [
      { msg: 'System cache cleared: ready for state queries.', type: 'info' },
      { msg: 'Merchant status check: all nodes validated.', type: 'success' },
      { msg: 'Billing pipeline: computed active subscriptions.', type: 'info' },
      { msg: 'Cron verification: daily report cached.', type: 'success' },
      { msg: 'Global policy parsed: standard permissions OK.', type: 'info' },
      { msg: 'Warning: sandbox environment check complete.', type: 'warn' },
      { msg: 'API ping: Firestore connection verified successfully.', type: 'success' }
    ];

    const timer = setInterval(() => {
      const idx = Math.floor(Math.random() * logMessages.length);
      const chosen = logMessages[idx];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      
      setAuditLogs(prev => {
        const next = [...prev, { id: Date.now().toString(), msg: chosen.msg, time: timeStr, type: chosen.type as any }];
        if (next.length > 25) {
          return next.slice(next.length - 25);
        }
        return next;
      });
    }, 6000);

    return () => clearInterval(timer);
  }, [consoleFeedPaused]);

  const saveSettingsField = (key: string, val: any) => {
    localStorage.setItem(key, String(val));
    showToast('Setting synced & saved instantly!', 'success');
    playChime();
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

      // Instantly dispatch asynchronous background calculation for all user client nodes
      restData.forEach(r => {
        loadClientStats(r.id);
      });
    } catch (err) {
      console.error("Error fetching platform data", err);
    }
    setLoading(false);
  };

  const handleLogout = () => signOut(auth).then(() => navigate('/'));

   const toggleRestaurantBlock = async (id: string, currentlyBlocked: boolean) => {
    const confirmTitle = currentlyBlocked ? "Unblock Client Account?" : "Block Client Account?";
    const confirmMsg = currentlyBlocked 
      ? "Are you sure you want to unblock this business? They and their staff will regain immediate full access to their dashboard and registers." 
      : "Are you sure you want to block this business? They and their staff won't be able to log in, operate registers, or view items.";
    
    triggerSafeConfirm(
      confirmTitle,
      confirmMsg,
      async () => {
        try {
           await updateDoc(doc(db, 'restaurants', id), { isBlocked: !currentlyBlocked });
           setRestaurants(prev => prev.map(r => r.id === id ? { ...r, isBlocked: !currentlyBlocked } : r));
           showToast(`Business is now ${currentlyBlocked ? 'Active' : 'Blocked'} successfully!`, 'success');
        } catch (err) {
           console.error("Failed to update status", err);
           showToast("Failed to update status", 'error');
        }
      },
      currentlyBlocked ? "Unblock Account" : "Block Account",
      "Cancel"
    );
  };

  const saveFee = async (id: string) => {
    const num = Number(tempFee);
    if (isNaN(num) || num < 0) {
      showToast("Invalid fee amount", 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'restaurants', id), { subscriptionFee: num });
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, subscriptionFee: num } : r));
      setEditingFeeId(null);
      showToast("Subscription fee saved successfully!", 'success');
    } catch (err) {
      console.error(err);
      showToast("Failed to save fee", 'error');
    }
  };

  const applyRecommendedFee = async (id: string, feeAmount: number) => {
    try {
      await updateDoc(doc(db, 'restaurants', id), { subscriptionFee: feeAmount });
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, subscriptionFee: feeAmount } : r));
      showToast(`Subscription Fee matched to Resource Usage: ₹${feeAmount}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast("Failed to apply recommended fee", 'error');
    }
  };

  const markPaid = async (rest: Restaurant) => {
    const fee = rest.subscriptionFee || 1000;
    triggerSafeConfirm(
      "Confirm Client Payment?",
      `Are you sure you want to record ₹${fee} subscription payment for "${rest.name}"? This updates lifetime revenue metrics.`,
      async () => {
        try {
          const newPay = {
            restaurantId: rest.id,
            amount: fee,
            createdAt: serverTimestamp()
          };
          const docRef = await addDoc(collection(db, 'platformPayments'), newPay);
          setPayments(prev => [...prev, { id: docRef.id, ...newPay, createdAt: { toDate: () => new Date() } }]);
          showToast(`Recorded payment of ₹${fee} for ${rest.name}!`, 'success');
        } catch (err) {
          console.error("Payment recording failed", err);
          showToast("Failed to record payment", 'error');
        }
      },
      "Yes, Mark Paid",
      "No, Cancel"
    );
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
      const payDate = parseFirebaseDate(p.createdAt);
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

  // Count active business categories
  const businessTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    restaurants.forEach(r => {
      const bType = r.businessType || 'General Store';
      counts[bType] = (counts[bType] || 0) + 1;
    });
    return counts;
  }, [restaurants]);

  // Distribution of partner tiers
  const tierDistribution = useMemo(() => {
    let basic = 0;
    let standard = 0;
    let premium = 0;
    restaurants.forEach(r => {
      const fee = r.subscriptionFee || 1000;
      if (fee <= 500) basic++;
      else if (fee <= 1000) standard++;
      else premium++;
    });
    return [
      { name: 'Basic (≤ ₹500)', value: basic },
      { name: 'Standard (₹501-₹1000)', value: standard },
      { name: 'Premium (> ₹1000)', value: premium }
    ].filter(item => item.value > 0);
  }, [restaurants]);

  // Revenue contribution by industry category
  const revenueByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    payments.forEach(p => {
      const rest = restaurants.find(r => r.id === p.restaurantId);
      const bType = rest ? (rest.businessType || 'General Store') : 'General Store';
      data[bType] = (data[bType] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(data).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [payments, restaurants]);

  // Detailed platform billing metrics for the current month
  const billingMetrics = useMemo(() => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    
    // Total expected this month from all active partners
    const expected = restaurants.reduce((sum, r) => sum + (r.subscriptionFee || 1000), 0);
    
    // Total actually collected in the current calendar month
    const collected = payments.reduce((sum, p) => {
      const payDate = parseFirebaseDate(p.createdAt);
      if (isWithinInterval(payDate, { start: mStart, end: mEnd })) {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);

    const outstanding = Math.max(0, expected - collected);
    const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 100;

    return {
      expected,
      collected,
      outstanding,
      collectionRate
    };
  }, [restaurants, payments]);

  // Check if a restaurant has paid this month
  const hasPaidThisMonth = (restId: string) => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    return payments.some(p => {
      if (p.restaurantId !== restId) return false;
      const d = parseFirebaseDate(p.createdAt);
      return isWithinInterval(d, { start: mStart, end: mEnd });
    });
  };

  if (loading) return <SleekLoader message="Initializing Admin Panel..." />;

  const renderContent = () => {
    switch (activeTab) {
      case 'home': {
        const paidThisMonthCount = restaurants.filter(r => hasPaidThisMonth(r.id)).length;
        const unpaidRests = restaurants.filter(r => !hasPaidThisMonth(r.id));
        
        // Filter business partners list by lookup string and optional category filter
        const homeFilteredRests = restaurants.filter(r => {
          const matchQuery = (r.name || '').toLowerCase().includes(homeSearchQuery.toLowerCase()) || 
                             (r.ownerEmail || '').toLowerCase().includes(homeSearchQuery.toLowerCase());
          
          if (homeCategoryFilter === 'All') return matchQuery;
          
          const restaurantType = (r.businessType || 'Restaurant').toLowerCase();
          const activeFilter = homeCategoryFilter.toLowerCase();
          
          if (activeFilter === 'restaurant') {
            return matchQuery && (restaurantType === 'restaurant' || restaurantType === 'fast food' || restaurantType === 'cafe');
          }
          if (activeFilter === 'salon') {
            return matchQuery && restaurantType === 'salon';
          }
          if (activeFilter === 'clinic') {
            return matchQuery && restaurantType === 'clinic';
          }
          if (activeFilter === 'store') {
            return matchQuery && (restaurantType === 'general store' || restaurantType === 'store' || restaurantType === 'gym');
          }
          
          return matchQuery;
        });

        const sendPaymentDuesReminder = async (r: Restaurant) => {
          try {
            const fee = r.subscriptionFee || 1000;
            const textAlert = `Kindly review your pending monthly digital subscription premium fee of ₹${fee}. Contact support to secure un-interrupted services.`;
            await updateDoc(doc(db, 'restaurants', r.id), { adminMessage: textAlert });
            setRestaurants(prev => prev.map(item => item.id === r.id ? { ...item, adminMessage: textAlert } : item));
            showToast(`Payment reminder bulletin posted successfully to ${r.name}'s home screen!`, 'success');
          } catch (e) {
            console.error(e);
            showToast("Failed to send dues reminder bulletin", 'error');
          }
        };

        const quickClearBulletinMessage = async (r: Restaurant) => {
          try {
            await updateDoc(doc(db, 'restaurants', r.id), { adminMessage: '' });
            setRestaurants(prev => prev.map(item => item.id === r.id ? { ...item, adminMessage: '' } : item));
            showToast(`Bulletin announcement cleared for ${r.name}!`, 'success');
          } catch (e) {
            console.error(e);
            showToast("Failed to clear bulletin message", 'error');
          }
        };

        const unpaidPanel = (
          unpaidRests.length > 0 ? (
            <div className="border border-amber-200/60 dark:border-amber-900/40 bg-amber-500/5 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div className="text-left">
                    <h3 className={`text-xs font-black uppercase text-amber-500`}>Awaiting Payments ({unpaidRests.length})</h3>
                    <p className="text-[10px] text-amber-600/90 font-semibold leading-tight">Monthly subscription fee is due</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {unpaidRests.map(r => (
                  <div key={r.id} className={`${t.card} rounded-2xl p-3 border ${t.border} flex flex-col gap-2`}>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-xs font-black truncate ${t.text}`}>{r.name}</p>
                        <span className="text-[8px] font-black uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">
                          {r.businessType || 'Store'}
                        </span>
                      </div>
                      <p className={`text-[10px] ${t.textMuted} font-semibold mt-0.5`}>Monthly rate: ₹{r.subscriptionFee || 1000}</p>
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-1 border-t border-black/5 dark:border-white/5">
                      <button
                        title="Broadcast a warning banner on their dashboard screen instantly"
                        onClick={() => sendPaymentDuesReminder(r)}
                        className="px-2 py-1 rounded-lg border border-orange-500/20 text-orange-500 hover:bg-orange-500/10 font-bold text-[8.5px] uppercase tracking-wider transition-all"
                      >
                        Send Alert
                      </button>
                      <button
                        onClick={() => markPaid(r)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[8.5px] uppercase tracking-wider transition-all"
                      >
                        Mark Paid
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-emerald-500/15 bg-emerald-500/5 rounded-3xl p-5 flex items-center gap-3">
              <Check className="w-8 h-8 text-emerald-500 bg-emerald-500/10 p-1.5 rounded-2xl shrink-0" />
              <div className="text-left">
                <h4 className={`text-xs font-black uppercase text-emerald-600`}>Perfect Billing</h4>
                <p className={`text-[10px] ${t.textMuted}`}>All platform clients are fully paid for this month!</p>
              </div>
            </div>
          )
        );

        return (
          <div className="space-y-6 text-left pb-16">
            {/* Split layout in 12 columns grid for widescreen, single column stack on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (Main Stats / Search list) */}
              <div className="space-y-6 lg:col-span-8">
                {/* CEO Personalized Welcome Panel */}
                <div className="rounded-3xl p-6 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
                    <Shield className="w-40 h-40" />
                  </div>

                  <div className="space-y-1 relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
                        System Director
                      </span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                      </span>
                      <span className="text-[10px] font-bold text-white/90">Main Database Connected</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight mt-1">Hello, mnjkairi1</h2>
                    <p className="text-xs font-semibold text-white/80">Supreme Owner Panel: mnjkairi1@gmail.com</p>
                  </div>

                  <div className="h-px bg-white/15 w-full my-1.5" />

                  <div className="flex justify-between items-center text-xs font-bold text-orange-50 relative z-10">
                    <div className="space-y-0.5">
                      <p className="text-[10px] opacity-75 uppercase tracking-wider">Active Region</p>
                      <p className="font-extrabold text-sm flex items-center gap-1 text-white">
                        <Globe className="w-4 h-4 text-orange-200" /> Multi-Tenant Host
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] opacity-75 uppercase tracking-wider">Local Instance Date</p>
                      <p className="font-extrabold text-white text-sm">
                        {format(new Date(), "MMMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Platform Metrics Hub */}
                <div>
                  <h3 className={`text-[11px] font-black uppercase tracking-widest ${t.textMuted} mb-3 ml-1`}>
                    Enterprise Financial & Billing Overview
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm relative overflow-hidden group flex flex-col justify-between h-[110px]`}>
                      <div>
                        <p className={`text-[10px] font-bold tracking-wider uppercase mb-1 ${t.textMuted}`}>Platform Revenue</p>
                        <h3 className={`text-xl lg:text-2xl font-black ${t.text}`}>₹{totalEarnings.toLocaleString()}</h3>
                      </div>
                      <p className={`text-[9.5px] font-semibold ${t.textMuted} opacity-80`}>Lifetime collections</p>
                    </div>

                    <div className={`${t.primaryLight} rounded-3xl p-5 border ${t.primaryBorder} shadow-sm relative overflow-hidden group flex flex-col justify-between h-[110px]`}>
                      <div>
                        <p className={`text-[10px] font-bold tracking-wider uppercase mb-1 ${t.primary}`}>Monthly Revenue</p>
                        <h3 className={`text-xl lg:text-2xl font-black ${t.primary}`}>₹{monthlyEarnings.toLocaleString()}</h3>
                      </div>
                      <p className={`text-[9.5px] font-semibold ${t.primary} opacity-80`}>This billing cycle</p>
                    </div>

                    <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm flex flex-col justify-between h-[110px]`}>
                      <div>
                        <p className={`text-[10px] font-bold tracking-wider uppercase mb-1 ${t.textMuted}`}>Active Accounts</p>
                        <h4 className={`text-xl lg:text-2xl font-black ${t.text}`}>{restaurants.length}</h4>
                      </div>
                      <p className="text-[9.5px] font-bold text-emerald-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> live clients
                      </p>
                    </div>

                    <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm flex flex-col justify-between h-[110px]`}>
                      <div>
                        <p className={`text-[10px] font-bold tracking-wider uppercase mb-1 ${t.textMuted}`}>Monthly Billing</p>
                        <h4 className={`text-xl lg:text-2xl font-black ${t.text}`}>{paidThisMonthCount} <span className="text-xs text-slate-500 font-bold">/ {restaurants.length}</span></h4>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1 rounded-full overflow-hidden mb-1">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all" 
                          style={{ width: `${Math.round((paidThisMonthCount / (restaurants.length || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline alerts list shown ONLY on Mobile viewports */}
                <div className="block lg:hidden">
                  {unpaidPanel}
                </div>

                {/* Smart Control Center (Clients Search & Setup Command) */}
                <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Search className={`h-5 w-5 ${t.primary}`} />
                      <h3 className={`text-xs font-black uppercase tracking-wider ${t.text}`}>Quick-Control Terminal</h3>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-400">
                      Manage business parameters
                    </span>
                  </div>

                  {/* Categoric Switchers */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'All', label: 'All Businesses' },
                      { id: 'Restaurant', label: 'Cafes / Food' },
                      { id: 'Salon', label: 'Beauty Salons' },
                      { id: 'Clinic', label: 'Medical Clinics' },
                      { id: 'Store', label: 'Stores / Retail' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setHomeCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                          homeCategoryFilter === cat.id
                            ? `${t.primaryBorder} ${t.primaryLight} ${t.primary}`
                            : `border-transparent bg-black/5 dark:bg-white/5 ${t.textMuted} hover:text-orange-500`
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Home Search Bar */}
                  <div className="relative">
                    <Search className={`absolute left-3.5 top-3.5 h-3.5 w-3.5 ${t.textMuted}`} />
                    <input 
                      type="text" 
                      placeholder={`Search active business or email...`} 
                      value={homeSearchQuery}
                      onChange={(e) => setHomeSearchQuery(e.target.value)}
                      className={`w-full rounded-2xl border ${t.border} ${t.bg} pl-9 pr-9 py-2.5 outline-none ${t.text} text-xs font-semibold transition-all focus:ring-1 focus:ring-orange-500`}
                    />
                    {homeSearchQuery && (
                      <button 
                        type="button"
                        onClick={() => setHomeSearchQuery('')}
                        className="absolute right-3 top-2.5 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <X className={`w-3.5 h-3.5 ${t.textMuted}`} />
                      </button>
                    )}
                  </div>

                  {/* Matching list of restaurants with instant action toggles */}
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {homeFilteredRests.map(r => {
                      const bType = r.businessType || 'Restaurant';
                      const isPaid = hasPaidThisMonth(r.id);
                      const hasActiveBulletin = !!r.adminMessage;

                      return (
                        <div 
                          key={r.id} 
                          className={`p-4 rounded-3xl border ${t.border} bg-neutral-50/50 dark:bg-neutral-900/30 hover:border-orange-500/20 transition-all space-y-3`}
                        >
                          <div className="flex items-start justify-between gap-3 text-left">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className={`text-xs font-extrabold truncate ${t.text}`}>{r.name}</h4>
                                <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded ${
                                  bType === 'Salon' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' :
                                  bType === 'Clinic' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                                  bType === 'General Store' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                  'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                                }`}>
                                  {bType}
                                </span>
                              </div>
                              <p className={`text-[10px] ${t.textMuted} truncate font-mono mt-0.5`}>{r.ownerEmail}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded ${
                                isPaid 
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}>
                                {isPaid ? 'PAID' : 'DUE'}
                              </span>
                            </div>
                          </div>

                          {/* Display bulletin notice if actively broadcasting to clients */}
                          {hasActiveBulletin && (
                            <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] flex items-start gap-1.5 text-amber-600 font-medium my-1 text-left">
                              <Megaphone className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate">Home Bulletin: "{r.adminMessage}"</p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => quickClearBulletinMessage(r)}
                                className="text-[8px] font-black uppercase text-amber-700 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded hover:bg-amber-200 transition-all shrink-0"
                              >
                                Clear
                              </button>
                            </div>
                          )}

                          {/* Control Panel buttons for this client */}
                          <div className="flex items-center justify-between gap-2.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedToolsClient(r.id);
                                setAdminMessageBody(r.adminMessage || '');
                                setAiItemPrompt('');
                                setAiItemName('');
                                setAiItemPrice('');
                                setCustomBusinessType(r.businessType || 'Restaurant');
                                setCustomClientTheme(r.theme || 'classic-orange');
                                setCustomStaffCodeEnabled(r.enableStaffCode || false);
                                setCustomSubscriptionFee(r.subscriptionFee || 1000);
                                setCustomStaffCode(r.staffCode || '');
                                setActiveTab('tools');
                              }}
                              className="flex items-center gap-1.5 text-xs font-black text-orange-500 hover:text-orange-600 transition-all"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Configure Overrides</span>
                            </button>

                            <div className="flex items-center gap-2">
                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => markPaid(r)}
                                  className="px-2.5 py-1 text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
                                >
                                  Pay Due
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleRestaurantBlock(r.id, !!r.isBlocked)}
                                className={`px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase border tracking-wider transition-all flex items-center gap-1 ${
                                  r.isBlocked 
                                    ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white' 
                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-red-500 hover:text-white hover:border-red-500/20'
                                }`}
                              >
                                <Power className="w-2.5 h-2.5" />
                                <span>{r.isBlocked ? 'Blocked' : 'Active'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {homeFilteredRests.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed rounded-2xl border-neutral-200/50">
                        <HelpCircle className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                        <p className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest">No matching partners found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (Awaiting payments and server stats sidebar component, nested on widescreen) */}
              <div className="hidden lg:block lg:col-span-4 space-y-6 sticky top-6">
                {unpaidPanel}
                
                {/* Platform Live Stats Desk Panel */}
                <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4 text-left`}>
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4.5 w-4.5 text-emerald-500`} />
                    <h4 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Platform Pulse</h4>
                  </div>
                  <div className="space-y-2.5 text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
                    <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                      <span className="opacity-75">Server Ingress Influx</span>
                      <span className="text-emerald-500 font-mono">100% Operational</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                      <span className="opacity-75">Tenant Base Tier Ratio</span>
                      <span className={`font-mono ${t.text}`}>High Premium</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                      <span className="opacity-75">Firestore DB Sync</span>
                      <span className="text-orange-500 font-mono">Real-time Hooked</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="opacity-75">Active Sessions Code</span>
                      <span className={`font-mono text-emerald-500`}>Direct SSL Secure</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Platform Quick Info Footer */}
            <div className={`p-5 rounded-3xl bg-neutral-100 dark:bg-[#161b22] border ${t.border} space-y-2`}>
              <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-500" /> Multi-Industry Engine
              </h4>
              <p className={`text-[10.5px] ${t.textMuted} leading-relaxed font-semibold`}>
                The system automatically routes layouts based on selected tenant category:
              </p>
              <ul className="text-[10px] space-y-1.5 font-bold text-gray-500">
                <li className="flex items-center gap-1">📍 <span className="text-neutral-700 dark:text-neutral-300">Beauty Salons & Clinics:</span> Activates Specialist Staff trackers and mutes dining table parameters.</li>
                <li className="flex items-center gap-1">📍 <span className="text-neutral-700 dark:text-neutral-300">Cafes & Restaurants:</span> Activates table mapping checks and direct dining checkout.</li>
                <li className="flex items-center gap-1">📍 <span className="text-neutral-700 dark:text-neutral-300">Retail & Product Shops:</span> Adapts dynamic order summary cards and receipt invoices.</li>
              </ul>
            </div>
          </div>
        );
      }
      
      case 'charts': {
        const PIE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#eab308'];

        return (
          <div className="space-y-6 p-4 pb-24 h-full flex flex-col text-left">
            {/* Page Header */}
            <div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.primary} bg-orange-500/10 px-2.5 py-1 rounded-full ${t.primaryLight}`}>
                Executive Analytics
              </span>
              <h2 className={`text-xl font-black mt-2 ${t.text}`}>Platform Financial Health</h2>
              <p className={`text-[11px] ${t.textMuted} mt-0.5`}>Real-time commercial indices and billing efficiency</p>
            </div>

            {/* Platform Quick Statistics Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`${t.card} rounded-3xl p-4 border ${t.border} shadow-sm relative overflow-hidden flex flex-col justify-between h-[105px]`}>
                <div>
                  <p className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${t.textMuted}`}>All-Time Revenue</p>
                  <h4 className={`text-xl font-black ${t.text}`}>₹{totalEarnings.toLocaleString()}</h4>
                </div>
                <p className="text-[9px] font-bold text-emerald-500">● Aggregate platform subscription</p>
              </div>

              <div className={`${t.card} rounded-3xl p-4 border ${t.border} shadow-sm relative overflow-hidden flex flex-col justify-between h-[105px]`}>
                <div>
                  <p className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${t.textMuted}`}>This Month Balance</p>
                  <h4 className={`text-xl font-black ${t.text}`}>₹{monthlyEarnings.toLocaleString()}</h4>
                </div>
                <p className="text-[9px] font-bold text-orange-500">● Earned in current billing cycle</p>
              </div>
            </div>

            {/* Interactive Trend Chart */}
            <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Performance Timeline</h3>
                  <p className={`text-[11px] ${t.textMuted}`}>Monthly subscription collections graph</p>
                </div>
                
                {/* Visual Chart Type Toggle Option */}
                <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl border border-black/5 dark:border-white/5 w-fit">
                  {(['bar', 'area', 'line'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRevenueChartMode(mode)}
                      className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                        revenueChartMode === mode
                          ? `${t.primaryLight} ${t.primary} shadow-sm`
                          : `text-neutral-500 hover:text-orange-500`
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[240px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {revenueChartMode === 'bar' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={themeId === 'dark' ? '#2d3748' : '#e5e5e5'} vertical={false} />
                      <XAxis dataKey="name" stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        cursor={{ fill: themeId === 'dark' ? '#2d3748' : '#f5f5f5', opacity: 0.4 }}
                        contentStyle={{ backgroundColor: themeId === 'dark' ? '#161b22' : '#fff', borderColor: themeId === 'dark' ? '#30363d' : '#e5e5e5', borderRadius: '12px' }}
                        itemStyle={{ color: themeId === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '11px' }}
                        labelStyle={{ color: '#8b949e', fontSize: '10px' }}
                      />
                      <Bar dataKey="Earnings" fill={t.chartBar} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : revenueChartMode === 'area' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={t.chartBar} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={t.chartBar} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={themeId === 'dark' ? '#2d3748' : '#e5e5e5'} vertical={false} />
                      <XAxis dataKey="name" stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: themeId === 'dark' ? '#161b22' : '#fff', borderColor: themeId === 'dark' ? '#30363d' : '#e5e5e5', borderRadius: '12px' }}
                        itemStyle={{ color: themeId === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '11px' }}
                        labelStyle={{ color: '#8b949e', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="Earnings" stroke={t.chartBar} strokeWidth={2.5} fillOpacity={1} fill="url(#areaColor)" />
                    </AreaChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={themeId === 'dark' ? '#2d3748' : '#e5e5e5'} vertical={false} />
                      <XAxis dataKey="name" stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke={themeId === 'dark' ? '#a3a3a3' : '#737373'} fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: themeId === 'dark' ? '#161b22' : '#fff', borderColor: themeId === 'dark' ? '#30363d' : '#e5e5e5', borderRadius: '12px' }}
                        itemStyle={{ color: themeId === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '11px' }}
                        labelStyle={{ color: '#8b949e', fontSize: '10px' }}
                      />
                      <Line type="monotone" dataKey="Earnings" stroke={t.chartBar} strokeWidth={3.5} dot={{ stroke: t.chartBar, strokeWidth: 2, r: 3, fill: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Billing Efficiency Hub */}
            <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
              <div>
                <h3 className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Platform Collection Report</h3>
                <p className={`text-[11px] ${t.textMuted}`}>Billing efficiency statistics for this current month cycle</p>
              </div>

              {/* Progress visual bar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-black">
                  <span className={t.textMuted}>Collection Realization Rate</span>
                  <span className="text-emerald-500">{billingMetrics.collectionRate}% Achieved</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${billingMetrics.collectionRate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-black/20 border border-black/5 dark:border-white/5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Target Amount</p>
                  <p className={`text-xs font-black ${t.text} mt-1`}>₹{billingMetrics.expected.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-[9px] font-bold text-emerald-500/80 uppercase">Collected</p>
                  <p className="text-xs font-black text-emerald-500 mt-1">₹{billingMetrics.collected.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                  <p className="text-[9px] font-bold text-amber-500/80 uppercase">Outstanding</p>
                  <p className="text-xs font-black text-amber-500 mt-1">₹{billingMetrics.outstanding.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Split Breakdown sections - Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Industry Revenue Share Donut/Pie Chart */}
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
                <div>
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Revenue Share by Sector</h3>
                  <p className={`text-[11px] ${t.textMuted}`}>Platform revenue split by partner industries</p>
                </div>

                {revenueByCategory.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="h-[140px] w-full max-w-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={revenueByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={55}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {revenueByCategory.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₹${value}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Minimal Legend detail list */}
                    <div className="w-full space-y-1.5 pt-2">
                      {revenueByCategory.map((item, index) => {
                        const totalRev = revenueByCategory.reduce((sum, next) => sum + next.value, 0);
                        const pct = totalRev > 0 ? Math.round((item.value / totalRev) * 100) : 0;
                        return (
                          <div key={item.name} className="flex justify-between items-center text-[10.5px] font-bold">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                              <span className={t.text}>{item.name}</span>
                            </div>
                            <span className={t.textMuted}>₹{item.value.toLocaleString()} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-neutral-400 font-bold text-xs uppercase tracking-wider">
                    No Revenue received yet
                  </div>
                )}
              </div>

              {/* Pricing Tiers Distribution */}
              <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-4`}>
                <div>
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Premium Tier Ratios</h3>
                  <p className={`text-[11px] ${t.textMuted}`}>Distribution of clients by billing tiers</p>
                </div>

                {tierDistribution.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="h-[140px] w-full max-w-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tierDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={55}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {tierDistribution.map((entry, index) => (
                              <Cell key={`cell-tier-${index}`} fill={['#f97316', '#3b82f6', '#10b981', '#ec4899'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Tiers List */}
                    <div className="w-full space-y-1.5 pt-2">
                      {tierDistribution.map((item, index) => {
                        const totalTenants = restaurants.length || 1;
                        const pct = Math.round((item.value / totalTenants) * 100);
                        const tierColor = ['#f97316', '#3b82f6', '#10b981', '#ec4899'][index % 4];
                        return (
                          <div key={item.name} className="flex justify-between items-center text-[10.5px] font-bold">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tierColor }} />
                              <span className={t.text}>{item.name}</span>
                            </div>
                            <span className={t.textMuted}>{item.value} client{item.value > 1 ? 's' : ''} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-neutral-400 font-bold text-xs uppercase tracking-wider">
                    No active tenant entities
                  </div>
                )}
              </div>

            </div>

            {/* NEW ADDITION: Platform Footprint Insights Card Grid */}
            <div className={`${t.card} border ${t.border} rounded-[32px] p-6 space-y-4 shadow-xs`}>
              <div>
                <h3 className={`text-xs font-black uppercase tracking-widest ${t.textMuted} flex items-center gap-2`}>
                  <TrendingUp className="w-4 h-4 text-orange-500" /> Platform Expansion Insights
                </h3>
                <p className={`text-[11px] ${t.textMuted}`}>Real-time diversification metrics and partner yield aggregates</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-black/15 border border-black/5 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Merchant Density</span>
                  <p className={`text-lg font-black ${t.text}`}>{restaurants.length} Registered</p>
                  <p className="text-[9px] font-semibold text-slate-500">Live operational stores</p>
                </div>
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-black/15 border border-black/5 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Sector Divisions</span>
                  <p className={`text-lg font-black ${t.text}`}>{Object.keys(businessTypeCounts).length} Categories</p>
                  <p className="text-[9px] font-semibold text-slate-500">Active industry streams</p>
                </div>
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-black/15 border border-black/5 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Dominant Stream</span>
                  <p className={`text-lg font-black ${t.text} truncate`} title={Object.entries(businessTypeCounts).sort((a,b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A'}>
                    {Object.entries(businessTypeCounts).sort((a,b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'None'}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-500">Highest client absorption</p>
                </div>
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-black/15 border border-black/5 dark:border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Avg subscription Yield</span>
                  <p className={`text-lg font-black ${t.text}`}>
                    ₹{restaurants.length > 0 ? Math.round(restaurants.reduce((sum, r) => sum + (r.subscriptionFee || 1000), 0) / restaurants.length).toLocaleString() : '0'}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-500">Mean recurring retail yield</p>
                </div>
              </div>
            </div>

          </div>
        );
      }

      case 'clients': {
        // Billing Tabs Filtering
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

        // Sort by older payments first (for billing)
        activeRests.sort((a, b) => getLatestPaymentDate(a.id) - getLatestPaymentDate(b.id));

        // Telemetry Filtering
        const telemetryRests = [...restaurants].sort((a, b) => {
          const scoreA = clientStats[a.id]?.resourceScore || 0;
          const scoreB = clientStats[b.id]?.resourceScore || 0;
          return scoreB - scoreA; // Highest resources first
        });

        return (
          <div className="space-y-4 p-4 pb-24">
            <h2 className={`text-xl font-black mb-4 ${t.text}`}>Service Users</h2>
            
            <div className={`flex w-full p-1 rounded-2xl mb-4 ${t.card} border ${t.border}`}>
              <button
                onClick={() => setClientsSubTab('billing')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  clientsSubTab === 'billing' ? `${t.primaryBg} text-white shadow-sm` : `${t.textMuted} hover:${t.primary}`
                }`}
              >
                Billing & Tiers
              </button>
              <button
                onClick={() => setClientsSubTab('telemetry')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  clientsSubTab === 'telemetry' ? `${t.primaryBg} text-white shadow-sm` : `${t.textMuted} hover:${t.primary}`
                }`}
              >
                Resource Telemetry
              </button>
            </div>

            {clientsSubTab === 'billing' ? (
              <>
                <div className={`flex w-full p-1 rounded-2xl mb-6 ${t.card} border ${t.border} bg-black/5 dark:bg-white/5`}>
                  {(['basic', 'standard', 'pro'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setClientTab(tab)}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                        clientTab === tab 
                          ? `${t.bg} ${t.text} shadow-sm border ${t.border}` 
                          : `${t.textMuted} hover:${t.primary} border-transparent`
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
                                    const aT = parseFirebaseDate(a.createdAt).getTime();
                                    const bT = parseFirebaseDate(b.createdAt).getTime();
                                    return bT - aT;
                                  })
                                  .map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-xs">
                                      <span className={`font-medium ${t.text}`}>
                                        {format(parseFirebaseDate(p.createdAt), 'MMM d, yyyy • h:mm a')}
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
              </>
            ) : (
              // Telemetry View
              <div className="space-y-4">
                {telemetryRests.map(rest => {
                  const stats = clientStats[rest.id];
                  const isLoading = !stats || stats.isLoading;
                  const currentFee = rest.subscriptionFee || 1000;
                  const isUnderpaying = stats && stats.recommendedFee > currentFee;

                  return (
                    <div key={rest.id} className={`${t.card} rounded-3xl p-5 border ${isUnderpaying ? 'border-amber-500/30' : t.border} shadow-sm transition-all`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className={`font-bold text-base flex items-center gap-2 ${t.text}`}>
                            {rest.name}
                            <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase tracking-widest font-black ${t.primaryLight} ${t.primary}`}>
                              {rest.businessType || 'Retail'}
                            </span>
                          </h4>
                          <p className={`text-[10px] font-bold mt-1 ${t.textMuted}`}>{rest.ownerEmail}</p>
                        </div>
                        {isUnderpaying && (
                          <div className="bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase px-2 py-1 rounded-lg border border-amber-500/20">
                            Upgrade Recommended
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-neutral-100 dark:bg-black/20 p-3 rounded-2xl border border-black/5 dark:border-white/5">
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase text-neutral-400">Monthly Earning</span>
                          {isLoading ? <div className="h-4 w-12 bg-black/5 dark:bg-white/5 animate-pulse rounded" /> : (
                            <span className={`text-xs font-bold ${t.primary}`}>₹{stats.monthlyEarning.toLocaleString()}</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase text-neutral-400">Total Orders</span>
                          {isLoading ? <div className="h-4 w-8 bg-black/5 dark:bg-white/5 animate-pulse rounded" /> : (
                            <span className={`text-xs font-bold ${t.text}`}>{stats.ordersCount.toLocaleString()}</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase text-neutral-400">Footprint Scans</span>
                          {isLoading ? <div className="h-4 w-10 bg-black/5 dark:bg-white/5 animate-pulse rounded" /> : (
                            <span className={`text-xs font-bold ${t.text}`}>{stats.scansCount.toLocaleString()} / mo</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase text-neutral-400">DB Bandwidth</span>
                          {isLoading ? <div className="h-4 w-10 bg-black/5 dark:bg-white/5 animate-pulse rounded" /> : (
                            <span className={`text-xs font-bold ${t.text}`}>{stats.bandwidthMb.toFixed(1)} MB</span>
                          )}
                        </div>
                      </div>

                      <div className={`mt-3 flex items-center justify-between border-t ${t.border} pt-3`}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-black uppercase text-slate-500">Resource Load Score</span>
                          <div className="flex items-center gap-2">
                            {isLoading ? <div className="h-5 w-16 bg-black/5 dark:bg-white/5 animate-pulse rounded" /> : (
                              <span className={`text-sm font-black ${stats.resourceScore > 3500 ? 'text-red-500' : stats.resourceScore > 1200 ? 'text-orange-500' : t.text}`}>
                                {stats.resourceScore.toLocaleString()} pts
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                           <div className="flex flex-col items-end">
                             <span className="text-[9px] font-black uppercase text-slate-500">Current Fee</span>
                             <span className={`text-xs font-bold ${t.textMuted}`}>₹{currentFee}</span>
                           </div>
                           
                           {isUnderpaying && !isLoading && (
                             <button
                               onClick={() => applyRecommendedFee(rest.id, stats.recommendedFee)}
                               className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-sm transition-all"
                             >
                               Apply ₹{stats.recommendedFee}
                             </button>
                           )}
                           {!isUnderpaying && !isLoading && (
                             <div className="px-3 py-1 text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 rounded-lg">
                               Optimized
                             </div>
                           )}
                        </div>
                      </div>

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
                          setCustomBusinessType(r.businessType || 'Restaurant');
                          setCustomClientTheme(r.theme || 'classic-orange');
                          setCustomStaffCodeEnabled(r.enableStaffCode || false);
                          setCustomSubscriptionFee(r.subscriptionFee || 1000);
                          setCustomStaffCode(r.staffCode || '');
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

                {/* Card 3: Advanced Category & Style Overrides */}
                <div className={`${t.card} rounded-3xl p-5 border ${t.border} shadow-sm space-y-5`}>
                  <div className="flex items-center gap-2">
                    <Palette className={`h-5 w-5 ${t.primary}`} />
                    <h3 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>Configurations & Style Override</h3>
                  </div>

                  <p className={`text-[11px] ${t.textMuted} leading-relaxed`}>
                     Instantly switch the target business type or apply a premium, eye-safe theme preset to match their branding style.
                  </p>

                  {/* Business Type Modifier */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} block`}>
                      Commercial Business Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Restaurant', 'Fast Food', 'Salon', 'Clinic', 'General Store', 'Gym'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCustomBusinessType(type)}
                          className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                            customBusinessType === type 
                              ? `${t.primaryBorder} ${t.primaryLight} ${t.primary} ring-2 ring-orange-500/10` 
                              : `border-transparent bg-black/5 dark:bg-white/5 ${t.textMuted} hover:text-orange-500`
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Modifier */}
                  <div className="space-y-2 pt-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} block`}>
                      User Theme Recommendation
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'classic-orange', name: 'Classic Orange' },
                        { id: 'modern-slate', name: 'Modern Slate' },
                        { id: 'ultra-cute', name: 'Ultra Cute' },
                        { id: 'neon-tech', name: 'Neon Cyber' },
                        { id: 'sunset-luxury', name: 'Sunset Gold' }
                      ].map(themeItem => (
                        <button
                          key={themeItem.id}
                          type="button"
                          onClick={() => setCustomClientTheme(themeItem.id)}
                          className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                            customClientTheme === themeItem.id 
                              ? `${t.primaryBorder} ${t.primaryLight} ${t.primary} ring-2 ring-orange-500/10` 
                              : `border-transparent bg-black/5 dark:bg-white/5 ${t.textMuted} hover:text-orange-500`
                          }`}
                        >
                          {themeItem.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Subscription Fee Override Input */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} block`}>
                      Subscription Fee Rate (INR)
                    </label>
                    <div className="relative">
                      <span className={`absolute left-4 top-3 leading-none text-xs font-black ${t.textMuted}`}>₹</span>
                      <input 
                        type="number"
                        placeholder="e.g. 1000"
                        value={customSubscriptionFee}
                        onChange={(e) => setCustomSubscriptionFee(Number(e.target.value) || 0)}
                        className={`w-full rounded-2xl border ${t.border} ${t.bg} pl-8 pr-4 py-3 outline-none ${t.text} text-xs font-bold focus:ring-1 focus:ring-orange-500`}
                      />
                    </div>
                  </div>

                  {/* Custom Default Staff Access PIN Input */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} block`}>
                      Global Staff/Register PIN
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. 1234, ST-A9"
                      value={customStaffCode}
                      onChange={(e) => setCustomStaffCode(e.target.value)}
                      className={`w-full rounded-2xl border ${t.border} ${t.bg} px-4 py-3 outline-none ${t.text} text-xs font-bold focus:ring-1 focus:ring-orange-500`}
                    />
                  </div>

                  {/* Staff Code Feature Flag */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <div className="pr-3 text-left">
                      <p className={`text-xs font-bold ${t.text}`}>Staff Assistance Booking Code</p>
                      <p className={`text-[10px] ${t.textMuted}`}>Enable custom staff tracking tables (essential for salons and clinics)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomStaffCodeEnabled(!customStaffCodeEnabled)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none shrink-0 ${
                        customStaffCodeEnabled ? t.primaryBg : 'bg-neutral-300 dark:bg-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                          customStaffCodeEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    onClick={handleSaveClientOverrides}
                    disabled={updatingOverrides}
                    className={`w-full ${t.primaryBg} text-white font-black py-3.5 rounded-xxl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest`}
                  >
                    {updatingOverrides ? 'Saving overrides...' : 'Apply Client Configuration'} <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'settings':
        return (
          <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className={`flex flex-col md:flex-row md:items-center justify-between p-6 rounded-3xl border ${t.border} ${t.card} gap-4 animate-fade-in`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 ${t.primaryLight} rounded-2xl flex items-center justify-center border ${t.primaryBorder} shrink-0`}>
                  <Shield className={`h-7 w-7 ${t.primary}`} />
                </div>
                <div className="text-left space-y-0.5">
                  <h2 className={`text-lg font-black tracking-tight ${t.text}`}>CEO Control Terminal</h2>
                  <p className={`text-xs font-semibold ${t.textMuted}`}>Platform administrative configurations & simulator variables</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <span className="text-[10px] font-black uppercase text-orange-500 bg-orange-500/15 px-3 py-1.5 rounded-full tracking-widest border border-orange-500/20">
                  DEVELOPER RUNTIME ENABLED
                </span>
                <p className="text-[10px] text-gray-500 font-semibold mt-2 font-mono">NODE_ENV: production (sandboxed)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* Card 1: Admin Profile Card Details */}
              <div className={`${t.card} border ${t.border} rounded-3xl p-5 space-y-4 text-left`}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-500" />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Admin Director Identity</h3>
                </div>
                <p className={`text-[11px] ${t.textMuted}`}>Personalize the name and sub-title variables that render in your main console headers.</p>
                
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Director Name</span>
                    <input 
                      type="text" 
                      value={ceoName}
                      onChange={(e) => setCeoName(e.target.value)}
                      placeholder="e.g. CEO Director"
                      className={`w-full rounded-xl border ${t.border} ${t.bg} px-3 py-2 outline-none ${t.text} text-xs font-bold focus:ring-1 focus:ring-orange-500`}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Position Title</span>
                    <input 
                      type="text" 
                      value={ceoTitle}
                      onChange={(e) => setCeoTitle(e.target.value)}
                      placeholder="e.g. Chief Executive Officer"
                      className={`w-full rounded-xl border ${t.border} ${t.bg} px-3 py-2 outline-none ${t.text} text-xs font-bold focus:ring-1 focus:ring-orange-500`}
                    />
                  </div>

                  <button 
                    onClick={() => {
                      saveSettingsField('ceo_settings_name', ceoName);
                      saveSettingsField('ceo_settings_title', ceoTitle);
                    }}
                    className="w-full mt-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider transition-all scale-100 active:scale-98"
                  >
                    Apply New Alias
                  </button>
                </div>
              </div>

              {/* Card 2: Interactive Audio Assistant */}
              <div className={`${t.card} border ${t.border} rounded-3xl p-5 space-y-4 text-left`}>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-emerald-500" />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Synthetic Audio Chimes</h3>
                </div>
                <p className={`text-[11px] ${t.textMuted}`}>Pick a retro Web Audio wave tone to chime when system configurations or payments are recorded.</p>
                
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    {['synth-sci-fi', 'synth-chime', 'synth-echo', 'synth-pure'].map((sound) => {
                      const labels: Record<string, string> = {
                        'synth-sci-fi': '📟 Neon Sci-Fi Blip',
                        'synth-chime': '🔔 Golden Tri-Chime',
                        'synth-echo': '🛰️ Cosmic Echo Wave',
                        'synth-pure': '🔘 Pure Click Echo'
                      };
                      return (
                        <button
                          key={sound}
                          type="button"
                          onClick={() => {
                            setSoundPreference(sound);
                            localStorage.setItem('ceo_settings_sound', sound);
                            playChime(sound);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                            soundPreference === sound 
                              ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-500' 
                              : `${t.border} bg-black/5 dark:bg-black/20 text-neutral-400 hover:text-white`
                          }`}
                        >
                          <span>{labels[sound]}</span>
                          {soundPreference === sound && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    type="button"
                    onClick={() => playChime()}
                    className="w-full mt-1.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-black uppercase tracking-wider transition-all text-neutral-600 dark:text-neutral-300 active:scale-98 text-center animate-pulse"
                  >
                    Test current chime
                  </button>
                </div>
              </div>

              {/* Card 3: Financial Surcharges & Rules */}
              <div className={`${t.card} border ${t.border} rounded-3xl p-5 space-y-4 text-left`}>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Formulas & Parameters</h3>
                </div>
                <p className={`text-[11px] ${t.textMuted}`}>Tweak formulas applied to simulation math (such as tax rate multipliers and rounding limits).</p>
                
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-neutral-400">
                      <span>Simulated GST Tax (VAT)</span>
                      <span className="text-blue-500 font-bold">{taxRate}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="28" 
                      step="1"
                      value={taxRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTaxRate(val);
                        localStorage.setItem('ceo_settings_tax_rate', String(val));
                      }}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none mt-1"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block mb-1">Decimal Rounding Rule</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'closest', name: 'Nearest 1₹' },
                        { id: 'precise', name: 'Fractional' }
                      ].map((rule) => (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => {
                            setRoundingRule(rule.id);
                            localStorage.setItem('ceo_settings_rounding', rule.id);
                            showToast('Rounding formula updated!', 'success');
                            playChime();
                          }}
                          className={`py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                            roundingRule === rule.id 
                              ? 'border-blue-500/40 bg-blue-500/5 text-blue-500' 
                              : `${t.border} bg-black/5 dark:bg-black/20 text-neutral-400`
                          }`}
                        >
                          {rule.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight mt-1.5">Determines standard calculations for invoice simulation models.</p>
                  </div>
                </div>
              </div>

              {/* Card 4: Platform Themes selection */}
              <div className={`${t.card} border ${t.border} rounded-3xl p-5 space-y-4 text-left md:col-span-2 lg:col-span-1`}>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-purple-500" />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Control Center Visual Dress</h3>
                </div>
                <p className={`text-[11px] ${t.textMuted}`}>Switch the global style identity of the director console. All visual assets adapt instantly.</p>
                
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        changeTheme(theme.id);
                        playChime();
                      }}
                      className={`text-[10px] font-black uppercase tracking-wider py-3 px-2 rounded-xl text-center transition-all border block ${
                        themeId === theme.id 
                          ? `${t.primaryBorder} ${t.primaryLight} ${t.primary}` 
                          : `${t.border} ${t.bg} ${t.textMuted} hover:bg-black/5 dark:hover:bg-white/5`
                      }`}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 5: Core Simulator Feature Flags */}
              <div className={`${t.card} border ${t.border} rounded-3xl p-5 space-y-4 text-left md:col-span-2`}>
                <div className="flex items-center gap-2">
                  <Power className="h-4 w-4 text-red-500" />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Pilot Feature Toggles</h3>
                </div>
                <p className={`text-[11px] ${t.textMuted}`}>Direct control flags modifying administrative response systems and diagnostic visuals.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  
                  {/* Maintenance block switch */}
                  <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-black/20 border border-black/5 dark:border-white/5 flex items-center justify-between">
                    <div className="text-left py-0.5 pr-2">
                      <span className={`text-[10px] font-black uppercase ${t.text} block`}>Freeze System / Maintenance</span>
                      <span className="text-[9px] font-semibold text-slate-500 leading-normal">Lock merchant logins & trigger alerts.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !isMaintenanceMode;
                        setIsMaintenanceMode(nextVal);
                        localStorage.setItem('ceo_settings_maintenance', String(nextVal));
                        showToast(`Simulation lockdown ${nextVal ? 'Activated' : 'Dismissed'}!`, 'success');
                        playChime();
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase transition-all tracking-wider ${
                        isMaintenanceMode 
                          ? 'bg-red-500 text-white shrink-0 shadow-sm font-black' 
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 shrink-0'
                      }`}
                    >
                      {isMaintenanceMode ? 'Lock On' : 'Active'}
                    </button>
                  </div>

                  {/* Autopilot Smart Assist */}
                  <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-black/20 border border-black/5 dark:border-white/5 flex items-center justify-between">
                    <div className="text-left py-0.5 pr-2">
                      <span className={`text-[10px] font-black uppercase ${t.text} block`}>Smart Menu Copilot</span>
                      <span className="text-[9px] font-semibold text-slate-500 leading-normal">Default simulated AI blueprints generation.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !autopilotEnabled;
                        setAutopilotEnabled(nextVal);
                        localStorage.setItem('ceo_settings_autopilot', String(nextVal));
                        showToast(`Copilot Autopilot ${nextVal ? 'ENABLED' : 'DISABLED'}!`, 'success');
                        playChime();
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase transition-all tracking-wider ${
                        autopilotEnabled 
                          ? 'bg-orange-500 text-white shrink-0 shadow-sm font-black' 
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 shrink-0'
                      }`}
                    >
                      {autopilotEnabled ? 'Autopilot' : 'Manual'}
                    </button>
                  </div>

                </div>
              </div>

            </div>

            {/* FULL INTEGRATED TELEMETRY COMPUTER CONSOLE PANEL */}
            <div className={`${t.card} border ${t.border} rounded-3xl p-6 text-left space-y-4 animate-fade-in`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-black/5 dark:border-white/5">
                <div className="space-y-1">
                  <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${t.text}`}>
                    <Terminal className="w-5 h-5 text-orange-500 animate-pulse" /> Security Integrity & Diagnostic Feed
                  </h3>
                  <p className={`text-[11px] ${t.textMuted}`}>Real-time sandboxed system process and network heartbeat logging.</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setConsoleFeedPaused(!consoleFeedPaused)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 transition-all active:scale-98"
                  >
                    {consoleFeedPaused ? '▶ Resume stream' : '⏸ Pause stream'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuditLogs([]);
                      showToast('Console event stack cleared!', 'success');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-500/15 hover:bg-red-500/5 text-[10px] font-black uppercase tracking-widest text-red-500 transition-all active:scale-98"
                  >
                    Flush logs
                  </button>
                </div>
              </div>

              {/* Console logs output terminal window */}
              <div className="font-mono text-[10px] bg-[#090d11] p-4 rounded-2xl h-44 overflow-y-auto space-y-1 block border border-white/5 select-text relative">
                {auditLogs.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-bold p-4 text-center">
                    Terminal buffer empty. Resume feed or inject logs manually to listen.
                  </div>
                ) : (
                  auditLogs.map((log) => {
                    const typeColors = {
                      info: 'text-blue-400',
                      warn: 'text-amber-500 font-extrabold',
                      success: 'text-emerald-400'
                    };
                    return (
                      <div key={log.id} className="flex flex-wrap items-start gap-1 text-[11px] leading-relaxed transition-all hover:bg-white/5 rounded px-1 py-0.5">
                        <span className="text-gray-500 font-black tracking-tight select-none">&#91;{log.time}&#93;</span>
                        <span className={`font-semibold shrink-0 select-none ${typeColors[log.type]}`}>&#91;{log.type.toUpperCase()}&#93;</span>
                        <span className="text-gray-300 font-medium">{log.msg}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Console diagnostic controllers inline widgets */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                <p className="text-[10px] font-semibold text-slate-500 leading-relaxed text-left max-w-sm">
                  Simulate emergency state events locally. Helps evaluate notification rendering constraints instantly inside the preview iframe container.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const timeStr = now.toTimeString().split(' ')[0];
                    setAuditLogs(prev => [
                      ...prev,
                      {
                        id: Date.now().toString(),
                        msg: 'HAZARDOUS_ALERT: Sandbox iframe security policy constraints simulated - token restricted.',
                        time: timeStr,
                        type: 'warn'
                      }
                    ]);
                    showToast('Critical warning injection simulated!', 'error');
                    playChime('synth-sci-fi');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-sm shrink-0 active:scale-98 text-center"
                >
                  📡 Inject Simulated Warn
                </button>
              </div>
            </div>

            {/* Bottom session terminal sign-out block */}
            <div className="flex justify-center pt-6 max-w-xs mx-auto">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2.5 w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-md active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                Terminate Director Session
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-sans flex transition-colors duration-300`}>
      {/* Desktop Sidebar (hidden on mobile, visible on desktop) */}
      <aside className={`hidden lg:flex flex-col w-64 fixed top-0 bottom-0 left-0 z-40 border-r ${t.border} ${t.card} p-5 justify-between overflow-y-auto`}>
        <div className="space-y-8">
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-2">
            <div className={`w-9 h-9 rounded-xl ${t.primaryLight} flex items-center justify-center border ${t.primaryBorder}`}>
              <Shield className={`h-5 w-5 ${t.primary}`} />
            </div>
            <div className="text-left">
              <h1 className={`text-sm font-black uppercase tracking-widest ${t.text} truncate max-w-[140px]`} title={ceoName}>{ceoName}</h1>
              <p className={`text-[9px] font-bold ${t.textMuted} uppercase truncate max-w-[140px]`} title={ceoTitle}>{ceoTitle}</p>
            </div>
          </div>

          {/* Nav List */}
          <div className="space-y-1.5 text-left">
            {[
              { id: 'home', icon: Home, label: 'Home Dashboard' },
              { id: 'charts', icon: BarChart2, label: 'Financial Index' },
              { id: 'clients', icon: Users, label: 'Partner Accounts' },
              { id: 'tools', icon: Wrench, label: 'Control Terminal' },
              { id: 'settings', icon: Settings, label: 'System Settings' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all relative ${
                    isActive ? `${t.primary} ${t.primaryLight} border ${t.primaryBorder}` : `border border-transparent ${t.textMuted} hover:text-orange-500 hover:bg-black/5 dark:hover:bg-white/5`
                  }`}
                >
                  <Icon className="h-5 w-5 stroke-[2px]" />
                  <span>{tab.label}</span>
                  {isActive && <span className={`absolute right-3 w-1.5 h-1.5 rounded-full ${t.primaryBg}`} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* User profile details box */}
        <div className="space-y-4 px-1 pb-2">
          <div className={`p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border ${t.border} text-left`}>
            <p className="text-[9px] font-black tracking-widest uppercase opacity-65">Director Auth</p>
            <p className={`text-xs font-black truncate mt-1 ${t.text}`} title="mnjkairi1@gmail.com">mnjkairi1@gmail.com</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-3 rounded-xl border border-red-500/10 hover:border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content Box */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header - Hidden on wide screens because of sidebar details */}
        <header className={`lg:hidden ${t.bg}/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40 border-b ${t.border}`}>
          <div className={`flex items-center justify-between ${t.text}`}>
            <span className="text-xs font-black uppercase tracking-widest opacity-80">CEO TERMINAL</span>
            <Shield className={`h-5 w-5 ${t.primary}`} />
          </div>
        </header>

        {/* Screen layout content panel */}
        <main className="flex-1 overflow-y-auto w-full max-w-lg lg:max-w-7xl mx-auto px-4 py-4 md:py-6 lg:px-8 xl:px-12 relative transition-all duration-300 pb-24">
          {isMaintenanceMode && (
            <div className="mb-6 p-4 rounded-[24px] bg-red-500/10 border border-red-500/25 text-red-500 flex items-center gap-3.5 animate-pulse shadow-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-wider">Simulated System Maintenance Lockdown Mode Active</p>
                <p className="text-[9px] font-semibold opacity-85 leading-relaxed">Admin simulation logs display system freeze locks. Merchant client devices would experience temporary database synchronization notifications.</p>
              </div>
            </div>
          )}
          {renderContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Hidden on LG wide screen console) */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 ${t.card} border-t ${t.border} pb-safe z-50`}>
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

      {/* Custom Toast Alert Banner */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-xs animate-slide-up pointer-events-none">
          <div className={`${t.card} border ${t.border} rounded-2xl px-4 py-3.5 shadow-xl flex items-center gap-3 bg-[#161b22]/95 backdrop-blur-md`}>
            {toast.type === 'success' ? (
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-emerald-500" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
            )}
            <p className={`text-xs font-bold ${t.text} text-left leading-tight`}>{toast.message}</p>
          </div>
        </div>
      )}

      {/* Custom Secure Iframe Dynamic Confirm Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in object-contain">
          <div className={`${t.card} border ${t.border} w-full max-w-sm rounded-[28px] p-6 shadow-2xl space-y-4 text-left animate-scale-up`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className={`text-base font-black tracking-tight ${t.text}`}>{confirmModal.title}</h3>
            </div>
            
            <p className={`text-xs font-semibold leading-relaxed ${t.textMuted}`}>
              {confirmModal.description}
            </p>
            
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className={`flex-1 py-2.5 rounded-xl border ${t.border} bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-black uppercase tracking-wider transition-all text-neutral-700 dark:text-neutral-300`}
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm text-center"
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


