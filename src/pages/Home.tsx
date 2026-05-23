import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion } from 'motion/react';
import { UtensilsCrossed, ArrowRight, UserCircle2, Mail, Lock, Sparkles, RefreshCcw } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'welcome' | 'login' | 'signup' | 'verify'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await u.reload();
        if (!u.emailVerified && u.providerData.some((p) => p.providerId === 'password')) {
          setMode('verify');
          setLoading(false);
          return;
        }

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
      } else {
        setMode('welcome');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google Login failed:', error);
    }
  };

  const handleEmailAuth = async () => {
     if (!email || !password) {
       alert("Please enter both email and password.");
       return;
     }
     setLoading(true);
     try {
       if (mode === 'signup') {
         const userCredential = await createUserWithEmailAndPassword(auth, email, password);
         await sendEmailVerification(userCredential.user);
         alert("Verification email sent! Please check your inbox.");
       } else {
         await signInWithEmailAndPassword(auth, email, password);
       }
     } catch (error: any) {
       console.error(`${mode} failed:`, error);
       if (error.code === 'auth/email-already-in-use') {
         alert("This email is already in use. Please login instead.");
         setMode('login');
       } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
         alert("Invalid email or password.");
       } else {
         alert(error.message || "Failed. Please check your credentials.");
       }
       setLoading(false);
     }
  };

  const handleResendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        alert("Verification email resent!");
      } catch (error: any) {
        alert(error.message || "Failed to resend. Try again later.");
      }
    }
  };

  const handleCheckVerification = async () => {
    if (auth.currentUser) {
      setLoading(true);
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        // Will be handled by next re-eval or we can force reload
        window.location.reload();
      } else {
        alert("Email is not verified yet. Please check your inbox or spam folder.");
        setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMode('welcome');
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-orange-50 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-orange-100"
      >
        <div className="flex justify-center mb-6">
          <div className="rounded-3xl bg-orange-100 p-4">
            <Sparkles className="h-10 w-10 text-orange-600" />
          </div>
        </div>
        
        {mode === 'welcome' && (
            <>
                <h1 className="text-3xl font-black text-neutral-900 mb-2">Welcome!</h1>
                <p className="text-neutral-500 mb-8">Start managing your business with love.</p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => setMode('login')} className="w-full bg-neutral-900 text-white font-bold py-4 rounded-2xl">Login</button>
                    <button onClick={() => setMode('signup')} className="w-full bg-orange-100 text-orange-700 font-bold py-4 rounded-2xl">Create Account</button>
                    <button onClick={handleGoogleLogin} className="w-full border border-neutral-200 text-neutral-700 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2">
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                        Google
                    </button>
                </div>
            </>
        )}

        {(mode === 'login' || mode === 'signup') && (
            <div className="text-left space-y-4">
                <h2 className="text-2xl font-bold">{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
                <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-neutral-400" />
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-neutral-200 pl-10 pr-4 py-3 rounded-xl" />
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-neutral-400" />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-neutral-200 pl-10 pr-4 py-3 rounded-xl" />
                </div>
                <button onClick={handleEmailAuth} className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl">{mode === 'login' ? 'Login' : 'Sign Up'}</button>
                <button onClick={() => setMode('welcome')} className="w-full text-neutral-500 text-sm">Back</button>
            </div>
        )}

        {mode === 'verify' && (
            <div className="text-center space-y-6">
                <h2 className="text-2xl font-bold text-neutral-900">Verify your email</h2>
                <p className="text-neutral-500 text-sm">
                   We've sent a verification link to <strong>{auth.currentUser?.email}</strong>. 
                   Please verify your email to continue.
                </p>
                <div className="flex flex-col gap-3 mt-4">
                  <button onClick={handleCheckVerification} className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                    <RefreshCcw className="h-5 w-5" />
                    I've verified my email
                  </button>
                  <button onClick={handleResendVerification} className="w-full bg-orange-100 text-orange-700 font-bold py-4 rounded-2xl">
                    Resend Link
                  </button>
                  <button onClick={handleLogout} className="w-full text-neutral-500 font-semibold py-2">
                    Logout
                  </button>
                </div>
            </div>
        )}
      </motion.div>
    </div>
  );
}
