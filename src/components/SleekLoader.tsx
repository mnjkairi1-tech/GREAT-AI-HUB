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
      <motion.div 
        animate={{ 
          y: [-8, 8, -8],
          rotate: [-2, 2, -2]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="text-6xl mb-6 drop-shadow-md"
      >
        ✨
      </motion.div>

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
