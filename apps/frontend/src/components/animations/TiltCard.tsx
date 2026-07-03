'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltStrength?: number;
  scaleOnHover?: number;
  glareEffect?: boolean;
  disabled?: boolean;
}

const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  tiltStrength = 15,
  scaleOnHover = 1.05,
  glareEffect = true,
  disabled = false,
}) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -tiltStrength;
    const tiltY = ((x - centerX) / centerX) * tiltStrength;

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    if (!disabled) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative transform-gpu transition-transform duration-200 ease-out',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
          scale: isHovered && !disabled ? scaleOnHover : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
          mass: 0.8,
        }}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 主要内容 */}
        <div className="relative z-10">
          {children}
        </div>

        {/* 光泽效果 */}
        {glareEffect && !disabled && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{
              opacity: isHovered ? 1 : 0,
            }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(
                  circle at ${50 + tilt.y * 2}% ${50 - tilt.x * 2}%,
                  rgba(255, 255, 255, 0.4) 0%,
                  transparent 50%
                )`,
                transform: `translate(-${tilt.y}px, ${tilt.x}px)`,
              }}
            />
          </motion.div>
        )}

        {/* 阴影效果 */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-lg"
          animate={{
            boxShadow: isHovered && !disabled
              ? `0 ${20 + Math.abs(tilt.x)}px ${40 + Math.abs(tilt.y)}px rgba(0, 0, 0, 0.15)`
              : '0 4px 6px rgba(0, 0, 0, 0.07)',
          }}
          transition={{
            duration: 0.3,
            ease: 'easeOut',
          }}
          style={{
            transform: 'translateZ(-20px)',
          }}
        />
      </motion.div>
    </div>
  );
};

export default TiltCard;