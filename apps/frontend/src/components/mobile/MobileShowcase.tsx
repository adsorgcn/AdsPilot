'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  HeartIcon,
  ChatBubbleLeftRightIcon,
  ShareIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  BellIcon,
  UserIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
  BookmarkIcon as BookmarkSolidIcon,
} from '@heroicons/react/24/solid';

import BottomNavigation, { FloatingActionButton, SwipeHint } from './BottomNavigation';
import GestureHandler from './GestureHandler';
import MobileCard, { MobileListItem, MobileTabs, MobileDrawer } from './MobileCard';
import {
  TouchFeedback,
  TouchSwitch,
  TouchSlider,
  PullToRefresh,
  TouchStack,
} from './TouchInteraction';

const MobileShowcase: React.FC = () => {
  const [switchValue, setSwitchValue] = useState(false);
  const [sliderValue, setSliderValue] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<number>>(new Set());
  const [swipeHintVisible, setSwipeHintVisible] = useState(true);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRefreshing(false);
  };

  const toggleLike = (id: number) => {
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleBookmark = (id: number) => {
    setBookmarkedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const sampleCards = [
    {
      id: '1',
      content: (
        <div className="p-6 h-full flex flex-col justify-center items-center text-center">
          <h3 className="text-xl font-bold mb-4">探索新功能</h3>
          <p className="text-gray-600 dark:text-gray-400">
            向左或向右滑动卡片来体验手势交互
          </p>
          <div className="flex gap-4 mt-6">
            <span className="text-sm text-gray-500">← 喜欢</span>
            <span className="text-sm text-gray-500">跳过 →</span>
          </div>
        </div>
      ),
      onSwipe: (direction: 'left' | 'right') => {
        console.log('Card swiped:', direction);
      },
    },
    {
      id: '2',
      content: (
        <div className="p-6 h-full flex flex-col justify-center items-center text-center">
          <h3 className="text-xl font-bold mb-4">移动端优化</h3>
          <p className="text-gray-600 dark:text-gray-400">
            所有组件都针对触摸操作进行了优化
          </p>
        </div>
      ),
      onSwipe: (direction: 'left' | 'right') => {
        console.log('Card swiped:', direction);
      },
    },
    {
      id: '3',
      content: (
        <div className="p-6 h-full flex flex-col justify-center items-center text-center">
          <h3 className="text-xl font-bold mb-4">流畅动画</h3>
          <p className="text-gray-600 dark:text-gray-400">
            享受60fps的流畅动画体验
          </p>
        </div>
      ),
      onSwipe: (direction: 'left' | 'right') => {
        console.log('Card swiped:', direction);
      },
    },
  ];

  const feedItems = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    title: `动态项目 ${i + 1}`,
    subtitle: `这是第 ${i + 1} 个动态的描述内容`,
    time: `${i + 1}小时前`,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* 手势提示 */}
      <SwipeHint
        visible={swipeHintVisible}
        direction="up"
        className="top-20"
      />

      {/* 主要内容 */}
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="px-4 py-6 space-y-6">
          {/* 欢迎区域 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold text-gradient-primary mb-2">
              移动端体验
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              体验专为移动设备优化的交互设计
            </p>
          </motion.div>

          {/* 快捷操作 */}
          <div className="grid grid-cols-2 gap-4">
            <TouchFeedback onPress={() => setDrawerOpen(true)}>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center shadow-sm">
                <Cog6ToothIcon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">设置</span>
              </div>
            </TouchFeedback>

            <TouchFeedback onPress={() => setSwipeHintVisible(false)}>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl text-center shadow-sm">
                <BellIcon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">通知</span>
              </div>
            </TouchFeedback>
          </div>

          {/* 控件演示 */}
          <MobileCard title="交互控件">
            <div className="space-y-4">
              {/* 开关 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">推送通知</span>
                <TouchSwitch
                  checked={switchValue}
                  onChange={setSwitchValue}
                />
              </div>

              {/* 滑块 */}
              <div>
                <label className="text-sm font-medium mb-2 block">音量调节</label>
                <TouchSlider
                  value={sliderValue}
                  onChange={setSliderValue}
                  max={100}
                  showValue
                />
              </div>
            </div>
          </MobileCard>

          {/* 标签页演示 */}
          <MobileCard title="标签页内容">
            <MobileTabs
              tabs={[
                {
                  id: 'trending',
                  label: '热门',
                  content: (
                    <div className="space-y-3">
                      {feedItems.slice(0, 3).map((item) => (
                        <MobileListItem
                          key={item.id}
                          leading={
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-primary font-semibold">
                                {item.id}
                              </span>
                            </div>
                          }
                          trailing={
                            <TouchFeedback onPress={() => toggleLike(item.id)}>
                              {likedItems.has(item.id) ? (
                                <HeartSolidIcon className="h-5 w-5 text-red-500" />
                              ) : (
                                <HeartIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </TouchFeedback>
                          }
                        >
                          <div className="text-left">
                            <h4 className="font-medium text-sm">{item.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.subtitle}
                            </p>
                          </div>
                        </MobileListItem>
                      ))}
                    </div>
                  ),
                },
                {
                  id: 'latest',
                  label: '最新',
                  badge: 2,
                  content: (
                    <div className="space-y-3">
                      {feedItems.slice(2, 5).map((item) => (
                        <MobileListItem
                          key={item.id}
                          leading={
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                新
                              </span>
                            </div>
                          }
                          trailing={
                            <TouchFeedback onPress={() => toggleBookmark(item.id)}>
                              {bookmarkedItems.has(item.id) ? (
                                <BookmarkSolidIcon className="h-5 w-5 text-yellow-500" />
                              ) : (
                                <BookmarkIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </TouchFeedback>
                          }
                        >
                          <div className="text-left">
                            <h4 className="font-medium text-sm">{item.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.time}
                            </p>
                          </div>
                        </MobileListItem>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </MobileCard>

          {/* 手势卡片堆叠 */}
          <MobileCard title="手势卡片 (滑动切换)">
            <div className="h-96">
              <GestureHandler
                onSwipe={(direction) => {
                  console.log(' swipe detected:', direction);
                }}
              >
                <TouchStack cards={sampleCards} />
              </GestureHandler>
            </div>
          </MobileCard>

          {/* 可展开卡片 */}
          <MobileCard
            title="可展开内容"
            expandable
            expanded={false}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              这是卡片的基础内容，点击展开按钮可以查看更多内容。
            </p>

            <div className="hidden-expanded-content">
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  这是展开后显示的额外内容。可以包含更详细的信息、操作按钮等。
                </p>
                <div className="flex gap-2">
                  <TouchFeedback>
                    <div className="px-3 py-1 bg-primary text-white text-sm rounded-lg">
                      操作 1
                    </div>
                  </TouchFeedback>
                  <TouchFeedback>
                    <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-sm rounded-lg">
                      操作 2
                    </div>
                  </TouchFeedback>
                </div>
              </div>
            </div>
          </MobileCard>
        </div>
      </PullToRefresh>

      {/* 底部导航 */}
      <BottomNavigation
        items={[
          {
            id: 'home',
            label: '首页',
            href: '/',
            icon: HomeIcon,
            activeIcon: HomeIcon,
          },
          {
            id: 'explore',
            label: '发现',
            href: '/explore',
            icon: HeartIcon,
            activeIcon: HeartSolidIcon,
          },
          {
            id: 'create',
            label: '创建',
            href: '/create',
            icon: ChatBubbleLeftRightIcon,
            activeIcon: ChatBubbleLeftRightIcon,
          },
          {
            id: 'profile',
            label: '我的',
            href: '/profile',
            icon: UserIcon,
            activeIcon: UserIcon,
            badge: 3,
          },
        ]}
      />

      {/* 浮动操作按钮 */}
      <FloatingActionButton
        position="bottom-right"
        onClick={() => {
          console.log('FAB clicked');
        }}
      >
        <ShareIcon className="h-6 w-6" />
      </FloatingActionButton>

      {/* 底部抽屉 */}
      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="设置面板"
        position="bottom"
        height="60vh"
      >
        <div className="space-y-4">
          <MobileListItem
            leading={<Cog6ToothIcon className="h-5 w-5" />}
          >
            <span>通用设置</span>
          </MobileListItem>
          <MobileListItem
            leading={<BellIcon className="h-5 w-5" />}
          >
            <span>通知设置</span>
          </MobileListItem>
          <MobileListItem
            leading={<UserIcon className="h-5 w-5" />}
          >
            <span>账户设置</span>
          </MobileListItem>
          <MobileListItem
            leading={<HeartIcon className="h-5 w-5" />}
          >
            <span>隐私设置</span>
          </MobileListItem>
        </div>
      </MobileDrawer>
    </div>
  );
};

export default MobileShowcase;