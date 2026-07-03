'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { EvaluationResultCard, type EvaluationResultCardProps } from './EvaluationResultCard';

export interface AnimatedEvaluationCardProps extends EvaluationResultCardProps {
  /**
   * Whether to show the 3D flip animation
   */
  animate?: boolean;
  /**
   * Delay before showing the card (in seconds)
   */
  delay?: number;
}

/**
 * AnimatedEvaluationCard - Enhanced evaluation card with 3D flip animation
 * 
 * This component wraps EvaluationResultCard with a stunning 3D flip effect
 * that creates a "card reveal" experience when evaluation completes.
 */
export function AnimatedEvaluationCard({
  animate = true,
  delay = 0,
  ...props
}: AnimatedEvaluationCardProps) {
  if (!animate) {
    return <EvaluationResultCard {...props} />;
  }

  return (
    <motion.div
      initial={{ 
        rotateY: 180, 
        opacity: 0,
        scale: 0.8,
      }}
      animate={{ 
        rotateY: 0, 
        opacity: 1,
        scale: 1,
      }}
      transition={{ 
        duration: 0.8,
        delay,
        type: 'spring',
        stiffness: 100,
        damping: 15,
      }}
      style={{ 
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      <EvaluationResultCard {...props} />
    </motion.div>
  );
}