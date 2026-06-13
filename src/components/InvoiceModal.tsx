import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  Receipt,
  Utensils,
  Scissors,
  Stethoscope,
  ShoppingBag,
  User,
  Hash,
  Settings,
  Scale
} from 'lucide-react';
import { Order } from '../types';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  restaurantName: string;
  businessType?: string;
}

export default function InvoiceModal({ isOpen, onClose, order, restaurantName, businessType = 'Restaurant' }: InvoiceModalProps) {
  const [copied, setCopied] = useState(false);
  const [printTemplate, setPrintTemplate] = useState<'thermal' | 'modern'>('thermal');
  const [showTaxes, setShowTaxes] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Default Tax rates under CGST Rules in India
  const getDefaultRate = () => {
    switch (businessType.toLowerCase()) {
      case 'salon': return 18; // Beauty salons represent 18% regular services GST
      case 'clinic': return 0;  // Health services by clinical establishments are 100% exempt under Indian law (0%)
      case 'general store':
      case 'store': return 12; // Standard average retail goods slab
      default: return 5;       // Standalone restaurant services without Input Tax Credit are 5% under Notification 11/2017-Central Tax
    }
  };

  // Indian compliance states saved to localStorage
  const [gstRate, setGstRate] = useState<number>(() => {
    const saved = localStorage.getItem(`gstrate_${restaurantName}`);
    return saved ? Number(saved) : getDefaultRate();
  });

  const [gstType, setGstType] = useState<'exclusive' | 'inclusive'>(() => {
    return (localStorage.getItem(`gsttype_${restaurantName}`) as 'exclusive' | 'inclusive') || 'exclusive';
  });

  const [gstin, setGstin] = useState<string>(() => {
    return localStorage.getItem(`gstin_${restaurantName}`) || '27AAPCU1234M1Z5'; // Standard Maha template code
  });

  const [fssai, setFssai] = useState<string>(() => {
    return localStorage.getItem(`fssai_${restaurantName}`) || '22724999000123'; // 14-digit FSSAI format
  });

  if (!isOpen) return null;

  // Save config logic
  const handleSaveSettings = (rate: number, type: 'exclusive' | 'inclusive', gstStr: string, fssaiStr: string) => {
    setGstRate(rate);
    setGstType(type);
    setGstin(gstStr);
    setFssai(fssaiStr);
    localStorage.setItem(`gstrate_${restaurantName}`, String(rate));
    localStorage.setItem(`gsttype_${restaurantName}`, type);
    localStorage.setItem(`gstin_${restaurantName}`, gstStr);
    localStorage.setItem(`fssai_${restaurantName}`, fssaiStr);
  };

  // GST math breakdown with 50/50 CGST and SGST split (Intra-State flow is normal for storefronts)
  const baseTotal = order.totalAmount;
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let grandTotal = 0;

  if (showTaxes && gstRate > 0) {
    if (gstType === 'exclusive') {
      subtotal = baseTotal;
      const totalGst = subtotal * (gstRate / 100);
      cgst = totalGst / 2;
      sgst = totalGst / 2;
      grandTotal = subtotal + cgst + sgst;
    } else {
      // Inclusive GST reverse math formula: Assessable Value = Total Menu Price / (1 + Rate%)
      subtotal = baseTotal / (1 + (gstRate / 100));
      const totalGst = baseTotal - subtotal;
      cgst = totalGst / 2;
      sgst = totalGst / 2;
      grandTotal = baseTotal;
    }
  } else {
    subtotal = baseTotal;
    grandTotal = baseTotal;
  }

  // Format Date in human-readable format
  let orderDate = '';
  try {
    const dateObj = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    if (!isNaN(dateObj.getTime())) {
      orderDate = dateObj.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      orderDate = new Date().toLocaleString();
    }
  } catch (e) {
    orderDate = new Date().toLocaleString();
  }

  // Get business-specific icon
  const getBusinessIcon = () => {
    switch (businessType.toLowerCase()) {
      case 'salon':
        return <Scissors className="h-6 w-6 text-indigo-500" />;
      case 'clinic':
        return <Stethoscope className="h-6 w-6 text-emerald-500" />;
      case 'general store':
      case 'store':
        return <ShoppingBag className="h-6 w-6 text-amber-500" />;
      default:
        return <Utensils className="h-6 w-6 text-orange-500" />;
    }
  };

  // Whatsapp and text receipt sharing 
  const handleCopyText = () => {
    const itemsText = order.items
      .map(item => `${item.quantity}x ${item.name} - ₹${item.price * item.quantity}`)
      .join('\n');
    
    // Check if it's tax-exempt
    const gstApplicable = showTaxes && gstRate > 0;
    const isFood = businessType.toLowerCase() === 'restaurant' || businessType.toLowerCase() === 'food' || businessType.toLowerCase() === 'cafe';

    const textPayload = `*INVOICE BILL*\n` +
      `*${restaurantName.toUpperCase()}*\n` +
      `-----------------------------\n` +
      `${gstApplicable ? `GSTIN: ${gstin}\n` : ''}` +
      `${isFood ? `FSSAI Lic No: ${fssai}\n` : ''}` +
      `Invoice ID: #${order.id.slice(0, 8).toUpperCase()}\n` +
      `Date: ${orderDate}\n` +
      `${businessType === 'Salon' || businessType === 'Clinic' ? 'Staff Code' : 'Table'}: ${order.tableNo}\n` +
      `Customer Name: ${order.customerName || 'Walk-in'}\n` +
      `-----------------------------\n` +
      `*ITEMS PURCHASED:*\n${itemsText}\n` +
      `-----------------------------\n` +
      `Subtotal: ₹${subtotal.toFixed(2)}\n` +
      (gstApplicable ? `CGST (${(gstRate / 2).toFixed(1)}%): ₹${cgst.toFixed(2)}\nSGST (${(gstRate / 2).toFixed(1)}%): ₹${sgst.toFixed(2)}\n` : '') +
      `*Grand Total: ₹${grandTotal.toFixed(2)}*\n` +
      `-----------------------------\n` +
      `Thank you for clean orders with us!\n`;

    navigator.clipboard.writeText(textPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm print:hidden"
        />

        {/* Modal Sheet body */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-neutral-50 shadow-2xl rounded-3xl overflow-hidden border border-neutral-200/50 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white print:rounded-none print:p-0 print:m-0 print:absolute print:top-0 print:left-0 print:right-0 print:bottom-0"
        >
          {/* Print Style Injector for physical printers */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              html, body {
                height: auto;
                background-color: #fff;
                color: #000;
              }
              body * {
                visibility: hidden;
              }
              #printable-receipt, #printable-receipt * {
                visibility: visible;
              }
              #printable-receipt {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 10px;
                background-color: #fff !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `}} />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-100 print:hidden">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-neutral-800 animate-pulse" />
              <div>
                <span className="font-bold text-neutral-900 text-sm block">Invoice Bill</span>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">GST Compliant</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl border flex items-center gap-1 text-[11px] font-bold transition-all ${
                  showSettings ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
                }`}
                title="Configure Indian GST Rates and GSTIN"
              >
                <Settings className={`h-4.5 w-4.5 ${showSettings ? 'rotate-45' : ''} transition-all`} />
                {showSettings ? 'Hide Settings' : 'GST Setup'}
              </button>
              
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Interactive Indian GST and Compliance Config Panel for Stores / Salons */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white border-b border-orange-100 p-4 font-sans text-xs text-neutral-700 space-y-3 overflow-hidden shadow-inner print:hidden"
              >
                <div className="flex items-center gap-1.5 font-black text-neutral-800 border-b border-neutral-100 pb-1.5 text-[10px] uppercase tracking-wider">
                  <Scale className="h-3.5 w-3.5 text-orange-600" /> GST & Licence Setup
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">GST Percentage</label>
                    <select
                      value={gstRate}
                      onChange={(e) => handleSaveSettings(Number(e.target.value), gstType, gstin, fssai)}
                      className="w-full rounded-xl border-neutral-200 p-2 text-xs font-semibold focus:border-orange-500 focus:ring focus:ring-orange-100 bg-neutral-50"
                    >
                      <option value={0}>0% GST (Tax Exempt)</option>
                      <option value={5}>5% GST (Restaurants/Food)</option>
                      <option value={12}>12% GST (Retail Goods)</option>
                      <option value={18}>18% GST (Services / Salons)</option>
                      <option value={28}>28% GST (Luxury Slab)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Taxes Formula</label>
                    <div className="flex bg-neutral-100 p-0.5 rounded-xl">
                      <button
                        onClick={() => handleSaveSettings(gstRate, 'exclusive', gstin, fssai)}
                        className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all ${gstType === 'exclusive' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
                      >
                        Extra (On Top)
                      </button>
                      <button
                        onClick={() => handleSaveSettings(gstRate, 'inclusive', gstin, fssai)}
                        className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all ${gstType === 'inclusive' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
                      >
                        Inclusive
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Your GSTIN (15 Digits)</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => handleSaveSettings(gstRate, gstType, e.target.value.toUpperCase().slice(0, 15), fssai)}
                      placeholder="27AAPCU1234M1Z5"
                      className="w-full rounded-xl border-neutral-200 p-2 text-xs font-mono bg-neutral-50 focus:bg-white"
                    />
                  </div>

                  {(businessType.toLowerCase() === 'restaurant' || businessType.toLowerCase() === 'food' || businessType.toLowerCase() === 'cafe') && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">FSSAI Licence Number</label>
                      <input
                        type="text"
                        value={fssai}
                        onChange={(e) => handleSaveSettings(gstRate, gstType, gstin, e.target.value.replace(/\D/g, '').slice(0, 14))}
                        placeholder="22724999000123"
                        className="w-full rounded-xl border-neutral-200 p-2 text-xs font-mono bg-neutral-50 focus:bg-white"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Toolbar to select template and toggle GST presence */}
          <div className="bg-white p-4 border-b border-neutral-100 flex flex-wrap gap-2 items-center justify-between print:hidden">
            <div className="flex bg-neutral-100 p-0.5 rounded-xl text-xs font-semibold text-neutral-500">
              <button
                onClick={() => setPrintTemplate('thermal')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${printTemplate === 'thermal' ? 'bg-white text-neutral-900 shadow-sm' : 'hover:text-neutral-900'}`}
              >
                <Hash className="h-3 w-3" /> Thermal Roll (POS)
              </button>
              <button
                onClick={() => setPrintTemplate('modern')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${printTemplate === 'modern' ? 'bg-white text-neutral-900 shadow-sm' : 'hover:text-neutral-900'}`}
              >
                <FileText className="h-3 w-3" /> Premium A4 Bill
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-600">
              <input 
                type="checkbox"
                checked={showTaxes}
                onChange={(e) => setShowTaxes(e.target.checked)}
                className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500 h-4 w-4"
              />
              Calculate GST ({gstRate}%)
            </label>
          </div>

          {/* Printable Invoice Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-neutral-100/30 print:overflow-visible print:p-0 print:bg-white">
            <div 
              id="printable-receipt"
              className={`mx-auto bg-white transition-all duration-300 ${
                printTemplate === 'thermal' 
                  ? 'max-w-[320px] shadow-md border-t-8 border-t-orange-600 border border-neutral-200/60 p-5 font-mono text-neutral-800 text-xs shadow-neutral-200/40 print:max-w-none print:shadow-none print:border-none' 
                  : 'max-w-md shadow-lg border border-neutral-200/60 p-6 rounded-2xl text-neutral-800 shadow-neutral-200/40 print:shadow-none print:border-none'
              }`}
            >
              {/* Receipt Template: THERMAL ROLL */}
              {printTemplate === 'thermal' ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex justify-center mb-1 print:hidden">{getBusinessIcon()}</div>
                    <h2 className="text-base font-black tracking-tight uppercase text-neutral-900">{restaurantName}</h2>
                    <p className="text-[9px] text-neutral-500 uppercase mt-0.5 tracking-wider font-extrabold">- BILL BILL -</p>
                  </div>

                  {/* Indian statutory numbers thermal display (Simple & Clean) */}
                  {(showTaxes && gstRate > 0) || ((businessType.toLowerCase() === 'restaurant' || businessType.toLowerCase() === 'food' || businessType.toLowerCase() === 'cafe')) ? (
                    <>
                      <div className="border-b border-dashed border-neutral-300 my-1" />
                      <div className="text-[9px] text-neutral-600 font-mono tracking-tight space-y-0.5">
                        {showTaxes && gstRate > 0 && (
                          <div className="flex justify-between">
                            <span>GSTIN:</span>
                            <span className="font-bold text-neutral-900">{gstin}</span>
                          </div>
                        )}
                        {(businessType.toLowerCase() === 'restaurant' || businessType.toLowerCase() === 'food' || businessType.toLowerCase() === 'cafe') && (
                          <div className="flex justify-between">
                            <span>FSSAI NO:</span>
                            <span className="font-bold text-neutral-900">{fssai}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  <div className="border-b border-dashed border-neutral-300 my-2" />

                  {/* Invoicing details block */}
                  <div className="space-y-1 text-[11px] text-neutral-600">
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <span className="font-medium text-neutral-900">{orderDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>INV NO:</span>
                      <span className="font-mono text-neutral-900 font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{businessType === 'Salon' || businessType === 'Clinic' ? 'STAFF CODE:' : 'TABLE NO:'}</span>
                      <span className="font-black text-neutral-900">{order.tableNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CUSTOMER:</span>
                      <span className="font-bold text-neutral-900">{order.customerName || 'Walk-In'}</span>
                    </div>
                    {order.paymentMethod && (
                      <div className="flex justify-between">
                        <span>PAY MODE:</span>
                        <span className="font-extrabold text-neutral-900 uppercase bg-neutral-100 px-1 py-0.5 text-[10px] rounded">{order.paymentMethod}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-b border-dashed border-neutral-300 my-2" />

                  {/* Items catalog */}
                  <div>
                    <div className="flex justify-between font-black text-neutral-900 uppercase tracking-widest text-[10px] mb-2">
                      <span>Item Description</span>
                      <span>Total (INR)</span>
                    </div>
                    <ul className="space-y-2 text-[11px]">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="space-y-0.5">
                          <div className="flex justify-between">
                            <span className="font-bold text-neutral-900">{item.name}</span>
                            <span className="font-bold text-neutral-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          <div className="text-neutral-500 text-[10px] pl-2">
                            {item.quantity} x ₹{item.price.toFixed(2)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-b border-dashed border-neutral-300 my-2" />

                  {/* Dual split CGST + SGST pricing breakdown */}
                  <div className="space-y-1.5 text-xs text-neutral-700">
                    <div className="flex justify-between">
                      <span>SUBTOTAL:</span>
                      <span className="font-mono font-bold">₹{subtotal.toFixed(2)}</span>
                    </div>
                    {showTaxes && gstRate > 0 ? (
                      <>
                        <div className="flex justify-between">
                          <span>CGST ({(gstRate / 2).toFixed(1)}%):</span>
                          <span className="font-mono">₹{cgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST ({(gstRate / 2).toFixed(1)}%):</span>
                          <span className="font-mono">₹{sgst.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-neutral-500">
                        <span>TAXES CHARGED:</span>
                        <span className="font-bold uppercase text-[9px]">Exempt (0%)</span>
                      </div>
                    )}
                    <div className="border-b border-dotted border-neutral-200 my-1.5" />
                    <div className="flex justify-between font-black text-sm text-neutral-900 bg-neutral-100 p-1 rounded">
                      <span>NET AMOUNT:</span>
                      <span className="font-bold">₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-neutral-300 my-3" />

                  <div className="text-center">
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest font-sans">*** THANK YOU FOR VISITING ***</p>
                  </div>
                </div>
              ) : (
                /* Receipt Template: PREMIUM A4 INVOICE */
                <div className="space-y-6 animate-fade-in">
                  {/* Tax invoice header complying section 31 CGST */}
                  <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 animate-fadeIn">
                        {getBusinessIcon()}
                        <h2 className="text-lg font-black tracking-tight text-neutral-900">{restaurantName}</h2>
                      </div>
                      <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-100 px-2 by-0.5 rounded-full inline-block">
                        Retail Bill
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${
                        order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        order.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Clean Recipient & Identity Block */}
                  <div className="grid grid-cols-2 gap-4 bg-neutral-50/50 p-4 rounded-xl border border-neutral-100 text-xs text-neutral-600">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">Customer Details</span>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="font-bold text-neutral-800">{order.customerName || 'Walk-in Customer'}</span>
                      </div>
                      <span className="text-neutral-500 block mt-1">Table/Code: <strong className="text-neutral-800">{order.tableNo}</strong></span>
                    </div>

                    <div className="text-right space-y-0.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1.5">Bill Details</span>
                      <span className="text-neutral-500 block">Inv ID: <strong className="text-neutral-800 font-mono">#{order.id.slice(0, 8).toUpperCase()}</strong></span>
                      <span className="text-neutral-500 block">Date: <strong className="text-neutral-800">{orderDate.split(',')[0]}</strong></span>
                      {showTaxes && gstRate > 0 && <span className="text-neutral-500 block">GSTIN: <strong className="text-neutral-800 font-mono">{gstin}</strong></span>}
                      {(businessType.toLowerCase() === 'restaurant' || businessType.toLowerCase() === 'food' || businessType.toLowerCase() === 'cafe') && <span className="text-neutral-500 block">FSSAI Licence: <strong className="text-neutral-800 font-mono">{fssai}</strong></span>}
                    </div>
                  </div>

                  {/* Items billing table */}
                  <div className="space-y-2">
                    <div className="border border-neutral-100 rounded-xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-neutral-50 border-b border-neutral-100 text-neutral-500 font-bold uppercase tracking-wider text-[9px]">
                          <tr>
                            <th className="p-3">Item Description</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Unit Rate</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-neutral-600 font-medium">
                          {order.items.map((item, index) => (
                            <tr key={index} className="hover:bg-neutral-50/50">
                              <td className="p-3">
                                <div className="font-semibold text-neutral-800">{item.name}</div>
                              </td>
                              <td className="p-3 text-center font-bold text-neutral-800">{item.quantity}N</td>
                              <td className="p-3 text-right">₹{item.price.toFixed(2)}</td>
                              <td className="p-3 text-right font-semibold text-neutral-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Clean Tax computations */}
                  <div className="flex justify-end pt-2 border-t border-neutral-100">
                    <div className="w-60 text-xs space-y-2">
                      <div className="flex justify-between text-neutral-500 font-medium">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-neutral-800">₹{subtotal.toFixed(2)}</span>
                      </div>
                      
                      {showTaxes && gstRate > 0 ? (
                        <>
                          <div className="flex justify-between text-neutral-500 font-medium">
                            <span>CGST ({(gstRate / 2).toFixed(1)}%):</span>
                            <span className="font-semibold text-neutral-800">₹{cgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-neutral-500 font-medium">
                            <span>SGST ({(gstRate / 2).toFixed(1)}%):</span>
                            <span className="font-semibold text-neutral-800">₹{sgst.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-emerald-600 font-extrabold bg-emerald-50 p-1.5 rounded-lg text-[10px]">
                          <span>Taxes:</span>
                          <span className="uppercase font-bold">Tax Exempt</span>
                        </div>
                      )}

                      <div className="border-t border-neutral-100 pt-2 flex justify-between font-black text-xs text-neutral-900 uppercase">
                        <span>Total GST due:</span>
                        <span className="text-orange-600 text-sm">₹{grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Warm note */}
                  <div className="text-center bg-orange-50/10 p-4 rounded-xl border border-orange-100/30">
                    <p className="text-xs font-bold text-neutral-750">Thank you for visiting {restaurantName}!</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="bg-white p-6 border-t border-neutral-100 flex flex-col sm:flex-row gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 hover:shadow-orange-100 transition-all shadow-md active:scale-95"
            >
              <Printer className="h-4 w-4" /> Print Bill (POS/A4)
            </button>
            <button
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white border border-neutral-200 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors active:scale-95 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 animate-bounce" /> Copied GST Invoice!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-neutral-500" /> Share via WhatsApp
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="sm:w-28 flex items-center justify-center rounded-2xl bg-neutral-100 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-200 transition-colors active:scale-95"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
