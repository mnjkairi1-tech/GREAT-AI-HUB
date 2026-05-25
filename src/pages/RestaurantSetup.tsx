import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion } from 'motion/react';
import { Store, ArrowRight } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { BUSINESS_TYPES } from '../constants';
import { applyTheme } from '../themes';
import { useEffect } from 'react';

export default function RestaurantSetup() {
  useEffect(() => {
    applyTheme('classic-orange');
  }, []);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    const qPath = 'restaurants';
    try {
      await addDoc(collection(db, qPath), {
        name,
        description: desc,
        businessType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      navigate('/dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, qPath);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-3xl border border-neutral-100 bg-white p-8 shadow-xl"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary text-brand-primary">
            <Store className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">Setup Your Business</h2>
          <p className="text-neutral-500">Let's get your digital presence ready.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Business Type</label>
            <select
              required
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none transition-all focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-secondary"
            >
              {BUSINESS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Business Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spice Garden"
               className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none transition-all focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-secondary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Description (Optional)</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Modern Indian cuisine..."
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none transition-all focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-secondary"
            />
          </div>

          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Finalize Setup'} <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
