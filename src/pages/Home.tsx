import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion } from 'motion/react';
import { UtensilsCrossed, ArrowRight, LayoutDashboard, QrCode } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loginOption, setLoginOption] = useState<'default' | 'google' | 'email'>('default');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if user has or is staff for a restaurant
        let q = query(collection(db, 'restaurants'), where('ownerId', '==', u.uid));
        let snapshot = await getDocs(q);
        
        if (snapshot.empty) {
           q = query(collection(db, 'restaurants'), where('staffEmails', 'array-contains', u.email));
           snapshot = await getDocs(q);
        }

        if (snapshot.empty) {
          navigate('/setup');
        } else {
          navigate('/dashboard');
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleEmailLogin = async () => {
     // TODO: Implement real Email/Password login
     alert("Email login coming soon!");
  };



  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full"
      >
        <div className="mb-8 flex justify-center">
          <div className="rounded-2xl bg-orange-100 p-4">
            <UtensilsCrossed className="h-12 w-12 text-orange-600" />
          </div>
        </div>
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Welcome to <span className="text-orange-600">Smart System</span>
        </h1>

        {loginOption === 'default' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-8 py-4 font-semibold text-white transition-all hover:bg-neutral-800 active:scale-95"
            >
              Login with Google
            </button>
            <button
              onClick={() => setLoginOption('email')}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-8 py-4 font-semibold text-neutral-900 transition-all hover:bg-neutral-50 active:scale-95"
            >
              Login with Email
            </button>
          </div>
        )}

        {loginOption === 'email' && (
          <div className="flex flex-col gap-4 text-left">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3" />
            <button onClick={handleEmailLogin} className="w-full rounded-xl bg-orange-600 py-3 text-white font-semibold">Login</button>
            <button onClick={() => setLoginOption('default')} className="text-neutral-500">Back</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
      <div className="mb-3 flex justify-center text-orange-600">{icon}</div>
      <h3 className="mb-1 font-semibold text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-500">{desc}</p>
    </div>
  );
}
