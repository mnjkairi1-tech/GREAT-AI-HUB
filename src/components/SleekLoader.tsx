import { motion } from 'motion/react';
import { 
  Utensils, 
  Coffee, 
  Scissors, 
  Store, 
  MonitorSmartphone, 
  Shirt, 
  Dumbbell, 
  Stethoscope, 
  Car, 
  Building, 
  Video, 
  Loader2,
  PackageSearch
} from 'lucide-react';

interface SleekLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
  businessType?: string;
}

export default function SleekLoader({ 
  message = "Loading...", 
  subMessage, 
  fullScreen = true,
  businessType
}: SleekLoaderProps) {
  
  const renderIcon = () => {
    const type = (businessType || '').toLowerCase();
    const commonClasses = "w-16 h-16 drop-shadow-xl stroke-[1.5]";
    
    if (type.includes('restaurant') || type.includes('kitchen') || type.includes('dine')) 
      return <Utensils className={`${commonClasses} text-rose-500`} />;
    if (type.includes('fast') || type.includes('food') || type.includes('burger') || type.includes('cafe')) 
      return <Coffee className={`${commonClasses} text-amber-500`} />;
    if (type.includes('salon') || type.includes('spa') || type.includes('hair') || type.includes('beauty')) 
      return <Scissors className={`${commonClasses} text-emerald-500`} />;
    if (type.includes('cloth') || type.includes('fashion') || type.includes('apparel') || type.includes('boutique')) 
      return <Shirt className={`${commonClasses} text-pink-500`} />;
    if (type.includes('digital') || type.includes('tech') || type.includes('computer') || type.includes('mobile')) 
      return <MonitorSmartphone className={`${commonClasses} text-indigo-500`} />;
    if (type.includes('gym') || type.includes('fitness') || type.includes('sports')) 
      return <Dumbbell className={`${commonClasses} text-slate-800`} />;
    if (type.includes('health') || type.includes('clinic') || type.includes('doctor') || type.includes('medical')) 
      return <Stethoscope className={`${commonClasses} text-teal-500`} />;
    if (type.includes('auto') || type.includes('car') || type.includes('mechanic') || type.includes('garage')) 
      return <Car className={`${commonClasses} text-red-600`} />;
    if (type.includes('real estate') || type.includes('property') || type.includes('hotel')) 
      return <Building className={`${commonClasses} text-sky-600`} />;
    if (type.includes('video') || type.includes('studio') || type.includes('photo')) 
      return <Video className={`${commonClasses} text-purple-600`} />;
    if (type.includes('shop') || type.includes('store') || type.includes('retail') || type.includes('market')) 
      return <Store className={`${commonClasses} text-blue-500`} />;
    
    // Default professional icon if no match or generic
    if (businessType) return <PackageSearch className={`${commonClasses} text-blue-600`} />;
    
    return <Loader2 className={`${commonClasses} text-blue-600`} />;
  };

  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center select-none font-sans">
      
      {/* Dynamic Animated Icon */}
      <div className="relative mb-8 mt-4">
        {(!businessType || businessType === '') ? (
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="relative z-10 drop-shadow-xl"
          >
            {renderIcon()}
          </motion.div>
        ) : (
          <motion.div 
            animate={{ 
              y: [-10, 0, -10],
              scale: [0.95, 1.05, 0.95]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative z-10 drop-shadow-xl"
          >
            {renderIcon()}
          </motion.div>
        )}
        
        {/* Glowing Pulse Ring behind icon */}
        <motion.div
           animate={{
             scale: [0.8, 1.5],
             opacity: [0.5, 0]
           }}
           transition={{
             duration: 1.5,
             repeat: Infinity,
             ease: "easeOut"
           }}
           className="absolute inset-0 bg-blue-400/20 rounded-full blur-xl -z-10"
        />

        {/* Bouncing Shadow */}
        <motion.div 
          animate={{ 
            scale: [0.6, 1, 0.6],
            opacity: [0.1, 0.3, 0.1]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-14 h-3 bg-neutral-400 rounded-full mx-auto mt-4 blur-[3px]"
        />
      </div>

      <motion.h2 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-neutral-800 tracking-tight"
      >
        {message}
      </motion.h2>

      {subMessage && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-sm text-neutral-500 font-medium"
        >
          {subMessage}
        </motion.p>
      )}
      
      {/* Simple dots loader beneath */}
      <div className="mt-8 flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.3, 1, 0.3],
              backgroundColor: ["#94a3b8", "#3b82f6", "#94a3b8"]
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2
            }}
            className="h-2 w-2 rounded-full bg-slate-400"
          />
        ))}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
