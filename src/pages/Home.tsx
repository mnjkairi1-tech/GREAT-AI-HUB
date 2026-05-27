import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion } from 'motion/react';
import { Mail, Lock, RefreshCcw, LogIn, Key, Check } from 'lucide-react';
import { applyTheme } from '../themes';

export default function Home() {
  useEffect(() => {
    applyTheme('ai-atlas'); // Apply the pristine mint-teal theme immediately on mount
  }, []);

  const [loading, setLoading] = useState(true);
  const [mode, setModeRaw] = useState<'welcome' | 'login' | 'signup' | 'verify' | 'forgot'>('login');
  const [privacyAccepted, setPrivacyAccepted] = useState(true);

  const setMode = (newMode: 'welcome' | 'login' | 'signup' | 'verify' | 'forgot', replace = false) => {
    // We treat 'welcome' as 'login' to stay strictly inside the mockup toggle view
    const targetMode = newMode === 'welcome' ? 'login' : newMode;
    setModeRaw(targetMode);
    if (replace) {
      window.history.replaceState({ appMode: targetMode }, '');
    } else {
      window.history.pushState({ appMode: targetMode }, '');
    }
  };

  useEffect(() => {
    if (window.history.state === null || !window.history.state.appMode) {
      window.history.replaceState({ appMode: 'login' }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.appMode) {
        setModeRaw(event.state.appMode === 'welcome' ? 'login' : event.state.appMode);
      } else {
        setModeRaw('login');
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
        if (!u.emailVerified && u.providerData.some((p) => p.providerId === 'password')) {
          await u.reload();
          if (!auth.currentUser?.emailVerified) {
            setMode('verify', true);
            setLoading(false);
            return;
          }
        }
        
        // Skip redundant fetching of restaurants on Home. 
        // OwnerDashboard will fetch them and redirect to /setup if empty.
        navigate('/dashboard');
      } else {
        setMode('login', true);
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
    <div className="flex h-screen items-center justify-center bg-[#f4faf8]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0faf87] border-t-transparent" />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#f4faf8] text-center font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="max-w-[420px] w-full flex flex-col items-center"
      >
        {/* BRAND LOGO HEADER */}
        <div className="flex justify-center mb-1">
          <div className="relative flex items-center justify-center w-[84px] h-[84px] rounded-full bg-[#121614] shadow-[0_8px_24px_rgba(15,175,135,0.18)] ring-[8px] ring-[#0faf87]/5">
            {/* Concentric records ring styling */}
            <div className="absolute inset-[3px] rounded-full border border-neutral-800 flex items-center justify-center">
              {/* Inner white stylized outline circle */}
              <div className="absolute inset-[8px] rounded-full border-[1.5px] border-white/60 flex items-center justify-center">
                <div className="absolute inset-[6px] rounded-full border border-neutral-800 flex items-center justify-center">
                  {/* Glowing center core dot */}
                  <div className="w-[10px] h-[10px] rounded-full bg-white shadow-[0_0_12px_#ffffff]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-black tracking-normal text-[#123932] mt-4 mb-2">Smart QR System</h1>
        <p className="text-[10px] font-black tracking-[0.25em] text-[#5c887f] uppercase mb-4">Gateway to Smart Ordering</p>

        {/* MAIN CARD CONTAINER */}
        <div className="w-full bg-white p-7 rounded-[32px] shadow-[0_15px_45px_rgba(21,77,68,0.06)] border border-[#e8f5f1] text-left">
          
          {/* LOGIN / JOIN TOGGLE PILLS */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="flex bg-[#ecf5f2] rounded-[22px] p-1 mb-6 border border-[#e2f0eb]/60">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-grow py-3 text-center text-sm font-extrabold rounded-[18px] transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-white text-[#0faf87] shadow-[0_4px_12px_rgba(15,175,135,0.12)] font-black'
                    : 'text-[#7caea4] hover:text-[#0faf87]'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-grow py-3 text-center text-sm font-extrabold rounded-[18px] transition-all duration-200 ${
                  mode === 'signup'
                    ? 'bg-white text-[#0faf87] shadow-[0_4px_12px_rgba(15,175,135,0.12)] font-black'
                    : 'text-[#7caea4] hover:text-[#0faf87]'
                }`}
              >
                Join
              </button>
            </div>
          )}

          {/* LOGIN & SIGNUP VIEWS */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="space-y-5">
              
              {/* EMAIL FIELD */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-[#568c80] uppercase mb-2">
                  <Mail className="h-3.5 w-3.5 text-[#0faf87]" />
                  <span>Email</span>
                </div>
                <input
                  type="email"
                  placeholder="hello@atlas.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#f0f7f4] border border-[#e2f0ec] focus:border-[#0faf87] px-5 py-3.5 rounded-[18px] text-sm text-[#113a32] placeholder-[#8cb8ad] focus:outline-none transition-all duration-200"
                />
              </div>

              {/* PASSWORD FIELD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-[#568c80] uppercase">
                    <Lock className="h-3.5 w-3.5 text-[#0faf87]" />
                    <span>Password</span>
                  </div>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[10px] font-black text-[#0faf87] tracking-wider hover:underline"
                    >
                      FORGOT?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#f0f7f4] border border-[#e2f0ec] focus:border-[#0faf87] px-5 py-3.5 rounded-[18px] text-sm text-[#113a32] placeholder-[#8cb8ad] focus:outline-none transition-all duration-200"
                />
              </div>

              {/* ACTION BUTTON */}
              <button
                disabled={loading}
                onClick={handleEmailAuth}
                className="w-full bg-[#6be2be] hover:bg-[#59deb2] text-white font-extrabold text-[15px] py-4 rounded-[22px] shadow-[0_8px_24px_rgba(107,226,190,0.3)] flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4 stroke-[3]" />
                    <span>{mode === 'login' ? 'Login Now' : 'Join Now'}</span>
                  </>
                )}
              </button>

              {/* CUSTOM PRIVACY POLICY ACCEPTER */}
              <div 
                onClick={() => setPrivacyAccepted(!privacyAccepted)}
                className="flex items-center justify-center gap-2.5 mt-6 cursor-pointer select-none"
              >
                <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${privacyAccepted ? 'border-[#0faf87] bg-[#0faf87]' : 'border-[#b8dfd4] bg-white'}`}>
                  {privacyAccepted && <Check className="h-2.5 w-2.5 text-white stroke-[4.5]" />}
                </div>
                <span className="text-[11px] font-semibold text-[#568c80]">
                  I accept the <span className="font-extrabold text-[#0faf87] hover:underline">Privacy Policy</span> of Smart QR System.
                </span>
              </div>

            </div>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-[#113a32]">Reset Password</h2>
              <p className="text-xs text-[#568c80] leading-relaxed">
                Enter your registered email address below, and we'll send you a secure link to reset your password.
              </p>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-[#568c80] uppercase mb-2">
                  <Mail className="h-3.5 w-3.5 text-[#0faf87]" />
                  <span>Email Address</span>
                </div>
                <input 
                  type="email" 
                  placeholder="hello@atlas.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-[#f0f7f4] border border-[#e2f0ec] focus:border-[#0faf87] px-5 py-3.5 rounded-[18px] text-sm text-[#113a32] placeholder-[#8cb8ad] focus:outline-none transition-all duration-200" 
                />
              </div>
              <button 
                disabled={loading}
                onClick={handleForgotPassword} 
                className="w-full bg-[#6be2be] hover:bg-[#59deb2] text-white font-extrabold text-sm py-4 rounded-[20px] shadow-[0_8px_20px_rgba(107,226,190,0.2)] flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                {loading && <RefreshCcw className="h-4 w-4 animate-spin" />}
                Send password reset link
              </button>
              <button 
                type="button" 
                onClick={() => setMode('login')} 
                className="w-full text-center text-xs font-bold text-[#0faf87] uppercase tracking-wider pt-2 block hover:underline"
              >
                Back to Login
              </button>
            </div>
          )}

          {/* EMAIL VERIFICATION VIEW */}
          {mode === 'verify' && (
            <div className="text-center space-y-5 py-2">
              <h2 className="text-xl font-black text-[#113a32]">Verify your email</h2>
              <p className="text-[#568c80] text-xs leading-relaxed">
                 We've sent a verification link to <strong className="text-[#113a32]">{auth.currentUser?.email}</strong>. 
                 Please verify your email to continue.
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleCheckVerification} 
                  className="w-full bg-[#6be2be] hover:bg-[#59deb2] text-white font-extrabold text-sm py-3.5 rounded-[20px] flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(107,226,190,0.2)]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  I've verified my email
                </button>
                <button 
                  onClick={handleResendVerification} 
                  className="w-full bg-[#f0f7f4] text-[#0faf87] hover:bg-[#e2f0ec] font-extrabold text-sm py-3.5 rounded-[20px] transition-colors"
                >
                  Resend Link
                </button>
                <button 
                  onClick={handleLogout} 
                  className="w-full text-[#568c80] hover:text-red-500 font-bold text-xs uppercase tracking-wider pt-2"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

        </div>

        {/* QUICK CONNECT SEGMENT */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="w-full">
            <div className="relative flex py-2 items-center justify-center my-4 max-w-[420px] w-full">
              <div className="flex-grow border-t border-[#e2f0ec]"></div>
              <span className="flex-shrink mx-4 text-[9px] font-black tracking-[0.22em] text-[#81aba1] uppercase">Quick Connect</span>
              <div className="flex-grow border-t border-[#e2f0ec]"></div>
            </div>

            {/* GOOGLE CONNECT BUTTON */}
            <button
              onClick={handleGoogleLogin}
              className="max-w-[420px] w-full bg-white border border-[#eaf3f0] hover:border-[#bcf3e2] text-[#426e64] font-extrabold text-[13px] tracking-wide py-3.5 rounded-[22px] shadow-[0_4px_12px_rgba(21,77,68,0.02)] hover:shadow-[0_6px_16px_rgba(21,77,68,0.05)] hover:bg-[#FAFDFC] flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="h-[18px] w-[18px]" />
              <span>Google Account</span>
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
}
