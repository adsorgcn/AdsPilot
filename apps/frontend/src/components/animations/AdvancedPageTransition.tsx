'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type TransitionType = 'fade' | 'slide' | 'scale' | 'flip' | 'morph';

interface AdvancedPageTransitionProps {
  children: React.ReactNode;
  type?: TransitionType;
  duration?: number;
  className?: string;
  enableLoadingIndicator?: boolean;
}

const transitionVariants = {
  fade: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 100 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -100 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 1.1 },
  },
  flip: {
    initial: { opacity: 0, rotateY: 90 },
    in: { opacity: 1, rotateY: 0 },
    out: { opacity: 0, rotateY: -90 },
  },
  morph: {
    initial: {
      opacity: 0,
      scale: 0.8,
      borderRadius: '50%',
      filter: 'blur(10px)'
    },
    in: {
      opacity: 1,
      scale: 1,
      borderRadius: '0%',
      filter: 'blur(0px)'
    },
    out: {
      opacity: 0,
      scale: 1.2,
      borderRadius: '50%',
      filter: 'blur(10px)'
    },
  },
};

const LoadingDots = () => (
  <motion.div
    className="flex gap-2"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.6, 1, 0.6],
          y: [0, -4, 0]
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          delay: i * 0.1,
          ease: 'easeInOut'
        }}
      />
    ))}
  </motion.div>
);

const LoadingBar = () => (
  <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200 dark:bg-gray-800">
    <motion.div
      className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
      initial={{ x: '-100%' }}
      animate={{ x: '0%' }}
      transition={{
        duration: 0.8,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'loop'
      }}
    />
  </div>
);

const AdvancedPageTransition: React.FC<AdvancedPageTransitionProps> = ({
  children,
  type = 'fade',
  duration = 0.4,
  className = '',
  enableLoadingIndicator = true,
}) => {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), duration * 1000);
    return () => clearTimeout(timer);
  }, [pathname, duration, isClient]);

  const currentVariant = transitionVariants[type];

  if (!isClient) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      {enableLoadingIndicator && isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <motion.div
            className="text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LoadingDots />
            <motion.p
              className="mt-4 text-sm text-gray-600 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              加载中...
            </motion.p>
          </motion.div>
        </div>
      )}

      {enableLoadingIndicator && (
        <LoadingBar />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial="initial"
          animate="in"
          exit="out"
          variants={currentVariant}
          transition={{
            type: 'tween',
            ease: 'anticipate',
            duration,
          }}
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default AdvancedPageTransition;
export { AdvancedPageTransition };