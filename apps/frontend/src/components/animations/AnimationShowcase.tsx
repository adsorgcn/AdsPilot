'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import TiltCard from './TiltCard';
import RippleButton from './RippleButton';
import AnimatedCounter from './AnimatedCounter';
import { MarketingGlassCard, MarketingGlassCardContent } from '~/components/marketing';
import { MultiLayerParallax } from './ParallaxSection';

const AnimationShowcase: React.FC = () => {
  const [counterValue, setCounterValue] = useState(0);

  const showcaseData = [
    {
      title: '3D倾斜效果',
      description: '鼠标悬停时卡片会产生3D倾斜效果，带有光泽和阴影',
      animation: 'tilt',
    },
    {
      title: '按钮波纹效果',
      description: '点击按钮时产生Material Design风格的波纹效果',
      animation: 'ripple',
    },
    {
      title: '数字滚动动画',
      description: '数字会以多种动画方式滚动到目标值',
      animation: 'counter',
    },
    {
      title: '视差滚动',
      description: '不同层次的内容以不同速度滚动，创造深度感',
      animation: 'parallax',
    },
  ];

  const parallaxLayers = [
    {
      component: (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-3xl" />
      ),
      speed: 0.2,
      direction: 'up' as const,
    },
    {
      component: (
        <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-pink-400/30 to-orange-400/30 rounded-full blur-2xl" />
      ),
      speed: 0.5,
      direction: 'left' as const,
    },
    {
      component: (
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-gradient-to-br from-green-400/30 to-blue-400/30 rounded-full blur-2xl" />
      ),
      speed: 0.3,
      direction: 'right' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section with Parallax */}
      <section className="relative py-32 overflow-hidden">
        <MultiLayerParallax
          layers={parallaxLayers}
          className="absolute inset-0"
        >
          <div className="relative z-10 text-center">
            <motion.h1
              className="text-6xl font-bold text-gradient-primary mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              微交互动画展示
            </motion.h1>

            <motion.p
              className="text-xl text-muted-foreground max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              体验Google-Monetize的现代化交互动画效果，包括3D倾斜、波纹效果、数字动画和视差滚动
            </motion.p>
          </div>
        </MultiLayerParallax>
      </section>

      {/* 3D Tilt Cards Section */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            className="text-4xl font-bold text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            3D倾斜卡片
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {showcaseData.slice(0, 3).map((item) => (
              <TiltCard
                key={item.title}
                tiltStrength={15}
                scaleOnHover={1.05}
                glareEffect={true}
              >
                <MarketingGlassCard variant="gradient">
                  <MarketingGlassCardContent className="p-8">
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                        <span className="text-2xl">✨</span>
                      </div>
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </MarketingGlassCardContent>
                </MarketingGlassCard>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* Ripple Buttons Section */}
      <section className="py-20 px-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-4xl font-bold text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            波纹按钮
          </motion.h2>

          <div className="flex flex-wrap justify-center gap-4">
            <RippleButton variant="default" size="lg">
              主要按钮
            </RippleButton>

            <RippleButton variant="outline" size="lg">
              次要按钮
            </RippleButton>

            <RippleButton variant="secondary" size="lg">
              次要按钮
            </RippleButton>

            <RippleButton variant="ghost" size="lg">
              幽灵按钮
            </RippleButton>

            <RippleButton variant="destructive" size="lg">
              危险按钮
            </RippleButton>
          </div>
        </div>
      </section>

      {/* Animated Counters Section */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            className="text-4xl font-bold text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            数字动画
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <AnimatedCounter
                value={1234}
                duration={2000}
                animationType="count"
                className="text-4xl font-bold text-primary mb-2"
              />
              <p className="text-muted-foreground">计数动画</p>
            </div>

            <div className="text-center">
              <AnimatedCounter
                value={98.7}
                duration={2500}
                animationType="slide"
                decimals={1}
                suffix="%"
                className="text-4xl font-bold text-green-600 mb-2"
              />
              <p className="text-muted-foreground">滑动动画</p>
            </div>

            <div className="text-center">
              <AnimatedCounter
                value={2024}
                duration={3000}
                animationType="flip"
                className="text-4xl font-bold text-blue-600 mb-2"
              />
              <p className="text-muted-foreground">翻转动画</p>
            </div>

            <div className="text-center">
              <AnimatedCounter
                value={42}
                duration={2800}
                animationType="typewriter"
                suffix="天"
                className="text-4xl font-bold text-purple-600 mb-2"
              />
              <p className="text-muted-foreground">打字机动画</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-20 px-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-4xl font-bold text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            交互演示
          </motion.h2>

          <div className="text-center space-y-8">
            <div className="flex justify-center gap-4">
              <RippleButton
                onClick={() => setCounterValue(prev => prev + 100)}
                variant="default"
                size="lg"
              >
                增加 100
              </RippleButton>

              <RippleButton
                onClick={() => setCounterValue(prev => Math.max(0, prev - 100))}
                variant="outline"
                size="lg"
              >
                减少 100
              </RippleButton>

              <RippleButton
                onClick={() => setCounterValue(Math.floor(Math.random() * 9999))}
                variant="secondary"
                size="lg"
              >
                随机数字
              </RippleButton>
            </div>

            <TiltCard tiltStrength={20} scaleOnHover={1.1}>
              <MarketingGlassCard variant="gradient" className="p-12">
                <div className="text-center">
                  <AnimatedCounter
                    value={counterValue}
                    duration={1500}
                    animationType="slide"
                    className="text-6xl font-bold text-gradient-primary mb-4"
                  />
                  <p className="text-xl text-muted-foreground">当前值</p>
                </div>
              </MarketingGlassCard>
            </TiltCard>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AnimationShowcase;