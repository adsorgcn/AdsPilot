'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  animationType?: 'count' | 'slide' | 'flip' | 'typewriter';
  ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  onComplete?: () => void;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 2000,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0,
  animationType = 'count',
  ease = 'easeOut',
  onComplete,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<number>(0);

  const easeFunctions = {
    linear: (t: number) => t,
    easeIn: (t: number) => t * t,
    easeOut: (t: number) => t * (2 - t),
    easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  };

  useEffect(() => {
    if (previousValue.current === value) return;

    setIsAnimating(true);
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = Date.now();
    const easeFunction = easeFunctions[ease];

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeFunction(progress);

      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        previousValue.current = value;
        onComplete?.();
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, ease, onComplete]);

  const formatNumber = (num: number) => {
    return num.toFixed(decimals);
  };

  const renderCountAnimation = () => (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {formatNumber(displayValue)}
      {suffix}
    </span>
  );

  const renderSlideAnimation = () => {
    const digits = formatNumber(Math.abs(displayValue)).split('');
    const targetDigits = formatNumber(Math.abs(value)).split('');

    // 确保两个数组长度相同
    while (digits.length < targetDigits.length) {
      digits.unshift('0');
    }
    while (targetDigits.length < digits.length) {
      targetDigits.unshift('0');
    }

    return (
      <span className={cn('inline-flex items-center tabular-nums', className)}>
        {prefix}
        {digits.map((digit, index) => (
          <div key={index} className="relative overflow-hidden" style={{ height: '1.2em' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${digit}-${index}`}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {digit}
              </motion.div>
            </AnimatePresence>
          </div>
        ))}
        {suffix}
      </span>
    );
  };

  const renderFlipAnimation = () => {
    const formattedValue = formatNumber(displayValue);

    return (
      <span className={cn('relative inline-block tabular-nums', className)}>
        {prefix}
        <motion.div
          key={formattedValue}
          className="origin-center"
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 300, damping: 30 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {formattedValue}
        </motion.div>
        {suffix}
      </span>
    );
  };

  const TypewriterAnimation = () => {
    const [text, setText] = useState('');
    const fullText = prefix + formatNumber(displayValue) + suffix;

    useEffect(() => {
      if (previousValue.current === value) return;

      let currentIndex = 0;
      setText('');

      const interval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsAnimating(false);
          onComplete?.();
        }
      }, duration / fullText.length / 10);

      return () => clearInterval(interval);
    }, [fullText]);

    return (
      <span className={cn('tabular-nums', className)}>
        {text}
        {isAnimating && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-current ml-1"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </span>
    );
  };

  switch (animationType) {
    case 'slide':
      return renderSlideAnimation();
    case 'flip':
      return renderFlipAnimation();
    case 'typewriter':
      return <TypewriterAnimation />;
    default:
      return renderCountAnimation();
  }
};

// 高级计数器组件，支持分段动画
export const AdvancedCounter: React.FC<AnimatedCounterProps & {
  segments?: Array<{ value: number; label: string; color?: string }>;
}> = ({ segments, ...props }) => {
  if (!segments || segments.length === 0) {
    return <AnimatedCounter {...props} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {segments.map((segment, index) => (
        <motion.div
          key={index}
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <AnimatedCounter
            {...props}
            value={segment.value}
            className={cn(
              'text-2xl font-bold',
              segment.color || 'text-primary',
              props.className
            )}
            duration={props.duration ? props.duration * (index + 1) / segments.length : 2000}
          />
          <span className="text-sm text-muted-foreground">{segment.label}</span>
        </motion.div>
      ))}
    </div>
  );
};

export default AnimatedCounter;