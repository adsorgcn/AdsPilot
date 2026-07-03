'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export interface PageTransitionProps {
  children: React.ReactNode;
  /**
   * Transition variant
   */
  variant?: 'fade' | 'slide' | 'scale' | 'none';
  /**
   * Additional CSS classes
   */
  className?: string;
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

/**
 * PageTransition - Smooth page transition animations
 * 
 * Wraps page content with enter/exit animations for better UX.
 * Automatically detects route changes using Next.js pathname.
 */
export function PageTransition({
  children,
  variant = 'fade',
  className,
}: PageTransitionProps) {
  const pathname = usePathname();
  const selectedVariant = variants[variant];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={selectedVariant.initial}
        animate={selectedVariant.animate}
        exit={selectedVariant.exit}
        transition={{
          duration: 0.3,
          ease: 'easeInOut',
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * FadeIn - Simple fade-in animation wrapper
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SlideIn - Slide-in animation from specified direction
 */
export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.4,
  className,
}: {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const directionMap = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, type: 'spring', stiffness: 100 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleIn - Scale-in animation
 */
export function ScaleIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, type: 'spring', stiffness: 200 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger - Stagger animation for list items
 */
export function Stagger({
  children,
  staggerDelay = 0.1,
  className,
}: {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Individual item in a stagger animation
 */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ type: 'spring', stiffness: 100 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}