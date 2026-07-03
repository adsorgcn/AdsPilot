'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle, GlassCardDescription, type GlassCardProps } from '~/components/ui/GlassCard';
import { cn } from '~/core/generic/shadcn-utils';

interface MarketingGlassCardProps extends GlassCardProps {
  delay?: number;
  glow?: boolean;
  children: React.ReactNode;
}

export function MarketingGlassCard({ 
  children, 
  variant = 'default',
  hover = true,
  delay = 0,
  glow = false,
  className,
  ...props
}: MarketingGlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={cn(glow && 'animate-glow')}
    >
      <GlassCard variant={variant} hover={hover} className={className} {...props}>
        {/* Gradient overlay for extra depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent pointer-events-none" />
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </GlassCard>
    </motion.div>
  );
}

export { 
  GlassCardContent as MarketingGlassCardContent,
  GlassCardHeader as MarketingGlassCardHeader,
  GlassCardTitle as MarketingGlassCardTitle,
  GlassCardDescription as MarketingGlassCardDescription,
};