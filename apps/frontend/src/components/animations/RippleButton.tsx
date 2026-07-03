'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  rippleColor?: string;
  disabled?: boolean;
}

const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  className = '',
  variant = 'default',
  size = 'default',
  rippleColor,
  disabled = false,
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPressed, setIsPressed] = useState(false);

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple: Ripple = {
      x,
      y,
      size,
      id: Date.now(),
    };

    setRipples(prev => [...prev, newRipple]);

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    setIsPressed(true);
    createRipple(event);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  const getVariantStyles = () => {
    const baseStyles = 'relative overflow-hidden font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

    const variantStyles = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:ring-primary',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-primary',
      ghost: 'hover:bg-accent hover:text-accent-foreground focus:ring-primary',
      link: 'text-primary underline-offset-4 hover:underline focus:ring-primary',
    };

    const sizeStyles = {
      default: 'h-10 px-4 py-2 rounded-md',
      sm: 'h-9 px-3 rounded-md text-sm',
      lg: 'h-11 px-8 rounded-md text-lg',
      icon: 'h-10 w-10 rounded-md',
    };

    return cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      isPressed && 'scale-95',
      className
    );
  };

  const getRippleColor = () => {
    if (rippleColor) return rippleColor;

    const colors = {
      default: 'rgba(255, 255, 255, 0.3)',
      destructive: 'rgba(255, 255, 255, 0.3)',
      outline: 'rgba(0, 0, 0, 0.1)',
      secondary: 'rgba(0, 0, 0, 0.1)',
      ghost: 'rgba(0, 0, 0, 0.1)',
      link: 'rgba(0, 0, 0, 0.1)',
    };

    return colors[variant];
  };

  return (
    <motion.button
      ref={buttonRef}
      className={getVariantStyles()}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...(Object.fromEntries(
        Object.entries(props).filter(([key]) =>
          !['onDrag', 'onDragStart', 'onDragEnd'].includes(key)
        )
      ) as any)}
    >
      {/* 波纹效果容器 */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {ripples.map(ripple => (
            <motion.div
              key={ripple.id}
              className="absolute rounded-full"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: ripple.size,
                height: ripple.size,
                backgroundColor: getRippleColor(),
              }}
              initial={{
                scale: 0,
                opacity: 0.6,
              }}
              animate={{
                scale: 1,
                opacity: 0,
              }}
              exit={{
                scale: 1,
                opacity: 0,
              }}
              transition={{
                duration: 0.6,
                ease: 'easeOut',
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* 按钮内容 */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>

      {/* 悬停光环效果 */}
      <motion.div
        className="absolute inset-0 rounded-md opacity-0 hover:opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%)',
        }}
        whileHover={{ opacity: 0.3 }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
};

export default RippleButton;