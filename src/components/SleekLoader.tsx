import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface SleekLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

const COMPLIANCE_TIPS = [
  "Securing your session under Central GST Law...",
  "Powering up local offline persistence...",
  "Verifying secure Firebase DB connections...",
  "Structuring digital Indian Tax Invoice models...",
  "Loading localized tables & POS parameters...",
  "Preparing responsive visual dashboard modules..."
];

export default function SleekLoader({ 
  message = "Loading", 
  subMessage, 
  fullScreen = true 
}: SleekLoaderProps) {
  const [tipIndex, setTipIndex] = useState(0);

  // Cycle through engaging, professional compliance-centric status sub-messages to reduce perceived waiting time
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % COMPLIANCE_TIPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center select-none font-sans max-w-sm mx-auto">
      {/* Dynamic Cinematic Loader Symbol */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Background Soft Pulse Glow */}
        <motion.div 
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute h-16 w-16 rounded-full bg-brand-primary/10 blur-xl"
        />

        {/* External High-tech Orbital Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "linear"
          }}
          className="h-16 w-16 rounded-full border-t-2 border-b-[0.5px] border-l-2 border-r-[0.5px] border-brand-primary"
        />

        {/* Counter-rotating Inner Precision Ring */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute h-10 w-10 rounded-full border-b-2 border-r-2 border-t-[0.5px] border-l-[0.5px] border-neutral-700/80"
        />

        {/* Central Core Pulse Indicator */}
        <motion.div 
          animate={{
            scale: [0.85, 1.1, 0.85],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute h-4 w-4 rounded-full bg-orange-600 shadow-sm"
        />
      </div>

      {/* Main Title Banner with Stretchy Slide Up */}
      <motion.h2 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-lg font-black text-neutral-900 tracking-tight lowercase first-letter:uppercase flex items-center gap-2"
      >
        <span>{message}</span>
        <motion.span 
          animate={{ opacity: [1, 0.3, 1] }} 
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-orange-600 font-extrabold"
        >
          ...
        </motion.span>
      </motion.h2>

      {/* Animated Rotating Smart Sub-text tips to entertain the user while loading */}
      <div className="h-10 mt-2 overflow-hidden flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          <motion.p 
            key={tipIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="text-xs text-neutral-500 font-semibold tracking-wide"
          >
            {subMessage || COMPLIANCE_TIPS[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Modern thin static-duration progress line indicator */}
      <div className="w-36 h-[3px] bg-neutral-200/60 rounded-full overflow-hidden mt-2 relative">
        <motion.div 
          initial={{ left: "-100%" }}
          animate={{ left: "100%" }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-orange-500 to-transparent"
        />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
        {content}
      </div>
    );
  }

  return content;
}
