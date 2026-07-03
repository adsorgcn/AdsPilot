'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { cn } from '~/lib/utils';

interface ParallaxLayer {
  component: React.ReactNode;
  speed: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface ParallaxLayerProps {
  layer: ParallaxLayer;
  scrollYProgress: MotionValue<number>;
  disabled: boolean;
  zIndex: number;
}

const ParallaxLayer: React.FC<ParallaxLayerProps> = ({ layer, scrollYProgress, disabled, zIndex }) => {
  const progress = useTransform(scrollYProgress, [0, 1], [0, layer.speed * 100]);
  const direction = layer.direction || 'up';

  // 预先创建所有可能的 transform
  const transformUp = useTransform(progress, (value) => `translateY(-${value}%)`);
  const transformDown = useTransform(progress, (value) => `translateY(${value}%)`);
  const transformLeft = useTransform(progress, (value) => `translateX(-${value}%)`);
  const transformRight = useTransform(progress, (value) => `translateX(${value}%)`);

  // 根据方向选择 transform
  const transform = direction === 'down' ? transformDown 
    : direction === 'left' ? transformLeft 
    : direction === 'right' ? transformRight 
    : transformUp;

  const springTransform = useSpring(transform, {
    stiffness: 100,
    damping: 20,
    mass: 1,
  });

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        transform: disabled ? 'none' : springTransform,
        zIndex,
      }}
    >
      {layer.component}
    </motion.div>
  );
};

interface ParallaxSectionProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  disabled?: boolean;
  springConfig?: {
    stiffness: number;
    damping: number;
    mass: number;
  };
}

const ParallaxSection: React.FC<ParallaxSectionProps> = ({
  children,
  className = '',
  speed = 0.5,
  offset = 0,
  direction = 'up',
  disabled = false,
  springConfig = {
    stiffness: 100,
    damping: 20,
    mass: 1,
  },
}) => {
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 根据方向计算变换
  const progress = useTransform(scrollYProgress, [0, 1], [offset, offset + speed * 100]);

  // 预先创建所有可能的 transform
  const transformUp = useTransform(progress, (value) => `translateY(-${value}%)`);
  const transformDown = useTransform(progress, (value) => `translateY(${value}%)`);
  const transformLeft = useTransform(progress, (value) => `translateX(-${value}%)`);
  const transformRight = useTransform(progress, (value) => `translateX(${value}%)`);

  // 根据方向选择 transform
  const transform = direction === 'down' ? transformDown 
    : direction === 'left' ? transformLeft 
    : direction === 'right' ? transformRight 
    : transformUp;

  const springTransform = useSpring(transform, springConfig);

  if (!isClient) {
    return (
      <div ref={containerRef} className={cn('relative', className)}>
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <motion.div
        style={{
          transform: disabled ? 'none' : springTransform,
        }}
        transition={{
          type: 'spring',
          ...springConfig,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// 视差背景组件
interface ParallaxBackgroundProps {
  children: React.ReactNode;
  backgroundImage: string;
  className?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  parallaxSpeed?: number;
  disabled?: boolean;
}

export const ParallaxBackground: React.FC<ParallaxBackgroundProps> = ({
  children,
  backgroundImage,
  className = '',
  overlayColor = 'rgba(0, 0, 0, 0.4)',
  overlayOpacity = 0.4,
  parallaxSpeed = 0.3,
  disabled = false,
}) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* 视差背景 */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          transform: disabled ? 'none' : `translateY(${scrollY * parallaxSpeed}px)`,
          willChange: 'transform',
        }}
      />

      {/* 叠加层 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
        }}
      />

      {/* 内容 */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

// 多层视差组件
interface MultiLayerParallaxProps {
  children: React.ReactNode;
  layers: Array<{
    component: React.ReactNode;
    speed: number;
    direction?: 'up' | 'down' | 'left' | 'right';
  }>;
  className?: string;
  disabled?: boolean;
}

export const MultiLayerParallax: React.FC<MultiLayerParallaxProps> = ({
  children,
  layers,
  className = '',
  disabled = false,
}) => {
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div ref={containerRef} className={cn('relative', className)}>
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* 视差层 */}
      {layers.map((layer, index) => (
        <ParallaxLayer
          key={index}
          layer={layer}
          scrollYProgress={scrollYProgress}
          disabled={disabled}
          zIndex={layers.length - index}
        />
      ))}

      {/* 主要内容 */}
      <div className="relative z-20">
        {children}
      </div>
    </div>
  );
};

export default ParallaxSection;