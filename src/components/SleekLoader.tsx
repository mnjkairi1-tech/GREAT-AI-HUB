import { motion } from 'motion/react';

interface SleekLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export default function SleekLoader({ 
  message = "Loading...", 
  subMessage, 
  fullScreen = true 
}: SleekLoaderProps) {
  
  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center select-none font-sans">
      
      {/* Sleek Floating Emoji */}
      <div className="relative mb-8 mt-4">
        <motion.div 
          animate={{ 
            y: [-15, 0, -15],
            rotate: [-2, 2, -2]
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="text-7xl relative z-10 drop-shadow-xl"
        >
          🍔
        </motion.div>
        
        {/* Bouncing Shadow */}
        <motion.div 
          animate={{ 
            scale: [0.6, 1, 0.6],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-12 h-3 bg-neutral-300 rounded-full mx-auto mt-2 blur-[2px]"
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
              backgroundColor: ["#fb923c", "#ea580c", "#fb923c"]
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2
            }}
            className="h-2.5 w-2.5 rounded-full bg-orange-400"
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
