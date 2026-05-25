import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion } from 'motion/react';
import { UtensilsCrossed, ArrowRight, UserCircle2, Mail, Lock, Sparkles, RefreshCcw } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [mode, setModeRaw] = useState<'welcome' | 'login' | 'signup' | 'verify' | 'forgot'>('welcome');

  const setMode = (newMode: 'welcome' | 'login' | 'signup' | 'verify' | 'forgot', replace = false) => {
    setModeRaw(newMode);
    if (replace) {
      window.history.replaceState({ appMode: newMode }, '');
    } else {
      window.history.pushState({ appMode: newMode }, '');
    }
  };

  useEffect(() => {
    if (window.history.state === null || !window.history.state.appMode) {
      window.history.replaceState({ appMode: 'welcome' }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.appMode) {
        setModeRaw(event.state.appMode);
      } else {
        setModeRaw('welcome');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await u.reload();
        if (!u.emailVerified && u.providerData.some((p) => p.providerId === 'password')) {
          setMode('verify', true);
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
        setMode('welcome', true);
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

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email to reset your password.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      alert("We have sent a password reset link to: " + email + ". Please check your inbox or spam folder.");
      setMode('login');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      const errorCode = error.code || '';
      if (errorCode === 'auth/invalid-email') {
        alert("Please enter a valid email address.");
      } else if (errorCode === 'auth/user-not-found') {
        alert("An account with this email address was not found.");
      } else if (errorCode === 'auth/network-request-failed') {
        alert("Network error. Please check your internet connection.");
      } else {
        alert(error.message || "Failed to send password reset email. Please try again.");
      }
    } finally {
      setLoading(false);
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
         alert("Welcome! We've sent a verification email to " + email + ". Please verify to continue.");
         setMode('verify');
       } else {
         await signInWithEmailAndPassword(auth, email, password);
       }
     } catch (error: any) {
       console.error(`${mode} failed:`, error);
       const errorCode = error.code || '';
       
       if (errorCode === 'auth/email-already-in-use') {
         alert("An account with this email already exists. Switching you to login mode...");
         setMode('login');
       } else if (errorCode.includes('auth/invalid-credential') || errorCode.includes('auth/wrong-password') || errorCode.includes('auth/user-not-found')) {
         alert("Invalid email or password. Please try again.");
       } else if (errorCode === 'auth/weak-password') {
         alert("Password is too weak. Please use at least 6 characters.");
       } else if (errorCode === 'auth/invalid-email') {
         alert("Please enter a valid email address.");
       } else if (errorCode === 'auth/network-request-failed') {
         alert("Network error. Please check your internet connection and try again.");
       } else {
         alert(error.message || `An error occurred during ${mode}. Please try again.`);
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
                {mode === 'login' && (
                    <div className="text-right">
                        <button type="button" onClick={() => setMode('forgot')} className="text-sm font-bold text-orange-600 hover:text-orange-700">Forgot Password?</button>
                    </div>
                )}
                <button 
                    disabled={loading}
                    onClick={handleEmailAuth} 
                    className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading && <RefreshCcw className="h-4 w-4 animate-spin" />}
                    {mode === 'login' ? 'Login' : 'Sign Up'}
                </button>
                <button type="button" onClick={() => window.history.back()} className="w-full text-neutral-500 text-sm">Back</button>
            </div>
        )}

        {mode === 'forgot' && (
            <div className="text-left space-y-4">
                <h2 className="text-2xl font-black text-neutral-900">Reset Password</h2>
                <p className="text-sm text-neutral-500">
                    Enter your registered email address below, and we'll send you a secure link to reset your password.
                </p>
                <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-neutral-400" />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full border border-neutral-200 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                    />
                </div>
                <button 
                    disabled={loading}
                    onClick={handleForgotPassword} 
                    className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading && <RefreshCcw className="h-4 w-4 animate-spin" />}
                    Send password reset link
                </button>
                <button type="button" onClick={() => window.history.back()} className="w-full text-neutral-500 text-sm font-bold hover:text-orange-600">Back to Login</button>
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
