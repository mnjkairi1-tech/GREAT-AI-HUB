import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  ChevronRight, 
  Share2, 
  Receipt,
  Utensils,
  Scissors,
  Stethoscope,
  ShoppingBag,
  Clock,
  User,
  Hash
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

  if (!isOpen) return null;

  // Calculate prices
  const subtotal = order.totalAmount;
  const cgst = showTaxes ? subtotal * 0.025 : 0; // 2.5%
  const sgst = showTaxes ? subtotal * 0.025 : 0; // 2.5%
  const grandTotal = subtotal + cgst + sgst;

  // Format Date in human-readable English
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
        return <Scissors className="h-6 w-6 text-brand-primary" />;
      case 'clinic':
        return <Stethoscope className="h-6 w-6 text-emerald-500" />;
      case 'general store':
      case 'store':
        return <ShoppingBag className="h-6 w-6 text-amber-500" />;
      default:
        return <Utensils className="h-6 w-6 text-orange-500" />;
    }
  };

  // Plain Text Copying for Whatsapp/Sms
  const handleCopyText = () => {
    const itemsText = order.items
      .map(item => `${item.quantity}x ${item.name} - ₹${item.price * item.quantity}`)
      .join('\n');
    theText = `*INVOICE* from *${restaurantName}*\n\n` +
      `Date: ${orderDate}\n` +
      `Order ID: #${order.id.slice(0, 8).toUpperCase()}\n` +
      `${businessType === 'Salon' || businessType === 'Clinic' ? 'Staff Code' : 'Table'}: ${order.tableNo}\n` +
      `Customer Name: ${order.customerName || 'Walk-in'}\n` +
      `-----------------------------\n` +
      `${itemsText}\n` +
      `-----------------------------\n` +
      `Subtotal: ₹${subtotal.toFixed(2)}\n` +
      (showTaxes ? `CGST (2.5%): ₹${cgst.toFixed(2)}\nSGST (2.5%): ₹${sgst.toFixed(2)}\n` : '') +
      `*Total: ₹${grandTotal.toFixed(2)}*\n\n` +
      `Thank you for business with us!`;

    navigator.clipboard.writeText(theText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  let theText = '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm print:hidden"
        />

        {/* Modal Sheet */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-neutral-50 shadow-2xl rounded-3xl overflow-hidden border border-neutral-200/50 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white print:rounded-none print:p-0 print:m-0 print:absolute print:top-0 print:left-0 print:right-0 print:bottom-0"
        >
          {/* Print Style Injector */}
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
              <Receipt className="h-5 w-5 text-neutral-800" />
              <span className="font-bold text-neutral-900 text-sm">Generate Bill Invoice</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Configuration toolbar for custom invoice layouts */}
          <div className="bg-white p-4 border-b border-neutral-100 flex flex-wrap gap-3 items-center justify-between print:hidden">
            <div className="flex bg-neutral-100 p-0.5 rounded-xl text-xs font-semibold text-neutral-500">
              <button
                onClick={() => setPrintTemplate('thermal')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${printTemplate === 'thermal' ? 'bg-white text-neutral-900 shadow-sm' : 'hover:text-neutral-900'}`}
              >
                <Hash className="h-3 w-3" /> Retail Receipt (Thermal)
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
              Include 5% GST
            </label>
          </div>

          {/* Invoice Body Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-neutral-100/30 print:overflow-visible print:p-0 print:bg-white">
            <div 
              id="printable-receipt"
              className={`mx-auto bg-white transition-all duration-300 ${
                printTemplate === 'thermal' 
                  ? 'max-w-[320px] shadow-md border-t-8 border-t-neutral-800 border border-neutral-200/60 p-5 font-mono text-neutral-800 text-xs shadow-neutral-200/40 print:max-w-none print:shadow-none print:border-none' 
                  : 'max-w-md shadow-lg border border-neutral-200/60 p-6 rounded-2xl text-neutral-800 shadow-neutral-200/40 print:shadow-none print:border-none'
              }`}
            >
              {/* Receipt Template: THERMAL (Standard cashier/restaurant thermal bill roll) */}
              {printTemplate === 'thermal' ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex justify-center mb-1 print:hidden">{getBusinessIcon()}</div>
                    <h2 className="text-base font-black tracking-tight uppercase text-neutral-900">{restaurantName}</h2>
                    <p className="text-[10px] text-neutral-500 uppercase mt-0.5 tracking-wider">{businessType} Receipt</p>
                  </div>

                  <div className="border-b border-dashed border-neutral-300 my-2" />

                  {/* Metal-data details representation in thermal styled table */}
                  <div className="space-y-1 text-[11px] text-neutral-600">
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <span className="font-medium">{orderDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BILL NO:</span>
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
                        <span className="font-bold text-neutral-900 uppercase">{order.paymentMethod}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-b border-dashed border-neutral-300 my-2" />

                  {/* Items list */}
                  <div>
                    <div className="flex justify-between font-black text-neutral-900 uppercase tracking-widest text-[10px] mb-2">
                      <span>Item Description</span>
                      <span>Total</span>
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

                  {/* Pricing billing section */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>SUBTOTAL:</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    {showTaxes && (
                      <>
                        <div className="flex justify-between text-neutral-600">
                          <span>CGST (2.5%):</span>
                          <span>₹{cgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-neutral-600">
                          <span>SGST (2.5%):</span>
                          <span>₹{sgst.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="border-b border-dotted border-neutral-200 my-1.5" />
                    <div className="flex justify-between font-black text-sm text-neutral-900">
                      <span>GRAND TOTAL:</span>
                      <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-neutral-300 my-3" />

                  {/* Footer Barcode visual mockups and Thank you */}
                  <div className="text-center space-y-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">--- THANK YOU ---</p>
                    {/* Simulated barcode using dashed/solid line segments to look high craft */}
                    <div className="flex flex-col items-center justify-center opacity-70">
                      <div className="font-mono tracking-[0.2em] text-[18px] select-none text-neutral-900 font-bold leading-none">
                        ||||| | ||| || |||| | ||
                      </div>
                      <span className="text-[8px] font-mono mt-1 text-neutral-400">*{order.id.slice(0, 10).toUpperCase()}*</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Receipt Template: MODERN (Beautiful formal corporate layout) */
                <div className="space-y-6">
                  {/* Brand Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {getBusinessIcon()}
                        <h2 className="text-lg font-black tracking-tight text-neutral-900">{restaurantName}</h2>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 uppercase font-semibold tracking-wider">{businessType} invoice</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${
                        order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                        order.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Billing Details Metadata block */}
                  <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Invoice To</span>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-neutral-400" />
                        <span className="font-bold text-neutral-800">{order.customerName || 'Walk-in Client'}</span>
                      </div>
                      <span className="text-neutral-500 block mt-1">Table/Code: <strong className="text-neutral-800">{order.tableNo}</strong></span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Receipt Details</span>
                      <span className="text-neutral-500 block">ID: <strong className="text-neutral-800 font-mono">#{order.id.slice(0, 8).toUpperCase()}</strong></span>
                      <span className="text-neutral-500 block mt-0.5">Date: <strong className="text-neutral-800">{orderDate.split(',')[0]}</strong></span>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest block mb-1.5">Purchased items</span>
                    <div className="border border-neutral-100 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-neutral-50 border-b border-neutral-100 text-neutral-500 font-bold uppercase tracking-wider text-[9px]">
                          <tr>
                            <th className="p-3">Item</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Price</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-neutral-600 font-medium">
                          {order.items.map((item, index) => (
                            <tr key={index} className="hover:bg-neutral-50/50">
                              <td className="p-3 font-semibold text-neutral-800">{item.name}</td>
                              <td className="p-3 text-center font-bold text-brand-primary">{item.quantity}x</td>
                              <td className="p-3 text-right">₹{item.price.toFixed(2)}</td>
                              <td className="p-3 text-right font-semibold text-neutral-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary math */}
                  <div className="flex justify-end pt-2">
                    <div className="w-56 text-xs space-y-2">
                      <div className="flex justify-between text-neutral-500 font-medium">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-neutral-800">₹{subtotal.toFixed(2)}</span>
                      </div>
                      {showTaxes && (
                        <>
                          <div className="flex justify-between text-neutral-500 font-medium">
                            <span>CGST (2.5%):</span>
                            <span className="font-semibold text-neutral-800">₹{cgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-neutral-500 font-medium">
                            <span>SGST (2.5%):</span>
                            <span className="font-semibold text-neutral-800">₹{sgst.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      <div className="border-t border-neutral-100 pt-2 flex justify-between font-black text-sm text-neutral-900 uppercase">
                        <span>Total Due:</span>
                        <span className="text-orange-600 text-base">₹{grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Signature or stamp placeholder & Thanks */}
                  <div className="text-center bg-orange-50/30 p-4 rounded-xl border border-orange-100/50">
                    <p className="text-xs font-semibold text-neutral-700">Thank you for your visit!</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Please let us know if you need anything else.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="bg-white p-6 border-t border-neutral-100 flex flex-col sm:flex-row gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-bold text-white hover:bg-neutral-800 transition-colors active:scale-95 shadow-lg shadow-neutral-900/10"
            >
              <Printer className="h-4 w-4" /> Print Bill
            </button>
            <button
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white border border-neutral-200 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors active:scale-95 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 animate-bounce" /> Copied Receipt Details
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
